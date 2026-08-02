import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

export const performanceQueue = new Queue('performance-sync', { connection });
export const reportsQueue = new Queue('reports', { connection });
export const autoPauseQueue = new Queue('auto-pause', { connection });

export function startWorkers() {
  new Worker(
    'performance-sync',
    async () => {
      const { syncAllCampaignPerformance } = await import('./jobs/performance');
      await syncAllCampaignPerformance();
    },
    { connection }
  );

  new Worker(
    'reports',
    async (job) => {
      const { sendScheduledReports } = await import('./jobs/reports');
      await sendScheduledReports(job.data.frequency);
    },
    { connection }
  );

  new Worker(
    'auto-pause',
    async () => {
      const { checkAndAutoPause } = await import('./jobs/auto-pause');
      await checkAndAutoPause();
    },
    { connection }
  );

  console.log('[Workers] BullMQ workers started');
}

export async function scheduleRecurringJobs() {
  await performanceQueue.upsertJobScheduler(
    'daily-sync',
    { pattern: '0 6 * * *' },
    { name: 'daily-sync', data: {}, opts: { removeOnComplete: 10 } }
  );

  await reportsQueue.upsertJobScheduler(
    'daily-reports',
    { pattern: '0 8 * * *' },
    { name: 'daily-reports', data: { frequency: 'daily' }, opts: { removeOnComplete: 10 } }
  );

  await reportsQueue.upsertJobScheduler(
    'weekly-reports',
    { pattern: '0 8 * * 1' },
    { name: 'weekly-reports', data: { frequency: 'weekly' }, opts: { removeOnComplete: 10 } }
  );

  await autoPauseQueue.upsertJobScheduler(
    'check-cpa',
    { pattern: '0 7 * * *' },
    { name: 'check-cpa', data: {}, opts: { removeOnComplete: 10 } }
  );
}
