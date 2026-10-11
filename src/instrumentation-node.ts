import sharp from 'sharp';
import { reapStaleDeploys } from '@/lib/stale-deploys';

// libvips keeps a worker per CPU core; on shared hosting that eats the account's thread
// limit and leaves none for ffmpeg. Raise with SHARP_CONCURRENCY on a dedicated host.
sharp.concurrency(Math.max(1, Number(process.env.SHARP_CONCURRENCY) || 1));

void reapStaleDeploys().catch(() => undefined);
