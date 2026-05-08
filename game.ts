@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  /* ─── Root Tokens ─── */
  :root {
    --bg: #F5F5F7;
    --bg-elevated: #FFFFFF;
    --bg-secondary: #EBEBF0;
    --separator: rgba(0,0,0,0.08);
    --separator-strong: rgba(0,0,0,0.15);
    --text: #000000;
    --text-secondary: rgba(0,0,0,0.55);
    --text-tertiary: rgba(0,0,0,0.30);
    --text-quaternary: rgba(0,0,0,0.16);
    --blue: #007AFF;
    --blue-hover: #0051D5;
    --green: #34C759;
    --red: #FF3B30;
    --orange: #FF9500;
    --yellow: #FFCC00;
    --mono: 'SF Mono', SFMono-Regular, ui-monospace, Menlo, monospace;
    --duration: 220ms;
    --spring: cubic-bezier(0.25, 0.46, 0.45, 0.94);
    --bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
    --r: 10px;
    --r-sm: 8px;
    --r-md: 14px;
    --r-lg: 18px;
    --r-xl: 22px;
    --r-full: 9999px;
    --e1: 0 1px 2px rgba(0,0,0,0.04);
    --e2: 0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04);
    --e3: 0 4px 24px rgba(0,0,0,0.08);
    --topbar: 48px;
    --glass: rgba(255,255,255,0.65);
    --glass-border: rgba(0,0,0,0.06);
    --glass-highlight: rgba(255,255,255,0.5);
  }

  [data-theme="dark"] {
    --bg: #000000;
    --bg-elevated: #1C1C1E;
    --bg-secondary: #2C2C2E;
    --separator: rgba(255,255,255,0.08);
    --separator-strong: rgba(255,255,255,0.15);
    --text: #FFFFFF;
    --text-secondary: rgba(255,255,255,0.55);
    --text-tertiary: rgba(255,255,255,0.30);
    --text-quaternary: rgba(255,255,255,0.18);
    --blue: #0A84FF;
    --blue-hover: #409CFF;
    --green: #30D158;
    --red: #FF453A;
    --orange: #FF9F0A;
    --yellow: #FFD60A;
    --glass: rgba(30,30,30,0.65);
    --glass-border: rgba(255,255,255,0.08);
    --glass-highlight: rgba(255,255,255,0.08);
  }

  /* ─── Smooth Theme Transition ─── */
  html, body, #root, [data-theme] {
    transition: background-color 400ms ease, color 400ms ease;
  }
  *, *::before, *::after {
    transition: background-color 300ms ease, border-color 300ms ease, box-shadow 300ms ease, opacity 200ms ease;
  }

  /* ─── Reduced Motion ─── */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }

  html, body, #root {
    height: 100%;
    margin: 0;
    padding: 0;
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif;
    background: var(--bg);
    color: var(--text);
    overscroll-behavior-y: none;
    -webkit-tap-highlight-color: transparent;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    touch-action: manipulation;
  }

  /* ─── Safe Area Support ─── */
  .safe-top { padding-top: env(safe-area-inset-top, 0px); }
  .safe-bottom { padding-bottom: env(safe-area-inset-bottom, 0px); }
  .safe-left { padding-left: env(safe-area-inset-left, 0px); }
  .safe-right { padding-right: env(safe-area-inset-right, 0px); }

  /* ─── Typography Scale ─── */
  .t-display { font-size: 40px; font-weight: 800; letter-spacing: -0.03em; line-height: 1.1; }
  .t-title1 { font-size: 28px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.2; }
  .t-title2 { font-size: 22px; font-weight: 700; letter-spacing: -0.01em; line-height: 1.25; }
  .t-title3 { font-size: 20px; font-weight: 600; letter-spacing: -0.01em; }
  .t-headline { font-size: 17px; font-weight: 600; }
  .t-body { font-size: 17px; font-weight: 400; letter-spacing: -0.01em; line-height: 1.35; }
  .t-callout { font-size: 16px; font-weight: 600; }
  .t-subhead { font-size: 15px; font-weight: 400; letter-spacing: -0.01em; }
  .t-footnote { font-size: 13px; font-weight: 400; color: var(--text-secondary); line-height: 1.3; }
  .t-caption { font-size: 12px; font-weight: 500; color: var(--text-tertiary); letter-spacing: 0.02em; }
  .t-mono { font-family: var(--mono); font-variant-numeric: tabular-nums; }

  /* ─── Buttons ─── */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--r);
    font-weight: 600;
    font-size: 15px;
    padding: 10px 18px;
    border: none;
    cursor: pointer;
    transition: all var(--duration) var(--spring);
    user-select: none;
    -webkit-user-select: none;
    gap: 6px;
    position: relative;
    overflow: hidden;
  }
  .btn::after {
    content: '';
    position: absolute;
    inset: 0;
    background: currentColor;
    opacity: 0;
    transition: opacity 150ms ease;
    border-radius: inherit;
    pointer-events: none;
  }
  .btn:active::after { opacity: 0.12; }
  .btn:active { transform: scale(0.97); }
  .btn:disabled { opacity: 0.4; pointer-events: none; }

  .pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--r-full);
    font-weight: 600;
    font-size: 15px;
    padding: 10px 18px;
    border: none;
    cursor: pointer;
    transition: all var(--duration) var(--spring);
    user-select: none;
    -webkit-user-select: none;
    gap: 6px;
    position: relative;
    overflow: hidden;
  }
  .pill-sm { font-size: 13px; padding: 6px 14px; height: 32px; }
  .pill-full { width: 100%; border-radius: var(--r-full); height: 52px; font-size: 17px; }
  .pill-primary { background: var(--text); color: var(--bg); box-shadow: var(--e2); }
  [data-theme="dark"] .pill-primary { background: var(--text); color: var(--bg); }
  .pill-primary:active { transform: scale(0.97); opacity: 0.9; }
  .pill-glass {
    background: var(--glass);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid var(--glass-border);
    box-shadow: inset 0 1px 0 var(--glass-highlight), var(--e1);
    color: var(--text);
  }
  .pill-ghost {
    background: transparent;
    color: var(--text-secondary);
    border: 1px solid var(--separator);
  }
  .pill-ghost:hover { background: var(--bg-secondary); }
  .pill-red { background: var(--red); color: #fff; }
  .pill-red:active { opacity: 0.85; }

  /* ─── Glass ─── */
  .glass {
    background: var(--glass);
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    border: 1px solid var(--glass-border);
    box-shadow: inset 0 1px 0 var(--glass-highlight), var(--e2);
  }

  /* ─── Fields ─── */
  .field {
    width: 100%;
    height: 48px;
    padding: 0 16px;
    font-size: 17px;
    font-family: inherit;
    color: var(--text);
    background: transparent;
    border: 1px solid var(--separator);
    border-radius: var(--r);
    outline: none;
    transition: all var(--duration) var(--spring);
  }
  .field:focus {
    border-color: var(--text-tertiary);
    box-shadow: 0 0 0 3px rgba(0,0,0,0.06);
  }
  [data-theme="dark"] .field:focus {
    border-color: var(--text-tertiary);
    box-shadow: 0 0 0 3px rgba(255,255,255,0.06);
  }
  .field::placeholder { color: var(--text-quaternary); }

  /* ─── Slider ─── */
  .slider-ios {
    -webkit-appearance: none; appearance: none; width: 100%; height: 4px;
    background: var(--bg-secondary); border-radius: 2px; outline: none;
  }
  .slider-ios::-webkit-slider-thumb {
    -webkit-appearance: none; appearance: none; width: 24px; height: 24px;
    border-radius: 50%; background: var(--bg-elevated); border: 0.5px solid rgba(0,0,0,0.15);
    box-shadow: 0 2px 6px rgba(0,0,0,0.15), 0 0.5px 2px rgba(0,0,0,0.1); cursor: pointer;
  }
  .slider-ios::-moz-range-thumb { width: 24px; height: 24px; border-radius: 50%; background: var(--bg-elevated); border: 0.5px solid rgba(0,0,0,0.15); box-shadow: 0 2px 6px rgba(0,0,0,0.15); cursor: pointer; }

  /* ─── FAB ─── */
  .fab {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 52px; height: 52px; border-radius: 50%; background: var(--text);
    color: var(--bg); box-shadow: var(--e2); font-size: 20px; padding: 0;
    border: none;
    cursor: pointer;
    transition: all var(--duration) var(--spring);
    user-select: none;
    -webkit-user-select: none;
    position: relative;
    overflow: hidden;
  }
  .fab::after { border-radius: 50%; }
  .fab:active { transform: scale(0.92); }
  .fab-sm { width: 38px; height: 38px; font-size: 16px; }

  /* ─── Top Bar ─── */
  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: var(--topbar);
    padding: 0 16px;
    flex-shrink: 0;
    position: relative;
    z-index: 200;
    background: var(--bg-elevated);
    border-bottom: 1px solid var(--separator);
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  }
  .bar-title {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    font-size: 17px;
    font-weight: 600;
    color: var(--text);
    letter-spacing: -0.01em;
    white-space: nowrap;
    pointer-events: none;
  }

  /* ─── Game HUD ─── */
  .hud {
    position: absolute;
    top: 8px;
    left: 8px;
    right: 8px;
    z-index: 100;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: var(--r-md);
    pointer-events: auto;
    background: var(--bg-elevated);
    border: 1px solid var(--separator);
    box-shadow: var(--e2);
  }
  .hud-timer {
    font-family: var(--mono);
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1;
  }
  .hud-timer-urgent { color: var(--red); animation: blink-urgent 1s step-end infinite; }
  .hud-label { font-size: 10px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-tertiary); }

  /* ─── Content Row ─── */
  .crow {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    min-height: 48px;
  }

  /* ─── Screen Transition ─── */
  .screen-enter {
    animation: screen-fade 350ms var(--spring) both;
    will-change: opacity, transform;
  }

  /* ─── Animations ─── */

  /* ─── Toolbar Buttons ─── */
  .toolbar-btn {
    width: 40px; height: 40px; border-radius: 50%; border: none;
    background: var(--glass); backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid var(--glass-border);
    box-shadow: inset 0 1px 0 var(--glass-highlight), var(--e1);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: all var(--duration) var(--spring);
    color: var(--text); padding: 0; flex-shrink: 0;
    position: relative;
    overflow: hidden;
  }
  .toolbar-btn::after {
    content: '';
    position: absolute;
    inset: 0;
    background: currentColor;
    opacity: 0;
    transition: opacity 150ms ease;
    border-radius: inherit;
    pointer-events: none;
  }
  .toolbar-btn:active::after { opacity: 0.12; }
  .toolbar-btn:active { transform: scale(0.88); }
  .toolbar-btn.active { background: var(--text); color: var(--bg); }

  /* ─── Mode Carousel ─── */
  .mode-carousel {
    display: flex;
    gap: 12px;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    padding: 20px 0;
    scroll-padding-left: calc(50% - 70px);
    scroll-padding-right: calc(50% - 70px);
    position: relative;
  }
  .mode-carousel::-webkit-scrollbar { display: none; }
  .mode-card {
    flex: 0 0 140px;
    scroll-snap-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 24px 16px;
    border-radius: var(--r-lg);
    background: var(--bg-elevated);
    border: 1px solid var(--separator);
    cursor: pointer;
    transition: all var(--duration) var(--spring);
    user-select: none;
    min-height: 170px;
    opacity: 0.35;
    transform: scale(0.88);
    position: relative;
  }
  .mode-card:focus { outline: none; }
  .mode-card { will-change: transform, opacity; }
  .mode-card.active {
    opacity: 1;
    transform: scale(1);
    border-color: transparent;
    box-shadow: var(--e2);
  }
  .mode-card-icon { font-size: 36px; line-height: 1; transition: all var(--duration) var(--bounce); }
  .mode-card.active .mode-card-icon { transform: scale(1.15); }
  .mode-card-name { font-size: 13px; font-weight: 700; letter-spacing: 0.3px; color: var(--text-secondary); text-align: center; }
  .mode-card.active .mode-card-name { color: var(--text); }
  .mode-card-desc { font-size: 11px; color: var(--text-tertiary); text-align: center; line-height: 1.3; }

  /* ─── Scroll Behavior ─── */
  .scroll-smooth {
    -webkit-overflow-scrolling: touch;
    scroll-behavior: smooth;
  }

  /* ─── Leaflet ─── */
  .leaflet-container { background: #E8E8ED !important; }
  [data-theme="dark"] .leaflet-container { background: #0A0A0A !important; }
  .leaflet-control-attribution { display: none !important; }

  /* ─── Selection Color ─── */
  ::selection {
    background: var(--blue);
    color: #fff;
  }
}
