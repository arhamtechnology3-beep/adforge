import { NextResponse } from 'next/server';
import { ffmpegDownloadIssue, resolveFfmpegPath } from '@/lib/motion-video/ffmpeg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Public readiness probe for the creative renderers (no paths or secrets in the response). */
export async function GET() {
  const ffmpeg = await resolveFfmpegPath();
  return NextResponse.json({
    ffmpeg: Boolean(ffmpeg),
    ffmpeg_issue: ffmpeg ? null : ffmpegDownloadIssue(),
  });
}
