---
name: remotion-render-engine
description: Best practices and design patterns for building animated slide compositions, layout templates, and rendering pipelines in Remotion.
---

# Remotion Video Rendering Engine Skill

## Composition Guidelines
1. **Dynamic Composition:**
   - Use `calculateMetadata` in Remotion to compute `durationInFrames` dynamically from the input props (array of slides with audio durations).
   - Never fix the composition length statically.

```typescript
import { CalculateMetadataFunction } from 'remotion';

export const calculateVideoMetadata: CalculateMetadataFunction<VideoProps> = ({ props }) => {
  const fps = 30;
  const totalFrames = props.slides.reduce((acc, slide) => {
    return acc + Math.ceil(slide.durationInSeconds * fps);
  }, 0);

  return {
    durationInFrames: totalFrames,
    fps,
    width: 1920,
    height: 1080,
  };
};
```

2. **Spring & Interpolate Physics:**
   - Avoid linear keyframe movements. Always use `spring({ frame, fps, config: { damping: 12 } })` or `interpolate` with smooth easing functions.
   - Text elements should enter with a gentle fade-in and slide-up (e.g. `translateY: 20px -> 0px`, `opacity: 0 -> 1`).

3. **Slide Transitions:**
   - Use `<Series>` or `<TransitionSeries>` from `@remotion/transitions` for clean slide cross-fades, wipe, or slide transitions.
   - Transition duration should be short (15-20 frames, approx. 0.5s) to preserve pacing.
