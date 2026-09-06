import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { resolveAppOrigin } from '@/lib/app-url';
import { getSessionUser } from '@/lib/auth/session';
import { PRODUCT_ASSETS_BUCKET } from '@/lib/product-catalog';
import { createClient } from '@/lib/supabase/server';
import { normalizePackshotBuffer } from '@/lib/creative-assets';
import { fetchPublicProductImage } from '@/lib/product-page-suggestions';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

async function persistPackshot(
  request: Request,
  user: { id: string; isDemo?: boolean },
  sourceBuffer: Buffer
) {
  const filename = `${Date.now()}-${randomUUID()}.png`;
  let bytes: Buffer;
  let metadata: { width: number; height: number; backgroundRemoved: boolean; provider?: string };
  try {
    const normalized = await normalizePackshotBuffer(sourceBuffer);
    bytes = normalized.buffer;
    metadata = normalized;
  } catch {
    return NextResponse.json({ error: 'The image could not be decoded' }, { status: 422 });
  }

  if (user.isDemo) {
    try {
      const directory = path.join(process.cwd(), 'public', 'uploads', 'demo-products');
      await mkdir(directory, { recursive: true });
      await writeFile(path.join(directory, filename), bytes);
      const publicPath = `/uploads/demo-products/${filename}`;
      return NextResponse.json(
        {
          url: `${resolveAppOrigin(request)}${publicPath}`,
          path: publicPath,
          content_type: 'image/png',
          size: bytes.length,
          width: metadata.width,
          height: metadata.height,
          background_removed: metadata.backgroundRemoved,
          cutout_provider: metadata.provider || 'local',
          demo: true,
        },
        { status: 201 }
      );
    } catch (error) {
      console.error('[Product upload] Demo upload failed', error);
      return NextResponse.json({ error: 'Could not save the demo image' }, { status: 500 });
    }
  }

  const objectPath = `${user.id}/${filename}`;
  const supabase = await createClient();
  const { error } = await supabase.storage.from(PRODUCT_ASSETS_BUCKET).upload(objectPath, bytes, {
    contentType: 'image/png',
    cacheControl: '31536000',
    upsert: false,
  });

  if (error) {
    const unavailable = /bucket.*not found|not found.*bucket/i.test(error.message);
    return NextResponse.json(
      {
        error: unavailable
          ? `Storage bucket "${PRODUCT_ASSETS_BUCKET}" is unavailable. Apply migration 007_product_catalog.sql or create the bucket before uploading.`
          : `Product image upload failed: ${error.message}`,
      },
      { status: unavailable ? 503 : 500 }
    );
  }

  const { data } = supabase.storage.from(PRODUCT_ASSETS_BUCKET).getPublicUrl(objectPath);
  return NextResponse.json(
    {
      url: data.publicUrl,
      path: objectPath,
      bucket: PRODUCT_ASSETS_BUCKET,
      content_type: 'image/png',
      size: bytes.length,
      width: metadata.width,
      height: metadata.height,
      background_removed: metadata.backgroundRemoved,
      cutout_provider: metadata.provider || 'local',
    },
    { status: 201 }
  );
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const contentType = request.headers.get('content-type') || '';

  // Import packshot from a public product-page image URL (used by onboarding Import).
  if (contentType.includes('application/json')) {
    const body = await request.json().catch(() => ({}));
    const imageUrl = typeof body.image_url === 'string' ? body.image_url.trim() : '';
    if (!imageUrl) {
      return NextResponse.json({ error: 'image_url is required' }, { status: 400 });
    }
    try {
      const { buffer } = await fetchPublicProductImage(imageUrl);
      return persistPackshot(request, user, buffer);
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : 'Could not import image from URL',
        },
        { status: 422 }
      );
    }
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: 'Expected a multipart/form-data upload or JSON { image_url }' },
      { status: 400 }
    );
  }

  const remoteUrl = form.get('image_url');
  if (typeof remoteUrl === 'string' && remoteUrl.trim()) {
    try {
      const { buffer } = await fetchPublicProductImage(remoteUrl.trim());
      return persistPackshot(request, user, buffer);
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : 'Could not import image from URL',
        },
        { status: 422 }
      );
    }
  }

  const file = form.get('image') || form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'An image file is required' }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'The image is empty' }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: 'Image too large (max 10MB)' }, { status: 413 });
  }

  const extension = IMAGE_EXTENSIONS[file.type];
  if (!extension) {
    return NextResponse.json(
      { error: 'Unsupported image type. Use JPEG, PNG, WEBP, GIF, or AVIF.' },
      { status: 415 }
    );
  }

  return persistPackshot(request, user, Buffer.from(await file.arrayBuffer()));
}
