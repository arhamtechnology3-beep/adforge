import Link from 'next/link';
import type { ReactNode } from 'react';

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f7f5f1] text-[#0b1220]">
      <header className="border-b border-black/10 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            AdForge
          </Link>
          <nav className="flex gap-4 text-sm text-black/60">
            <Link href="/privacy" className="hover:text-black">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-black">
              Terms
            </Link>
            <Link href="/data-deletion" className="hover:text-black">
              Data deletion
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12">
        <p className="text-xs uppercase tracking-[0.14em] text-black/45">Legal</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-black/50">Last updated: {updated}</p>
        <div className="prose prose-neutral mt-10 max-w-none text-[15px] leading-7 text-black/80 [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-black [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5 [&_a]:text-[#e85d04] [&_a]:underline">
          {children}
        </div>
      </main>

      <footer className="border-t border-black/10 py-8 text-center text-sm text-black/50">
        <p>
          Questions?{' '}
          <a href="mailto:support@arhamtechnology.com" className="text-[#e85d04] underline">
            support@arhamtechnology.com
          </a>
        </p>
        <p className="mt-2">
          <Link href="/" className="underline">
            Back to AdForge
          </Link>
        </p>
      </footer>
    </div>
  );
}
