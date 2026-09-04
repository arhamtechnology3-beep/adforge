/**
 * Ensure platform admin exists in Supabase Auth + public.users (lifetime access).
 *
 * Usage: node --env-file=.env.local scripts/ensure-admin-user.mjs
 * Or:    ADMIN_EMAIL=... ADMIN_PASSWORD=... node --env-file=.env.local scripts/ensure-admin-user.mjs
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const email = (process.env.ADMIN_EMAIL || 'jesalp85@gmail.com').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || 'Jesal@13';
const name = process.env.ADMIN_NAME || 'Jesal';

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserByEmail(target) {
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = (data.users || []).find((u) => (u.email || '').toLowerCase() === target);
    if (hit) return hit;
    if (!data.users?.length || data.users.length < 200) return null;
    page += 1;
  }
}

async function main() {
  let user = await findUserByEmail(email);

  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });
    if (error) throw error;
    user = data.user;
    console.log('Created auth user', user.id);
  } else {
    const { data, error } = await admin.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
      user_metadata: { ...(user.user_metadata || {}), name },
    });
    if (error) throw error;
    user = data.user;
    console.log('Updated auth user password', user.id);
  }

  // Lifetime access marker (trial gate also allowlists admin email)
  const { error: upsertError } = await admin.from('users').upsert(
    {
      id: user.id,
      email,
      name,
      plan_tier: 'scale',
      trial_ends_at: null,
      razorpay_subscription_id: 'admin-lifetime',
    },
    { onConflict: 'id' }
  );
  if (upsertError) throw upsertError;

  console.log(
    JSON.stringify(
      {
        ok: true,
        email,
        user_id: user.id,
        plan_tier: 'scale',
        access: 'lifetime (admin allowlist + admin-lifetime subscription marker)',
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
