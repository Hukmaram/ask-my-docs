import 'dotenv/config';

import { NodeSDK } from '@opentelemetry/sdk-node';
import { LangfuseSpanProcessor } from '@langfuse/otel';

const publicKey =
  process.env.LANGFUSE_PUBLIC_KEY;

const secretKey =
  process.env.LANGFUSE_SECRET_KEY;

const baseUrl =
  process.env.LANGFUSE_BASE_URL ??
  'https://cloud.langfuse.com';

export let sdk: { start: () => void; shutdown: () => Promise<void> };

if (publicKey && secretKey) {
  sdk = new NodeSDK({
    spanProcessors: [
      new LangfuseSpanProcessor({
        publicKey,
        secretKey,
        baseUrl,
      }),
    ],
  });
  sdk.start();
} else {
  sdk = {
    start: () => {},
    shutdown: async () => {},
  };
}