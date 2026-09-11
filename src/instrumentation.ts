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

if (!publicKey) {
  throw new Error(
    'LANGFUSE_PUBLIC_KEY is not configured',
  );
}

if (!secretKey) {
  throw new Error(
    'LANGFUSE_SECRET_KEY is not configured',
  );
}

export const sdk = new NodeSDK({
  spanProcessors: [
    new LangfuseSpanProcessor({
      publicKey,
      secretKey,
      baseUrl,
    }),
  ],
});

sdk.start();