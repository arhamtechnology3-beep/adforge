import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { resolveAppOrigin } from '@/lib/app-url';

const MAX_BYTES = 25 * 1024 * 1024; // 25MB
const ALLOWED = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

/** Upload image/video for manual ads & full edit */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get('file');
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'file required' }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File too large (max 25MB)' }, { status: 400 });
  }

  const type = file.type || 'application/octet-stream';
  if (!ALLOWED.has(type) && !type.startsWith('image/') && !type.startsWith('video/')) {
    return NextResponse.json(
      { error: 'Unsupported type. Upload JPG, PNG, WEBP, GIF, MP4, or WEBM.' },
      { status: 400 }
    );
  }

  const ext =
    path.extname(file.name) ||
    (type.includes('png')
      ? '.png'
      : type.includes('webp')
        ? '.webp'
        : type.includes('mp4')
          ? '.mp4'
          : type.includes('webm')
            ? '.webm'
            : '.jpg');

  const dir = path.join(process.cwd(), 'public', 'uploads', user.id);
  await mkdir(dir, { recursive: true });
  const filename = `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), buf);

  const appUrl = resolveAppOrigin(request);

  const relative = `/uploads/${user.id}/${filename}`;
  const url = `${appUrl}${relative}`;

  return NextResponse.json({
    url,
    path: relative,
    content_type: type,
    is_video: type.startsWith('video/'),
    size: file.size,
  });
}
