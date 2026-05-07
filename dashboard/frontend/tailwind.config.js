/** @type {import('tailwindcss').Config} */

// ─── BetTrack Design Token System ────────────────────────────────────────────
//
// Brand identity: Wild West cowboy + analytical rigor.
// Voice: sharp-tongued sidekick. Visual: retro pixel art, bold red, dark surfaces.
//
// Token conventions:
//   brand-*    → Red ramp. The brand color. Use for all primary actions, active
//                nav states, CTAs, and emphasis. NOT for semantic "error" states —
//                use red-* for those so they read as errors, not as brand.
//
//   surface-*  → Dark-optimized gray ramp for backgrounds and cards. Prefer
//                surface-* over raw gray-* for layout surfaces so refactors
//                stay contained. surface-900 = dark page bg, surface-800 = dark
//                card, surface-700 = dark elevated surface.
//
//   win        → Semantic green. Winning bets, positive P&L, favorable odds.
//   loss       → Semantic red (aliases brand). Losing bets, negative P&L.
//   push       → Semantic gray. Tied/voided bets, neutral outcomes.
//   live       → Semantic amber. In-progress games, live data indicators.
//   info       → Semantic blue. Informational badges, links, helper text.
//                (Blue is no longer a primary/brand color — use brand-* for that.)
//
//   font.display → Monospace stack. Brand headings, page titles, hero copy.
//                  Matches the inline fontFamily used throughout Home.tsx.
//                  Swap `font-mono` → `font-display` on all heading elements.
//   font.body    → Inter stack. Body text, data tables, form labels.
//   font.mono    → Same monospace stack. Code, odds numbers, precise values.
//
//   shadow.pixel-*   → Offset box shadows for the retro pixel aesthetic.
//   shadow.card      → Standard elevated card shadow (dark-mode aware via CSS var).
//
// Migration path:
//   1. Replace `bg-blue-600` active states in Header.tsx → `bg-brand-600`
//   2. Replace `font-family: ui-monospace` inline styles → `font-display` class
//   3. Replace `boxShadow: '0 6px 0 ...'` inline styles → `shadow-pixel-btn` etc.
//   4. Replace `primary-*` references → `brand-*` (only 2 exist)
//   5. For semantic bet outcomes: replace ad-hoc green/red → win/loss tokens
//
// DO NOT change: gray-*, green-*, yellow-*, purple-* raw utilities. Components
// that use those directly still work. Migrate to semantic tokens over time.
// ─────────────────────────────────────────────────────────────────────────────

export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {

      // ── Colors ──────────────────────────────────────────────────────────────
      colors: {

        // Brand red — the primary BetTrack color.
        // Use: CTAs, active nav, focus rings, primary buttons, accent borders.
        // Avoid: semantic error states (use red-* for those).
        // Reference: Home.tsx hero (#dc2626 = brand-600), shadow (#991b1b = brand-800).
        brand: {
          50:  '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',  // ← primary brand color (hero, CTAs, active nav)
          700: '#b91c1c',  // ← hover states
          800: '#991b1b',  // ← pixel button shadow color
          900: '#7f1d1d',  // ← deep shadow, pressed state
          950: '#450a0a',
        },

        // Primary = brand alias so that .btn-primary and any primary-* utilities
        // resolve to brand-red without touching those references during migration.
        primary: {
          50:  '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
          950: '#450a0a',
        },

        // Surface — dark-optimized gray for backgrounds, cards, and panels.
        // Mirrors Tailwind gray but with a semantic name so surface-level
        // layout decisions stay easy to refactor.
        // Dark mode: surface-900 (page) → surface-800 (card) → surface-700 (elevated).
        // Light mode: surface-50 (page) → white (card) → surface-100 (elevated).
        surface: {
          50:  '#f9fafb',  // light mode page bg (= gray-50)
          100: '#f3f4f6',  // light mode elevated surface
          200: '#e5e7eb',  // light mode border
          300: '#d1d5db',  // light mode muted border
          400: '#9ca3af',  // mid — muted text on dark
          500: '#6b7280',  // mid — secondary text
          600: '#4b5563',  // dark mode elevated border
          700: '#374151',  // dark mode elevated surface (= gray-700)
          800: '#1f2937',  // dark mode card bg (= gray-800)
          900: '#111827',  // dark mode page bg (= gray-900)
          950: '#030712',  // deepest dark — pixel shadow color
        },

        // ── Semantic betting outcome tokens ───────────────────────────────────
        // Use these for bet status indicators, P&L values, outcome badges.
        // Do NOT use for general UI — these carry specific meaning.

        win: {
          // Green. Winning bets, positive P&L, favorable line movement.
          50:  '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',  // ← primary win indicator
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },

        loss: {
          // Red — aliased to brand. Losing bets, negative P&L.
          // Intentionally shares the brand ramp: losing hurts, the brand knows it.
          50:  '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',  // ← primary loss indicator (= brand-600)
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
          950: '#450a0a',
        },

        push: {
          // Gray. Tied/voided bets, no-result outcomes.
          50:  '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',  // ← primary push indicator
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
          950: '#030712',
        },

        live: {
          // Amber. In-progress games, live score indicators, real-time data.
          50:  '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',  // ← primary live indicator
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          950: '#451a03',
        },

        info: {
          // Blue — informational only. NOT a brand color.
          // Use for: informational badges, help text, hyperlinks, secondary accents.
          // Do NOT use for primary actions, active states, or brand identity.
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',  // ← informational accent (was incorrectly the brand color)
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },

      },

      // ── Typography ──────────────────────────────────────────────────────────
      fontFamily: {
        // Brand display font — monospace. Use on all headings, page titles,
        // section headers, hero copy, and CTAs that express the brand voice.
        // Replaces the 67 inline `fontFamily: 'ui-monospace, SFMono-Regular...'`
        // style attributes throughout the codebase.
        // Usage: className="font-display"
        display: [
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          '"Liberation Mono"',
          '"Courier New"',
          'monospace',
        ],
        // Body font — Inter. Use for body text, data tables, form labels,
        // supporting copy. Defined explicitly so it's a named token.
        // Usage: className="font-body" (or omit — it's the default)
        body: [
          'Inter',
          'system-ui',
          'Avenir',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        // Mono — same stack as display. Use specifically for code, odds numbers,
        // and precise numeric values where a code-like context is intended.
        // Usage: className="font-mono"
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          '"Liberation Mono"',
          '"Courier New"',
          'monospace',
        ],
      },

      // ── Box Shadows ─────────────────────────────────────────────────────────
      // Pixel art offset shadows — the core of the retro visual language.
      // These replace the 33 inline boxShadow style attributes.
      //
      // Convention: the "pixel" shadow is always a hard offset (no blur),
      // giving the flat retro look. The shadow color is always surface-950
      // (near-black) for card shadows, and brand-800 (#991b1b) for button shadows.
      //
      // Dark mode note: CSS variables aren't supported directly in Tailwind
      // shadow values. Use dark: variants to swap between light/dark shadows
      // where needed, or use the -dark suffixed variants explicitly.
      boxShadow: {
        // Standard pixel shadows — hard offset, no blur. Dark mode friendly.
        'pixel-sm':  '2px 2px 0px #030712',        // subtle depth
        'pixel':     '4px 4px 0px #030712',        // standard card depth
        'pixel-lg':  '6px 6px 0px #030712',        // hero/prominent card depth

        // Light mode pixel shadows — use with light: variant or on light surfaces
        'pixel-sm-light':  '2px 2px 0px #9ca3af',
        'pixel-light':     '4px 4px 0px #9ca3af',
        'pixel-lg-light':  '6px 6px 0px #9ca3af',

        // Button press shadows — brand-red bottom edge, matching Home.tsx CTAs.
        // Creates the 3D "raised button" pixel art effect.
        // Usage: className="shadow-pixel-btn hover:shadow-pixel-btn-pressed"
        'pixel-btn':         '0 6px 0 #991b1b, 0 10px 20px rgba(0,0,0,0.4)',
        'pixel-btn-pressed': '0 2px 0 #991b1b, 0 4px 8px rgba(0,0,0,0.4)',

        // Card lift shadow — matches the Home.tsx feature cards.
        // Use on .card-pixel components.
        'pixel-card':      '0 6px 0 #374151, 0 10px 20px rgba(0,0,0,0.3)',
        'pixel-card-light':'0 6px 0 #9ca3af, 0 10px 20px rgba(0,0,0,0.15)',

        // Standard elevated card — subtle, for app UI cards (not pixel-art style).
        // Matches the existing shadow-md usage but slightly more refined.
        'card': '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)',
      },

      // ── Border Radius ───────────────────────────────────────────────────────
      borderRadius: {
        // Pixel — no radius. Use on pixel-art styled elements (buttons, cards)
        // to match the hard-edged retro aesthetic of Home.tsx.
        'pixel': '0px',
        // Retain all Tailwind defaults (sm, md, lg, xl, 2xl, full) — these are
        // used on app-interior UI components where rounded corners are appropriate.
      },

      // ── Text Shadow (via CSS variable workaround) ───────────────────────────
      // Tailwind doesn't support text-shadow natively. The textShadow utilities
      // below are available via the custom plugin at the bottom of this config.
      // Usage: className="text-shadow-pixel" / "text-shadow-pixel-lg"

    },
  },

  plugins: [
    // Text shadow plugin — adds font-display-level text shadows for headings.
    // Matches the inline textShadow styles in Home.tsx hero and section headers.
    function({ addUtilities }) {
      addUtilities({
        '.text-shadow-pixel': {
          'text-shadow': '3px 3px 0px rgba(0,0,0,0.5)',
        },
        '.text-shadow-pixel-lg': {
          'text-shadow': '6px 6px 0px rgba(0,0,0,0.8), 0 0 20px rgba(220,38,38,0.4)',
        },
        '.text-shadow-pixel-glow': {
          'text-shadow': '3px 3px 0px rgba(0,0,0,0.8), 0 0 20px rgba(220,38,38,0.5)',
        },
        '.text-shadow-none': {
          'text-shadow': 'none',
        },
      })
    },
  ],
}

