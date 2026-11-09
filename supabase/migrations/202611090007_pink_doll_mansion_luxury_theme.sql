-- Update only the two known starter palettes to the Pink Doll Mansion nude/champagne theme.
-- Owner-customized palettes are intentionally left untouched.

update public.site_appearance
set theme = jsonb_build_object(
  'primary',   '#98506A',
  'accent',    '#D79AAA',
  'background','#F7EFE8',
  'surface',   '#FFF9F4',
  'text',      '#30212A',
  'muted',     '#8E777D',
  'deep',      '#291A25',
  'highlight', '#D7B19B',
  'border',    '#E8D8D0'
),
updated_at = now()
where id = true
  and (
    (
      theme->>'primary' = '#B83268'
      and theme->>'accent' = '#E58BAC'
      and theme->>'background' = '#FFF7FA'
      and theme->>'surface' = '#FCE7EF'
      and theme->>'text' = '#2B1721'
      and theme->>'muted' = '#987585'
      and theme->>'deep' = '#4A1630'
      and theme->>'highlight' = '#F4BDD0'
      and theme->>'border' = '#F2D5E0'
    )
    or
    (
      theme->>'primary' = '#54253c'
      and theme->>'accent' = '#c17c91'
      and theme->>'background' = '#fbf5f3'
      and theme->>'surface' = '#f1e2e4'
      and theme->>'text' = '#2b1a24'
      and theme->>'muted' = '#907b83'
      and theme->>'deep' = '#321923'
      and theme->>'highlight' = '#d6a0ae'
      and theme->>'border' = '#e8d8dc'
    )
  );
