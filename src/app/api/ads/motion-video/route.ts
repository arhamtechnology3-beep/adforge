import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import {
  renderMotionTemplateVideo,
  type MotionVideoAspect,
  type MotionVideoImage,
  type MotionVideoText,
} from '@/lib/motion-video';

export const runtime = 'nodejs';
export const maxDuration = 240;

const ASPECTS = new Set<MotionVideoAspect>(['1:1', '4:5', '9:16', '16:9']);

function parseImages(value: unknown): MotionVideoImage[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('images must be a non-empty array');
  }
  return value.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`images[${index}] must be an object`);
    }
    const image = item as Record<string, unknown>;
    if (image.kind === 'remote' && typeof image.url === 'string') {
      return {
        kind: 'remote',
        url: image.url.trim(),
        alt: typeof image.alt === 'string' ? image.alt.slice(0, 160) : undefined,
      };
    }
    if (
      image.kind === 'local' &&
      typeof image.path === 'string' &&
      image.path.startsWith('/uploads/')
    ) {
      return {
        kind: 'local',
        path: image.path,
        alt: typeof image.alt === 'string' ? image.alt.slice(0, 160) : undefined,
      };
    }
    throw new Error(
      `images[${index}] must be { kind: "remote", url } or { kind: "local", path: "/uploads/..." }`
    );
  });
}

function parseText(value: unknown): MotionVideoText | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object') throw new Error('text must be an object');
  const text = value as Record<string, unknown>;
  const optionalString = (key: string) =>
    typeof text[key] === 'string' ? (text[key] as string) : undefined;
  return {
    headline: optionalString('headline'),
    body: optionalString('body'),
    callToAction: optionalString('callToAction'),
    brand: optionalString('brand'),
  };
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Request body must be an object');
    }
    body = parsed as Record<string, unknown>;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid JSON body' },
      { status: 400 }
    );
  }

  try {
    const images = parseImages(body.images);
    const aspect =
      typeof body.aspect === 'string' && ASPECTS.has(body.aspect as MotionVideoAspect)
        ? (body.aspect as MotionVideoAspect)
        : undefined;
    const result = await renderMotionTemplateVideo({
      images,
      text: parseText(body.text),
      durationSeconds:
        typeof body.durationSeconds === 'number' ? body.durationSeconds : undefined,
      aspect,
      filenamePrefix: `ad-${user.id.slice(0, 8)}`,
      publicOrigin: new URL(request.url).origin,
    });

    if (!result.ok) {
      return NextResponse.json(result, { status: 503 });
    }
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Motion video render failed';
    const isInputError =
      /images|image|path|URL|maximum|at least|text|request/i.test(message) &&
      !message.startsWith('ffmpeg could not render');
    return NextResponse.json({ error: message }, { status: isInputError ? 400 : 500 });
  }
}
