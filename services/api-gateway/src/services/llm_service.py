"""
LLM Script Generation Service (Milestone M1.2).
Transforms user prompts into strictly validated multi-slide presentation scripts
using the official Google GenAI SDK (`google-genai` >= 3.2.0) Interactions API
and Structured Outputs (`response_format`).
"""

import json
import logging
import os
import time
from typing import Optional, Tuple

from dotenv import load_dotenv
from google import genai
from pydantic import ValidationError

from ..schemas import PresentationScript, SlideScriptItem, SupportedLanguage

load_dotenv()

logger = logging.getLogger(__name__)

# System instruction aligned with .agent/skills/video-prompt-engineering/SKILL.md
SYSTEM_INSTRUCTION = """You are an expert presentation designer and video scriptwriter.
Convert the user's topic or text into an engaging, structured presentation video script.

Rules:
1. Break down the content into 3 to 8 logical slides (Introduction, Key Points, Examples/Deep Dive, Summary/Call to Action).
2. Each slide must have:
   - "slide_index": 1-based sequential integer (1, 2, 3...).
   - "heading": Catchy, concise title (under 8 words).
   - "bullet_points": 2 to 4 concise bullet points (each under 12 words, never more than 5).
   - "voiceover_script": Natural, spoken narrative text (2 to 4 sentences). Use conversational, engaging language with clear punctuation (commas, periods) so TTS pauses naturally. Do NOT include markdown syntax (`**`, `` ` ``, `#`) in spoken text.
   - "visual_keywords": 3 to 5 English keywords to search for relevant background photos or illustrations.
   - "layout": One of ["title_intro", "bullet_list", "split_card", "quote_highlight", "conclusion_cta"].
3. Strict Language Consistency: Write "title", "heading", "bullet_points", and "voiceover_script" 100% in the requested language ("vi" -> pure natural Vietnamese; "en" -> natural English). Never mix English sentences into Vietnamese scripts. Keep only "visual_keywords" in English.
4. Output: Strict JSON matching the provided schema. No markdown formatting outside the JSON object.
"""


class LLMScriptGenerator:
    """Orchestrates prompt-to-script generation via Gemini 3.8 Flash Interactions API with retries and schema validation."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        default_model: Optional[str] = None,
        fallback_model: Optional[str] = None,
        timeout_seconds: Optional[int] = None,
        max_retries: Optional[int] = None,
    ) -> None:
        self.api_key = api_key or os.getenv("GEMINI_API_KEY", "").strip()
        self.default_model = default_model or os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
        self.fallback_model = fallback_model or os.getenv("GEMINI_FALLBACK_MODEL", "gemini-4-hydrogen")
        self.timeout_seconds = timeout_seconds or int(os.getenv("LLM_TIMEOUT_SECONDS", "30"))
        self.max_retries = max_retries or int(os.getenv("LLM_MAX_RETRIES", "3"))

    def _build_user_prompt(
        self,
        prompt: str,
        language: SupportedLanguage,
        target_duration_seconds: int,
        theme: str,
    ) -> str:
        estimated_slides = max(3, min(8, round(target_duration_seconds / 12)))
        lang_name = "Vietnamese" if language == "vi" else "English"
        return (
            f"Topic / Source Prompt: {prompt}\n"
            f"Target Language: {language} ({lang_name})\n"
            f"Target Video Duration: ~{target_duration_seconds} seconds "
            f"(aim for approximately {estimated_slides} slides)\n"
            f"Visual Theme: {theme}\n\n"
            "Generate the complete structured slide presentation script now."
        )

    @staticmethod
    def _normalize_script(
        script: PresentationScript,
        requested_language: SupportedLanguage,
        requested_theme: str,
    ) -> PresentationScript:
        """Ensures sequential 1-based slide indices and consistent metadata."""
        normalized_slides = []
        for idx, slide in enumerate(script.slides, start=1):
            normalized_slides.append(
                SlideScriptItem(
                    slide_index=idx,
                    layout=slide.layout,
                    heading=slide.heading,
                    bullet_points=slide.bullet_points[:5],
                    voiceover_script=slide.voiceover_script,
                    visual_keywords=slide.visual_keywords,
                )
            )
        return PresentationScript(
            title=script.title,
            language=requested_language,
            theme=script.theme or requested_theme,
            slides=normalized_slides,
        )

    def generate_script(
        self,
        prompt: str,
        language: SupportedLanguage = "vi",
        target_duration_seconds: int = 60,
        theme: str = "modern_tech",
        model_override: Optional[str] = None,
    ) -> Tuple[PresentationScript, str]:
        """
        Generates and validates a PresentationScript from a user prompt using
        the Gemini Interactions API (`client.interactions.create`).

        Returns:
            Tuple[PresentationScript, str]: The validated script object and the model ID used.
        """
        primary_model = model_override or self.default_model

        if not self.api_key or self.api_key == "your_gemini_api_key_here":
            logger.warning(
                "GEMINI_API_KEY is not configured. Using deterministic local fallback script for dev testing."
            )
            return (
                self._generate_fallback_mock_script(prompt, language, theme),
                f"{primary_model} (mock-fallback)",
            )

        client = genai.Client(
            api_key=self.api_key,
            http_options={"timeout": self.timeout_seconds * 1000},
        )
        user_input = self._build_user_prompt(prompt, language, target_duration_seconds, theme)

        candidate_models = [primary_model]
        if self.fallback_model and self.fallback_model not in candidate_models:
            candidate_models.append(self.fallback_model)

        last_error: Optional[Exception] = None

        for current_model in candidate_models:
            for attempt in range(1, self.max_retries + 1):
                try:
                    logger.info(
                        "Invoking Gemini Interactions API with model '%s' (attempt %d/%d)...",
                        current_model,
                        attempt,
                        self.max_retries,
                    )
                    interaction = client.interactions.create(
                        model=current_model,
                        input=user_input,
                        system_instruction=SYSTEM_INSTRUCTION,
                        generation_config={"temperature": 0.4},
                        response_format={
                            "type": "text",
                            "mime_type": "application/json",
                            "schema": PresentationScript.model_json_schema(),
                        },
                    )

                    if interaction.output_text:
                        parsed_script = PresentationScript.model_validate_json(interaction.output_text)
                        validated = self._normalize_script(parsed_script, language, theme)
                        return validated, current_model

                    raise ValueError(f"Empty output_text received from model '{current_model}'.")

                except (ValidationError, json.JSONDecodeError) as val_err:
                    last_error = val_err
                    logger.warning(
                        "Schema validation failed on model '%s' (attempt %d/%d): %s",
                        current_model,
                        attempt,
                        self.max_retries,
                        val_err,
                    )
                except Exception as api_err:
                    last_error = api_err
                    err_msg = str(api_err).lower()
                    logger.warning(
                        "API error on model '%s' (attempt %d/%d): %s",
                        current_model,
                        attempt,
                        self.max_retries,
                        api_err,
                    )
                    if "not found" in err_msg or "404" in err_msg or "not_found" in err_msg:
                        logger.info(
                            "Model '%s' not available on endpoint; switching to fallback model.",
                            current_model,
                        )
                        break

                if attempt < self.max_retries:
                    backoff = 2 ** (attempt - 1)
                    time.sleep(backoff)

        raise RuntimeError(
            f"Failed to generate valid presentation script after retries. Last error: {last_error}"
        )

    @staticmethod
    def _clean_topic_title(prompt: str, max_chars: int = 58) -> str:
        """Normalizes whitespace and trims at word boundaries without dangling punctuation."""
        normalized = " ".join(prompt.split())
        if len(normalized) <= max_chars:
            return normalized.rstrip("([:,;- ")

        clipped = normalized[:max_chars]
        if " " in clipped:
            clipped = clipped.rsplit(" ", 1)[0]
        return clipped.rstrip("([:,;- ") or normalized[:max_chars].strip()

    @staticmethod
    def _generate_fallback_mock_script(
        prompt: str,
        language: SupportedLanguage,
        theme: str,
    ) -> PresentationScript:
        """Deterministic language-accurate dev fallback when GEMINI_API_KEY is not set."""
        clean_topic = LLMScriptGenerator._clean_topic_title(prompt, max_chars=58)

        if language == "vi":
            slides = [
                SlideScriptItem(
                    slide_index=1,
                    layout="title_intro",
                    heading=f"Tổng Quan: {clean_topic}",
                    bullet_points=[
                        "Khái niệm cốt lõi và nguyên lý hoạt động",
                        "Giá trị ứng dụng trong quy trình thực tế",
                    ],
                    voiceover_script=(
                        f"Chào mừng bạn đến với bài thuyết trình về chủ đề {clean_topic}. "
                        "Trong ít phút tới, chúng ta sẽ cùng khám phá những nguyên lý nền tảng và các điểm ứng dụng quan trọng nhất."
                    ),
                    visual_keywords="technology abstract digital network",
                ),
                SlideScriptItem(
                    slide_index=2,
                    layout="bullet_list",
                    heading="Ba Trụ Cột & Lợi Ích Cốt Lõi",
                    bullet_points=[
                        "Tự động hóa quy trình, tiết kiệm thời gian",
                        "Mở rộng linh hoạt theo nhu cầu thực tế",
                        "Vận hành ổn định và dễ dàng tích hợp",
                    ],
                    voiceover_script=(
                        "Cách tiếp cận này mang lại hiệu quả nhờ ba trụ cột chính. "
                        "Hệ thống giúp tối ưu hóa năng suất xử lý, đồng thời đảm bảo sự ổn định khi triển khai ở quy mô lớn."
                    ),
                    visual_keywords="workflow analytics cloud servers",
                ),
                SlideScriptItem(
                    slide_index=3,
                    layout="conclusion_cta",
                    heading="Tổng Kết & Hướng Ứng Dụng",
                    bullet_points=[
                        "Áp dụng từng bước vào công việc hằng ngày",
                        "Theo dõi hiệu quả và cải tiến liên tục",
                    ],
                    voiceover_script=(
                        "Đó là toàn bộ nội dung trọng tâm của chuyên đề hôm nay. "
                        "Hãy áp dụng ngay những kiến thức này vào dự án tiếp theo của bạn, và hẹn gặp lại trong các video kế tiếp."
                    ),
                    visual_keywords="future horizon innovation team",
                ),
            ]
            return PresentationScript(
                title=f"Chuyên đề: {clean_topic}",
                language="vi",
                theme=theme,
                slides=slides,
            )

        slides = [
            SlideScriptItem(
                slide_index=1,
                layout="title_intro",
                heading=f"Overview: {clean_topic}",
                bullet_points=[
                    "Core concepts and foundational architecture",
                    "Why it matters in modern workflows",
                ],
                voiceover_script=(
                    f"Welcome to this presentation on {clean_topic}. "
                    "In the next minute, we will break down the essential concepts and practical takeaways."
                ),
                visual_keywords="technology abstract digital network",
            ),
            SlideScriptItem(
                slide_index=2,
                layout="bullet_list",
                heading="Key Pillars & Advantages",
                bullet_points=[
                    "High efficiency and automated execution",
                    "Seamless scalability across environments",
                    "Reliable integration with modern toolchains",
                ],
                voiceover_script=(
                    "There are three primary pillars that make this approach effective. "
                    "It streamlines operations while maintaining reliability at scale."
                ),
                visual_keywords="workflow analytics cloud servers",
            ),
            SlideScriptItem(
                slide_index=3,
                layout="conclusion_cta",
                heading="Summary & Actionable Next Steps",
                bullet_points=[
                    "Start applying these principles today",
                    "Subscribe for more deep-dive explainers",
                ],
                voiceover_script=(
                    "That wraps up our quick guide. "
                    "Put these insights into practice on your next project, and see you in the next video."
                ),
                visual_keywords="future horizon innovation team",
            ),
        ]

        return PresentationScript(
            title=f"Deep Dive: {clean_topic}",
            language=language,
            theme=theme,
            slides=slides,
        )
