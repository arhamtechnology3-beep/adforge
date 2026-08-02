import 'dotenv/config';
import { startWorkers, scheduleRecurringJobs } from './index';

async function main() {
  startWorkers();
  await scheduleRecurringJobs();
  console.log('[Worker] Scheduled jobs registered. Waiting for tasks...');
}

main().catch(console.error);
