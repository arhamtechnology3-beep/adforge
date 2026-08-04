'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Check, Zap, Smartphone, Menu, X, MousePointer2 } from 'lucide-react';
import HeroCanvas from './HeroCanvas';
import ImmersiveStage from './ImmersiveStage';
import PersonalizationBar, { type Persona } from './PersonalizationBar';
import AiConcierge from './AiConcierge';
import FlowVisual from './FlowVisual';
import VisionVisual from './VisionVisual';
import LiveVisual from './LiveVisual';
import RoadmapVisual from './RoadmapVisual';

function useInView<T extends HTMLElement>(threshold = 0.18) {
  const [ref, setRef] = useState<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ref) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold }
    );
    obs.observe(ref);
    return () => obs.disconnect();
  }, [ref, threshold]);

  return { setRef, visible };
}

function Reveal({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const { setRef, visible } = useInView<HTMLDivElement>();
  return (
    <div
      ref={setRef}
      className={`af-reveal ${visible ? 'in' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

const TEAM = [
  { role: 'Strategist', does: 'Brand + competitor onboarding, angle planning' },
  { role: 'Copywriter', does: '10 Meta primary-text angles — offer, UGC, urgency…' },
  { role: 'Creative', does: 'Image, Carousel, Stories 9:16, Video slideshow' },
  { role: 'Media buyer', does: 'Draft → Confirm & Launch on the client ad account' },
  { role: 'Analyst', does: 'CPC, CPA, CTR, spend — WhatsApp reports' },
  { role: 'Optimizer', does: 'Auto-pause when CPA exceeds your target' },
];

export default function LandingPage() {
  const [persona, setPersona] = useState<Persona | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<{ prompt: () => Promise<void> } | null>(
    null
  );

  const onPersona = useCallback((p: Persona) => setPersona(p), []);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(max > 0 ? y / max : 0);
      setScrolled(y > 12);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    const handler = (e: Event) => {
      e.preventDefault();
      const ev = e as unknown as { prompt: () => Promise<void> };
      setDeferredPrompt(ev);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  const ctaHref = persona?.segment === 'Returning founder' ? '/dashboard' : '/signup';
  const ctaLabel = persona?.cta || 'Start 7-day free trial';
  const hook =
    persona?.hook ||
    'Creatives, launch, and optimization for Indian D2C on Facebook & Instagram.';

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <div className="af">
      <div className="af-progress" style={{ transform: `scaleX(${scrollProgress})` }} aria-hidden />

      <HeroCanvas />

      <header className={`af-header ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="af-nav">
          <Link href="/" className="af-logo" onClick={closeMenu}>
            <span className="af-mark">AF</span>
            <span className="af-logo-word">AdForge</span>
          </Link>

          <nav className="af-nav-links" aria-label="Primary">
            <a href="#vision">Vision</a>
            <a href="#live">Live</a>
            <a href="#roadmap">Roadmap</a>
          </nav>

          <div className="af-nav-actions">
            {deferredPrompt && (
              <button
                type="button"
                className="af-install"
                onClick={() => deferredPrompt.prompt()}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span className="af-install-label">Install</span>
              </button>
            )}
            <Link href="/login" className="af-quiet af-quiet-desktop">
              Sign in
            </Link>
            <Link href="/signup" className="af-ink-btn">
              <span className="af-cta-full">Start free trial</span>
              <span className="af-cta-short">Trial</span>
            </Link>
            <button
              type="button"
              className="af-burger"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="af-mobile-drawer">
            <a href="#vision" onClick={closeMenu}>
              Vision
            </a>
            <a href="#live" onClick={closeMenu}>
              Live
            </a>
            <a href="#roadmap" onClick={closeMenu}>
              Roadmap
            </a>
            <Link href="/login" onClick={closeMenu}>
              Sign in
            </Link>
            <Link href="/signup" className="af-ink-btn af-drawer-cta" onClick={closeMenu}>
              Start free trial
            </Link>
          </div>
        )}
      </header>

      <main className="af-main">
        <PersonalizationBar onPersona={onPersona} />

        <section className="af-hero">
          <div className="af-hero-copy">
            <p className="af-brand">AdForge</p>
            <h1>
              Your Meta ads team —
              <em> without the team.</em>
            </h1>
            <p className="af-hook">{hook}</p>
            <div className="af-hero-cta">
              <Link href={ctaHref} className="af-flame-btn af-magnetic">
                {ctaLabel} <ArrowRight className="w-4 h-4" />
              </Link>
              <a href="#vision" className="af-ghost-link">
                Explore the system
              </a>
            </div>
            <ul className="af-trust">
              <li>
                <Zap className="w-3.5 h-3.5" /> SSR-fast · Edge-ready
              </li>
              <li>
                <Smartphone className="w-3.5 h-3.5" /> Installable PWA
              </li>
              <li>
                <Check className="w-3.5 h-3.5" /> Client pays Meta spend
              </li>
            </ul>
          </div>
          <ImmersiveStage />
        </section>

        <section id="vision" className="af-section af-vision-section">
          <Reveal>
            <p className="af-eye">The vision</p>
            <h2>Replace the full digital marketing + creative stack</h2>
            <p className="af-lead">
              Strategist to optimizer — one product. You approve every creative and every rupee of
              launch.
            </p>
          </Reveal>
          <Reveal delay={60}>
            <VisionVisual />
          </Reveal>
          <div className="af-team">
            {TEAM.map((t, i) => (
              <Reveal key={t.role} delay={i * 40}>
                <div className="af-team-item">
                  <span className="af-team-n">{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <h3>{t.role}</h3>
                    <p>{t.does}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="af-section af-playground">
          <Reveal>
            <p className="af-eye">Interactive</p>
            <h2>Drag the stage. Switch formats. Feel the motion.</h2>
            <p className="af-lead">
              Immersive 3D layers + micro-animations — not a flat brochure. Move your cursor over the
              creative to tilt the scene.
            </p>
          </Reveal>
          <Reveal delay={80}>
            <div className="af-playground-stage">
              <div className="af-playground-hints" aria-hidden>
                <span>
                  <MousePointer2 className="w-3.5 h-3.5" /> Drag to tilt
                </span>
                <span>Tap formats below</span>
                <span>Auto-cycles every 3s</span>
              </div>
              <ImmersiveStage />
            </div>
          </Reveal>
        </section>

        <section id="live" className="af-section">
          <Reveal>
            <p className="af-eye">Live today</p>
            <h2>Ship Meta ads this week</h2>
            <p className="af-lead">
              Studio → approve → draft → confirm. Everything you need to go live on the client Meta
              account.
            </p>
          </Reveal>
          <Reveal delay={70}>
            <LiveVisual />
          </Reveal>
        </section>

        <section className="af-section af-flow-section">
          <Reveal>
            <p className="af-eye">Flow</p>
            <h2>Four steps. Founder control.</h2>
            <p className="af-lead">
              From brand URL to live Meta ads — you approve creatives and confirm spend at every gate.
            </p>
          </Reveal>
          <Reveal delay={80}>
            <FlowVisual />
          </Reveal>
        </section>

        <section id="roadmap" className="af-section">
          <Reveal>
            <p className="af-eye">Coming next</p>
            <h2>The agency roadmap</h2>
            <p className="af-lead">
              From deeper creatives to India-native buying and agency-grade optimization — shipping
              in phases.
            </p>
          </Reveal>
          <Reveal delay={80}>
            <RoadmapVisual />
          </Reveal>
        </section>

        <section className="af-section af-final">
          <Reveal>
            <h2>
              Agency output.
              <br />
              Founder control.
            </h2>
            <p className="af-lead">
              {persona?.greeting ? `${persona.greeting}. ` : ''}
              7-day trial. Ad spend bills the client Meta account — never yours.
            </p>
            <Link href={ctaHref} className="af-flame-btn af-lg">
              {ctaLabel} <ArrowRight className="w-5 h-5" />
            </Link>
          </Reveal>
        </section>

        <footer className="af-footer">
          <span className="af-logo-text">AdForge</span>
          <span className="af-footer-tag">Meta ads automation · PWA · SSR</span>
          <div className="af-footer-links">
            <Link href="/login">Sign in</Link>
            <Link href="/signup">Sign up</Link>
          </div>
        </footer>
      </main>

      <AiConcierge />
    </div>
  );
}
