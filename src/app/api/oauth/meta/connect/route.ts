import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getMetaAuthUrl } from '@/lib/meta';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.META_APP_ID || !process.env.META_REDIRECT_URI) {
    return NextResponse.json(
      {
        error: 'Meta OAuth not configured',
        message: 'Set META_APP_ID, META_APP_SECRET, and META_REDIRECT_URI env vars. Register a Meta App with Marketing API access first.',
      },
      { status: 503 }
    );
  }

  const state = Buffer.from(JSON.stringify({ userId: user.id })).toString('base64');
  const authUrl = getMetaAuthUrl(state);

  return NextResponse.redirect(authUrl);
}
