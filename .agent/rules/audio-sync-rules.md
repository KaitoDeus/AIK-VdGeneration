# Rule: Audio Duration & Remotion Frame Synchronization

## Formula & Rules
1. **Target Frame Rate (FPS):**
   - Default FPS is `30`.
2. **Slide Duration Calculation:**
   ```typescript
   const PADDING_BEFORE_SEC = 0.2; // slight pause before speaker starts
   const PADDING_AFTER_SEC = 0.5;  // breathing room before next slide transition
   const totalSlideSeconds = PADDING_BEFORE_SEC + audioDurationSeconds + PADDING_AFTER_SEC;
   const durationInFrames = Math.max(90, Math.ceil(totalSlideSeconds * fps)); // Minimum 3 seconds (90 frames)
   ```
3. **Audio File Verification:**
   - Always verify that the audio file exists and has size > 10KB before passing to Remotion.
   - Use `ffprobe` or `music-metadata` to read the exact duration in milliseconds. Do NOT estimate duration based on character count alone.
