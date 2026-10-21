'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Rocket,
  Sparkles,
  Megaphone,
  BarChart3,
  CreditCard,
  LogOut,
  Menu,
  X,
  Shield,
  FileBarChart2,
  Gauge,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/onboarding', label: 'Onboarding', icon: Rocket },
  { href: '/ads', label: 'Ad Generation', icon: Sparkles },
  { href: '/campaigns', label: 'Campaigns', icon: Megaphone },
  { href: '/performance', label: 'Performance', icon: BarChart3 },
  { href: '/reports', label: 'Reports', icon: FileBarChart2 },
  { href: '/optimize', label: 'Optimize', icon: Gauge },
  { href: '/ops', label: 'Ops Agent', icon: Shield },
  { href: '/billing', label: 'Billing', icon: CreditCard },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [stores, setStores] = useState<Array<{ id: string; name: string }>>([]);
  const [activeId, setActiveId] = useState('');
  const [canAdd, setCanAdd] = useState(false);
  const [maxStores, setMaxStores] = useState(1);
  const [adding, setAdding] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [storeWebsite, setStoreWebsite] = useState('');
  const [storeError, setStoreError] = useState('');

  useEffect(() => {
    fetch('/api/stores')
      .then((res) => res.json())
      .then((data) => {
        setStores(data.stores || []);
        setActiveId(data.activeStore?.id || '');
        setCanAdd(Boolean(data.canAdd));
        setMaxStores(data.maxStores || 1);
      })
      .catch(() => {
        /* billing still works if stores are unavailable */
      });
  }, []);

  async function switchStore(storeId: string) {
    setActiveId(storeId);
    const res = await fetch('/api/stores/active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId }),
    });
    if (res.ok) window.location.reload();
  }

  async function addStore() {
    setStoreError('');
    const res = await fetch('/api/stores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: storeName, website_url: storeWebsite }),
    });
    const data = await res.json();
    if (!res.ok) {
      setStoreError(data.error || 'Could not add store');
      return;
    }
    window.location.href = '/onboarding';
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  const nav = (
    <>
      <div className="px-6 py-5 border-b border-white/10">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-light to-accent flex items-center justify-center">
            <Megaphone className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-white text-lg">AdForge</span>
        </Link>
      </div>

      {stores.length > 0 && (
        <div className="px-3 py-3 border-b border-white/10 space-y-2">
          <label className="block text-[11px] uppercase tracking-wide text-white/50 px-1">
            Store
          </label>
          <select
            className="w-full rounded-lg bg-white/10 text-white text-sm px-2 py-2 border border-white/15"
            value={activeId}
            onChange={(event) => switchStore(event.target.value)}
          >
            {stores.map((store) => (
              <option key={store.id} value={store.id} className="text-black">
                {store.name}
              </option>
            ))}
          </select>
          {canAdd && !adding && (
            <button
              type="button"
              className="text-xs text-white/80 hover:text-white px-1"
              onClick={() => setAdding(true)}
            >
              Add store
            </button>
          )}
          {canAdd && adding && (
            <div className="space-y-2">
              <input
                className="w-full rounded-lg bg-white text-black text-sm px-2 py-1.5"
                placeholder="Store name"
                value={storeName}
                onChange={(event) => setStoreName(event.target.value)}
              />
              <input
                className="w-full rounded-lg bg-white text-black text-sm px-2 py-1.5"
                placeholder="https://shop.myshopify.com"
                value={storeWebsite}
                onChange={(event) => setStoreWebsite(event.target.value)}
              />
              {storeError && <p className="text-xs text-amber-200">{storeError}</p>}
              <div className="flex gap-2">
                <button type="button" className="text-xs text-white underline" onClick={addStore}>
                  Save
                </button>
                <button
                  type="button"
                  className="text-xs text-white/70"
                  onClick={() => setAdding(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {!canAdd && (
            <Link href="/billing" className="block text-xs text-white/70 hover:text-white px-1">
              Plan includes {maxStores} store{maxStores === 1 ? '' : 's'}
            </Link>
          )}
        </div>
      )}

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              pathname === href
                ? 'bg-white/15 text-white'
                : 'text-white/70 hover:bg-white/10 hover:text-white'
            )}
          >
            <Icon className="w-5 h-5" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors w-full"
        >
          <LogOut className="w-5 h-5" />
          Log out
        </button>
      </div>
    </>
  );

  return (
    <>
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-primary text-white"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-40 w-64 bg-gradient-to-b from-[#1a1a2e] to-[#1877f2] flex flex-col transition-transform',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {nav}
      </aside>
    </>
  );
}
