import Link from 'next/link';
import { Megaphone, ArrowRight, Sparkles, BarChart3, Zap } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a2e] via-[#2d1b69] to-[#6c3ce0]">
      <nav className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center">
            <Megaphone className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-white text-xl">Meta Ads</span>
        </div>
        <div className="flex gap-3">
          <Link href="/login" className="text-white/80 hover:text-white text-sm font-medium px-4 py-2">
            Sign In
          </Link>
          <Link href="/signup" className="bg-white text-primary font-medium text-sm px-5 py-2 rounded-lg hover:bg-white/90 transition-colors">
            Start Free Trial
          </Link>
        </div>
      </nav>

      <section className="max-w-6xl mx-auto px-6 pt-16 pb-24 text-center">
        <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight mb-6">
          AI-Powered Meta Ads<br />for Indian D2C Brands
        </h1>
        <p className="text-lg md:text-xl text-white/70 max-w-2xl mx-auto mb-10">
          Generate ad copy, create campaign creatives, and automate performance tracking — built for Shopify sellers scaling on Facebook & Instagram.
        </p>
        <Link href="/signup" className="inline-flex items-center gap-2 bg-accent hover:bg-orange-600 text-white font-semibold px-8 py-3.5 rounded-xl text-lg transition-colors">
          Start 7-Day Free Trial <ArrowRight className="w-5 h-5" />
        </Link>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-24 grid md:grid-cols-3 gap-6">
        {[
          { icon: Sparkles, title: 'AI Ad Generation', desc: '10 ad copy variants with matching visuals across different angles — offer-led, UGC, urgency, and more.' },
          { icon: Zap, title: 'Campaign Automation', desc: 'Launch Meta campaigns with manual approval. Auto-pause when CPA exceeds your target.' },
          { icon: BarChart3, title: 'Performance Dashboard', desc: 'Track CPC, CPA, CTR, and spend. Get WhatsApp reports delivered to your phone.' },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <Icon className="w-8 h-8 text-accent mb-4" />
            <h3 className="text-white font-semibold text-lg mb-2">{title}</h3>
            <p className="text-white/60 text-sm leading-relaxed">{desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
