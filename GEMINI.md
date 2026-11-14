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
4. **English Documentation & Automatic Git Commits:**
   - All project documentation, markdown files, comments, and commit messages must be written in English.
   - Immediately stage and `git commit` all changes upon completing and verifying each task or milestone.
5. **Mandatory Testing & Verification Report Gate:**
   - Never move to a new task or milestone without writing automated tests, running them to confirm they pass according to specifications, and presenting a structured Testing & Verification Report with concrete proof to the user.
