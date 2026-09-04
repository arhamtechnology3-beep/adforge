import { Queue } from 'bullmq';
import IORedis from 'ioredis';

let connection: IORedis | null = null;
let queueInstance: Queue | null = null;

function getRedis(): IORedis {
  if (!connection) {
    connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
      lazyConnect: true,
      enableOfflineQueue: false,
    });
  }
  return connection;
}

/** Lazy queue — do not connect Redis at import/build time. */
export function getCreativeGenerationQueue(): Queue {
  if (!queueInstance) {
    queueInstance = new Queue('creative-generation', { connection: getRedis() });
  }
  return queueInstance;
}

/** Proxy so existing `creativeGenerationQueue.add(...)` call sites stay side-effect free on import. */
export const creativeGenerationQueue = {
  add: (...args: Parameters<Queue['add']>) => getCreativeGenerationQueue().add(...args),
  getJob: (...args: Parameters<Queue['getJob']>) => getCreativeGenerationQueue().getJob(...args),
};
