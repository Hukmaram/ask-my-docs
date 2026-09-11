import { sdk } from '../src/instrumentation.js';

async function main(): Promise<void> {
  console.log('\nLangfuse configuration:');

  console.log(
    'Public key:',
    process.env.LANGFUSE_PUBLIC_KEY
      ? 'LOADED'
      : 'MISSING',
  );

  console.log(
    'Secret key:',
    process.env.LANGFUSE_SECRET_KEY
      ? 'LOADED'
      : 'MISSING',
  );

  console.log(
    'Base URL:',
    process.env.LANGFUSE_BASE_URL ??
      'MISSING',
  );

  console.log('\nConfiguration loaded successfully.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sdk.shutdown();
  });