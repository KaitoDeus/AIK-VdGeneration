/**
 * Remotion Lambda Distributed Chunk Planning & Configuration Utilities (Milestone M3.1).
 * Pure, dependency-free helpers shared across render planning & verification tests.
 */

import { VideoPresentationProps } from '../types';
import { calculatePresentationMetadata } from '../utils/timing';

export const DEFAULT_TARGET_LAMBDA_CHUNKS = 50;
export const MIN_FRAMES_PER_LAMBDA = 20;
export const DEFAULT_AWS_REGION = 'us-east-1';

export interface LambdaChunkPlan {
  totalFrames: number;
  framesPerLambda: number;
  estimatedChunks: number;
  targetChunks: number;
}

export interface LambdaEnvConfig {
  region: string;
  functionName: string;
  serveUrl: string;
  bucketName: string;
  memorySizeInMb: number;
  diskSizeInMb: number;
  timeoutInSeconds: number;
  maxChunks: number;
}

export interface LambdaRenderOptions {
  region: string;
  functionName: string;
  serveUrl: string;
  composition: 'SlidePresentation';
  inputProps: VideoPresentationProps;
  codec: 'h264';
  framesPerLambda: number;
  maxRetries: number;
  privacy: 'private' | 'public';
  outName: {
    bucketName?: string;
    key: string;
  };
}

/**
 * Computes optimal `framesPerLambda` so a presentation splits cleanly into
 * ~`targetChunks` (default: 50) parallel serverless Lambda workers, cutting a
 * 2-minute (3,600-frame) render from ~120s down to ~15-20s.
 */
export function calculateLambdaChunkPlan(
  totalFrames: number,
  targetChunks: number = DEFAULT_TARGET_LAMBDA_CHUNKS,
  explicitFramesPerLambda?: number
): LambdaChunkPlan {
  const safeTotalFrames = Math.max(90, Math.round(Number(totalFrames) || 90));
  const safeTargetChunks = Math.max(1, Math.min(200, Math.round(Number(targetChunks) || DEFAULT_TARGET_LAMBDA_CHUNKS)));

  const framesPerLambda =
    explicitFramesPerLambda && explicitFramesPerLambda >= MIN_FRAMES_PER_LAMBDA
      ? Math.round(explicitFramesPerLambda)
      : Math.max(MIN_FRAMES_PER_LAMBDA, Math.ceil(safeTotalFrames / safeTargetChunks));

  const estimatedChunks = Math.max(1, Math.ceil(safeTotalFrames / framesPerLambda));

  return {
    totalFrames: safeTotalFrames,
    framesPerLambda,
    estimatedChunks,
    targetChunks: safeTargetChunks,
  };
}

/**
 * Resolves Remotion Lambda configuration from an environment mapping.
 */
export function resolveLambdaEnvConfig(
  env: Record<string, string | undefined>
): LambdaEnvConfig {
  return {
    region: (env.REMOTION_AWS_REGION || env.AWS_REGION || DEFAULT_AWS_REGION).trim(),
    functionName: (env.REMOTION_LAMBDA_FUNCTION_NAME || '').trim(),
    serveUrl: (env.REMOTION_LAMBDA_SERVE_URL || '').trim(),
    bucketName: (env.AWS_S3_BUCKET || env.REMOTION_LAMBDA_BUCKET || '').trim(),
    memorySizeInMb: Math.max(1024, Number(env.REMOTION_LAMBDA_MEMORY_MB || 2048)),
    diskSizeInMb: Math.max(2048, Number(env.REMOTION_LAMBDA_DISK_SIZE_MB || 2048)),
    timeoutInSeconds: Math.max(60, Number(env.REMOTION_LAMBDA_TIMEOUT_SECONDS || 240)),
    maxChunks: Math.max(1, Number(env.REMOTION_LAMBDA_MAX_CHUNKS || DEFAULT_TARGET_LAMBDA_CHUNKS)),
  };
}

/**
 * Checks whether all mandatory Remotion Lambda environment fields are populated.
 */
export function isLambdaConfigReady(config: LambdaEnvConfig): boolean {
  return Boolean(config.region && config.functionName && config.serveUrl);
}

/**
 * Builds the exact options object passed to `@remotion/lambda/client`'s `renderMediaOnLambda()`.
 */
export function buildLambdaRenderPayload(
  config: LambdaEnvConfig,
  props: VideoPresentationProps,
  jobId: string,
  explicitFramesPerLambda?: number
): { options: LambdaRenderOptions; chunkPlan: LambdaChunkPlan } {
  const meta = calculatePresentationMetadata(props);
  const chunkPlan = calculateLambdaChunkPlan(
    props.total_frames || meta.durationInFrames,
    config.maxChunks,
    explicitFramesPerLambda
  );

  const outputKey = `videos/${jobId}/${jobId}.mp4`;
  return {
    chunkPlan,
    options: {
      region: config.region,
      functionName: config.functionName,
      serveUrl: config.serveUrl,
      composition: 'SlidePresentation',
      inputProps: props,
      codec: 'h264',
      framesPerLambda: chunkPlan.framesPerLambda,
      maxRetries: 2,
      privacy: 'private',
      outName: config.bucketName
        ? { bucketName: config.bucketName, key: outputKey }
        : { key: outputKey },
    },
  };
}
