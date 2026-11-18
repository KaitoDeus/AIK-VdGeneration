/**
 * Remotion Lambda Distributed Render CLI Script (Milestone M3.1).
 * Invokes `renderMediaOnLambda` splitting total frames across ~50 parallel chunks
 * and polls progress until completion.
 *
 * Usage:
 *   node scripts/lambda-render.mjs --props path/to/props.json --job-id job_123 [--target-chunks 50]
 */

import fs from 'node:fs';
import { getRenderProgress, renderMediaOnLambda } from '@remotion/lambda/client';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (key.startsWith('--')) {
      const name = key.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
      args[name] = val;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.props) {
    throw new Error('Missing required --props argument.');
  }

  const jobId = args['job-id'] || `job_lambda_${Date.now()}`;
  const targetChunks = Math.max(1, Number(args['target-chunks'] || process.env.REMOTION_LAMBDA_MAX_CHUNKS || 50));
  const explicitFramesPerLambda = args['frames-per-lambda'] ? Number(args['frames-per-lambda']) : undefined;

  const region = process.env.REMOTION_AWS_REGION || process.env.AWS_REGION || 'us-east-1';
  const functionName = process.env.REMOTION_LAMBDA_FUNCTION_NAME || '';
  const serveUrl = process.env.REMOTION_LAMBDA_SERVE_URL || '';
  const bucketName = process.env.AWS_S3_BUCKET || process.env.REMOTION_LAMBDA_BUCKET || '';

  if (!functionName || !serveUrl) {
    throw new Error('REMOTION_LAMBDA_FUNCTION_NAME and REMOTION_LAMBDA_SERVE_URL are required.');
  }

  const rawProps = JSON.parse(fs.readFileSync(args.props, 'utf-8'));
  const totalFrames = Math.max(
    90,
    Number(rawProps.total_frames) ||
      (Array.isArray(rawProps.slides)
        ? rawProps.slides.reduce(
            (sum, s) => sum + Math.max(90, Math.ceil((0.2 + Number(s.voiceover_duration_seconds || 4) + 0.5) * Number(rawProps.fps || 30))),
            0
          )
        : 180)
  );

  const framesPerLambda =
    explicitFramesPerLambda && explicitFramesPerLambda >= 20
      ? explicitFramesPerLambda
      : Math.max(20, Math.ceil(totalFrames / targetChunks));
  const estimatedChunks = Math.max(1, Math.ceil(totalFrames / framesPerLambda));

  const startMs = Date.now();
  const { renderId, bucketName: renderBucket } = await renderMediaOnLambda({
    region,
    functionName,
    serveUrl,
    composition: 'SlidePresentation',
    inputProps: rawProps,
    codec: 'h264',
    framesPerLambda,
    maxRetries: 2,
    privacy: 'private',
    outName: bucketName ? { bucketName, key: `videos/${jobId}/${jobId}.mp4` } : `videos/${jobId}/${jobId}.mp4`,
  });

  while (true) {
    const progress = await getRenderProgress({
      renderId,
      bucketName: renderBucket,
      functionName,
      region,
    });

    console.log(
      `PROGRESS_JSON:${JSON.stringify({
        renderId,
        overallProgress: progress.overallProgress,
        chunks: progress.chunks,
        done: progress.done,
      })}`
    );

    if (progress.fatalErrorEncountered) {
      const msg = (progress.errors || []).map((e) => e.message).join('; ') || 'Lambda fatal render error';
      throw new Error(msg);
    }

    if (progress.done) {
      const elapsedSeconds = Number(((Date.now() - startMs) / 1000).toFixed(2));
      console.log(
        `RESULT_JSON:${JSON.stringify({
          renderId,
          bucketName: renderBucket,
          outputFile: progress.outputFile,
          outKey: progress.outKey,
          chunks: progress.chunks || estimatedChunks,
          framesPerLambda,
          elapsedSeconds,
        })}`
      );
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
