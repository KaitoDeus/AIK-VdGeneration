/**
 * Remotion Lambda Deployment Script (Milestone M3.1).
 * Provisions S3 site bundle (`deploySite`) and serverless Chrome render Lambda (`deployFunction`).
 *
 * Usage:
 *   npm run lambda:deploy
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deployFunction, deploySite, getOrCreateBucket } from '@remotion/lambda';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rendererRoot = path.resolve(__dirname, '..');

async function main() {
  const region = process.env.REMOTION_AWS_REGION || process.env.AWS_REGION || 'us-east-1';
  const memorySizeInMb = Number(process.env.REMOTION_LAMBDA_MEMORY_MB || 2048);
  const diskSizeInMb = Number(process.env.REMOTION_LAMBDA_DISK_SIZE_MB || 2048);
  const timeoutInSeconds = Number(process.env.REMOTION_LAMBDA_TIMEOUT_SECONDS || 240);
  const siteName = process.env.REMOTION_LAMBDA_SITE_NAME || 'aik-slide-presentation';

  const { bucketName } = await getOrCreateBucket({ region });
  const { serveUrl } = await deploySite({
    entryPoint: path.join(rendererRoot, 'src', 'index.ts'),
    bucketName,
    region,
    siteName,
  });

  const { functionName, alreadyExisted } = await deployFunction({
    region,
    timeoutInSeconds,
    memorySizeInMb,
    diskSizeInMb,
    createCloudWatchLogGroup: true,
  });

  console.log(
    JSON.stringify({
      status: 'deployed',
      region,
      bucketName,
      serveUrl,
      functionName,
      alreadyExisted,
    })
  );
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
