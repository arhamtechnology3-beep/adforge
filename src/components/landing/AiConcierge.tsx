'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, X, Sparkles } from 'lucide-react';

type Msg = { role: 'user' | 'assistant'; text: string };

const KNOWLEDGE: { q: RegExp; a: string }[] = [
  {
    q: /spend|who pays|billing|charge|my account|client account/i,
    a: 'Ad spend always bills the client’s Meta Ad Account — never AdForge’s. Your App only has permission to manage their campaigns after they Connect Meta.',
  },
  {
    q: /meta app|app id|oauth|connect/i,
    a: 'You create one platform Meta App. Each client logs into their own Facebook and grants AdForge access. Tokens are stored per user — multi-tenant SaaS, one App ID.',
  },
  {
    q: /carousel|stories|video|format|image/i,
    a: 'We generate Image (Feed 1:1), Carousel, Stories 9:16, and UGC-style motion video previews. You approve winners, then launch only what you like.',
  },
  {
    q: /price|cost|trial|plan|razorpay/i,
    a: 'Start with a 7-day free trial. Subscriptions run via Razorpay (Starter / Growth / Scale). Meta ad spend is separate and paid to Meta by the advertiser.',
  },
  {
    q: /how|work|step|launch|campaign/i,
    a: '1) Connect brand + competitors 2) Generate creatives 3) Approve formats 4) Create a draft campaign 5) Confirm & Launch — nothing goes live without your click.',
  },
  {
    q: /shopify|india|d2c|pickle|brand/i,
    a: 'Built for Indian D2C Shopify sellers. We scrape your store for products & copy angles, then render Meta-ready creatives with your catalog imagery.',
  },
  {
    q: /pwa|mobile|app|install/i,
    a: 'AdForge is a Progressive Web App — install to your phone home screen for an app-like experience without the App Store.',
  },
];

function answer(input: string): string {
  const hit = KNOWLEDGE.find((k) => k.q.test(input));
  if (hit) return hit.a;
  return 'I can help with creatives (Image/Carousel/Stories/Video), campaign draft → confirm, Meta OAuth for clients, pricing, and who pays ad spend. Ask me anything about AdForge.';
}

function streamText(full: string, onChunk: (t: string) => void): Promise<void> {
  return new Promise((resolve) => {
    let i = 0;
    const tick = () => {
      i = Math.min(full.length, i + 2 + Math.floor(Math.random() * 3));
      onChunk(full.slice(0, i));
      if (i >= full.length) resolve();
      else window.setTimeout(tick, 16);
    };
    tick();
  });
}

/** Generative AI-style concierge — replaces static FAQ */
export default function AiConcierge() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: 'assistant',
      text: 'Hi — I’m the AdForge concierge. Ask about formats, launch flow, Meta connect, or who pays ad spend.',
    },
  ]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, open]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput('');
    setMsgs((m) => [...m, { role: 'user', text: trimmed }, { role: 'assistant', text: '' }]);
    setBusy(true);
    const reply = answer(trimmed);
    await streamText(reply, (partial) => {
      setMsgs((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: 'assistant', text: partial };
        return copy;
      });
    });
    setBusy(false);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  const suggestions = ['Who pays ad spend?', 'What formats?', 'How does launch work?'];

  return (
    <>
      <button
        type="button"
        className={`af-concierge-fab ${open ? 'hidden' : ''}`}
        onClick={() => setOpen(true)}
        aria-label="Open AI concierge"
      >
        <MessageCircle className="w-5 h-5" />
        <span>Ask AdForge AI</span>
      </button>

      {open && (
        <div className="af-concierge" role="dialog" aria-label="AdForge AI concierge">
          <header>
            <div>
              <Sparkles className="w-4 h-4" />
              <strong>AdForge Concierge</strong>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </header>

          <div className="af-concierge-body">
            {msgs.map((m, i) => (
              <div key={i} className={`af-msg ${m.role}`}>
                {m.text}
                {busy && i === msgs.length - 1 && m.role === 'assistant' ? <span className="af-caret" /> : null}
              </div>
            ))}
            <div ref={endRef} />
          </div>

          <div className="af-suggestions">
            {suggestions.map((s) => (
              <button key={s} type="button" disabled={busy} onClick={() => void send(s)}>
                {s}
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about Meta ads, formats, launch…"
              disabled={busy}
            />
            <button type="submit" disabled={busy || !input.trim()} aria-label="Send">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
