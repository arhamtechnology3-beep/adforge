import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

export const performanceQueue = new Queue('performance-sync', { connection });
export const reportsQueue = new Queue('reports', { connection });
export const autoPauseQueue = new Queue('auto-pause', { connection });
export const opsQueue = new Queue('ops-monitor', { connection });

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
    'ops-monitor',
    async (job) => {
      const { runOpsMonitorSlot } = await import('./jobs/ops-monitor');
      await runOpsMonitorSlot(job.data.slot || 'morning');
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

  console.log('[Workers] BullMQ workers started (ops + email reports + policy)');
}

export async function scheduleRecurringJobs() {
  // Legacy daily sync → morning ops
  await performanceQueue.upsertJobScheduler(
    'daily-sync',
    { pattern: '30 1 * * *' },
    { name: 'daily-sync', data: {}, opts: { removeOnComplete: 10 } }
  );

  // IST-oriented slots (UTC): morning 07:00, midday 13:00, afternoon 16:00, evening 19:00 IST
  await opsQueue.upsertJobScheduler(
    'ops-morning',
    { pattern: '30 1 * * *' },
    { name: 'ops-morning', data: { slot: 'morning' }, opts: { removeOnComplete: 10 } }
  );
  await opsQueue.upsertJobScheduler(
    'ops-midday',
    { pattern: '30 7 * * *' },
    { name: 'ops-midday', data: { slot: 'midday' }, opts: { removeOnComplete: 10 } }
  );
  await opsQueue.upsertJobScheduler(
    'ops-afternoon',
    { pattern: '30 10 * * *' },
    { name: 'ops-afternoon', data: { slot: 'afternoon' }, opts: { removeOnComplete: 10 } }
  );
  await opsQueue.upsertJobScheduler(
    'ops-evening',
    { pattern: '30 13 * * *' },
    { name: 'ops-evening', data: { slot: 'evening' }, opts: { removeOnComplete: 10 } }
  );

  await reportsQueue.upsertJobScheduler(
    'daily-reports',
    { pattern: '0 2 * * *' },
    { name: 'daily-reports', data: { frequency: 'daily' }, opts: { removeOnComplete: 10 } }
  );

  await reportsQueue.upsertJobScheduler(
    'weekly-reports',
    { pattern: '0 2 * * 1' },
    { name: 'weekly-reports', data: { frequency: 'weekly' }, opts: { removeOnComplete: 10 } }
  );

  await autoPauseQueue.upsertJobScheduler(
    'check-cpa',
    { pattern: '0 11 * * *' },
    { name: 'check-cpa', data: {}, opts: { removeOnComplete: 10 } }
  );
}
