# Rule: Architecture Boundaries & Service Independence

## Guidelines
1. **Never import code directly between `services/video-renderer` and `services/api-gateway`**:
   - Communication must strictly occur via JSON files, HTTP/RPC calls, or CLI execution (`remotion render`).
2. **Stateless Video Rendering**:
   - The video renderer should receive all needed assets (audio files, images, slide data JSON) via clean local paths or public URLs.
3. **Graceful Degradation**:
   - If stock photo fetching fails, the system must fallback to a clean geometric or gradient background rather than aborting video generation.
4. **Clean Asset Directory**:
   - Temporary audio files and intermediate frame caches must be stored in `.temp/` or `public/audio_temp/` and cleaned up after rendering or job completion.
