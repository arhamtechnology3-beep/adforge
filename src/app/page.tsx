import type { Metadata } from 'next';
import localFont from 'next/font/local';
import LandingPage from '@/components/landing/LandingPage';
import './landing.css';

const syne = localFont({
  src: './fonts/Syne-Variable.ttf',
  variable: '--font-display',
  weight: '400 800',
  display: 'swap',
});

const outfit = localFont({
  src: './fonts/Outfit-Variable.ttf',
  variable: '--font-body',
  weight: '100 900',
  display: 'swap',
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
