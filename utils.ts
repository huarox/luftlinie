import { useRef, useEffect, useCallback } from 'react';
import { TopBar } from '@/components/TopBar';
import { IOSSwitch } from '@/components/IOSSwitch';
import { SegmentedControl } from '@/components/SegmentedControl';
import { DIFFICULTY, MODE_INFO } from '@/types/game';
import type { GameState, GameMode } from '@/types/game';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

interface Props { state: GameState; onBack: () => void; onGoMap: () => void; updateSettings: (p: Partial<GameState['settings']>) => void; }

export function SetupScreen({ state, onBack, onGoMap, updateSettings }: Props) {
  const s = state.settings;
  const [showAdv, setShowAdv] = useState(false);
  const limit = Math.round(s.idealMin * DIFFICULTY.mult[s.diff]);

  const modes = Object.entries(MODE_INFO) as [GameMode, typeof MODE_INFO['standard']][];
  const carouselRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isScrollingRef = useRef(false);

  // Center-select: find the card closest to center and select it
  const selectCenterCard = useCallback(() => {
    const el = carouselRef.current;
    if (!el) return;
    const cards = el.querySelectorAll<HTMLElement>('.mode-card');
    if (!cards.length) return;
    const elRect = el.getBoundingClientRect();
    const centerX = elRect.left + elRect.width / 2;
    let closestIdx = 0;
    let closestDist = Infinity;
    cards.forEach((card, i) => {
      const rect = card.getBoundingClientRect();
      const cardCenter = rect.left + rect.width / 2;
      const dist = Math.abs(cardCenter - centerX);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    });
    const [key] = modes[closestIdx];
    if (key !== s.gameMode) {
      updateSettings({
        gameMode: key,
        elimMode: key === 'elimination',
        whisperMode: key === 'whisper',
      });
    }
  }, [modes, s.gameMode, updateSettings]);

  // Scroll handler with debounce
  const handleScroll = useCallback(() => {
    isScrollingRef.current = true;
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      isScrollingRef.current = false;
      selectCenterCard();
    }, 80);
  }, [selectCenterCard]);

  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => { el.removeEventListener('scroll', handleScroll); };
  }, [handleScroll]);

  // Scroll the selected mode to center on mount / mode change
  const scrollToMode = useCallback((idx: number) => {
    const el = carouselRef.current;
    if (!el || isScrollingRef.current) return;
    const cards = el.querySelectorAll<HTMLElement>('.mode-card');
    if (cards[idx]) {
      const c = cards[idx];
      el.scrollTo({ left: c.offsetLeft - el.clientWidth / 2 + c.offsetWidth / 2, behavior: 'smooth' });
    }
  }, []);

  // Scroll to current mode on mount
  useEffect(() => {
    const idx = modes.findIndex(([k]) => k === s.gameMode);
    if (idx >= 0) {
      // Immediate scroll without animation on mount
      const el = carouselRef.current;
      if (el) {
        const cards = el.querySelectorAll<HTMLElement>('.mode-card');
        if (cards[idx]) {
          const c = cards[idx];
          el.scrollLeft = c.offsetLeft - el.clientWidth / 2 + c.offsetWidth / 2;
        }
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectMode = (key: GameMode, idx: number) => {
    updateSettings({
      gameMode: key,
      elimMode: key === 'elimination',
      whisperMode: key === 'whisper',
    });
    scrollToMode(idx);
  };

  // Name input handler
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    localStorage.setItem('ll_nickname', e.target.value);
  };

  return (
    <div className="absolute inset-0 flex flex-col screen-enter" style={{ background: 'var(--bg)' }}>
      <TopBar title="New Game" onBack={onBack} />
      <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="px-5 py-5 space-y-6">

          {/* Name */}
          <section style={{ animation: 'fade-up 0.2s var(--spring)' }}>
            <div className="t-caption mb-2">Your Name</div>
            <div className="glass" style={{ borderRadius: 'var(--r)', overflow: 'hidden' }}>
              <input
                className="field"
                style={{ border: 'none', borderRadius: 0, background: 'transparent' }}
                defaultValue={state.myName}
                onChange={handleNameChange}
                placeholder="Your name"
                maxLength={20}
              />
            </div>
          </section>

          {/* Mode Carousel - Center-Select Picker */}
          <section style={{ animation: 'fade-up 0.25s var(--spring)' }}>
            <div className="t-caption mb-3">Game Mode</div>
            {/* Carousel container with center indicator */}
            <div style={{ position: 'relative' }}>
              {/* Center selection indicator - aligned to card size */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 140,
                height: 170,
                borderRadius: 'var(--r-lg)',
                border: '2.5px solid var(--blue)',
                opacity: 0.3,
                pointerEvents: 'none',
                zIndex: 10,
              }} />
              <div ref={carouselRef} className="mode-carousel" style={{
                scrollSnapType: 'x mandatory',
                paddingLeft: 'calc(50% - 70px)',
                paddingRight: 'calc(50% - 70px)',
              }}>
                {modes.map(([key, m], i) => {
                  const isSel = key === s.gameMode;
                  return (
                    <button
                      key={key}
                      className={'mode-card' + (isSel ? ' active' : '')}
                      style={{
                        scrollSnapAlign: 'center',
                        borderBottom: isSel ? '3px solid ' + m.color : '3px solid transparent',
                      }}
                      onClick={() => selectMode(key, i)}
                    >
                      <span className="mode-card-icon" style={{
                        fontSize: 36,
                        lineHeight: 1,
                        transition: 'all 0.2s var(--spring)',
                        filter: isSel ? `drop-shadow(0 0 10px ${m.color}66)` : 'none',
                      }}>{m.icon}</span>
                      <span className="mode-card-name">{m.name}</span>
                      <span className="mode-card-desc">{m.short}</span>
                      {isSel && (
                        <span style={{
                          position: 'absolute', top: 10, right: 10,
                          width: 20, height: 20, borderRadius: '50%',
                          background: m.color, display: 'flex',
                          alignItems: 'center', justifyContent: 'center',
                        }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <p className="t-footnote px-1" style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
              {modes.find(([k]) => k === s.gameMode)?.[1].detail || ''}
            </p>
          </section>

          {/* Distance */}
          <section style={{ animation: 'fade-up 0.3s var(--spring)' }}>
            <div className="t-caption mb-3">Distance</div>
            <div className="glass" style={{ borderRadius: 'var(--r)', overflow: 'hidden' }}>
              <div className="crow">
                <span className="t-body">Drive time</span>
                <span className="t-callout">{s.idealMin} min</span>
              </div>
              <div className="px-4 pb-1">
                <input type="range" className="slider-ios" min={10} max={90} value={s.idealMin} onChange={e => updateSettings({ idealMin: +e.target.value })} />
              </div>
              <div className="crow" style={{ borderTop: '1px solid var(--glass-border)' }}>
                <span className="t-subhead" style={{ color: 'var(--text-secondary)' }}>Time limit</span>
                <span className="t-callout">{limit} min</span>
              </div>
            </div>
          </section>

          {/* Target Mode */}
          <section style={{ animation: 'fade-up 0.35s var(--spring)' }}>
            <div className="t-caption mb-3">Target</div>
            <div className="glass" style={{ borderRadius: 'var(--r)', overflow: 'hidden', padding: 12 }}>
              <SegmentedControl
                options={[{ value: 'manual', label: 'Manual' }, { value: 'smart', label: 'Smart' }]}
                value={s.mode}
                onChange={v => updateSettings({ mode: v as any })}
              />
              <p className="t-footnote mt-2">{s.mode === 'manual' ? 'Tap the map to place the secret target.' : 'A target on a real road will be placed automatically.'}</p>
            </div>
          </section>

          {/* Advanced */}
          <section style={{ animation: 'fade-up 0.4s var(--spring)' }}>
            <button
              className="pill pill-ghost pill-sm gap-1"
              onClick={() => setShowAdv(!showAdv)}
              style={{ padding: '8px 4px' }}
            >
              <ChevronDown size={16} style={{ transition: 'transform 200ms', transform: showAdv ? 'rotate(180deg)' : undefined }} />
              Advanced
            </button>
            {showAdv && (
              <div className="space-y-4 mt-2">
                {/* Arrival Radius */}
                <div>
                  <div className="t-caption mb-2">Arrival Radius</div>
                  <div className="glass" style={{ borderRadius: 'var(--r)', overflow: 'hidden', padding: 10 }}>
                    <div className="flex gap-2">
                      {[25, 50, 100, 200].map(r => (
                        <button
                          key={r}
                          className="btn flex-1 pill-sm"
                          onClick={() => updateSettings({ arrRadius: r })}
                          style={{
                            borderRadius: 10,
                            background: s.arrRadius === r ? 'var(--text)' : 'transparent',
                            color: s.arrRadius === r ? 'var(--bg)' : 'var(--text-secondary)',
                            border: '1px solid ' + (s.arrRadius === r ? 'var(--text)' : 'var(--glass-border)'),
                          }}
                        >
                          {r}m
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Difficulty */}
                <div>
                  <div className="t-caption mb-2">Difficulty</div>
                  <div className="glass" style={{ borderRadius: 'var(--r)', overflow: 'hidden' }}>
                    <div className="crow">
                      {[1, 2, 3, 4, 5].map(d => (
                        <button
                          key={d}
                          className="btn pill-ghost"
                          onClick={() => updateSettings({ diff: d })}
                          style={{
                            fontSize: 22,
                            padding: '0 6px',
                            color: d <= s.diff ? 'var(--orange)' : 'var(--text-quaternary)',
                          }}
                        >
                          {'★'}
                        </button>
                      ))}
                    </div>
                    <div className="px-4 pb-3">
                      <p className="t-footnote">{DIFFICULTY.descs[s.diff]}</p>
                    </div>
                  </div>
                </div>

                {/* Rules */}
                <div>
                  <div className="t-caption mb-2">Rules</div>
                  <div className="glass" style={{ borderRadius: 'var(--r)', overflow: 'hidden' }}>
                    {[
                      { k: 'blindStart', l: 'Blind Start', s: 'Hide distance until 300m from start' },
                      { k: 'blindFinish', l: 'Blind Finish', s: 'Keep playing after first arrival' },
                      { k: 'excludeHost', l: 'Exclude Host', s: 'Host hidden from results' },
                      { k: 'teamsMode', l: 'Teams', s: 'Red vs Blue teams' },
                    ].map((item, i) => (
                      <div
                        key={item.k}
                        className="crow"
                        style={{ borderTop: i > 0 ? '1px solid var(--glass-border)' : undefined }}
                      >
                        <div>
                          <div className="t-body">{item.l}</div>
                          <div className="t-footnote">{item.s}</div>
                        </div>
                        <IOSSwitch
                          checked={s[item.k as keyof typeof s] as boolean}
                          onChange={v => updateSettings({ [item.k]: v })}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>

          <div style={{ height: 24 }} />
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="glass" style={{ borderRadius: 0, border: 'none', borderTop: '1px solid var(--glass-border)', padding: '14px 20px' }}>
        <button className="pill pill-primary pill-full" onClick={onGoMap}>
          {s.mode === 'smart' ? 'Continue' : 'Place Target on Map'}
        </button>
      </div>
    </div>
  );
}
