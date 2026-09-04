export type MotionVideoAspect = '1:1' | '4:5' | '9:16' | '16:9';

export type MotionVideoImage =
  | {
      kind: 'local';
      /** Absolute path or a root-relative path under public/. */
      path: string;
      alt?: string;
    }
  | {
      kind: 'remote';
      url: string;
      alt?: string;
    };

export interface MotionVideoText {
  headline?: string;
  body?: string;
  callToAction?: string;
  brand?: string;
}

export interface RenderMotionVideoInput {
  images: MotionVideoImage[];
  text?: MotionVideoText;
  /** Clamped to 8-12 seconds. Defaults to 10. */
  durationSeconds?: number;
  aspect?: MotionVideoAspect;
  /** Optional stable prefix for the generated filenames. */
  filenamePrefix?: string;
  /** Used to produce absolute video and poster URLs when provided. */
  publicOrigin?: string;
}

export interface MotionVideoSuccess {
  ok: true;
  videoUrl: string;
  videoPath: string;
  posterUrl: string;
  posterPath: string;
  durationSeconds: number;
  width: number;
  height: number;
  mimeType: 'video/mp4';
  text: MotionVideoText;
}

export interface MotionVideoUnavailable {
  ok: false;
  code: 'FFMPEG_UNAVAILABLE';
  error: string;
}

export type MotionVideoResult = MotionVideoSuccess | MotionVideoUnavailable;
