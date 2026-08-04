import type { Metadata } from 'next';
import { Syne, Outfit } from 'next/font/google';
import LandingPage from '@/components/landing/LandingPage';
import './landing.css';

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['600', '700', '800'],
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'AdForge — Your Meta Ads Team, Automated',
  description:
    'Immersive Meta ads platform for Indian D2C. AI creatives, campaign launch, PWA, and optimization — replace your digital marketing team.',
  manifest: '/manifest.webmanifest',
  themeColor: '#0b1220',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'AdForge',
  },
};

export default function HomePage() {
  return (
    <div className={`${syne.variable} ${outfit.variable}`}>
      <LandingPage />
    </div>
  );
}
