import { runAdLibraryWebFetchInProcess } from '../src/lib/meta-ad-library-web-fetch';
import type { AdLibraryFetchInput } from '../src/lib/meta-ad-library';

export { runAdLibraryWebFetchInProcess };

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function main() {
  const raw = await readStdin();
  const input = JSON.parse(raw || '{}') as AdLibraryFetchInput;
  const result = await runAdLibraryWebFetchInProcess(input);
  process.stdout.write(JSON.stringify(result));
}

const invokedDirectly =
  typeof require !== 'undefined' &&
  typeof module !== 'undefined' &&
  require.main === module;

if (invokedDirectly) {
  main().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(message);
    process.exit(1);
  });
}
