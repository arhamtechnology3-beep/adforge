'use client';

import { useEffect, useMemo, useState } from 'react';

type Persona = {
  city: string;
  region: string;
  greeting: string;
  hook: string;
  cta: string;
  segment: string;
};

function timeGreeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function buildPersona(city: string, region: string, hour: number, visited: boolean): Persona {
  const greeting = timeGreeting(hour);
  const isIndia = /india|in/i.test(region) || /mumbai|delhi|bengaluru|bangalore|hyderabad|chennai|pune|ahmedabad|kolkata|surat|jaipur/i.test(city);

  if (visited) {
    return {
      city,
      region,
      greeting,
      hook: 'Welcome back — your Meta ads team is ready when you are.',
      cta: 'Continue to dashboard',
      segment: 'Returning founder',
    };
  }

  if (isIndia) {
    return {
      city: city || 'India',
      region: region || 'IN',
      greeting,
      hook: `Built for Indian D2C on Meta — creatives, launch, and CPA guardrails from ${city || 'your city'}.`,
      cta: 'Start 7-day free trial',
      segment: 'India D2C',
    };
  }

  return {
    city: city || 'your market',
    region: region || 'Global',
    greeting,
    hook: 'Agency-grade Meta ads automation for Shopify brands — approve every creative, confirm every launch.',
    cta: 'Start free trial',
    segment: 'Global Shopify',
  };
}

/** AI-personalized strip — adapts by time, locale, and return visits */
export default function PersonalizationBar({
  onPersona,
}: {
  onPersona?: (p: Persona) => void;
}) {
  const [persona, setPersona] = useState<Persona | null>(null);

  useEffect(() => {
    const hour = new Date().getHours();
    const visited = localStorage.getItem('adforge_visited') === '1';
    localStorage.setItem('adforge_visited', '1');

    let cancelled = false;

    const apply = (city: string, region: string) => {
      if (cancelled) return;
      const p = buildPersona(city, region, hour, visited);
      setPersona(p);
      onPersona?.(p);
    };

    // Instant local guess from timezone
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const localGuess = /Kolkata|Calcutta|Asia\/Kolkata/i.test(tz)
      ? { city: 'India', region: 'IN' }
      : { city: '', region: tz.split('/')[0] || '' };
    apply(localGuess.city, localGuess.region);

    // Enrich with geo (best-effort, non-blocking)
    fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(2500) })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        apply(data.city || localGuess.city, data.country_name || data.country_code || localGuess.region);
      })
      .catch(() => {
        /* keep local guess */
      });

    return () => {
      cancelled = true;
    };
  }, [onPersona]);

  const label = useMemo(() => {
    if (!persona) return 'Personalizing experience…';
    return `${persona.greeting} · ${persona.city || persona.region} · ${persona.segment}`;
  }, [persona]);

  return (
    <div className="af-persona" role="status" aria-live="polite">
      <span className="af-persona-pulse" aria-hidden />
      <span>{label}</span>
      {persona && <span className="af-persona-hint">Layout adapted for you</span>}
    </div>
  );
}

export type { Persona };
