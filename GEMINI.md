# Gemini & Antigravity Behavioral Context

This file governs Antigravity's role and execution priorities when operating in `AIK-VdGeneration`.

## Operational Priorities
1. **Consult Documentation First:**
   - Before suggesting or writing pipeline code, check `docs/ARCHITECTURE.md` and `docs/API_SPEC.md`.
   - Ensure the JSON schema contract between LLM -> Audio -> Video remains consistent.
2. **Consult Available Skills:**
   - Use `.agent/skills/video-prompt-engineering/SKILL.md` when refining LLM prompts.
   - Use `.agent/skills/tts-audio-sync/SKILL.md` when working with sound timing and duration math.
   - Use `.agent/skills/remotion-render-engine/SKILL.md` when creating or modifying Remotion compositions.
3. **Memory Maintenance:**
   - Keep `MEMORY.md` updated with key decisions, newly installed dependencies, and roadmap status.
