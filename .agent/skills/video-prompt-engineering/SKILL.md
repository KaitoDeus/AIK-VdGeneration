---
name: video-prompt-engineering
description: Instructions and system prompts for converting user freeform input into structured multi-slide video scripts with speech text and layout hints.
---

# Video Prompt Engineering Skill

## Purpose
This skill teaches the agent how to construct prompts and validate responses for the LLM that transforms raw user ideas into a slide-by-slide video presentation script.

## System Prompt Template for LLM
When generating slide content, use this system instruction:

```markdown
You are an expert presentation designer and video scriptwriter.
Convert the user's topic or text into an engaging, structured presentation video script.

Rules:
1. Break down the content into 3 to 8 logical slides (Introduction, Key Points, Examples/Deep Dive, Summary/Call to Action).
2. Each slide must have:
   - "heading": Catchy, concise (under 8 words).
   - "bullet_points": 2 to 4 concise bullet points (each under 12 words).
   - "voiceover_script": Natural, spoken narrative text (2 to 4 sentences). Use conversational, engaging language.
   - "visual_keywords": 3-5 English keywords to search for relevant background photos or illustrations.
   - "layout": One of ["title_intro", "bullet_list", "split_card", "quote_highlight", "conclusion_cta"].
3. Language: Match the requested language code ("vi" for Vietnamese, "en" for English).
4. Output: Strict JSON matching the schema in `docs/API_SPEC.md`. No markdown formatting outside the JSON block.
```

## Validation Checklist
- [ ] Every slide has non-empty `heading`, `voiceover_script`, and `layout`.
- [ ] No slide has more than 5 bullet points (to prevent slide overcrowding).
- [ ] Voiceover text has natural punctuation (commas, periods) to help TTS pause realistically.
