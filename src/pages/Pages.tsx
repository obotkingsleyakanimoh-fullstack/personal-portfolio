import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck, Bitcoin, Check, CheckCircle2,
  ChevronRight, CircleHelp, Clock3, Crown, Eye, EyeOff, Heart, Image as ImageIcon,
  LockKeyhole, LogIn, Mail, MessageCircle, MoreHorizontal, Play, Send, ShieldCheck,
  Sparkles, Star, UserRound, Video, Wallet, X, ImagePlus, Mic, Square, Phone, CalendarDays, Headphones,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { fallbackContent, fallbackPlans, useContent, usePlans } from '../lib/data';
import { formatCurrency, formatDate } from '../lib/utils';
import { isSupabaseConfigured, ownerName, ownerTagline, supabase } from '../lib/supabase';
import type { ContentItem, MembershipPlan, Profile } from '../lib/types';
import { convertImageToWebP, prepareVideoForStorage, uploadToPrivateStorage } from '../lib/media';

const portrait = import.meta.env.VITE_OWNER_PORTRAIT_URL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1400&q=82';
const widePortrait = import.meta.env.VITE_OWNER_HERO_IMAGE_URL || 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1800&q=82';
const featurePortrait = import.meta.env.VITE_OWNER_FEATURE_IMAGE_URL || portrait;

function SectionEyebrow({ children }: { children: ReactNode }) { return <div className="eyebrow"><span />{children}</div>; }
function SectionHeading({ eyebrow, title, description, align = 'left' }: { eyebrow: string; title: ReactNode; description?: string; align?: 'left' | 'center' }) {
  return <div className={`section-heading ${align === 'center' ? 'center' : ''}`}><SectionEyebrow>{eyebrow}</SectionEyebrow><h2>{title}</h2>{description && <p>{description}</p>}</div>;
}
function LockedMark({ label = 'Members only · 18+' }: { label?: string }) { return <span className="locked-mark"><LockKeyhole size={11} /> {label}</span>; }
function ContentCard({ item, index = 0 }: { item: ContentItem; index?: number }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState('');
  const locked = item.access_level !== 'public';
  const accessQuery = useQuery({
    queryKey: ['content-access', user?.id, item.id],
    enabled: Boolean(user && supabase && locked),
    queryFn: async () => {
      if (!supabase) return false;
      const { data, error } = await supabase.rpc('can_access_content', { content_uuid: item.id });
      if (error) throw error;
      return Boolean(data);
    },
    staleTime: 20_000,
  });
  const canView = !locked || accessQuery.data === true;
  const label = item.access_level === 'vip' ? 'VIP collection' : item.access_level === 'premium' ? 'Unlock separately' : 'Members only · 18+';
  const openContent = async () => {
    setOpenError('');
    if (!user && locked) { navigate({ to: '/login' }); return; }
    if (locked && !canView) { if (item.access_level === 'premium') navigate({ to: '/content-checkout/$contentId', params: { contentId: item.id } }); else navigate({ to: '/membership' }); return; }
    // The card preview is only a teaser. Always request the actual media through the access-checking function.
    // This avoids trying to play a WebP poster as a video and never exposes the private original URL.
    
    if (!supabase) { setOpenError('Connect Supabase to securely deliver the original media.'); return; }
    setOpening(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-content-url', { body: { contentId: item.id } });
      if (error || !data?.signedUrl) {
        setOpenError(error?.message || data?.error || 'I could not prepare this private item. Please try again.');
        return;
      }
      setMediaUrl(data.signedUrl);
    } catch {
      setOpenError('The secure media link could not be reached. Check your connection and try again.');
    } finally {
      setOpening(false);
    }
  };
  return <>
    <article className={`content-card ${index % 3 === 1 ? 'offset-card' : ''} ${locked && !canView ? 'locked-content-card' : ''}`}>
      <button type="button" onClick={openContent} className="content-image-wrap content-image-button" aria-label={`Open ${item.title}`}>
        {item.preview_url ? <img className={locked && !canView ? 'locked-preview' : ''} src={item.preview_url} alt={item.title} loading="lazy" decoding="async" /> : <div className="image-placeholder"><Sparkles /></div>}
        {item.content_type === 'video' && <span className="play-button"><Play size={16} fill="currentColor" /></span>}
        {locked && !canView && <><div className="content-image-lock"><LockKeyhole size={17} /></div><div className="locked-preview-overlay"><span>PRIVATE · 18+</span><strong>Unlock this private set</strong></div></>}
        {opening && <span className="content-opening">Opening securely…</span>}
        <span className="content-category">{item.category}</span>
      </button>
      <div className="content-card-body">
        <div><h3>{item.title}</h3><p>{item.description || 'A photograph from my personal collection.'}</p></div>
        {locked && !canView ? <LockedMark label={label} /> : <span className="open-label"><Eye size={12} /> {canView ? 'Open my collection' : 'View teaser'}</span>}
      </div>
      {openError && <p className="content-open-error">{openError}</p>}
      {locked && !canView && !user && <Link className="card-unlock-link" to="/login">Sign in for access <ArrowUpRight size={13} /></Link>}
      {locked && !canView && user && (item.access_level === 'premium' ? <Link className="card-unlock-link" to="/content-checkout/$contentId" params={{ contentId: item.id }}>Unlock this item <ArrowUpRight size={13} /></Link> : <Link className="card-unlock-link" to="/membership">Choose your access <ArrowUpRight size={13} /></Link>)}
    </article>
    {mediaUrl && <div className="media-lightbox" role="dialog" aria-modal="true" aria-label={item.title} onClick={() => setMediaUrl(null)}><button className="lightbox-close" onClick={() => setMediaUrl(null)} aria-label="Close media"><X/></button><div className="lightbox-content" onClick={(e) => e.stopPropagation()}>{item.content_type === 'video' ? <video src={mediaUrl} poster={item.preview_url || undefined} controls autoPlay playsInline preload="metadata" /> : <img src={mediaUrl} alt={item.title} />}</div><div className="lightbox-caption"><strong>{item.title}</strong><span>Private viewing · Please respect the owner's content</span></div></div>}
  </>;
}

export function HomePage() {
  const { data: content = fallbackContent } = useContent();
  const featured = content.slice(0, 3);
  return (
    <>
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-kicker"><span className="kicker-line" /> A PERSONAL INVITATION · ADULTS 18+</div>
          <h1>A little more of me,<br /><em>after dark.</em></h1>
          <p className="hero-description">{ownerTagline}</p>
          <div className="hero-actions"><Link to="/about" className="button button-cream">Discover my story <ArrowUpRight size={15} /></Link><Link to="/membership" className="hero-text-link">Explore my private collection <ArrowRight size={15} /></Link></div>
          <div className="hero-note"><span className="hero-note-icon"><Heart size={14} /></span><span>One person. One personal collection. Every intimate image shared with consent.</span></div>
        </div>
        <div className="hero-image-panel">
          <img src={widePortrait} alt={`Portrait of ${ownerName}`} fetchPriority="high" decoding="async" />
          <div className="hero-image-shade" />
          <div className="hero-image-caption"><span>A CLOSER LOOK AT ME</span><strong>A side of me I choose to share.</strong></div>
          <div className="hero-image-index">01 <span>/</span> 04</div>
        </div>
        <div className="hero-vertical-note">MY PERSONAL EDITION <span>✦</span> SENSUAL · PRIVATE · 18+</div>
        <div className="hero-bottom-rule"><span>SCROLL TO EXPLORE</span><ArrowDown size={14} /><span className="hero-bottom-right">01 — MY WORLD</span></div>
      </section>

      <section className="intro-section section-pad">
        <div className="intro-portrait-wrap"><img src={portrait} alt={`A personal portrait of ${ownerName}`} loading="lazy" decoding="async" /><div className="intro-caption"><span>A FIRST IMPRESSION</span><span>01 / 03</span></div></div>
        <div className="intro-copy"><SectionEyebrow>THE PERSON BEHIND THE COLLECTION</SectionEyebrow><h2>Confidence looks good<br />with a little <em>mystery.</em></h2><p className="intro-lead">For me, sensuality begins with confidence and the freedom to choose how I am seen. This is where I share intimate portraits, artistic nude photography, boudoir sets and more of the person behind the camera.</p><p className="muted-copy">Explore my boudoir portraits, nude art, private photo sets, erotic films and one-to-one conversations with me. Every collection is personal, deliberately shared and intended for adults who respect consent, privacy and boundaries.</p><Link to="/about" className="underlined-link">Read my story <ArrowUpRight size={15} /></Link><div className="signature">With affection, <span>— {ownerName}</span></div></div>
      </section>

      <section className="collection-section section-pad">
        <div className="collection-top"><SectionHeading eyebrow="THE COLLECTION" title={<>A glimpse behind the <em>velvet curtain.</em></>} description="A first look at selected moments from my collection. Full boudoir sets, artistic nudes and complete original galleries are reserved for members." /><Link to="/gallery" className="underlined-link collection-view-link">Explore every set <ArrowUpRight size={15} /></Link></div>
        <div className="content-grid home-content-grid">{featured.map((item, i) => <ContentCard key={item.id} item={item} index={i} />)}</div>
      </section>

      <section className="membership-feature">
        <div className="membership-feature-image"><img src={featurePortrait} alt={`A personal portrait of ${ownerName}`} loading="lazy" decoding="async" /></div>
        <div className="membership-feature-copy"><SectionEyebrow>AFTER DARK MEMBERSHIP</SectionEyebrow><h2>See more of me<br /><em>after dark.</em></h2><p>Step inside my collection of sensual portraits, nude photography and erotic films. Selected memberships also include private photo exchanges, voice notes and a personal line to me.</p><Link to="/membership" className="button button-dark">Choose your access <ArrowUpRight size={15} /></Link><span className="feature-footnote"><ShieldCheck size={14} /> Adults 18+. Private membership. Personal access.</span></div>
      </section>

      <section className="connection-section section-pad"><div className="connection-mark"><MessageCircle size={22} /></div><SectionHeading eyebrow="A PERSONAL CONNECTION" title={<>A private line<br /><em>between us.</em></>} description="Write to me directly, exchange private photographs, leave a voice note or request a personal audio or video session. Every conversation is one-to-one with me; members never message one another." align="center" /><Link to="/chat" className="underlined-link">See how we can connect <ArrowUpRight size={15} /></Link></section>
    </>
  );
}

export function AboutPage() {
  return <div className="page-shell"><section className="page-hero about-hero"><div><SectionEyebrow>A CLOSER LOOK AT ME</SectionEyebrow><h1>The person behind<br /><em>the imagery.</em></h1><p>I choose what I reveal, how I reveal it and who gets to come closer. This is my personal space for sensual portraits, artistic nudity, intimate films and conversation that stays between us.</p></div><div className="about-hero-image"><img src={portrait} alt={`Personal portrait of ${ownerName}`} loading="lazy" decoding="async" /></div></section><section className="about-body section-pad"><div className="about-body-heading"><span>01 — MY WORLD</span><h2>Sensuality lives in<br /><em>the details.</em></h2></div><div className="about-body-copy"><p className="large-paragraph">I love the confidence of a beautiful portrait, the quiet power of a bare silhouette and the thrill of revealing a little more on my own terms. Every image reflects my taste, my boundaries and my way of embracing sensuality.</p><p>I created this private edition for adults who appreciate sensual photography, artistic nudity, boudoir and erotic film. The public gallery offers a tasteful introduction; my more intimate photographs and videos are reserved for members.</p><p>This is not a marketplace or a social network. It is my personal collection, told in my own voice, with a private line for members who want to speak with me directly.</p><div className="signature">With affection, <span>— {ownerName}</span></div></div></section><section className="about-values"><div><span>01</span><h3>Intentional</h3><p>Every photograph is selected and shared on my terms.</p></div><div><span>02</span><h3>Unfiltered</h3><p>One person, one point of view, one personal collection.</p></div><div><span>03</span><h3>Private</h3><p>Your privacy, my boundaries and clear consent come first.</p></div></section><section className="about-cta"><p>You have seen the introduction. The more intimate chapters are reserved for members.</p><Link to="/membership" className="button button-cream">Explore membership <ArrowUpRight size={15} /></Link></section></div>;
}

export function GalleryPage() {
  const { data = fallbackContent, isLoading } = useContent('image');
  const [category, setCategory] = useState('All collections');
  const categories = ['All collections', ...Array.from(new Set(data.map((x) => x.category)))];
  const filtered = data.filter((x) => category === 'All collections' || x.category === category);
  return <div className="page-shell"><section className="page-intro"><SectionEyebrow>NUDE · BOUDOIR · INTIMATE PORTRAITS</SectionEyebrow><h1>My body of work, <em>uncovered.</em></h1><p>Browse public portraits and tasteful previews. Boudoir portraits, artistic nude photography and intimate sets are protected for members with the appropriate access.</p></section><div className="filter-row">{categories.map((c) => <button key={c} onClick={() => setCategory(c)} className={`filter-chip ${category === c ? 'selected' : ''}`}>{c}</button>)}</div>{isLoading ? <div className="loading-state">Curating the collection…</div> : <div className="content-grid gallery-grid">{filtered.map((item, i) => <ContentCard key={item.id} item={item} index={i} />)}</div>}<div className="gallery-note"><LockKeyhole size={16} /><span>Members-only photographs are delivered through protected, time-limited links after access is verified.</span><Link to="/membership">View private access <ArrowUpRight size={13} /></Link></div></div>;
}

export function VideosPage() {
  const { data = fallbackContent } = useContent('video');
  return <div className="page-shell"><section className="page-intro film-intro"><SectionEyebrow>EROTIC FILMS · PRIVATE RELEASES · 18+</SectionEyebrow><h1>My private films, <em>after dark.</em></h1><p>A personal selection of intimate films, sensual scenes and private videos. Public cover images offer a preview; full-length originals are reserved for eligible members or individual purchase.</p></section><div className="video-feature-card"><div className="video-feature-image"><img src={data[0]?.preview_url || 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=1200'} alt="Video collection preview"/><div className="video-feature-overlay"><span className="play-button large"><Play size={19} fill="currentColor" /></span><span>A GLIMPSE · NOT THE FULL FILM</span></div></div><div className="video-feature-copy"><SectionEyebrow>FEATURED PRIVATE RELEASE</SectionEyebrow><h2>The scenes I keep<br /><em>for later.</em></h2><p>My film collection brings together intimate visual stories and personal clips. Full-length releases are available only to members with the right access.</p><Link to="/membership" className="button button-dark">Unlock the private films <ArrowUpRight size={15}/></Link></div></div><div className="video-list-heading"><div><SectionEyebrow>MY FILM COLLECTION</SectionEyebrow><h2>Available <em>private films.</em></h2></div><span>{data.length.toString().padStart(2, '0')} PRIVATE FILMS</span></div><div className="content-grid video-grid">{data.map((item, i) => <ContentCard key={item.id} item={item} index={i} />)}</div></div>;
}

export function MembershipPage() {
  const { data: plans = fallbackPlans, isLoading } = usePlans();
  return <div className="page-shell membership-page"><section className="page-intro centered-intro"><SectionEyebrow>AFTER DARK MEMBERSHIP</SectionEyebrow><h1>Choose how much<br /><em>you would like to discover.</em></h1><p>Choose the level of access that feels right for you. Each membership opens a different selection of nude photography, erotic films and personal ways to connect with me. You will see every benefit and the full price before checkout.</p><div className="billing-note"><Bitcoin size={14} /> Pay privately in Bitcoin through a verified BTCPay invoice.</div></section><div className="plans-grid">{plans.map((plan, i) => <PlanCard key={plan.id} plan={plan} index={i} />)}</div><div className="membership-assurance"><div><ShieldCheck /><span><strong>Private by design</strong><small>Private member accounts and protected access to original media.</small></span></div><div><Wallet /><span><strong>Bitcoin, properly verified</strong><small>Your access opens only after BTCPay confirms settlement.</small></span></div><div><MessageCircle /><span><strong>A personal connection</strong><small>Your private conversation is with me alone. No group chats and no member directory.</small></span></div></div><div className="membership-faq"><SectionHeading eyebrow="BEFORE YOU COME CLOSER" title={<>A few things to know <em>before you enter.</em></>} /><div className="faq-list"><Faq q="How does membership work?" a="Create your private account, choose the access level you prefer and pay the Bitcoin invoice. BTCPay verifies the payment before the selected photographs, films or chat privileges are made available."/><Faq q="Does membership renew automatically?" a="No. Every membership is prepaid for its stated period. Renew whenever you choose; Bitcoin is not automatically taken from your wallet."/><Faq q="Can other members contact me?" a="No. Every conversation is between you and me. Members cannot browse, search for or message one another."/><Faq q="Can I buy one piece of content?" a="Selected nude sets and erotic films may be purchased individually. The price and access terms are displayed before you pay."/></div></div></div>;
}

function PlanCard({ plan, index }: { plan: MembershipPlan; index: number }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  return <article className={`plan-card ${plan.featured || index === 1 ? 'featured-plan' : ''}`}>
    {(plan.featured || index === 1) && <div className="plan-ribbon"><Sparkles size={12} /> MOST REQUESTED</div>}
    <div className="plan-index">0{index + 1} / MEMBERSHIP</div><h2>{plan.name}</h2><p className="plan-description">{plan.description}</p>
    <div className="plan-price"><strong>{formatCurrency(plan.price_amount, plan.currency || 'USD')}</strong><span>/ {plan.duration_days} days</span></div>
    <div className="plan-price-note">Payable in BTC at the current invoice rate</div>
    <div className="plan-divider"/><div className="plan-benefits-label">YOUR MEMBERSHIP INCLUDES</div>
    <ul className="plan-benefits">{(plan.benefits || []).map((benefit) => <li key={benefit}><Check size={14}/>{benefit}</li>)}</ul>
    <button className={`button ${plan.featured || index === 1 ? 'button-cream' : 'button-outline-dark'} plan-button`} onClick={() => navigate({ to: '/checkout/$planId', params: { planId: plan.slug || plan.id } })}>{user ? 'Continue to checkout' : 'Choose this membership'} <ArrowUpRight size={15}/></button>
    <div className="plan-secure"><LockKeyhole size={11}/> Secure, verified Bitcoin payment</div>
  </article>;
}
function Faq({ q, a }: { q: string; a: string }) { const [open, setOpen] = useState(false); return <div className={`faq-item ${open ? 'open' : ''}`}><button onClick={() => setOpen(!open)}><span>{q}</span><span className="faq-toggle">{open ? <X size={14}/> : <ChevronRight size={14}/>}</span></button>{open && <p>{a}</p>}</div>; }

export function CheckoutPage() {
  const { planId } = useParams({ from: '/checkout/$planId' });
  const { data: plans = fallbackPlans } = usePlans();
  const plan = plans.find((p) => p.slug === planId || p.id === planId);
  const { user, configured } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [invoice, setInvoice] = useState<{ checkoutLink?: string; invoiceId?: string; amount?: string; currency?: string } | null>(null);

  const createInvoice = async () => {
    setError('');
    if (!user) { navigate({ to: '/login', search: { next: `/checkout/${planId}` } as never }); return; }
    if (!configured || !supabase) { setError('Connect Supabase and configure the create-btc-invoice Edge Function and BTCPay Server secrets to activate checkout. No payment has been created.'); return; }
    if (!plan) return;
    setPending(true);
    const { data, error: functionError } = await supabase.functions.invoke('create-btc-invoice', { body: { productType: 'membership', productId: plan.id } });
    setPending(false);
    if (functionError || !data?.checkoutLink) { setError(functionError?.message || data?.error || 'The invoice could not be created. Please try again.'); return; }
    setInvoice(data);
  };

  if (!plan) return <div className="page-shell narrow-shell"><div className="notice-card"><CircleHelp/><h2>That membership is unavailable.</h2><Link to="/membership" className="underlined-link">Return to membership <ArrowRight size={14}/></Link></div></div>;
  return <div className="page-shell checkout-shell"><Link to="/membership" className="back-link"><ArrowLeft size={14}/> Back to membership</Link><div className="checkout-grid"><div className="checkout-main"><SectionEyebrow>SECURE CHECKOUT</SectionEyebrow><h1>Your private<br/><em>edition begins here.</em></h1><p className="checkout-intro">Review your selection, then create a secure Bitcoin invoice. Your access will be activated only after the payment gateway confirms settlement.</p><div className="checkout-summary"><div className="checkout-summary-top"><span>YOUR SELECTION</span><span className="verified-label"><ShieldCheck size={13}/> VERIFIED CHECKOUT</span></div><div className="checkout-plan-row"><div className="plan-mini-mark"><Crown/></div><div><h3>{plan.name}</h3><p>{plan.description}</p></div><strong>{formatCurrency(plan.price_amount, plan.currency)}</strong></div><div className="checkout-summary-bottom"><span>Membership duration</span><strong>{plan.duration_days} days</strong></div><div className="checkout-summary-bottom"><span>Payment method</span><strong className="btc-method"><Bitcoin size={15}/> Bitcoin (BTC)</strong></div><div className="checkout-total"><span>Total due</span><strong>{formatCurrency(plan.price_amount, plan.currency)}</strong></div></div>
      {invoice ? <div className="invoice-created"><CheckCircle2/><div><strong>Invoice created</strong><span>Continue to the BTCPay Server checkout to complete payment.</span></div><a href={invoice.checkoutLink} target="_blank" rel="noreferrer" className="button button-dark">Open Bitcoin checkout <ArrowUpRight size={14}/></a></div> : <button className="button button-dark checkout-submit" disabled={pending} onClick={createInvoice}>{pending ? 'Creating secure invoice…' : 'Create Bitcoin invoice'} <ArrowUpRight size={15}/></button>}
      {error && <div className="inline-error"><CircleHelp size={16}/><span>{error}</span></div>}
      {!user && <p className="checkout-signin-note">You will be asked to sign in or create an account before a payment invoice is generated.</p>}
      </div><aside className="checkout-aside"><div className="checkout-aside-visual"><img src="https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=85" alt={`Portrait from ${ownerName}'s private collection`}/><div><span>AFTER DARK MEMBERSHIP</span><h3>A little closer,<br/><em>by choice.</em></h3></div></div><div className="checkout-security"><ShieldCheck/><div><strong>Private and protected</strong><p>Your payment is verified server-side. Protected media links are issued only after server-side access checks.</p></div></div><div className="checkout-security"><Clock3/><div><strong>Prepaid access</strong><p>Your membership starts when the invoice is settled and ends after {plan.duration_days} days.</p></div></div><div className="checkout-terms">By continuing, you agree to the <Link to="/terms">Terms</Link> and <Link to="/refunds">Refund Policy</Link>.</div></aside></div></div>;
}

export function ContentCheckoutPage() {
  const { contentId } = useParams({ from: '/content-checkout/$contentId' });
  const { data: items = [] } = useContent();
  const item = items.find((x) => x.id === contentId);
  const { user, configured } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [checkoutLink, setCheckoutLink] = useState('');
  const createInvoice = async () => {
    setError('');
    if (!user) { navigate({ to: '/login', search: { next: `/content-checkout/${contentId}` } as never }); return; }
    if (!configured || !supabase) { setError('Connect Supabase and deploy the create-btc-invoice Edge Function with BTCPay secrets before accepting payments.'); return; }
    setPending(true);
    const { data, error: fnError } = await supabase.functions.invoke('create-btc-invoice', { body: { productType: 'content', productId: contentId } });
    setPending(false);
    if (fnError || !data?.checkoutLink) setError(fnError?.message || data?.error || 'Could not create the Bitcoin invoice.');
    else setCheckoutLink(data.checkoutLink);
  };
  if (!item || item.access_level !== 'premium') return <div className="page-shell narrow-shell"><div className="notice-card"><ImageIcon/><h2>This item is not available for individual purchase.</h2><Link to="/gallery" className="underlined-link">Return to the collection <ArrowRight size={14}/></Link></div></div>;
  return <div className="page-shell checkout-shell"><Link to="/gallery" className="back-link"><ArrowLeft size={14}/> Back to the gallery</Link><div className="checkout-grid"><div className="checkout-main"><SectionEyebrow>INDIVIDUAL CONTENT UNLOCK</SectionEyebrow><h1>One moment,<br/><em>kept for you.</em></h1><p className="checkout-intro">Purchase this item separately using a verified Bitcoin invoice. Access is attached to your member account after confirmed settlement.</p><div className="checkout-summary"><div className="checkout-summary-top"><span>YOUR SELECTED CONTENT</span><span className="verified-label"><ShieldCheck size={13}/> VERIFIED CHECKOUT</span></div><div className="checkout-plan-row"><div className="plan-mini-mark"><Video/></div><div><h3>{item.title}</h3><p>{item.category} · Individual access</p></div><strong>{formatCurrency(Number(item.price_amount || 0), item.currency)}</strong></div><div className="checkout-summary-bottom"><span>Access</span><strong>Linked to your account</strong></div><div className="checkout-summary-bottom"><span>Payment method</span><strong className="btc-method"><Bitcoin size={15}/> Bitcoin (BTC)</strong></div><div className="checkout-total"><span>Total due</span><strong>{formatCurrency(Number(item.price_amount || 0), item.currency)}</strong></div></div>
      {checkoutLink ? <div className="invoice-created"><CheckCircle2/><div><strong>Invoice created</strong><span>Continue to BTCPay Server to complete the payment.</span></div><a href={checkoutLink} target="_blank" rel="noreferrer" className="button button-dark">Open Bitcoin checkout <ArrowUpRight size={14}/></a></div> : <button className="button button-dark checkout-submit" onClick={createInvoice} disabled={pending}>{pending ? 'Creating secure invoice…' : 'Create Bitcoin invoice'} <ArrowUpRight size={15}/></button>}
      {error && <div className="inline-error"><CircleHelp size={16}/>{error}</div>}
      {!user && <p className="checkout-signin-note">Sign in or register before an invoice is created.</p>}
      </div><aside className="checkout-aside"><div className="checkout-aside-visual"><img src={item.preview_url || portrait} alt={item.title}/><div><span>AFTER DARK MEMBERSHIP</span><h3>A moment,<br/><em>just for you.</em></h3></div></div><div className="checkout-security"><ShieldCheck/><div><strong>Protected access</strong><p>The original media is delivered through a short-lived signed link after your purchase is verified.</p></div></div><div className="checkout-security"><Bitcoin/><div><strong>Verified payment</strong><p>Payment screenshots and browser redirects never unlock content. The payment provider confirms settlement.</p></div></div></aside></div></div>;
}

export function LoginPage() {
  const { user, configured } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>(() => window.location.hash.includes('type=recovery') || new URLSearchParams(window.location.search).get('type') === 'recovery' ? 'reset' : 'login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (user && mode !== 'reset') {
      navigate({ to: new URLSearchParams(window.location.search).get('next') || '/dashboard' } as never);
    }
  }, [user, mode]);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError(''); setMessage('');
    if (!supabase || !configured) { setError('Supabase is not connected yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment.'); return; }
    if (password.length < 8) { setError('Use a password with at least 8 characters.'); return; }
    if (mode === 'register' && !adultConfirmed) { setError('You must confirm that you are at least 18 years old to create an account.'); return; }
    setLoading(true);
    if (mode === 'reset') {
      if (password !== confirmPassword) { setLoading(false); setError('Your new passwords do not match.'); return; }
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) setError(updateError.message); else { setMessage('Your password has been updated.'); setMode('login'); navigate({ to: '/dashboard' }); }
    } else if (mode === 'register') {
      const { data, error: authError } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name, username }, emailRedirectTo: `${window.location.origin}/login` } });
      if (authError) setError(authError.message);
      else if (data.session) { await supabase.from('profiles').update({ full_name: name, username }).eq('id', data.user?.id); navigate({ to: new URLSearchParams(window.location.search).get('next') || '/dashboard' } as never); }
      else setMessage('Your account has been created. Check your email for the verification link before signing in.');
    } else {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) setError(authError.message); else navigate({ to: new URLSearchParams(window.location.search).get('next') || '/dashboard' } as never);
    }
    setLoading(false);
  };
  return <div className="auth-page"><div className="auth-visual"><img src={portrait} alt="Personal portrait"/><div className="auth-visual-shade"/><div className="auth-visual-copy"><span>AFTER DARK MEMBERSHIP</span><h2>The most personal moments<br />are shared <em>by choice.</em></h2><p>My sensual world, shared on my terms.</p></div><div className="auth-visual-bottom">ADULTS ONLY <span>✦</span> PRIVATE ONE-TO-ONE</div></div><div className="auth-form-panel"><div className="auth-form-inner"><Link to="/" className="auth-back"><ArrowLeft size={14}/> Return to the website</Link><div className="auth-monogram">a.</div><SectionEyebrow>A PRIVATE LINE TO ME</SectionEyebrow><h1>{mode === 'login' ? 'Welcome back.' : mode === 'register' ? 'A place for you.' : 'A fresh start.'}</h1><p className="auth-subtitle">{mode === 'login' ? 'Sign in to continue to your personal space.' : mode === 'register' ? 'Create your account to explore my private photographs, adult films and one-to-one conversations.' : 'Choose a new password for your account.'}</p>{mode !== 'reset' && <div className="auth-tabs"><button onClick={() => { setMode('login'); setError(''); setMessage(''); }} className={mode === 'login' ? 'active' : ''}>Sign in</button><button onClick={() => { setMode('register'); setError(''); setMessage(''); }} className={mode === 'register' ? 'active' : ''}>Create account</button></div>}<form onSubmit={submit} className="auth-form">{mode === 'register' && <><label>Full name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" required autoComplete="name"/></label><label>Username<input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Choose your private username" required autoComplete="username"/></label><label className="adult-consent-check signup-age-check"><input type="checkbox" checked={adultConfirmed} onChange={(e) => setAdultConfirmed(e.target.checked)}/><span>I confirm that I am at least 18 years old and legally allowed to access adult-oriented content where I live.</span></label></>}{mode !== 'reset' && <label>Email address<div className="field-with-icon"><Mail size={16}/><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email"/></div></label>}<label>Password<div className="field-with-icon password-field"><input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" required autoComplete={mode === 'login' ? 'current-password' : 'new-password'}/><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label="Toggle password visibility">{showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div></label>{mode === 'reset' && <label>Confirm new password<input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat your new password" required autoComplete="new-password"/></label>}{mode === 'login' && <div className="auth-forgot"><button type="button" onClick={async () => { if (!supabase || !email) { setError('Enter your email address first.'); return; } const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/login` }); setError(resetError?.message || 'Password reset instructions have been sent if the account exists.'); }}>Forgot password?</button></div>}<button className="button button-dark auth-submit" disabled={loading}>{loading ? 'Please wait…' : mode === 'login' ? 'Sign in to your account' : mode === 'register' ? 'Create my account' : 'Update password'} <ArrowUpRight size={15}/></button></form>{error && <div className="inline-error">{error}</div>}{message && <div className="inline-success"><CheckCircle2 size={16}/>{message}</div>}<div className="auth-privacy"><ShieldCheck size={14}/> Your account and conversations are private.</div><p className="auth-legal">By continuing, you agree to our <Link to="/terms">Terms</Link> and <Link to="/privacy">Privacy Policy</Link>.</p></div></div></div>;
}

export function DashboardPage() {
  const { user, profile, isOwner } = useAuth();
  const { data: content = fallbackContent } = useContent();
  const [membership, setMembership] = useState<{ status: string; ends_at: string; plan_name: string } | null>(null);
  useEffect(() => {
    const client = supabase;
    if (!client || !user) return;
    client.from('memberships')
      .select('status,ends_at,membership_plans(name)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .lte('starts_at', new Date().toISOString())
      .gt('ends_at', new Date().toISOString())
      .order('ends_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        // Supabase may infer a joined relationship as an array; use its first row.
        const planName = data.membership_plans?.[0]?.name || 'Membership';
        setMembership({ status: data.status, ends_at: data.ends_at, plan_name: planName });
      });
  }, [user]);
  if (!user) return <AuthGate title="Your private space awaits." copy="Sign in to view your membership, saved collections and private messages."/>;
  return <div className="member-dashboard page-shell">{profile?.status === 'suspended' && <div className="inline-error account-suspension-notice"><ShieldCheck size={16}/> Your account access has been paused by the owner. Private media, messaging and purchases are unavailable while this restriction is in place.</div>}<div className="dashboard-welcome"><div><SectionEyebrow>A PRIVATE LINE TO ME</SectionEyebrow><h1>Good to see you,<br/><em>{profile?.full_name?.split(' ')[0] || 'friend'}.</em></h1><p>Your membership, private messages and saved moments are gathered here.</p></div><div className="dashboard-date">MEMBER SINCE <strong>{formatDate(user.created_at)}</strong></div></div><div className="dashboard-stat-grid"><div className="dashboard-stat membership-status-stat"><span>MEMBERSHIP STATUS</span><strong>{profile?.status === 'suspended' ? 'Restricted' : membership ? 'Active' : 'Not active'}</strong><small>{profile?.status === 'suspended' ? 'Member access has been restricted by the owner.' : membership ? `${membership.plan_name} · Until ${formatDate(membership.ends_at)}` : 'Choose a membership to unlock the private edition.'}</small><span className="stat-icon"><BadgeCheck/></span></div><div className="dashboard-stat"><span>YOUR COLLECTION</span><strong>{content.length.toString().padStart(2, '0')}</strong><small>Stories and moments in the library</small><span className="stat-icon"><ImageIcon/></span></div><div className="dashboard-stat"><span>PRIVATE CONNECTION</span><strong>01 : 01</strong><small>One private conversation, just between us.</small><span className="stat-icon"><MessageCircle/></span></div></div><div className="dashboard-content-grid"><div className="dashboard-main-card"><div className="dashboard-card-heading"><div><SectionEyebrow>RECENTLY ADDED</SectionEyebrow><h2>From the <em>collection.</em></h2></div><Link to="/gallery" className="small-link">View all <ArrowUpRight size={13}/></Link></div><div className="dashboard-recent-list">{content.slice(0, 3).map((item) => <div className="recent-item" key={item.id}><img src={item.preview_url || portrait} alt=""/><div><strong>{item.title}</strong><small>{item.category}</small></div><LockedMark label={item.access_level === 'public' ? 'Open' : 'Members'}/></div>)}</div></div><div className="dashboard-side-card"><div className="dashboard-side-icon"><Crown/></div><SectionEyebrow>MEMBERSHIP</SectionEyebrow><h3>{membership ? 'Your access is open.' : 'Come a little closer.'}</h3><p>{membership ? 'Your private collection and member features are ready.' : 'Unlock the private picture and video collections, and choose whether one-to-one chat is part of your experience.'}</p><Link to="/membership" className="button button-dark">{membership ? 'View membership' : 'Explore plans'} <ArrowUpRight size={14}/></Link></div></div><div className="dashboard-quick-links"><Link to="/gallery"><ImageIcon/> My gallery <ArrowUpRight/></Link><Link to="/videos"><Video/> Private videos <ArrowUpRight/></Link><Link to="/chat"><MessageCircle/> Private chat <ArrowUpRight/></Link><Link to="/membership"><Crown/> Membership <ArrowUpRight/></Link></div>{isOwner && <div className="owner-redirect"><BadgeCheck/> You are signed in as the owner. <Link to="/admin">Open Owner Studio <ArrowUpRight size={13}/></Link></div>}</div>;
}

function AuthGate({ title, copy }: { title: string; copy: string }) { return <div className="auth-gate"><div className="auth-gate-mark"><LockKeyhole/></div><SectionEyebrow>MEMBERS AREA</SectionEyebrow><h1>{title}</h1><p>{copy}</p><Link to="/login" className="button button-dark">Sign in or register <ArrowUpRight size={15}/></Link></div>; }

function ChatMessageBubble({ message, userId }: { message: any; userId: string }) {
  const { data: signedUrl } = useQuery({
    queryKey: ['private-message-url', message.id],
    enabled: Boolean(supabase && message.attachment_path),
    queryFn: async () => {
      if (!supabase || !message.attachment_path) return null;
      const { data, error } = await supabase.storage.from('private-messages').createSignedUrl(message.attachment_path, 300);
      if (error) throw error;
      return data.signedUrl;
    },
    staleTime: 240_000,
  });
  const mine = message.sender_id === userId;
  const time = new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return <div className={`message-row ${mine ? 'mine' : 'theirs'}`}><div className={`message-bubble ${message.message_type !== 'text' ? 'typed-message-bubble' : ''}`}>
    {message.message_type === 'image' && <>{signedUrl ? <a href={signedUrl} target="_blank" rel="noreferrer"><img className="chat-photo-attachment" src={signedUrl} alt="Private photo attachment" /></a> : <div className="chat-attachment-loading">Preparing private photo…</div>}<p>{message.body}</p></>}
    {message.message_type === 'voice' && <><div className="voice-message-label"><Headphones size={15}/> Private voice note</div>{signedUrl ? <audio controls preload="none" src={signedUrl}/> : <div className="chat-attachment-loading">Preparing voice note…</div>}<p>{message.body}</p></>}
    {message.message_type === 'session_request' && <div className="session-request-card"><div className="session-request-icon">{message.session_kind === 'video' ? <Video size={17}/> : <Phone size={17}/>}</div><div><strong>Private {message.session_kind === 'video' ? 'video' : 'audio'} session request</strong><p>{message.body}</p>{message.session_scheduled_at && <small><CalendarDays size={12}/> Preferred: {new Date(message.session_scheduled_at).toLocaleString()}</small>}<small className="session-request-status">Request sent · Awaiting owner response</small></div></div>}
    {(!message.message_type || message.message_type === 'text') && <p>{message.body}</p>}
    <span>{time}</span>
  </div></div>;
}

export function ChatPage() {
  const { user, isOwner } = useAuth();
  const queryClient = useQueryClient();
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [access, setAccess] = useState<boolean | null>(null);
  const [chatMode, setChatMode] = useState<'text' | 'photo' | 'voice' | 'session'>('text');
  const [sessionKind, setSessionKind] = useState<'audio' | 'video'>('audio');
  const [sessionTime, setSessionTime] = useState('');
  const [chatNotice, setChatNotice] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunks = useRef<Blob[]>([]);

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['conversations', user?.id, isOwner], enabled: Boolean(user && supabase),
    queryFn: async () => {
      if (!supabase || !user) return [];
      const q = supabase.from('conversations').select('id,member_id,updated_at,profiles:profiles!conversations_member_id_fkey(full_name,username,avatar_url)').order('updated_at', { ascending: false });
      const { data, error } = isOwner ? await q : await q.eq('member_id', user.id);
      if (error) throw error;
      return data || [];
    },
  });
  useEffect(() => { if (!supabase || !user || isOwner) return; supabase.rpc('can_use_chat').then(({ data }) => setAccess(Boolean(data))); }, [user, isOwner]);
  useEffect(() => { if (!activeConversation && conversations.length) setActiveConversation(conversations[0].id); }, [conversations, activeConversation]);
  const { data: messages = [] } = useQuery({
    queryKey: ['messages', activeConversation], enabled: Boolean(activeConversation && supabase),
    queryFn: async () => {
      if (!supabase || !activeConversation) return [];
      const { data, error } = await supabase.from('messages').select('id,conversation_id,sender_id,body,message_type,attachment_path,attachment_name,attachment_mime_type,duration_seconds,session_kind,session_scheduled_at,created_at,read_at').eq('conversation_id', activeConversation).order('created_at');
      if (error) throw error;
      return data || [];
    },
  });
  useEffect(() => { if (!supabase || !activeConversation || !user || !messages.length) return; const unread = messages.filter((m: any) => m.sender_id !== user.id && !m.read_at).map((m: any) => m.id); if (unread.length) supabase.from('messages').update({ read_at: new Date().toISOString() }).in('id', unread); }, [activeConversation, messages, user]);
  useEffect(() => {
    const client = supabase;
    if (!client || !activeConversation) return;
    const channel = client.channel(`conversation:${activeConversation}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${activeConversation}`,
      }, () => queryClient.invalidateQueries({ queryKey: ['messages', activeConversation] }))
      .subscribe();
    return () => { void client.removeChannel(channel); };
  }, [activeConversation, queryClient]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);
  useEffect(() => () => { if (recorderRef.current?.state === 'recording') recorderRef.current.stop(); }, []);

  const createConversation = async () => {
    if (!supabase || !user) return;
    const { data: ownerId, error: ownerError } = await supabase.rpc('get_owner_user_id');
    if (ownerError || !ownerId) { setChatNotice('The owner account is not configured yet.'); return; }
    const { data, error } = await supabase.from('conversations').insert({ member_id: user.id, owner_id: ownerId }).select('id').single();
    if (!error && data) { setActiveConversation(data.id); queryClient.invalidateQueries({ queryKey: ['conversations'] }); }
    else if (error) setChatNotice(error.message);
  };
  const insertMessage = async (payload: Record<string, unknown>) => {
    if (!supabase || !user || !activeConversation) return false;
    const { error } = await supabase.from('messages').insert({ conversation_id: activeConversation, sender_id: user.id, ...payload });
    if (error) { setChatNotice(error.message); return false; }
    setChatNotice('');
    await queryClient.invalidateQueries({ queryKey: ['messages', activeConversation] });
    return true;
  };
  const sendText = async (e: FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setIsSending(true);
    const body = message.trim();
    const ok = await insertMessage({ body, message_type: 'text' });
    if (ok) setMessage('');
    setIsSending(false);
  };
  const uploadAttachment = async (file: File, kind: 'image' | 'voice') => {
    if (!supabase || !user || !activeConversation) return;
    const maxBytes = kind === 'image' ? 15 * 1024 * 1024 : 20 * 1024 * 1024;
    if (file.size > maxBytes) { setChatNotice(`Keep ${kind === 'image' ? 'photographs under 15 MB' : 'voice notes under 20 MB'}.`); return; }
    if (kind === 'image' && !file.type.startsWith('image/')) { setChatNotice('Choose a JPEG, PNG, WebP or AVIF photograph.'); return; }
    if (kind === 'voice' && !file.type.startsWith('audio/')) { setChatNotice('Choose an audio file for your voice note.'); return; }
    setIsSending(true);
    setChatNotice(kind === 'image' ? 'Optimizing your private photograph…' : 'Uploading your private voice note…');
    let storedFile: File;
    try {
      storedFile = kind === 'image'
        ? await convertImageToWebP(file, { maxDimension: 1800, quality: 0.82, maxInputBytes: maxBytes })
        : file;
      const cleanExtension = storedFile.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || (kind === 'image' ? 'webp' : 'webm');
      const path = `${activeConversation}/${user.id}/${crypto.randomUUID()}.${cleanExtension}`;
      const safeMimeType = storedFile.type.split(';')[0] || (kind === 'voice' ? 'audio/webm' : 'image/webp');
      await uploadToPrivateStorage(supabase, 'private-messages', path, storedFile);
      const ok = await insertMessage({
        body: kind === 'image' ? (message.trim() || 'A private photograph') : 'A private voice note',
        message_type: kind,
        attachment_path: path,
        attachment_name: storedFile.name,
        attachment_mime_type: safeMimeType,
        duration_seconds: null,
      });
      if (!ok) await supabase.storage.from('private-messages').remove([path]);
      else setMessage('');
      setChatNotice(ok ? 'Your private message has been sent.' : 'Your attachment could not be added to the conversation.');
    } catch (error) {
      setChatNotice(error instanceof Error ? error.message : 'The attachment could not be uploaded. Please try again.');
    } finally {
      setIsSending(false);
    }
  };
  const startVoiceRecording = async () => {
    setChatNotice('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { setChatNotice('Voice recording is not supported in this browser. Try a recent version of Chrome, Edge or Safari.'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordingChunks.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size) recordingChunks.current.push(event.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(recordingChunks.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size) {
          const ext = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'm4a' : 'webm';
          await uploadAttachment(new File([blob], `voice-note-${Date.now()}.${ext}`, { type: blob.type }), 'voice');
        }
      };
      recorder.start(); recorderRef.current = recorder; setIsRecording(true);
    } catch { setChatNotice('Microphone permission is needed to record a private voice note.'); }
  };
  const stopVoiceRecording = () => { if (recorderRef.current?.state === 'recording') recorderRef.current.stop(); setIsRecording(false); };
  const requestSession = async (e: FormEvent) => {
    e.preventDefault();
    const preferred = sessionTime ? new Date(sessionTime) : null;
    if (preferred && Number.isNaN(preferred.getTime())) { setChatNotice('Choose a valid preferred time.'); return; }
    const readable = preferred ? preferred.toLocaleString() : 'Flexible timing';
    setIsSending(true);
    const ok = await insertMessage({ body: `I'd like to request a private ${sessionKind} session. Preferred time: ${readable}. Please confirm availability and the rate in this chat.`, message_type: 'session_request', session_kind: sessionKind, session_scheduled_at: preferred?.toISOString() || null });
    if (ok) { setChatNotice('Your session request has been sent. I will confirm availability and pricing in this conversation.'); setSessionTime(''); setChatMode('text'); }
    setIsSending(false);
  };

  if (!user) return <AuthGate title="A private conversation, just between us." copy="Sign in to open your private conversation with me. Depending on your membership, you can exchange text and photographs, leave voice notes or request a personal audio or video session."/>;
  if (!isOwner && access === false) return <div className="page-shell"><div className="chat-locked"><div className="auth-gate-mark"><MessageCircle/></div><SectionEyebrow>PRIVATE CONVERSATION · 18+</SectionEyebrow><h1>A more personal<br/><em>conversation.</em></h1><p>Private text, photo and voice-note conversations are included with selected memberships. Audio and video sessions can be requested here and confirmed personally.</p><Link to="/membership" className="button button-dark">See membership access <ArrowUpRight size={15}/></Link></div></div>;

  const selectedConversation: any = conversations.find((c: any) => c.id === activeConversation);
  return <div className="chat-page page-shell">
    <div className="chat-heading"><div><SectionEyebrow>PRIVATE CONVERSATIONS · 18+</SectionEyebrow><h1>Say it privately. <em>I'll be listening.</em></h1><p>Send a private note, exchange WebP photographs, leave a voice message or request an audio or video session with {ownerName}. Every message comes directly to me. There are no member profiles to browse and no member-to-member conversations.</p></div><div className="chat-private-tag"><span/> ONE-TO-ONE · PRIVATE</div></div>
    <div className="chat-shell">
      <aside className="chat-sidebar"><div className="chat-sidebar-head"><span>{isOwner ? 'MY PRIVATE INBOX' : 'YOUR CONVERSATION'}</span><MoreHorizontal size={16}/></div>{isOwner && <div className="chat-sidebar-search"><UserRound size={14}/> <span>One private thread per member</span></div>}
        {isLoading && <div className="loading-state">Loading conversations…</div>}
        {conversations.map((c: any) => <button key={c.id} className={`chat-conversation-item ${activeConversation === c.id ? 'active' : ''}`} onClick={() => setActiveConversation(c.id)}><div className="chat-contact-avatar">{(c.profiles?.full_name || 'M').slice(0, 1).toUpperCase()}</div><div><strong>{isOwner ? c.profiles?.full_name || 'Member' : ownerName}</strong><small>{isOwner ? 'Private member conversation' : 'Only you and me'}</small></div><span className="chat-status-dot"/></button>)}
        {!conversations.length && !isLoading && <div className="chat-empty-list"><MessageCircle/><p>{isOwner ? 'Your private inbox is quiet for now.' : 'Your private thread is ready whenever you are.'}</p>{!isOwner && access && <button onClick={createConversation}>Send me a private note <ArrowRight size={13}/></button>}</div>}
        <div className="chat-sidebar-note"><LockKeyhole size={13}/> No member-to-member messages. Only you and I can see this conversation.</div>
      </aside>
      <section className="chat-main">
        <div className="chat-main-head"><div className="chat-contact-avatar large-avatar">{isOwner ? (selectedConversation?.profiles?.full_name || 'M').slice(0, 1).toUpperCase() : 'A'}</div><div><strong>{isOwner ? selectedConversation?.profiles?.full_name || 'Select a member' : ownerName}</strong><small><span className="chat-status-dot"/> Private conversation</small></div><span className="chat-header-private"><LockKeyhole size={12}/> PRIVATE</span></div>
        {activeConversation ? <>
          <div className="chat-messages"><div className="chat-day-divider"><span>A PRIVATE LINE TO ME</span></div><div className="chat-welcome-note"><div className="chat-welcome-icon"><Heart size={17}/></div><strong>Tell me what's on your mind.</strong><p>Send me a personal message, share a private photograph, leave a voice note or request an audio or video session. Keep every exchange respectful, consensual and between us.</p></div>
            {messages.map((m: any) => <ChatMessageBubble key={m.id} message={m} userId={user.id}/>)}<div ref={bottomRef}/>
          </div>
          <div className="chat-tools-wrap">
            <div className="chat-mode-tabs">
              <button className={chatMode === 'text' ? 'selected' : ''} onClick={() => setChatMode('text')}><MessageCircle size={14}/> Text</button>
              <button className={chatMode === 'photo' ? 'selected' : ''} onClick={() => { setChatMode('photo'); photoInputRef.current?.click(); }}><ImagePlus size={14}/> Photo</button>
              <button className={chatMode === 'voice' ? 'selected' : ''} onClick={() => setChatMode('voice')}><Mic size={14}/> Voice note</button>
              {!isOwner && <button className={chatMode === 'session' ? 'selected' : ''} onClick={() => setChatMode('session')}><Video size={14}/> Personal session</button>}
            </div>
            <input ref={photoInputRef} className="chat-hidden-file" type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadAttachment(file, 'image'); e.currentTarget.value = ''; }}/>
            {chatMode === 'text' && <form className="chat-composer" onSubmit={sendText}><input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Write something just for me…" maxLength={5000}/><button className="chat-send" disabled={!message.trim() || isSending}><Send size={16}/><span>{isSending ? 'Sending…' : 'Send'}</span></button></form>}
            {chatMode === 'photo' && <div className="chat-mode-panel"><div><ImagePlus size={19}/><strong>Share a private photograph</strong><small>JPEG, PNG, WebP or AVIF · up to 15 MB before optimization. Your photo is converted to WebP and kept private.</small></div><button className="button button-dark" onClick={() => photoInputRef.current?.click()} disabled={isSending}>Choose a photograph <ArrowUpRight size={14}/></button></div>}
            {chatMode === 'voice' && <div className="chat-mode-panel"><div><Mic size={19}/><strong>{isRecording ? 'Recording your voice note…' : 'Leave me a voice note'}</strong><small>Use your microphone. Your recording is uploaded privately when you stop.</small></div><button className={`button ${isRecording ? 'recording-button' : 'button-dark'}`} onClick={isRecording ? stopVoiceRecording : startVoiceRecording} disabled={isSending}>{isRecording ? <><Square size={13}/> Stop & send</> : <><Mic size={14}/> Start recording</>}</button></div>}
            {chatMode === 'session' && <form className="chat-mode-panel session-request-form" onSubmit={requestSession}><div><Video size={19}/><strong>Request a personal session</strong><small>This sends a request, not an instant call. I will confirm availability and the rate in our conversation.</small></div><div className="session-request-fields"><label>Session type<select value={sessionKind} onChange={(e) => setSessionKind(e.target.value as 'audio' | 'video')}><option value="audio">Private audio session</option><option value="video">Private video session</option></select></label><label>Preferred time<input type="datetime-local" value={sessionTime} onChange={(e) => setSessionTime(e.target.value)}/></label><button className="button button-dark" disabled={isSending}>Send request <ArrowUpRight size={14}/></button></div></form>}
            {chatNotice && <div className="chat-notice">{chatNotice}</div>}
          </div>
        </> : <div className="chat-no-conversation"><MessageCircle/><h3>Your conversation begins here.</h3><p>{isOwner ? 'Select a member from the inbox.' : 'Start your one-to-one conversation with the website owner.'}</p></div>}
      </section>
    </div>
  </div>;
}

export function AdminPage() {
  const { user, isOwner } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'overview' | 'content' | 'members' | 'plans' | 'payments'>('overview');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'image' | 'video'>('image');
  const [access, setAccess] = useState('members');
  const [category, setCategory] = useState('Intimate portraits');
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploadMessage, setUploadMessage] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [contentConsent, setContentConsent] = useState(false);
  const [previewConsent, setPreviewConsent] = useState(false);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const previewInputRef = useRef<HTMLInputElement>(null);
  const { data: content = [] } = useQuery({ queryKey: ['owner-content'], enabled: Boolean(isOwner && supabase), queryFn: async () => { const { data, error } = await supabase!.from('content_items').select('id,title,content_type,access_level,is_published,created_at,storage_path,preview_storage_path').order('created_at', { ascending: false }); if (error) throw error; return data || []; } });
  const { data: members = [] } = useQuery({ queryKey: ['owner-members'], enabled: Boolean(isOwner && supabase), queryFn: async () => { const { data, error } = await supabase!.from('profiles').select('id,full_name,username,created_at,role,status').eq('role', 'member').order('created_at', { ascending: false }).limit(100); if (error) throw error; return data || []; } });
  const { data: paymentOrders = [] } = useQuery({ queryKey: ['owner-payment-orders'], enabled: Boolean(isOwner && supabase), queryFn: async () => { const { data, error } = await supabase!.from('payment_orders').select('id,user_id,product_type,amount,currency,status,provider_invoice_id,transaction_id,created_at,confirmed_at').order('created_at', { ascending: false }).limit(100); if (error) throw error; return data || []; } });
  const upload = async (e: FormEvent) => {
    e.preventDefault();
    setUploadMessage('');
    setUploadProgress(0);
    if (!title.trim()) { setUploadProgress(null); setUploadMessage('Error: Add a title for this collection.'); return; }
    if (!supabase || !file || !user) { setUploadProgress(null); setUploadMessage('Error: Choose a media file and confirm that Supabase is connected.'); return; }
    if (!contentConsent) { setUploadProgress(null); setUploadMessage('Error: Confirm that every person depicted is an adult and has consented to this specific content and its publication.'); return; }
    if (!previewFile) { setUploadProgress(null); setUploadMessage('Error: Add a separate, non-explicit WebP cover image. The private original must never be used as a public gallery preview.'); return; }
    if (!previewConsent) { setUploadProgress(null); setUploadMessage('Error: Confirm that the cover image contains no visible nudity and is approved for public display.'); return; }

    let storedMedia: File;
    let previewPath: string | null = null;
    let mediaPath: string | null = null;
    try {
      if (type === 'image') {
        setUploadMessage('Optimizing the photograph as WebP…');
        storedMedia = await convertImageToWebP(file);
      } else {
        storedMedia = prepareVideoForStorage(file);
      }

      let safePreviewUrl: string | null = null;
      if (previewFile) {
        setUploadMessage('Preparing your public-safe WebP cover…');
        const optimizedPreview = await convertImageToWebP(previewFile, { maxDimension: 1000, quality: 0.78, maxInputBytes: 20 * 1024 * 1024 });
        previewPath = `${user.id}/${crypto.randomUUID()}.webp`;
        await uploadToPrivateStorage(supabase, 'content-previews', previewPath, optimizedPreview);
        safePreviewUrl = supabase.storage.from('content-previews').getPublicUrl(previewPath).data.publicUrl;
      }

      const extension = storedMedia.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || (type === 'image' ? 'webp' : 'mp4');
      mediaPath = `${user.id}/${crypto.randomUUID()}.${type === 'image' ? 'webp' : extension}`;
      setUploadMessage(type === 'image' ? 'Uploading optimized WebP photograph…' : 'Uploading private video…');
      await uploadToPrivateStorage(supabase, 'private-content', mediaPath, storedMedia, setUploadProgress);

      const { error } = await supabase.from('content_items').insert({
        title: title.trim(),
        description: description.trim() || null,
        content_type: type,
        category,
        access_level: access,
        storage_path: mediaPath,
        preview_url: safePreviewUrl,
        preview_storage_path: previewPath,
        is_published: false,
        currency: 'USD',
        created_by: user.id,
      });
      if (error) throw error;

      setUploadMessage(type === 'image'
        ? 'Uploaded. Your private photograph has been resized, converted to WebP and saved as a draft.'
        : 'Uploaded. Your private video is saved as a draft, with its separate WebP cover stored in the public preview library.');
      setTitle(''); setDescription(''); setFile(null); setPreviewFile(null);
      setContentConsent(false); setPreviewConsent(false); setUploadProgress(null);
      if (mediaInputRef.current) mediaInputRef.current.value = '';
      if (previewInputRef.current) previewInputRef.current.value = '';
      queryClient.invalidateQueries({ queryKey: ['owner-content'] });
    } catch (error) {
      if (mediaPath) await supabase.storage.from('private-content').remove([mediaPath]);
      if (previewPath) await supabase.storage.from('content-previews').remove([previewPath]);
      setUploadMessage(`Error: ${error instanceof Error ? error.message : 'The upload did not complete. Please try again.'}`);
      setUploadProgress(null);
    }
  };
  if (!user) return <AuthGate title="My private studio." copy="Sign in with the owner account to manage your private portfolio."/>;
  if (!isOwner) return <div className="auth-gate"><div className="auth-gate-mark"><ShieldCheck/></div><SectionEyebrow>RESTRICTED AREA</SectionEyebrow><h1>This space is<br/><em>for the owner.</em></h1><p>Your account does not have administrator permissions.</p><Link to="/dashboard" className="button button-dark">Return to my account <ArrowRight size={15}/></Link></div>;
  return <div className="admin-page page-shell"><div className="admin-heading"><div><SectionEyebrow>THE OWNER'S WORKSPACE</SectionEyebrow><h1>Owner <em>studio.</em></h1><p>One person. One personal collection. One private inbox.</p></div><div className="admin-account-pill"><span className="admin-account-avatar">A</span><span><strong>Owner account</strong><small>Full access</small></span><BadgeCheck size={16}/></div></div><div className="admin-layout"><aside className="admin-sidebar"><span className="admin-nav-caption">WORKSPACE</span>{(['overview', 'content', 'members', 'plans', 'payments'] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={tab === t ? 'active' : ''}>{t === 'overview' ? <Sparkles/> : t === 'content' ? <ImageIcon/> : t === 'members' ? <UserRound/> : t === 'plans' ? <Crown/> : <Wallet/>}{t.charAt(0).toUpperCase() + t.slice(1)}</button>)}<span className="admin-nav-caption settings-caption">QUICK LINKS</span><Link to="/chat"><MessageCircle/> Private inbox <ArrowUpRight/></Link><Link to="/"><Eye/> View website <ArrowUpRight/></Link></aside><div className="admin-content">{tab === 'overview' && <><div className="admin-content-title"><div><h2>Welcome back.</h2><p>Here is what is happening inside your private world.</p></div><span className="live-pill"><span/> LIVE WORKSPACE</span></div><div className="admin-metric-grid"><Metric label="REGISTERED MEMBERS" value={String(members.length).padStart(2, '0')} icon={<UserRound/>} hint="Member profiles"/><Metric label="CONTENT ITEMS" value={String(content.length).padStart(2, '0')} icon={<ImageIcon/>} hint="Across your library"/><Metric label="ACTIVE CONTENT" value={String(content.filter((x: any) => x.is_published).length).padStart(2, '0')} icon={<Eye/>} hint="Published to the site"/><Metric label="BITCOIN ORDERS" value={String(paymentOrders.length).padStart(2, '0')} icon={<Wallet/>} hint="Invoice and payment records"/></div><div className="admin-panel"><div className="admin-panel-heading"><div><SectionEyebrow>RECENT CONTENT</SectionEyebrow><h3>My private library</h3></div><button onClick={() => setTab('content')} className="small-link">Manage my collection <ArrowRight size={13}/></button></div><div className="admin-table"><div className="admin-table-head"><span>TITLE</span><span>TYPE</span><span>ACCESS</span><span>STATUS</span></div>{content.slice(0, 5).map((x: any) => <div className="admin-table-row" key={x.id}><strong>{x.title}</strong><span>{x.content_type}</span><span>{x.access_level}</span><span className={`status-chip ${x.is_published ? 'published' : 'draft'}`}>{x.is_published ? 'Published' : 'Draft'}</span></div>)}{!content.length && <p className="empty-table">Your private collection is ready for its first addition.</p>}</div></div><div className="admin-panel admin-note-panel"><ShieldCheck/><div><strong>Payments are not yet connected</strong><p>Configure BTCPay Server secrets and deploy the invoice and webhook functions before accepting live Bitcoin payments. Do not grant access manually based on screenshots.</p></div></div></>}
      {tab === 'content' && <><div className="admin-content-title"><div><h2>My content library</h2><p>Add private photographs and films, then choose who may view each one.</p></div></div><form className="admin-upload-form" onSubmit={upload}><h3>Add to my private collection</h3><p className="admin-upload-intro">Your private originals stay protected. Photographs are resized and converted to WebP automatically; videos remain in MP4 or WebM, with a separate WebP cover for the gallery.</p><div className="admin-form-grid"><label>Collection title<input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g. Velvet-light boudoir portraits"/></label><label>Collection category<select value={category} onChange={(e) => setCategory(e.target.value)}><option>Intimate portraits</option><option>Boudoir collection</option><option>Artistic nude</option><option>Erotic photo set</option><option>Private picture set</option><option>VIP nude collection</option><option>Adult video collection</option><option>Behind the scenes</option><option>Public portraits</option></select></label><label>Media format<select value={type} onChange={(e) => { setType(e.target.value as 'image' | 'video'); setFile(null); if (mediaInputRef.current) mediaInputRef.current.value = ''; }}><option value="image">Photograph / nude image</option><option value="video">Adult video</option></select></label><label>Who may view it?<select value={access} onChange={(e) => setAccess(e.target.value)}><option value="public">Public</option><option value="members">All active members</option><option value="vip">VIP members only</option><option value="premium">One-time purchase</option><option value="private">By personal invitation</option></select></label><label className="full-field">Description<textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the mood, style and contents of this collection…"/></label><label className="full-field file-field">Private original — {type === 'image' ? 'automatically converted to WebP' : 'MP4, WebM or MOV'}<input ref={mediaInputRef} type="file" accept={type === 'image' ? 'image/jpeg,image/png,image/webp,image/avif' : 'video/mp4,video/webm,video/quicktime'} onChange={(e) => setFile(e.target.files?.[0] || null)} required/><small>{type === 'image' ? 'JPEG, PNG, WebP or AVIF · up to 40 MB before optimization · resized to a maximum 2,400 px edge and compressed as WebP.' : 'MP4 (H.264) is recommended · WebM and MOV are accepted · maximum 450 MB. The video stays in its video format; its separate cover is converted to WebP.'}</small></label><label className="full-field file-field">Public-safe cover image (required)<input ref={previewInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" required onChange={(e) => { setPreviewFile(e.target.files?.[0] || null); setPreviewConsent(false); }}/><small>Required for every item: choose a separate, non-explicit cover image for the gallery card or video poster. It is resized, converted to WebP and stored in the public preview bucket. Never upload the private original here.</small></label><label className="adult-consent-check full-field"><input type="checkbox" checked={contentConsent} onChange={(e) => setContentConsent(e.target.checked)} required/><span>I confirm that everyone shown in the private original is an adult, has knowingly consented to this specific content and its publication, and that I have all necessary rights to upload it.</span></label><label className="adult-consent-check full-field"><input type="checkbox" checked={previewConsent} onChange={(e) => setPreviewConsent(e.target.checked)} disabled={!previewFile} required/><span>I confirm that this separate cover image is non-explicit, contains no visible nudity and is approved for public display.</span></label></div><button className="button button-dark" disabled={!file || uploadProgress !== null}>{uploadProgress !== null && uploadProgress > 0 && uploadProgress < 100 ? `Uploading ${uploadProgress}%…` : 'Add to my private collection'} <ArrowUpRight size={14}/></button>{uploadProgress !== null && <div className="media-upload-progress" role="status" aria-live="polite"><div className="media-upload-progress-track"><span style={{width: `${uploadProgress}%`}}/></div><small>{uploadProgress}% uploaded</small></div>}{uploadMessage && <div className={uploadMessage.startsWith('Error:') ? 'inline-error' : 'inline-success'}>{uploadMessage}</div>}</form><div className="admin-panel"><div className="admin-panel-heading"><h3>All content</h3><span>{content.length} items</span></div><div className="admin-table"><div className="admin-table-head"><span>TITLE</span><span>TYPE</span><span>ACCESS</span><span>STATUS</span></div>{content.map((x: any) => <div className="admin-table-row admin-content-row" key={x.id}><strong>{x.title}</strong><span>{x.content_type}</span><span>{x.access_level}</span><span className={`status-chip ${x.is_published ? 'published' : 'draft'}`}>{x.is_published ? 'Published' : 'Draft'}</span><button className="small-link" onClick={async () => { const next = !x.is_published; const { error } = await supabase!.from('content_items').update({ is_published: next, published_at: next ? new Date().toISOString() : null }).eq('id', x.id); if (!error) queryClient.invalidateQueries({ queryKey: ['owner-content'] }); }}>{x.is_published ? 'Unpublish' : 'Publish'}</button><button className="small-link delete-link" onClick={async () => { if (!window.confirm(`Permanently remove “${x.title}” and its stored media?`)) return; const { error } = await supabase!.from('content_items').delete().eq('id', x.id); if (error) { setUploadMessage(`Error: ${error.message}`); return; } await supabase!.storage.from('private-content').remove([x.storage_path]); if (x.preview_storage_path) await supabase!.storage.from('content-previews').remove([x.preview_storage_path]); queryClient.invalidateQueries({ queryKey: ['owner-content'] }); }}>Delete</button></div>)}</div></div></>}
      {tab === 'members' && <><div className="admin-content-title"><div><h2>Members</h2><p>Manage the adults who have joined your private edition. Suspended accounts lose access to paid media, messaging and checkout.</p></div><span className="live-pill">{members.length} ACCOUNTS</span></div><div className="admin-panel"><div className="admin-table"><div className="admin-table-head member-table-head"><span>MEMBER</span><span>USERNAME</span><span>JOINED</span><span>STATUS</span><span>ACTION</span></div>{members.map((m: any) => <div className="admin-table-row member-table-row" key={m.id}><strong>{m.full_name || 'Member'}</strong><span>@{m.username || '—'}</span><span>{formatDate(m.created_at)}</span><span className={`status-chip ${m.status === 'suspended' ? 'draft' : 'published'}`}>{m.status === 'suspended' ? 'Suspended' : 'Active'}</span><button className={`small-link ${m.status === 'suspended' ? '' : 'delete-link'}`} onClick={async () => { const nextStatus = m.status === 'suspended' ? 'active' : 'suspended'; const { error } = await supabase!.from('profiles').update({ status: nextStatus }).eq('id', m.id); if (!error) queryClient.invalidateQueries({ queryKey: ['owner-members'] }); }}>{m.status === 'suspended' ? 'Restore' : 'Suspend'}</button></div>)}</div>{!members.length && <p className="empty-table">New member registrations will appear here.</p>}</div></>}
      {tab === 'plans' && <><div className="admin-content-title"><div><h2>Membership plans</h2><p>Set the price, duration and private access included in each membership.</p></div></div><PlanAdminPanel/></>}
      {tab === 'payments' && <><div className="admin-content-title"><div><h2>Bitcoin payments</h2><p>Review Bitcoin invoices, settlement and order status. Partial, late and overpaid transactions remain locked for your review.</p></div><span className="live-pill">{paymentOrders.length} RECENT ORDERS</span></div><div className="admin-panel owner-payments-panel"><div className="admin-table"><div className="admin-table-head owner-payment-head"><span>ORDER</span><span>MEMBER</span><span>TYPE</span><span>AMOUNT</span><span>STATUS</span><span>DATE</span></div>{paymentOrders.map((o: any) => <div className="admin-table-row owner-payment-row" key={o.id}><div className="owner-order-id"><strong>#{o.id.slice(0, 8).toUpperCase()}</strong><small>Invoice · {o.provider_invoice_id || 'Pending'}</small>{o.transaction_id && <small>TX · {o.transaction_id}</small>}</div><span>{o.user_id.slice(0, 8)}…</span><span>{o.product_type}</span><span>{formatCurrency(Number(o.amount), o.currency)}</span><span className={`status-chip ${o.status === 'confirmed' ? 'published' : 'draft'}`}>{o.status.replaceAll('_', ' ')}</span><span>{formatDate(o.created_at)}</span></div>)}{!paymentOrders.length && <p className="empty-table">No member has started a Bitcoin checkout yet.</p>}</div></div></>}
      </div></div></div>;
}
function Metric({ label, value, icon, hint }: { label: string; value: string; icon: ReactNode; hint: string }) { return <div className="admin-metric"><span>{label}</span><strong>{value}</strong><small>{hint}</small><i>{icon}</i></div>; }
function PlanAdminPanel() {
  const queryClient = useQueryClient();
  const { data: plans = fallbackPlans } = usePlans();
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState(''); const [slug, setSlug] = useState('');
  const [description, setDescription] = useState(''); const [price, setPrice] = useState('');
  const [days, setDays] = useState('30'); const [tier, setTier] = useState('1');
  const [canChat, setCanChat] = useState(false); const [benefits, setBenefits] = useState('');
  const [status, setStatus] = useState(''); const [busy, setBusy] = useState(false);
  const reset = () => { setEditing(null); setName(''); setSlug(''); setDescription(''); setPrice(''); setDays('30'); setTier('1'); setCanChat(false); setBenefits(''); };
  const edit = (p: MembershipPlan) => { setEditing(p.id); setName(p.name); setSlug(p.slug); setDescription(p.description); setPrice(String(p.price_amount)); setDays(String(p.duration_days)); setTier(String(p.access_tier)); setCanChat(p.can_chat); setBenefits((p.benefits || []).join('\n')); setStatus(''); };
  const save = async (e: FormEvent) => {
    e.preventDefault(); setStatus('');
    if (!supabase || !name.trim() || !slug.trim() || Number(price) <= 0 || Number(days) <= 0) { setStatus('Complete the required plan details.'); return; }
    setBusy(true);
    const payload = { name: name.trim(), slug: slug.trim().toLowerCase().replace(/\s+/g, '-'), description: description.trim(), price_amount: Number(price), currency: 'USD', duration_days: Number(days), access_tier: Number(tier), can_chat: canChat, benefits: benefits.split('\n').map((x) => x.trim()).filter(Boolean) };
    const result = editing ? await supabase.from('membership_plans').update(payload).eq('id', editing) : await supabase.from('membership_plans').insert(payload);
    setBusy(false);
    if (result.error) { setStatus(result.error.message); return; }
    setStatus(editing ? 'Membership plan updated.' : 'Membership plan created.'); reset(); queryClient.invalidateQueries({ queryKey: ['membership-plans'] });
  };
  const toggle = async (p: MembershipPlan) => { if (!supabase) return; const { error } = await supabase.from('membership_plans').update({ is_active: !p.is_active }).eq('id', p.id); if (error) setStatus(error.message); else queryClient.invalidateQueries({ queryKey: ['membership-plans'] }); };
  return <>
    <form className="admin-upload-form plan-editor-form" onSubmit={save}>
      <div className="plan-editor-heading"><h3>{editing ? 'Edit membership plan' : 'Create a membership plan'}</h3>{editing && <button type="button" className="small-link" onClick={reset}>Cancel edit <X size={13}/></button>}</div>
      <div className="admin-form-grid"><label>Plan name<input value={name} onChange={(e) => setName(e.target.value)} required placeholder="The Private Suite"/></label><label>Plan slug<input value={slug} onChange={(e) => setSlug(e.target.value)} required placeholder="private-suite"/></label><label>Price (USD)<input type="number" min="1" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required/></label><label>Duration in days<input type="number" min="1" value={days} onChange={(e) => setDays(e.target.value)} required/></label><label>Access tier<select value={tier} onChange={(e) => setTier(e.target.value)}><option value="1">Tier 1 — Members</option><option value="2">Tier 2 — Enhanced</option><option value="3">Tier 3 — VIP</option></select></label><label className="chat-toggle-label">One-to-one chat included <input type="checkbox" checked={canChat} onChange={(e) => setCanChat(e.target.checked)}/></label><label className="full-field">Description<textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this membership includes…"/></label><label className="full-field">Benefits (one per line)<textarea value={benefits} onChange={(e) => setBenefits(e.target.value)} placeholder={'Members-only intimate picture sets\nPrivate erotic film collection'}/></label></div>
      <button className="button button-dark" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save plan changes' : 'Create membership plan'} <ArrowUpRight size={14}/></button>{status && <div className={status.includes('updated') || status.includes('created') ? 'inline-success' : 'inline-error'}>{status}</div>}
    </form>
    <div className="admin-plan-list">{plans.map((p) => <div key={p.id} className="admin-plan-row"><div className="admin-plan-symbol"><Crown/></div><div><strong>{p.name}</strong><small>{p.duration_days} days · Tier {p.access_tier} · {p.can_chat ? 'Chat included' : 'No chat'}</small></div><b>{formatCurrency(p.price_amount, p.currency)}</b><span className={`status-chip ${p.is_active ? 'published' : 'draft'}`}>{p.is_active ? 'Active' : 'Inactive'}</span><button className="small-link" onClick={() => edit(p)}>Edit</button><button className="small-link" onClick={() => toggle(p)}>{p.is_active ? 'Deactivate' : 'Activate'}</button></div>)}</div>
  </>;
}

export function AccountPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [name, setName] = useState(profile?.full_name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setName(profile?.full_name || ''); setUsername(profile?.username || ''); }, [profile]);
  if (!user) return <AuthGate title="Your account, your way." copy="Sign in to manage your profile and account details."/>;
  const save = async (e: FormEvent) => {
    e.preventDefault(); if (!supabase) return; setBusy(true); setStatus('');
    const { error } = await supabase.from('profiles').update({ full_name: name.trim(), username: username.trim() }).eq('id', user.id);
    setBusy(false); setStatus(error ? error.message : 'Your profile has been updated.'); if (!error) await refreshProfile();
  };
  return <div className="account-settings-page page-shell"><div className="page-intro"><SectionEyebrow>YOUR DETAILS</SectionEyebrow><h1>Account <em>settings.</em></h1><p>Keep your personal details current. Your account information is not shown to other members.</p></div><div className="account-settings-card"><div className="settings-profile-head"><div className="settings-avatar"><UserRound/></div><div><strong>{profile?.full_name || 'Your profile'}</strong><small>{user.email}</small></div></div><form className="account-settings-form" onSubmit={save}><label>Full name<input value={name} onChange={(e) => setName(e.target.value)} required/></label><label>Username<input value={username} onChange={(e) => setUsername(e.target.value)} required/></label><label>Email address<input value={user.email || ''} disabled/><small>Email changes are handled through Supabase Auth verification.</small></label><button className="button button-dark" disabled={busy}>{busy ? 'Saving…' : 'Save changes'} <ArrowUpRight size={14}/></button>{status && <div className={status.includes('updated') ? 'inline-success' : 'inline-error'}>{status}</div>}</form></div></div>;
}

export function PaymentsPage() {
  const { user } = useAuth();
  const { data: orders = [], isLoading } = useQuery({ queryKey: ['payment-history', user?.id], enabled: Boolean(user && supabase), queryFn: async () => { const { data, error } = await supabase!.from('payment_orders').select('id,product_type,amount,currency,status,provider_invoice_id,checkout_url,created_at,confirmed_at').eq('user_id', user!.id).order('created_at', { ascending: false }); if (error) throw error; return data || []; } });
  if (!user) return <AuthGate title="Your payment history." copy="Sign in to review invoices and payments linked to your account."/>;
  return <div className="account-settings-page page-shell"><div className="page-intro"><SectionEyebrow>ACCOUNT RECORDS</SectionEyebrow><h1>Payment <em>history.</em></h1><p>Your Bitcoin invoices, their payment status and the date each order was created.</p></div><div className="account-table-card"><div className="account-table-head"><span>ORDER</span><span>TYPE</span><span>AMOUNT</span><span>STATUS</span><span>DATE</span><span>ACTION</span></div>{isLoading && <div className="empty-table">Loading payment records…</div>}{orders.map((o: any) => <div className="account-table-row" key={o.id}><strong>#{o.id.slice(0, 8).toUpperCase()}</strong><span>{o.product_type}</span><span>{formatCurrency(Number(o.amount), o.currency)}</span><span className={`status-chip ${o.status === 'confirmed' ? 'published' : 'draft'}`}>{o.status.replaceAll('_', ' ')}</span><span>{formatDate(o.created_at)}</span>{o.status !== 'confirmed' && o.checkout_url ? <a className="small-link" href={o.checkout_url} target="_blank" rel="noreferrer">Continue payment <ArrowUpRight size={12}/></a> : <span>—</span>}</div>)}{!orders.length && !isLoading && <div className="empty-table">No payment orders yet. When you purchase a membership or premium item, your order will appear here.</div>}</div></div>;
}

export function PurchasesPage() {
  const { user } = useAuth();
  const { data: purchases = [], isLoading } = useQuery({ queryKey: ['content-purchases', user?.id], enabled: Boolean(user && supabase), queryFn: async () => { const { data, error } = await supabase!.from('content_purchases').select('id,content_id,status,purchased_at').eq('user_id', user!.id).order('purchased_at', { ascending: false }); if (error) throw error; return data || []; } });
  const { data: content = [] } = useContent();
  if (!user) return <AuthGate title="Your saved purchases." copy="Sign in to see premium photographs and videos that you have unlocked."/>;
  return <div className="account-settings-page page-shell"><div className="page-intro"><SectionEyebrow>YOUR PRIVATE COLLECTION</SectionEyebrow><h1>My <em>purchases.</em></h1><p>Individual content purchases remain connected to your account.</p></div>{isLoading ? <div className="loading-state">Loading purchases…</div> : purchases.length ? <div className="content-grid purchases-grid">{purchases.map((p: any, i: number) => { const item = content.find((x) => x.id === p.content_id); return item ? <ContentCard key={p.id} item={item} index={i}/> : <div className="purchase-unavailable" key={p.id}>Purchased item · {formatDate(p.purchased_at)}</div>; })}</div> : <div className="notice-card"><ImageIcon/><h2>Your personal collection will grow here.</h2><p>Premium items you purchase individually will appear in this space.</p><Link to="/gallery" className="underlined-link">Explore the gallery <ArrowUpRight size={14}/></Link></div>}</div>;
}

export function ContactPage() { return <div className="page-shell contact-page"><SectionEyebrow>A NOTE IS ALWAYS WELCOME</SectionEyebrow><h1>I'd love to hear<br /><em>from you.</em></h1><p>For general enquiries, account help or questions about membership, I read member messages personally. Sign in to ask about membership, account access or your private collection.</p><div className="contact-options"><div><Mail/><span><strong>General enquiries</strong><small>Sign in and send me a private note about your account, membership or access.</small></span></div><div><MessageCircle/><span><strong>Member conversations</strong><small>Members with chat access can write to me directly in a private one-to-one conversation.</small></span></div></div><Link to="/membership" className="button button-dark">Choose your access <ArrowUpRight size={15}/></Link></div>; }

export function LegalPage({ kind }: { kind: 'privacy' | 'terms' | 'refunds' | 'cookies' }) {
  const content = {
    privacy: { title: 'Privacy, with care.', lead: 'Your name, account details and conversations are handled with care.', sections: [['Information we collect', 'The website may collect account information, basic profile details, membership and payment records, and messages you send to the website owner. Payment credentials and wallet private keys are never requested.'], ['How information is used', 'Information is used to manage accounts, verify payments, provide access to purchased content, support private messaging and maintain platform security.'], ['Your choices', 'You may request access to or deletion of personal data, subject to records that must be retained for legal, security or financial purposes. Use the site contact details to make a request.'], ['Protected media', 'Private photographs and videos are stored in restricted storage and delivered through time-limited access links. This reduces public exposure but cannot prevent screen capture or redistribution by an authorized viewer.']] },
    terms: { title: 'Before you enter.', lead: 'A respectful, secure experience begins with shared expectations.', sections: [['Age and eligibility', 'You must be at least 18 years old and legally permitted to access adult-oriented material in your location. A website entry confirmation is not formal identity or age verification; additional age-assurance checks may be required by law.'], ['Accounts', 'You are responsible for keeping your sign-in credentials secure and for activity under your account. Email verification may be required before purchasing or using member features.'], ['Membership and access', 'Membership is prepaid for the displayed duration. Access begins after the payment gateway verifies settlement and ends when the membership expires or is otherwise lawfully terminated.'], ['Adult content and consent', 'This website is intended for adults aged 18 and over. Any adult-oriented content must depict consenting adults who have explicitly agreed to the specific material and its publication. Minors, non-consensual imagery, hidden-camera material, coercion, revenge content and content shared without the subject’s permission are prohibited. The owner may remove material or suspend accounts where consent or rights are unclear.'], ['Content and conduct', 'Content is for personal viewing only. Do not copy, redistribute, publish, scrape or attempt to bypass access controls. Respectful conduct is required in private conversations.'], ['Payments', 'Bitcoin payments are processed through the configured payment provider. The amount, invoice expiry and payment status shown by the provider govern checkout. Never send funds to an address supplied outside the official checkout.']] },
    refunds: { title: 'The refund policy.', lead: 'Please review each purchase carefully before completing a Bitcoin payment.', sections: [['Digital memberships', 'Because access to digital content may begin immediately after confirmed payment, membership purchases are generally non-refundable once access has been granted, except where applicable law requires otherwise.'], ['Duplicate or incorrect payments', 'Contact the site owner with the order reference and transaction details. Never send a wallet seed phrase or private key. Each case will be reviewed against payment records.'], ['Underpayments and overpayments', 'Payments that do not match the invoice may remain pending or require manual reconciliation with the payment provider. Do not assume access is active until the order shows confirmed.'], ['Statutory rights', 'Nothing in this policy removes rights that cannot legally be excluded in the buyer’s jurisdiction.']] },
    cookies: { title: 'A lighter digital footprint.', lead: 'Cookies and browser storage help the site work securely and remember your session.', sections: [['Essential storage', 'Authentication uses secure session storage managed by the Supabase client. Essential cookies or browser storage may be required for sign-in and account security.'], ['Analytics', 'No analytics provider is enabled in this starter. The owner should disclose any analytics or marketing tools before enabling them.'], ['Your controls', 'You can clear browser cookies and site data through your browser settings. Doing so may sign you out.']] },
  }[kind];
  return <div className="legal-page page-shell"><div className="legal-topline"><SectionEyebrow>INFORMATION & TRANSPARENCY</SectionEyebrow><span>LAST UPDATED · NOVEMBER 2026</span></div><h1>{content.title}</h1><p className="legal-lead">{content.lead}</p><div className="legal-content">{content.sections.map(([h, p], i) => <section key={h}><span>0{i + 1}</span><div><h2>{h}</h2><p>{p}</p></div></section>)}</div><div className="legal-disclaimer">This is starter policy copy and must be reviewed and adapted to the actual owner, data practices, applicable jurisdictions and local legal requirements before launch.</div></div>;
}
