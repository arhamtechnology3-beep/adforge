import { access, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { resolveFfmpegPath, spawnProcess } from './ffmpeg';
import { prepareImageInputs } from './inputs';
import type {
  MotionVideoAspect,
  MotionVideoResult,
  MotionVideoText,
  RenderMotionVideoInput,
} from './types';

const DIMENSIONS: Record<MotionVideoAspect, { width: number; height: number }> = {
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
  '9:16': { width: 1080, height: 1920 },
  '16:9': { width: 1920, height: 1080 },
};
const FPS = 30;
const MAX_IMAGES = 6;

function cleanText(text: MotionVideoText | undefined): MotionVideoText {
  const clean = (value: string | undefined, max: number) =>
    value?.replace(/\s+/g, ' ').trim().slice(0, max) || undefined;
  return {
    headline: clean(text?.headline, 100),
    body: clean(text?.body, 220),
    callToAction: clean(text?.callToAction, 40),
    brand: clean(text?.brand, 60),
  };
}

function filterPath(filePath: string): string {
  return filePath.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'");
}

async function firstReadablePath(paths: string[]): Promise<string | null> {
  for (const candidate of paths) {
    try {
      await access(candidate, constants.R_OK);
      return candidate;
    } catch {
      // Continue through platform font locations.
    }
  }
  return null;
}

async function buildTextFilters(
  currentLabel: string,
  text: MotionVideoText,
  workingDirectory: string,
  width: number,
  height: number
): Promise<{ filters: string[]; outputLabel: string }> {
  const entries = [
    text.brand
      ? { key: 'brand', value: text.brand, size: Math.round(width * 0.035), y: Math.round(height * 0.07) }
      : null,
    text.headline
      ? { key: 'headline', value: text.headline, size: Math.round(width * 0.065), y: Math.round(height * 0.69) }
      : null,
    text.body
      ? { key: 'body', value: text.body, size: Math.round(width * 0.034), y: Math.round(height * 0.79) }
      : null,
    text.callToAction
      ? { key: 'cta', value: text.callToAction, size: Math.round(width * 0.035), y: Math.round(height * 0.9) }
      : null,
  ].filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  if (entries.length === 0) return { filters: [], outputLabel: currentLabel };

  const font = await firstReadablePath([
    '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
    '/System/Library/Fonts/Supplemental/Arial.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf',
  ]);
  const fontOption = font ? `:fontfile='${filterPath(font)}'` : '';
  const filters: string[] = [
    `[${currentLabel}]drawbox=x=0:y=${Math.round(height * 0.62)}:w=${width}:h=${Math.round(height * 0.38)}:color=black@0.52:t=fill[text-bg]`,
  ];
  let inputLabel = 'text-bg';

  for (const [index, entry] of entries.entries()) {
    const textFile = path.join(workingDirectory, `${entry.key}.txt`);
    await writeFile(textFile, entry.value, 'utf8');
    const outputLabel = `text-${index}`;
    const isBody = entry.key === 'body';
    filters.push(
      `[${inputLabel}]drawtext=textfile='${filterPath(textFile)}'${fontOption}` +
        `:fontcolor=white:fontsize=${entry.size}:x=(w-text_w)/2:y=${entry.y}` +
        `:box=${entry.key === 'cta' ? 1 : 0}:boxcolor=white@0.18:boxborderw=18` +
        `:line_spacing=10:expansion=none` +
        `${isBody ? `:alpha='if(lt(t,0.5),t/0.5,1)'` : ''}[${outputLabel}]`
    );
    inputLabel = outputLabel;
  }
  return { filters, outputLabel: inputLabel };
}

async function buildFilterGraph(options: {
  imageCount: number;
  duration: number;
  width: number;
  height: number;
  text: MotionVideoText;
  workingDirectory: string;
  useText: boolean;
}): Promise<{ graph: string; outputLabel: string }> {
  const { imageCount, duration, width, height } = options;
  const transitionDuration = imageCount > 1 ? Math.min(0.65, duration / (imageCount * 4)) : 0;
  const clipDuration =
    imageCount === 1 ? duration : (duration + (imageCount - 1) * transitionDuration) / imageCount;
  const clipFrames = Math.ceil(clipDuration * FPS) + 2;
  const filters: string[] = [];

  for (let index = 0; index < imageCount; index += 1) {
    const zoom =
      index % 2 === 0
        ? `min(zoom+0.0006,1.06)`
        : `if(eq(on,1),1.06,max(1.0,zoom-0.0006))`;
    // Cover the 9:16 frame edge-to-edge (square sources fill height; sides may crop slightly)
    filters.push(
      `[${index}:v]scale=${width}:${height}:force_original_aspect_ratio=increase,` +
        `crop=${width}:${height},setsar=1,` +
        `zoompan=z='${zoom}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'` +
        `:d=${clipFrames}:s=${width}x${height}:fps=${FPS},` +
        `trim=duration=${clipDuration.toFixed(3)},setpts=PTS-STARTPTS[v${index}]`
    );
  }

  let outputLabel = 'v0';
  for (let index = 1; index < imageCount; index += 1) {
    const nextLabel = `mix${index}`;
    const offset = index * (clipDuration - transitionDuration);
    filters.push(
      `[${outputLabel}][v${index}]xfade=transition=fade:duration=${transitionDuration.toFixed(3)}` +
        `:offset=${offset.toFixed(3)}[${nextLabel}]`
    );
    outputLabel = nextLabel;
  }

  if (options.useText) {
    const textFilters = await buildTextFilters(
      outputLabel,
      options.text,
      options.workingDirectory,
      width,
      height
    );
    filters.push(...textFilters.filters);
    outputLabel = textFilters.outputLabel;
  }

  filters.push(
    `[${outputLabel}]trim=duration=${duration.toFixed(3)},setpts=PTS-STARTPTS[output]`
  );
  return { graph: filters.join(';'), outputLabel: 'output' };
}

function publicUrl(relativePath: string, origin?: string): string {
  if (!origin) return relativePath;
  return `${origin.replace(/\/+$/, '')}${relativePath}`;
}

/**
 * Render an ad-ready motion-template MP4 from normalized images and text.
 * The function is intentionally independent of API/auth code so generate routes can call it directly.
 */
export async function renderMotionTemplateVideo(
  input: RenderMotionVideoInput
): Promise<MotionVideoResult> {
  if (!Array.isArray(input.images) || input.images.length === 0) {
    throw new Error('At least one image is required');
  }
  if (input.images.length > MAX_IMAGES) {
    throw new Error(`A maximum of ${MAX_IMAGES} images is supported`);
  }

  const ffmpeg = await resolveFfmpegPath();
  if (!ffmpeg) {
    return {
      ok: false,
      code: 'FFMPEG_UNAVAILABLE',
      error:
        'Motion video rendering is unavailable because ffmpeg was not found. Set FFMPEG_PATH or install ffmpeg on the server.',
    };
  }

  const duration = Math.max(8, Math.min(12, Number(input.durationSeconds) || 10));
  const aspect = input.aspect && DIMENSIONS[input.aspect] ? input.aspect : '1:1';
  const { width, height } = DIMENSIONS[aspect];
  const text = cleanText(input.text);
  const id = randomUUID();
  const prefix = (input.filenamePrefix || 'motion')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'motion';
  const outputDirectory = path.join(process.cwd(), 'public', 'uploads', 'motion');
  const workingDirectory = path.join(outputDirectory, '.tmp', id);
  const filename = `${prefix}-${Date.now()}-${id.slice(0, 8)}`;
  const videoFilename = `${filename}.mp4`;
  const posterFilename = `${filename}-poster.jpg`;
  const temporaryVideo = path.join(workingDirectory, videoFilename);
  const temporaryPoster = path.join(workingDirectory, posterFilename);
  const finalVideo = path.join(outputDirectory, videoFilename);
  const finalPoster = path.join(outputDirectory, posterFilename);

  await mkdir(workingDirectory, { recursive: true });
  try {
    const imagePaths = await prepareImageInputs(input.images, workingDirectory);
    const filterInfo = await spawnProcess(ffmpeg, ['-hide_banner', '-filters'], {
      timeoutMs: 10_000,
    });
    const supportsDrawText = /\bdrawtext\b/.test(filterInfo.stdout + filterInfo.stderr);
    const graph = await buildFilterGraph({
      imageCount: imagePaths.length,
      duration,
      width,
      height,
      text,
      workingDirectory,
      useText: supportsDrawText,
    });
    const imageArgs = imagePaths.flatMap((imagePath) => [
      '-loop',
      '1',
      '-framerate',
      String(FPS),
      '-i',
      imagePath,
    ]);
    const commonOutputArgs = [
      '-filter_complex',
      graph.graph,
      '-map',
      `[${graph.outputLabel}]`,
      '-t',
      duration.toFixed(3),
      '-an',
      '-r',
      String(FPS),
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      '-y',
      temporaryVideo,
    ];

    try {
      await spawnProcess(
        ffmpeg,
        ['-hide_banner', '-loglevel', 'warning', ...imageArgs, ...commonOutputArgs.slice(0, -2), '-c:v', 'libx264', '-preset', 'medium', '-crf', '21', ...commonOutputArgs.slice(-2)],
        { timeoutMs: 180_000 }
      );
    } catch (firstError) {
      await rm(temporaryVideo, { force: true });
      try {
        await spawnProcess(
          ffmpeg,
          ['-hide_banner', '-loglevel', 'warning', ...imageArgs, ...commonOutputArgs.slice(0, -2), '-c:v', 'mpeg4', '-q:v', '3', ...commonOutputArgs.slice(-2)],
          { timeoutMs: 180_000 }
        );
      } catch (fallbackError) {
        throw new Error(
          `ffmpeg could not render the motion video. H.264: ${
            firstError instanceof Error ? firstError.message : String(firstError)
          }; fallback: ${
            fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
          }`
        );
      }
    }

    await spawnProcess(
      ffmpeg,
      [
        '-hide_banner',
        '-loglevel',
        'warning',
        '-ss',
        '0.5',
        '-i',
        temporaryVideo,
        '-frames:v',
        '1',
        '-q:v',
        '2',
        '-y',
        temporaryPoster,
      ],
      { timeoutMs: 30_000 }
    );
    await mkdir(outputDirectory, { recursive: true });
    await rename(temporaryVideo, finalVideo);
    await rename(temporaryPoster, finalPoster);

    const videoPath = `/uploads/motion/${videoFilename}`;
    const posterPath = `/uploads/motion/${posterFilename}`;
    return {
      ok: true,
      videoUrl: publicUrl(videoPath, input.publicOrigin),
      videoPath,
      posterUrl: publicUrl(posterPath, input.publicOrigin),
      posterPath,
      durationSeconds: duration,
      width,
      height,
      mimeType: 'video/mp4',
      text,
    };
  } finally {
    await rm(workingDirectory, { recursive: true, force: true });
  }
}
