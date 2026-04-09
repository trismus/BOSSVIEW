/**
 * DesignCheckPage — visual reference for the SKYNEX Design System v1.0.
 *
 * Renders every color token, the type scale, and the base components so
 * that developers and reviewers can verify the design system is wired up
 * correctly and matches docs/branding/skynex-design-system.md.
 *
 * Accessible at /design-check. Not a product surface — pure reference.
 */

interface ColorSwatch {
  name: string;
  cssVar: string;
  description: string;
}

const SURFACE_SWATCHES: ColorSwatch[] = [
  { name: 'surface', cssVar: '--skx-surface', description: 'Atmosphere — infinite base' },
  {
    name: 'surface-container-lowest',
    cssVar: '--skx-surface-container-lowest',
    description: 'Recessed inputs',
  },
  {
    name: 'surface-container-low',
    cssVar: '--skx-surface-container-low',
    description: 'Sidebars, sections',
  },
  {
    name: 'surface-container',
    cssVar: '--skx-surface-container',
    description: 'Primary data groups',
  },
  {
    name: 'surface-container-high',
    cssVar: '--skx-surface-container-high',
    description: 'Hover / active',
  },
];

const PRIMARY_SWATCHES: ColorSwatch[] = [
  { name: 'primary', cssVar: '--skx-primary', description: 'Neon accent, KPIs' },
  {
    name: 'primary-container',
    cssVar: '--skx-primary-container',
    description: 'Gradient end-stop, CTA glow',
  },
  { name: 'on-primary', cssVar: '--skx-on-primary', description: 'Text on primary' },
];

const STATUS_SWATCHES: ColorSwatch[] = [
  { name: 'error', cssVar: '--skx-error', description: 'Critical alerts, outages' },
  { name: 'warning', cssVar: '--skx-warning', description: 'Degraded, needs attention' },
  { name: 'success', cssVar: '--skx-success', description: 'Healthy, green state' },
  { name: 'info', cssVar: '--skx-info', description: 'Neutral info' },
];

const TEXT_SWATCHES: ColorSwatch[] = [
  { name: 'on-surface', cssVar: '--skx-on-surface', description: 'Primary text' },
  {
    name: 'on-surface-variant',
    cssVar: '--skx-on-surface-variant',
    description: 'Secondary text',
  },
  {
    name: 'on-surface-dim',
    cssVar: '--skx-on-surface-dim',
    description: 'Tertiary / metadata',
  },
];

const TYPE_SCALE: { name: string; sizeVar: string; lineVar: string; sample: string }[] = [
  {
    name: 'display-lg',
    sizeVar: '--skx-text-display-lg-size',
    lineVar: '--skx-text-display-lg-line',
    sample: 'Display Large',
  },
  {
    name: 'display-md',
    sizeVar: '--skx-text-display-md-size',
    lineVar: '--skx-text-display-md-line',
    sample: 'Display Medium',
  },
  {
    name: 'display-sm',
    sizeVar: '--skx-text-display-sm-size',
    lineVar: '--skx-text-display-sm-line',
    sample: 'Display Small',
  },
  {
    name: 'headline-lg',
    sizeVar: '--skx-text-headline-lg-size',
    lineVar: '--skx-text-headline-lg-line',
    sample: 'Headline Large',
  },
  {
    name: 'headline-md',
    sizeVar: '--skx-text-headline-md-size',
    lineVar: '--skx-text-headline-md-line',
    sample: 'Headline Medium',
  },
  {
    name: 'headline-sm',
    sizeVar: '--skx-text-headline-sm-size',
    lineVar: '--skx-text-headline-sm-line',
    sample: 'Headline Small',
  },
  {
    name: 'title-lg',
    sizeVar: '--skx-text-title-lg-size',
    lineVar: '--skx-text-title-lg-line',
    sample: 'Title Large',
  },
  {
    name: 'title-md',
    sizeVar: '--skx-text-title-md-size',
    lineVar: '--skx-text-title-md-line',
    sample: 'Title Medium',
  },
  {
    name: 'body-lg',
    sizeVar: '--skx-text-body-lg-size',
    lineVar: '--skx-text-body-lg-line',
    sample: 'The quick brown fox jumps over the lazy dog. 0123456789',
  },
  {
    name: 'body-md',
    sizeVar: '--skx-text-body-md-size',
    lineVar: '--skx-text-body-md-line',
    sample: 'The quick brown fox jumps over the lazy dog. 0123456789',
  },
  {
    name: 'body-sm',
    sizeVar: '--skx-text-body-sm-size',
    lineVar: '--skx-text-body-sm-line',
    sample: 'The quick brown fox jumps over the lazy dog. 0123456789',
  },
];

function ColorRow({ swatches }: { swatches: ColorSwatch[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
      {swatches.map((swatch) => (
        <div
          key={swatch.name}
          className="flex items-center gap-3 rounded-skx-md p-3"
          style={{ background: 'var(--skx-surface-container)' }}
        >
          <div
            className="h-12 w-12 flex-shrink-0 rounded-skx-sm"
            style={{
              background: `var(${swatch.cssVar})`,
              border: '1px solid var(--skx-outline-variant-ghost)',
            }}
            aria-label={`Swatch for ${swatch.name}`}
          />
          <div className="min-w-0 flex-1">
            <div className="font-mono text-body-sm" style={{ color: 'var(--skx-on-surface)' }}>
              {swatch.name}
            </div>
            <div className="font-mono text-body-sm" style={{ color: 'var(--skx-on-surface-dim)' }}>
              {swatch.cssVar}
            </div>
            <div className="text-body-sm" style={{ color: 'var(--skx-on-surface-variant)' }}>
              {swatch.description}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <h2 className="mb-4 font-display text-headline-md" style={{ color: 'var(--skx-on-surface)' }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function DesignCheckPage() {
  return (
    <div
      className="min-h-full p-8 font-body"
      style={{ background: 'var(--skx-surface)', color: 'var(--skx-on-surface)' }}
    >
      <header className="mb-12">
        <h1 className="font-display text-display-sm" style={{ color: 'var(--skx-primary)' }}>
          SKYNEX Design System v1.0
        </h1>
        <p
          className="mt-2 font-body text-body-lg"
          style={{ color: 'var(--skx-on-surface-variant)' }}
        >
          Visual reference for the Tactical Command design language. Every swatch below is wired
          through <code className="font-mono">skynex-tokens.css</code> — no hardcoded hex values.
        </p>
      </header>

      <Section title="Surface Hierarchy">
        <ColorRow swatches={SURFACE_SWATCHES} />
      </Section>

      <Section title="Primary / Neon Accent">
        <ColorRow swatches={PRIMARY_SWATCHES} />
      </Section>

      <Section title="Status Colors">
        <ColorRow swatches={STATUS_SWATCHES} />
      </Section>

      <Section title="Text on Surface">
        <ColorRow swatches={TEXT_SWATCHES} />
      </Section>

      <Section title="Type Scale">
        <div className="skx-card space-y-4">
          {TYPE_SCALE.map((scale) => (
            <div
              key={scale.name}
              className="border-b pb-4 last:border-0 last:pb-0"
              style={{ borderColor: 'var(--skx-outline-variant-ghost)' }}
            >
              <div
                className="mb-1 font-mono text-body-sm"
                style={{ color: 'var(--skx-on-surface-dim)' }}
              >
                {scale.name} · {scale.sizeVar.replace('--skx-text-', '').replace('-size', '')}
              </div>
              <div
                className="font-display"
                style={{
                  fontSize: `var(${scale.sizeVar})`,
                  lineHeight: `var(${scale.lineVar})`,
                  color: 'var(--skx-on-surface)',
                }}
              >
                {scale.sample}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-4">
          <button className="skx-btn-primary">Primary CTA</button>
          <button className="skx-btn-secondary">Secondary</button>
        </div>
      </Section>

      <Section title="Input">
        <div className="max-w-md">
          <input type="text" className="skx-input w-full" placeholder="192.168.1.1" />
        </div>
      </Section>

      <Section title="Cards">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="skx-card">
            <div
              className="mb-2 font-mono text-body-sm"
              style={{ color: 'var(--skx-on-surface-dim)' }}
            >
              Standard .skx-card
            </div>
            <div className="font-body text-body-md" style={{ color: 'var(--skx-on-surface)' }}>
              Primary container for data groups — background uses{' '}
              <code className="font-mono">--skx-surface-container</code>.
            </div>
          </div>
          <div className="skx-card skx-card--recessed">
            <div
              className="mb-2 font-mono text-body-sm"
              style={{ color: 'var(--skx-on-surface-dim)' }}
            >
              Recessed .skx-card--recessed
            </div>
            <div className="font-body text-body-md" style={{ color: 'var(--skx-on-surface)' }}>
              Inset container for inputs and readouts — background uses{' '}
              <code className="font-mono">--skx-surface-container-lowest</code>.
            </div>
          </div>
        </div>
      </Section>

      <Section title="Status Badges">
        <div className="flex flex-wrap gap-3">
          <span className="skx-badge skx-badge--critical">Critical</span>
          <span className="skx-badge skx-badge--warning">Warning</span>
          <span className="skx-badge skx-badge--success">Operational</span>
          <span className="skx-badge skx-badge--info">Info</span>
        </div>
      </Section>

      <Section title="KPI">
        <div className="skx-card flex items-baseline gap-4">
          <div className="skx-kpi">42,318</div>
          <div
            className="font-mono text-body-sm uppercase tracking-wider"
            style={{ color: 'var(--skx-on-surface-variant)' }}
          >
            Assets monitored
          </div>
        </div>
      </Section>

      <Section title="Glassmorphism">
        <div
          className="relative h-48 overflow-hidden rounded-skx-md"
          style={{ background: 'var(--skx-gradient-primary)' }}
        >
          <div className="absolute inset-8 skx-glass flex items-center justify-center">
            <div className="font-display text-title-lg" style={{ color: 'var(--skx-on-surface)' }}>
              .skx-glass overlay
            </div>
          </div>
        </div>
      </Section>

      <Section title="Elevation Shadows">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {(['sm', 'md', 'lg', 'xl'] as const).map((level) => (
            <div
              key={level}
              className="flex h-24 items-center justify-center rounded-skx-md font-mono text-body-sm"
              style={{
                background: 'var(--skx-surface-container)',
                color: 'var(--skx-on-surface-variant)',
                boxShadow: `var(--skx-elevation-${level})`,
              }}
            >
              elevation-{level}
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
