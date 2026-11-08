import type { SupabaseClient } from '@supabase/supabase-js';
import { Upload } from 'tus-js-client';

const IMAGE_INPUT_LIMIT = 40 * 1024 * 1024;
const VIDEO_INPUT_LIMIT = 450 * 1024 * 1024;
const TUS_THRESHOLD = 6 * 1024 * 1024;
const TUS_CHUNK_SIZE = 6 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const VIDEO_TYPES = new Map([
  ['.mp4', 'video/mp4'],
  ['.m4v', 'video/mp4'],
  ['.webm', 'video/webm'],
  ['.mov', 'video/quicktime'],
]);

function fileStem(filename: string) {
  return filename.replace(/\.[^.]+$/, '').replace(/[^a-z0-9-_]+/gi, '-').replace(/^-+|-+$/g, '') || 'private-media';
}

/** Convert a still image to a resized WebP file. Orientation is read by the browser decoder. */
export async function convertImageToWebP(
  source: File,
  options: { maxDimension?: number; quality?: number; maxInputBytes?: number } = {},
): Promise<File> {
  const maxDimension = options.maxDimension ?? 2400;
  const quality = options.quality ?? 0.84;
  const maxInputBytes = options.maxInputBytes ?? IMAGE_INPUT_LIMIT;

  if (!IMAGE_TYPES.has(source.type)) {
    throw new Error('Choose a JPEG, PNG, WebP or AVIF still image. Animated GIFs and SVG files are not accepted.');
  }
  if (source.size > maxInputBytes) {
    throw new Error(`Choose an image smaller than ${Math.round(maxInputBytes / 1024 / 1024)} MB. It will be resized and compressed to WebP before upload.`);
  }
  if (typeof createImageBitmap !== 'function') {
    throw new Error('This browser cannot optimize images. Please use a recent version of Chrome, Edge, Firefox or Safari.');
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(source);
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 100_000_000) {
      throw new Error('This image is too large to process safely. Resize it before uploading.');
    }

    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) throw new Error('The browser could not prepare this image for WebP conversion.');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) resolve(result);
        else reject(new Error('WebP conversion failed. Please try another image.'));
      }, 'image/webp', quality);
    });

    return new File([blob], `${fileStem(source.name)}.webp`, {
      type: 'image/webp',
      lastModified: Date.now(),
    });
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error('This image could not be optimized. Please try a different file.');
  } finally {
    bitmap?.close();
  }
}


export type WatermarkPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'center';
export interface WatermarkSettings { enabled: boolean; text: string; position: WatermarkPosition; opacity: number; size: number; }
export const defaultWatermarkSettings: WatermarkSettings = { enabled: true, text: 'Atelier After Dark', position: 'bottom-right', opacity: 0.62, size: 0.035 };

/** Burns a text watermark into a still image before it is uploaded. */
export async function applyTextWatermark(source: File, settings: WatermarkSettings): Promise<File> {
  if (!settings.enabled || !settings.text.trim()) return source;
  const bitmap = await createImageBitmap(source);
  try {
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Could not prepare the watermark canvas.');
    ctx.drawImage(bitmap, 0, 0);
    const fontSize = Math.max(16, Math.round(Math.min(canvas.width, canvas.height) * Math.min(0.08, Math.max(0.018, settings.size))));
    const pad = Math.round(fontSize * 0.8); const label = settings.text.trim().slice(0, 60);
    ctx.font = `600 ${fontSize}px Georgia, serif`; ctx.textBaseline = 'middle';
    const width = ctx.measureText(label).width; let x = pad, y = canvas.height - pad;
    if (settings.position.includes('right')) x = canvas.width - width - pad;
    if (settings.position.includes('top')) y = pad + fontSize / 2;
    if (settings.position === 'center') { x = (canvas.width - width) / 2; y = canvas.height / 2; }
    ctx.save(); ctx.globalAlpha = Math.min(0.95, Math.max(0.15, settings.opacity));
    ctx.shadowColor = 'rgba(0,0,0,.65)'; ctx.shadowBlur = Math.max(3, fontSize * 0.18); ctx.fillStyle = '#ffffff';
    ctx.fillText(label, Math.max(pad, x), Math.max(fontSize / 2, Math.min(canvas.height - fontSize / 2, y))); ctx.restore();
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => b ? resolve(b) : reject(new Error('Could not encode the watermarked image.')), 'image/webp', 0.84));
    return new File([blob], `${source.name.replace(/\.[^.]+$/, '')}-watermarked.webp`, { type: 'image/webp', lastModified: Date.now() });
  } finally { bitmap.close(); }
}

/** Validate a browser-playable video without pretending that a still-image format can encode video. */
export function prepareVideoForStorage(source: File): File {
  if (source.size > VIDEO_INPUT_LIMIT) {
    throw new Error('Videos must be smaller than 450 MB. Export or compress the video as MP4 (H.264) before uploading.');
  }
  const extension = `.${source.name.split('.').pop()?.toLowerCase() || ''}`;
  const inferredType = VIDEO_TYPES.get(extension);
  if (!inferredType) {
    throw new Error('Choose an MP4, WebM or MOV video. MP4 encoded with H.264 is recommended for the widest browser support.');
  }
  if (source.type && source.type !== inferredType && !(extension === '.m4v' && source.type === 'video/x-m4v')) {
    throw new Error(`The file extension and video format do not match. Select a genuine ${extension.slice(1).toUpperCase()} file or export it as MP4 (H.264).`);
  }
  return source.type === inferredType ? source : new File([source], source.name, { type: inferredType, lastModified: source.lastModified });
}

/** Upload larger media with Supabase Storage's TUS endpoint and smaller files with the SDK. */
export async function uploadToPrivateStorage(
  client: SupabaseClient,
  bucket: string,
  path: string,
  file: File,
  onProgress?: (percentage: number) => void,
): Promise<void> {
  if (file.size <= TUS_THRESHOLD) {
    const { error } = await client.storage.from(bucket).upload(path, file, {
      upsert: false,
      contentType: file.type,
      cacheControl: '3600',
    });
    if (error) throw error;
    onProgress?.(100);
    return;
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) throw new Error('Supabase upload settings are missing from the frontend environment.');
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) throw new Error('Your sign-in session has expired. Sign in again before uploading.');

  const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
  const endpoint = `https://${projectRef}.storage.supabase.co/storage/v1/upload/resumable`;

  await new Promise<void>((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${sessionData.session!.access_token}`,
        apikey: anonKey,
        'x-upsert': 'false',
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: TUS_CHUNK_SIZE,
      metadata: {
        bucketName: bucket,
        objectName: path,
        contentType: file.type,
        cacheControl: '3600',
      },
      onError: (error) => reject(error),
      onProgress: (bytesUploaded, bytesTotal) => {
        onProgress?.(Math.min(100, Math.round((bytesUploaded / bytesTotal) * 100)));
      },
      onSuccess: () => {
        onProgress?.(100);
        resolve();
      },
    });

    upload.findPreviousUploads().then((previousUploads) => {
      if (previousUploads.length) upload.resumeFromPreviousUpload(previousUploads[0]);
      upload.start();
    }).catch(reject);
  });
}

export const mediaLimits = {
  imageInputBytes: IMAGE_INPUT_LIMIT,
  videoInputBytes: VIDEO_INPUT_LIMIT,
  resumableThresholdBytes: TUS_THRESHOLD,
};
