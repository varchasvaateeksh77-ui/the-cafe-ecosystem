import React, { useState } from 'react';
import {
  PRODUCT_THEMES,
  ServiceLevel,
  ThemeId,
} from './themeCatalogData';

interface ThemeCataloguePageProps {
  onInitializeTheme: (config: {
    themeId: ThemeId;
    customBrandName: string;
    serviceLevel: ServiceLevel;
    initialTable: number;
  }) => void;
  onBackToCommandCenter?: () => void;
}

export const ThemeCataloguePage: React.FC<ThemeCataloguePageProps> = ({
  onInitializeTheme,
  onBackToCommandCenter,
}) => {
  const [serviceLevel, setServiceLevel] = useState<ServiceLevel>(3);

  const scrollToTheme = (id: ThemeId) => {
    const el = document.getElementById(`catalogue-theme-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F2ED] text-[#1A0C06] selection:bg-[#E8500C] selection:text-[#FBEFE6]">
      {/* tasteskill.dev Floating Translucent Pill Nav (3-Zone Contract) */}
      <div className="sticky top-4 z-50 px-4 md:px-8 pointer-events-none">
        <header
          style={{
            backgroundColor: 'rgba(20, 9, 5, 0.86)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
          className="pointer-events-auto max-w-[1160px] mx-auto h-14 px-4 md:px-6 rounded-[18px] text-[#FBEFE6] flex items-center justify-between gap-4 border border-[#FBEFE6]/12"
        >
          {/* Zone 1: Brand */}
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-[7px] bg-[#E8500C] text-[#FBEFE6] font-display font-bold text-[14px] flex items-center justify-center tracking-wider">
              BB
            </span>
            <span className="font-semibold text-[15px] tracking-[-0.01em] text-[#FBEFE6]">
              Build Bros
            </span>
            <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-[#FBEFE6] text-[#1A0C06] text-[11px] font-semibold">
              Theme Catalogue
            </span>
          </div>

          {/* Zone 2: 4 Theme Jump Links */}
          <nav
            aria-label="Theme jump links"
            className="hidden lg:flex items-center gap-5 text-[13px] text-[#D8C7B8]"
          >
            {PRODUCT_THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                onClick={() => scrollToTheme(theme.id)}
                className="hover:text-[#FBEFE6] transition-colors cursor-pointer"
              >
                {theme.indexNumber}. {theme.styleName}
              </button>
            ))}
          </nav>

          {/* Zone 3: Command Center Return */}
          <div className="flex items-center gap-2">
            {onBackToCommandCenter && (
              <button
                type="button"
                onClick={onBackToCommandCenter}
                className="px-3.5 py-1.5 rounded-[10px] bg-[#E8500C] text-[#FBEFE6] text-[12px] font-semibold cursor-pointer transition-opacity hover:opacity-90"
              >
                4-Surface APK Suite
              </button>
            )}
          </div>
        </header>
      </div>

      {/* Sunrise-to-Cream Editorial Hero */}
      <section
        style={{
          background:
            'linear-gradient(180deg, rgba(232, 80, 12, 0.14) 0%, rgba(247, 242, 237, 0) 100%)',
        }}
        className="pt-14 pb-16 md:pt-20 md:pb-24 px-4 md:px-8"
      >
        <div className="max-w-[1040px] mx-auto text-center">
          <p className="font-mono-code text-[12px] uppercase tracking-[0.14em] text-[#E8500C] mb-4">
            THE CAFE ECOSYSTEM · 4-THEME MENU CATALOGUE
          </p>
          <h1 className="font-sans font-bold text-[clamp(2.5rem,6vw,5.25rem)] leading-[1.02] tracking-[-0.04em] text-[#1A0C06] max-w-[18ch] mx-auto">
            Pick a theme. Run the restaurant live.
          </h1>
          <p className="font-serif-editorial text-[18px] md:text-[21px] text-[#5C493E] mt-5 max-w-[54ch] mx-auto leading-[1.55]">
            Four uncluttered ordering templates crafted for local bistros, coffee roasteries, burger joints, and wood-fired pizzerias. Launch any theme below to try the guest menu, table floor, and kitchen pass.
          </p>

          {/* Simple 3-Pill Default Level Selector */}
          <div className="mt-9 inline-flex flex-wrap items-center justify-center gap-2 p-1.5 rounded-[16px] bg-[#EFE6DC] border border-[#1A0C06]/10">
            {(
              [
                { level: 1 as ServiceLevel, label: 'Level 1 · Digital Menu' },
                { level: 2 as ServiceLevel, label: 'Level 2 · Waiter Call' },
                { level: 3 as ServiceLevel, label: 'Level 3 · Full Ordering' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.level}
                type="button"
                onClick={() => setServiceLevel(opt.level)}
                className={`px-4 py-2 rounded-[12px] text-[13px] font-medium cursor-pointer transition-colors ${
                  serviceLevel === opt.level
                    ? 'bg-[#1A0C06] text-[#FBEFE6] font-semibold'
                    : 'text-[#5C493E] hover:text-[#1A0C06]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Spacious Single-Column Stack of 4 Theme Showcases */}
      <main className="max-w-[1160px] mx-auto px-4 md:px-8 pb-24 space-y-12 md:space-y-16">
        {PRODUCT_THEMES.map((theme) => (
          <article
            key={theme.id}
            id={`catalogue-theme-${theme.id}`}
            data-testid={`theme-card-${theme.id}`}
            style={{
              backgroundColor: theme.palette.canvas,
              color: theme.palette.text,
              borderColor: theme.palette.border,
            }}
            className="rounded-[28px] border p-6 md:p-10 lg:p-12 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center"
          >
            {/* Left Column: Clean Studio Visual Stage (7 cols) */}
            <div className="lg:col-span-7">
              <div
                className="relative aspect-[16/10] rounded-[20px] overflow-hidden border"
                style={{ borderColor: theme.palette.border }}
              >
                <img
                  src={theme.heroImage}
                  alt={`${theme.styleName} — ${theme.defaultVenueName}`}
                  className="w-full h-full object-cover"
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(to top, rgba(12, 10, 8, 0.78) 0%, rgba(12, 10, 8, 0.12) 55%, rgba(12, 10, 8, 0.3) 100%)',
                  }}
                />

                {/* Top Index & Vibe */}
                <div className="absolute top-4 left-5 right-5 flex items-center justify-between text-[#FBEFE6]">
                  <span className="font-mono-code text-[12px] uppercase tracking-[0.14em] px-3 py-1 rounded-full bg-[#140905]/75 backdrop-blur-sm">
                    {theme.indexNumber} · {theme.styleName}
                  </span>
                  <span className="font-mono-code text-[11px] uppercase tracking-[0.12em] px-3 py-1 rounded-full bg-[#140905]/65 backdrop-blur-sm">
                    DEMO · Table 5
                  </span>
                </div>

                {/* Bottom Palette Dots & Venue Subtitle */}
                <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between gap-4 text-[#FBEFE6]">
                  <div>
                    <p className="font-mono-code text-[11px] uppercase tracking-[0.14em] text-[#E6D5C3]">
                      {theme.venueSubtitle}
                    </p>
                    <p
                      style={{ fontFamily: theme.displayFont }}
                      className="text-[28px] md:text-[34px] font-bold leading-tight mt-0.5"
                    >
                      {theme.defaultVenueName}
                    </p>
                  </div>

                  {/* 4 Quiet Palette Dots */}
                  <div className="flex items-center gap-1.5 bg-[#140905]/70 px-3 py-2 rounded-full">
                    {[
                      theme.palette.canvas,
                      theme.palette.surface,
                      theme.palette.text,
                      theme.palette.accent,
                    ].map((hex, i) => (
                      <span
                        key={i}
                        title={hex}
                        style={{ backgroundColor: hex }}
                        className="w-4 h-4 rounded-full border border-white/25 block"
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Spacious Editorial Summary + 3 Sample Dishes + Launch CTA (5 cols) */}
            <div className="lg:col-span-5 flex flex-col justify-between space-y-7">
              <div>
                <span
                  className="font-mono-code text-[11px] uppercase tracking-[0.16em] block mb-2"
                  style={{ color: theme.palette.accent }}
                >
                  THEME {theme.indexNumber} · {theme.styleName.toUpperCase()}
                </span>
                <h2
                  style={{ fontFamily: theme.displayFont }}
                  className="text-[32px] md:text-[40px] leading-[1.04] font-bold"
                >
                  {theme.defaultVenueName}
                </h2>
                <p
                  className="text-[16px] leading-[1.6] mt-3"
                  style={{ color: theme.palette.muted }}
                >
                  {theme.tagline}
                </p>
              </div>

              {/* Clean 3-Dish Tasting Preview (Zero Clutter) */}
              <div
                className="border-t border-b divide-y"
                style={{ borderColor: theme.palette.border }}
              >
                {theme.menu.slice(0, 3).map((dish) => (
                  <div
                    key={dish.id}
                    className="py-3.5 flex items-baseline justify-between gap-4"
                    style={{ borderColor: theme.palette.border }}
                  >
                    <span className="text-[15px] font-medium">
                      {dish.name}
                    </span>
                    <span
                      className="font-mono-code text-[14px] font-semibold tabular-nums shrink-0"
                      style={{ color: theme.palette.accent }}
                    >
                      {theme.currencySymbol}
                      {dish.price.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Single Uncluttered Primary Action */}
              <div className="pt-1 flex flex-wrap items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() =>
                    onInitializeTheme({
                      themeId: theme.id,
                      customBrandName: theme.defaultVenueName,
                      serviceLevel,
                      initialTable: 5,
                    })
                  }
                  style={{
                    backgroundColor: theme.palette.accent,
                    color: theme.palette.accentText,
                    borderRadius: theme.buttonRadius,
                  }}
                  className="w-full sm:w-auto px-7 py-3.5 font-mono-code text-[13px] font-semibold uppercase tracking-[0.1em] cursor-pointer transition-opacity hover:opacity-90"
                >
                  Launch {theme.styleName} →
                </button>

                <span
                  className="font-mono-code text-[11px] uppercase tracking-[0.1em]"
                  style={{ color: theme.palette.muted }}
                >
                  {theme.menu.length} Dishes · Level {serviceLevel}
                </span>
              </div>
            </div>
          </article>
        ))}
      </main>
    </div>
  );
};
