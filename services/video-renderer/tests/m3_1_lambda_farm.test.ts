/**
 * Automated Verification & Test Suite for Milestone M3.1:
 * Remotion Lambda Distributed Chunk Planning & Render Configuration.
 */

import { describe, expect, it } from 'vitest';
import {
  buildLambdaRenderPayload,
  calculateLambdaChunkPlan,
  isLambdaConfigReady,
  MIN_FRAMES_PER_LAMBDA,
  resolveLambdaEnvConfig,
} from '../src/lambda/config';
import { VideoPresentationProps } from '../src/types';

describe('M3.1 Remotion Lambda Distributed Chunk Planning', () => {
  it('splits a 2-minute 30fps presentation (3600 frames) into 50 parallel chunks', () => {
    const plan = calculateLambdaChunkPlan(3600, 50);
    expect(plan.totalFrames).toBe(3600);
    expect(plan.framesPerLambda).toBe(72);
    expect(plan.estimatedChunks).toBe(50);
  });

  it('enforces minimum framesPerLambda (20) on short decks and respects explicit overrides', () => {
    const shortPlan = calculateLambdaChunkPlan(300, 50);
    expect(shortPlan.framesPerLambda).toBe(MIN_FRAMES_PER_LAMBDA);
    expect(shortPlan.estimatedChunks).toBe(15);

    const customPlan = calculateLambdaChunkPlan(1800, 50, 90);
    expect(customPlan.framesPerLambda).toBe(90);
    expect(customPlan.estimatedChunks).toBe(20);
  });

  it('resolves Lambda environment variables and builds renderMediaOnLambda payload', () => {
    const unconfigured = resolveLambdaEnvConfig({});
    expect(isLambdaConfigReady(unconfigured)).toBe(false);

    const ready = resolveLambdaEnvConfig({
      REMOTION_AWS_REGION: 'ap-southeast-1',
      REMOTION_LAMBDA_FUNCTION_NAME: 'remotion-render-4-0-543-mem2048mb',
      REMOTION_LAMBDA_SERVE_URL: 'https://remotionlambda-apse1.s3.amazonaws.com/sites/aik/index.html',
      AWS_S3_BUCKET: 'aik-prod-videos',
      REMOTION_LAMBDA_MAX_CHUNKS: '50',
    });
    expect(isLambdaConfigReady(ready)).toBe(true);
    expect(ready.region).toBe('ap-southeast-1');

    const sampleProps: VideoPresentationProps = {
      project_title: 'Lambda Scale Demo',
      fps: 30,
      width: 1920,
      height: 1080,
      total_frames: 3600,
      slides: [
        {
          slide_index: 1,
          layout: 'title_intro',
          heading: 'Distributed Cloud Rendering',
          voiceover_duration_seconds: 5.0,
        },
      ],
    };

    const { options, chunkPlan } = buildLambdaRenderPayload(ready, sampleProps, 'job_lambda_01');
    expect(chunkPlan.estimatedChunks).toBe(50);
    expect(options.composition).toBe('SlidePresentation');
    expect(options.codec).toBe('h264');
    expect(options.framesPerLambda).toBe(72);
    expect(options.outName).toEqual({
      bucketName: 'aik-prod-videos',
      key: 'videos/job_lambda_01/job_lambda_01.mp4',
    });
  });
});
