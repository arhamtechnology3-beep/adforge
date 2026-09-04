import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export const DEMO_USER: { id: string; email: string } = {
  id: 'demo-user-id',
  email: 'jesalp85@gmail.com',
};

export type SessionUser = {
  id: string;
  email?: string;
  isDemo: boolean;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const isDemo = cookieStore.get('demo_session')?.value === 'true';

  if (isDemo) {
    return { id: DEMO_USER.id, email: DEMO_USER.email, isDemo: true };
  }

  try {
    const supabase = await createClient();
    const { data } = await Promise.race([
      supabase.auth.getUser(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('supabase-timeout')), 3000)
      ),
    ]);
    if (data.user) {
      return { id: data.user.id, email: data.user.email, isDemo: false };
    }
  } catch {
    // Supabase offline / DNS failure
  }

  return null;
}
