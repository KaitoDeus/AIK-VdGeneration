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
from typing import List, Optional, Tuple, Type, TypeVar

from dotenv import load_dotenv
from google import genai
from pydantic import BaseModel, ValidationError

from ..schemas import (
    MAX_PRESENTATION_SLIDES,
    PresentationScript,
    SlideExpansionBatch,
    SlideLayout,
    SlideScriptItem,
    SupportedLanguage,
)

TModel = TypeVar("TModel", bound=BaseModel)

load_dotenv()

logger = logging.getLogger(__name__)

# System instruction aligned with .agent/skills/video-prompt-engineering/SKILL.md
SYSTEM_INSTRUCTION = """You are an expert presentation designer and video scriptwriter.
Convert the user's topic or text into an engaging, structured presentation video script.

Rules:
1. Break down the content into 3 to 30 logical slides (Introduction, Key Points, Examples/Deep Dive, Summary/Call to Action) matching the requested slide count.
2. Each slide must have:
   - "slide_index": 1-based sequential integer (1, 2, 3...).
   - "heading": Catchy, concise title (under 8 words).
   - "bullet_points": 2 to 4 concise bullet points (each under 12 words, never more than 5).
   - "voiceover_script": Natural, spoken narrative text (2 to 4 sentences). Use conversational, engaging language with clear punctuation (commas, periods) so TTS pauses naturally. Do NOT include markdown syntax (`**`, `` ` ``, `#`) in spoken text.
   - "visual_keywords": 3 to 5 English keywords to search for relevant background photos or illustrations.
   - "layout": One of ["title_intro", "bullet_list", "split_card", "quote_highlight", "conclusion_cta"].
3. Visual Diversity & NotebookLM Storytelling Rhythm:
   - Always start Slide 1 with "title_intro" and end the final slide with "conclusion_cta".
   - Actively vary middle slide layouts across "split_card", "bullet_list", and "quote_highlight". NEVER place the exact same layout on two consecutive body slides.
   - Blend analytical comparisons, step-by-step workflows, core architecture breakdowns, and sharp pull-quotes so every slide looks visually distinct.
4. Strict Language Consistency: Write "title", "heading", "bullet_points", and "voiceover_script" 100% in the requested language ("vi" -> pure natural Vietnamese; "en" -> natural English). Never mix English sentences into Vietnamese scripts. Keep only "visual_keywords" in English.
5. Output: Strict JSON matching the provided schema. No markdown formatting outside the JSON object.
"""

_VI_EXPANSION_BLUEPRINTS: List[Tuple[SlideLayout, str, List[str], str, str]] = [
    (
        "split_card",
        "Bối Cảnh & Động Lực Hình Thành",
        ["Xu hướng chuyển đổi số mạnh mẽ", "Nhu cầu tự động hóa ngày càng tăng"],
        "Để hiểu rõ giá trị của {topic}, chúng ta hãy nhìn lại bối cảnh phát triển và những thách thức thực tế đặt ra cho các đội ngũ hiện đại.",
        "modern workspace timeline strategy",
    ),
    (
        "bullet_list",
        "Kiến Trúc Thành Phần Cốt Lõi",
        ["Lớp tiếp nhận và chuẩn hóa dữ liệu", "Bộ xử lý trung tâm hiệu năng cao", "Cơ chế kiểm tra chất lượng đầu ra"],
        "Về mặt cấu trúc, {topic} được tổ chức thành các tầng xử lý tách biệt, giúp từng thành phần phối hợp nhịp nhàng và dễ bảo trì.",
        "system architecture modular diagram",
    ),
    (
        "split_card",
        "Quy Trình Vận Hành Từng Bước",
        ["Bước 1: Thu thập và phân tích yêu cầu", "Bước 2: Xử lý và đồng bộ dữ liệu", "Bước 3: Đóng gói và bàn giao kết quả"],
        "Quy trình triển khai diễn ra theo ba giai đoạn rõ ràng. Mỗi bước đều có điểm kiểm tra tự động để đảm bảo kết quả nhất quán.",
        "workflow pipeline automation steps",
    ),
    (
        "quote_highlight",
        "Tự động hóa đúng chỗ giải phóng thời gian sáng tạo cho con người.",
        ["Nguyên tắc thiết kế tinh gọn"],
        "Một nguyên tắc quan trọng khi ứng dụng {topic} là để máy móc gánh phần lặp lại, còn con người tập trung vào tư duy chiến lược và chất lượng nội dung.",
        "creative studio minimal light",
    ),
    (
        "bullet_list",
        "Ứng Dụng Thực Tế Trong Doanh Nghiệp",
        ["Sản xuất tài liệu đào tạo nội bộ nhanh", "Chuẩn hóa truyền thông đa kênh", "Rút ngắn chu kỳ ra mắt sản phẩm"],
        "Trong môi trường doanh nghiệp, mô hình này giúp các phòng ban tạo nội dung đồng bộ chỉ trong vài phút thay vì nhiều ngày chuẩn bị thủ công.",
        "enterprise team presentation meeting",
    ),
    (
        "split_card",
        "So Sánh Trước Và Sau Khi Áp Dụng",
        ["Trước đây: Tốn nhiều giờ thao tác thủ công", "Hiện tại: Tự động hóa nhất quán, ít sai sót"],
        "Sự khác biệt lớn nhất nằm ở tốc độ và độ ổn định. Nhóm vận hành giảm đáng kể khối lượng công việc lặp lại nhưng vẫn giữ chuẩn đầu ra đồng đều.",
        "comparison chart analytics growth",
    ),
    (
        "bullet_list",
        "Tối Ưu Hiệu Năng & Mở Rộng Quy Mô",
        ["Xử lý bất đồng bộ qua hàng đợi", "Phân tách tác vụ nặng khỏi luồng chính", "Giám sát tiến độ theo thời gian thực"],
        "Khi lượng người dùng tăng cao, kiến trúc bất đồng bộ cho phép mở rộng tài nguyên xử lý song song mà không làm gián đoạn trải nghiệm.",
        "cloud servers scale performance",
    ),
    (
        "split_card",
        "Bảo Mật & Kiểm Soát Chất Lượng",
        ["Kiểm tra tính toàn vẹn dữ liệu đầu vào", "Cô lập môi trường thực thi an toàn", "Lưu vết lịch sử để dễ dàng rà soát"],
        "Yếu tố an toàn luôn được đặt lên hàng đầu thông qua việc xác thực chặt chẽ mọi đầu vào và ghi nhận đầy đủ nhật ký hệ thống.",
        "cybersecurity shield network data",
    ),
    (
        "bullet_list",
        "Quy Trình Kiểm Thử & Đo Lường Chuẩn",
        ["Rà soát kịch bản và từ khóa đầu vào", "Kiểm tra nhịp độ âm thanh trước khi xuất", "Đo lường tỷ lệ giữ chân người xem"],
        "Thiết lập quy trình kiểm thử rõ ràng giúp phát hiện sớm sai lệch về nhịp điệu và tối ưu chất lượng bài thuyết trình.",
        "checklist quality audit review",
    ),
    (
        "split_card",
        "Thực Hành Tốt Nhất Cho Đội Ngũ",
        ["Xây dựng bộ mẫu chuẩn theo từng chuyên đề", "Đánh giá định kỳ qua phản hồi người xem", "Cập nhật cải tiến theo từng chu kỳ ngắn"],
        "Để duy trì hiệu quả lâu dài, các nhóm nên chuẩn hóa thư viện mẫu dùng chung và đo lường phản hồi thực tế sau mỗi đợt phát hành.",
        "team collaboration best practices",
    ),
    (
        "quote_highlight",
        "Dữ liệu chuẩn xác tạo nền móng vững chắc cho mọi quy trình tự động.",
        ["Kiểm chứng trước khi mở rộng"],
        "Chất lượng đầu ra phụ thuộc trực tiếp vào độ rõ ràng của dữ liệu đầu vào. Đầu tư chuẩn hóa từ bước đầu sẽ nhân đôi hiệu quả toàn hệ thống.",
        "blueprint precision design studio",
    ),
    (
        "split_card",
        "Lộ Trình Nâng Cấp Trong Tương Lai",
        ["Tích hợp tùy biến sâu theo thương hiệu", "Hỗ trợ đa nền tảng web và di động", "Mở rộng khả năng tương tác thông minh"],
        "Trong giai đoạn tiếp theo, hệ sinh thái xoay quanh {topic} sẽ tiếp tục mở rộng khả năng cá nhân hóa và hỗ trợ linh hoạt trên mọi thiết bị.",
        "future technology horizon ai",
    ),
    (
        "bullet_list",
        "Chỉ Số Đo Lường Hiệu Quả Chính",
        ["Thời gian hoàn thành trên mỗi sản phẩm", "Tỷ lệ thành công ngay lần chạy đầu", "Mức độ hài lòng của người sử dụng"],
        "Việc theo dõi sát ba nhóm chỉ số vận hành giúp đội ngũ nhận ra điểm nghẽn sớm và chứng minh giá trị đầu tư một cách minh bạch.",
        "metrics dashboard kpi analytics",
    ),
    (
        "split_card",
        "Bài Học Kinh Nghiệm Từ Thực Tế",
        ["Bắt đầu từ quy trình nhỏ, dễ kiểm chứng", "Ưu tiên trải nghiệm người nghe và tính rõ ràng", "Mở rộng dần khi các khâu đã ổn định"],
        "Kinh nghiệm từ các dự án triển khai thành công cho thấy chiến lược đi từng bước chắc chắn luôn mang lại hiệu quả bền vững hơn.",
        "roadmap milestone business growth",
    ),
]

_EN_EXPANSION_BLUEPRINTS: List[Tuple[SlideLayout, str, List[str], str, str]] = [
    (
        "split_card",
        "Context & Industry Motivation",
        ["Rising demand for rapid content delivery", "Manual workflows struggle to scale cleanly"],
        "To understand the impact of {topic}, let us examine the operational pressures driving teams toward modern automated pipelines.",
        "modern workspace strategy timeline",
    ),
    (
        "bullet_list",
        "Core Architectural Components",
        ["Input validation and normalization layer", "Modular high-throughput processing engine", "Deterministic verification before delivery"],
        "Structurally, {topic} separates ingestion, synthesis, and delivery into clean stages so each module evolves independently.",
        "system architecture modular diagram",
    ),
    (
        "split_card",
        "End-to-End Execution Flow",
        ["Stage 1: Parse intent and structure outline", "Stage 2: Synthesize synchronized assets", "Stage 3: Compile verified final output"],
        "Execution progresses through three well-defined stages, with automated schema and media checks guarding every handoff.",
        "workflow pipeline automation steps",
    ),
    (
        "quote_highlight",
        "Precision automation handles repetition so creators can focus on clarity.",
        ["Design Principle"],
        "When applying {topic}, let background workers shoulder heavy compilation while your team refines narrative focus and storytelling.",
        "creative studio minimal lighting",
    ),
    (
        "bullet_list",
        "High-Value Practical Use Cases",
        ["Technical onboarding & explainer decks", "Consistent multilingual product updates", "Rapid micro-learning course production"],
        "Across engineering and marketing teams, this workflow turns dense documentation into clear visual briefings in minutes.",
        "enterprise team presentation meeting",
    ),
    (
        "split_card",
        "Manual Process vs. Automated Pipeline",
        ["Legacy: Hours of tedious manual alignment", "Modern: Deterministic sync with zero drift"],
        "The sharpest improvement is timing consistency. Automated frame calculation eliminates tedious manual timeline adjustments.",
        "comparison chart analytics growth",
    ),
    (
        "bullet_list",
        "Scaling Concurrency & Throughput",
        ["Decoupled message queues prevent bottlenecks", "Horizontal workers absorb burst workloads", "Live WebSocket telemetry tracks progress"],
        "Under peak traffic, asynchronous task queues and parallel workers keep response latency fast and predictable.",
        "cloud servers scale performance",
    ),
    (
        "split_card",
        "Reliability, Validation & Safeguards",
        ["Strict schema validation at boundaries", "Automatic exponential backoff retries", "Graceful fallbacks protect user experience"],
        "Resilience is built directly into the pipeline through strict contracts, retry recovery, and predictable fallback paths.",
        "cybersecurity shield network data",
    ),
    (
        "bullet_list",
        "Common Pitfalls to Avoid",
        ["Skipping clear prompt language alignment", "Overcrowding slides with excessive text", "Ignoring audio pacing and visual contrast"],
        "To maintain viewer engagement, keep bullet copy concise and verify that narration pacing matches each slide transition.",
        "checklist quality audit review",
    ),
    (
        "split_card",
        "Team Best Practices",
        ["Standardize reusable domain templates", "Review generated drafts before rendering", "Measure audience retention iteratively"],
        "High-performing teams treat templates as living assets and inspect draft scripts early before committing to full renders.",
        "team collaboration best practices",
    ),
    (
        "quote_highlight",
        "Strong structure turns complex ideas into effortless understanding.",
        ["Editorial Standard"],
        "Great visual communication depends less on flashy effects and more on disciplined pacing and well-structured arguments.",
        "blueprint precision design studio",
    ),
    (
        "split_card",
        "Looking Ahead: Next Capabilities",
        ["Deep interactive canvas customization", "Seamless multi-format mobile publishing", "Smarter context-aware visual curation"],
        "Going forward, workflows around {topic} will continue expanding personalization, mobile adaptability, and interactive editing.",
        "future technology horizon ai",
    ),
    (
        "bullet_list",
        "Key Performance Metrics to Track",
        ["End-to-end turnaround time per video", "First-pass render completion rate", "Audience completion and clarity scores"],
        "Tracking concrete operational metrics helps teams catch bottlenecks early and demonstrate measurable productivity gains.",
        "metrics dashboard kpi analytics",
    ),
    (
        "split_card",
        "Field-Tested Rollout Strategy",
        ["Pilot with focused flagship topics first", "Gather stakeholder feedback on pacing", "Expand template coverage across teams"],
        "Rolling out gradually around well-tested templates gives every contributor immediate confidence and consistent quality.",
        "roadmap milestone business growth",
    ),
]


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
        target_slides: Optional[int] = None,
    ) -> str:
        estimated_slides = (
            max(3, min(MAX_PRESENTATION_SLIDES, target_slides))
            if target_slides is not None
            else max(3, min(MAX_PRESENTATION_SLIDES, round(target_duration_seconds / 10)))
        )
        lang_name = "Vietnamese" if language == "vi" else "English"
        strict_note = (
            "Write every title, heading, bullet point, and voiceover_script exclusively in Vietnamese."
            if language == "vi"
            else "Write every title, heading, bullet point, and voiceover_script exclusively in English."
        )
        return (
            f"Topic / Source Prompt: {prompt}\n"
            f"Target Language: {language} ({lang_name}) — {strict_note}\n"
            f"Target Video Duration: ~{target_duration_seconds} seconds "
            f"(generate approximately {estimated_slides} slides)\n"
            f"Visual Theme: {theme}\n\n"
            "Generate the complete structured slide presentation script now."
        )

    @staticmethod
    def _normalize_slides(slides: List[SlideScriptItem]) -> List[SlideScriptItem]:
        """Normalizes sequential 1-based slide indices and caps bullets to 5 per slide."""
        return [
            SlideScriptItem(
                slide_index=idx,
                layout=slide.layout,
                heading=slide.heading,
                bullet_points=slide.bullet_points[:5],
                voiceover_script=slide.voiceover_script,
                visual_keywords=slide.visual_keywords,
            )
            for idx, slide in enumerate(slides[:MAX_PRESENTATION_SLIDES], start=1)
        ]

    @staticmethod
    def _normalize_script(
        script: PresentationScript,
        requested_language: SupportedLanguage,
        requested_theme: str,
    ) -> PresentationScript:
        """Ensures sequential 1-based slide indices and consistent metadata."""
        return PresentationScript(
            title=script.title,
            language=requested_language,
            theme=script.theme or requested_theme,
            slides=LLMScriptGenerator._normalize_slides(script.slides),
        )

    def _invoke_gemini_structured_json(
        self,
        user_input: str,
        response_schema_model: Type[TModel],
        model_override: Optional[str] = None,
    ) -> Tuple[TModel, str]:
        """Invokes Gemini Interactions API with retries, fallback model switch, and schema parsing."""
        primary_model = model_override or self.default_model
        client = genai.Client(
            api_key=self.api_key,
            http_options={"timeout": self.timeout_seconds * 1000},
        )

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
                            "schema": response_schema_model.model_json_schema(),
                        },
                    )

                    if interaction.output_text:
                        parsed = response_schema_model.model_validate_json(interaction.output_text)
                        return parsed, current_model

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

    def generate_script(
        self,
        prompt: str,
        language: SupportedLanguage = "vi",
        target_duration_seconds: int = 60,
        theme: str = "modern_tech",
        model_override: Optional[str] = None,
        target_slides: Optional[int] = None,
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
                self._generate_fallback_mock_script(
                    prompt,
                    language,
                    theme,
                    target_slides=target_slides,
                ),
                f"{primary_model} (mock-fallback)",
            )

        user_input = self._build_user_prompt(
            prompt,
            language,
            target_duration_seconds,
            theme,
            target_slides=target_slides,
        )
        parsed_script, model_used = self._invoke_gemini_structured_json(
            user_input=user_input,
            response_schema_model=PresentationScript,
            model_override=model_override,
        )
        return self._normalize_script(parsed_script, language, theme), model_used

    def expand_script(
        self,
        script: PresentationScript,
        additional_slides: int = 10,
        topic_hint: Optional[str] = None,
        model_override: Optional[str] = None,
    ) -> Tuple[PresentationScript, str]:
        """
        Automatically generates continuation slides (up to MAX_PRESENTATION_SLIDES total)
        and inserts new deep-dive body slides seamlessly before any concluding CTA slide.
        """
        remaining_capacity = MAX_PRESENTATION_SLIDES - len(script.slides)
        if remaining_capacity <= 0:
            raise ValueError(
                f"Presentation already reached the maximum limit of {MAX_PRESENTATION_SLIDES} slides."
            )

        count_to_generate = max(1, min(additional_slides, remaining_capacity))
        primary_model = model_override or self.default_model

        if not self.api_key or self.api_key == "your_gemini_api_key_here":
            logger.warning(
                "GEMINI_API_KEY is not configured. Using deterministic local continuation slides."
            )
            generated_slides = self._generate_fallback_continuation_slides(
                topic=topic_hint or script.title,
                language=script.language,
                count=count_to_generate,
                existing_headings=[s.heading for s in script.slides],
            )
            merged = self.merge_continuation_slides(script, generated_slides)
            return merged, f"{primary_model} (mock-fallback)"

        outline = "\n".join(
            f"- Slide {s.slide_index} ({s.layout}): {s.heading} | {', '.join(s.bullet_points)}"
            for s in script.slides
        )
        lang_name = "Vietnamese" if script.language == "vi" else "English"
        hint_line = f"\nFocus / Expansion Guidance: {topic_hint.strip()}" if topic_hint and topic_hint.strip() else ""
        expand_prompt = (
            f"Presentation Title: {script.title}\n"
            f"Target Language: {script.language} ({lang_name}) — strictly keep ALL headings, bullet_points, "
            f"and voiceover_script exclusively in {lang_name}.\n"
            f"Existing Deck Outline:\n{outline}{hint_line}\n\n"
            f"Generate exactly {count_to_generate} NEW, non-repetitive continuation body slides "
            f"(using varied layouts from ['bullet_list', 'split_card', 'quote_highlight']) that deepen, "
            f"illustrate with concrete examples, compare tradeoffs, and extend the presentation cleanly."
        )
        batch, model_used = self._invoke_gemini_structured_json(
            user_input=expand_prompt,
            response_schema_model=SlideExpansionBatch,
            model_override=model_override,
        )
        merged = self.merge_continuation_slides(script, batch.slides[:count_to_generate])
        return merged, model_used

    @staticmethod
    def merge_continuation_slides(
        existing_script: PresentationScript,
        new_slides: List[SlideScriptItem],
    ) -> PresentationScript:
        """
        Inserts newly generated deep-dive slides right before any trailing `conclusion_cta`
        slide (or appends if none) and re-numbers all slide indices sequentially 1..N.
        """
        existing = list(existing_script.slides)
        if existing and existing[-1].layout == "conclusion_cta":
            combined = existing[:-1] + list(new_slides) + [existing[-1]]
        else:
            combined = existing + list(new_slides)

        return PresentationScript(
            title=existing_script.title,
            language=existing_script.language,
            theme=existing_script.theme,
            slides=LLMScriptGenerator._normalize_slides(combined),
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
    def _generate_fallback_continuation_slides(
        topic: str,
        language: SupportedLanguage,
        count: int,
        existing_headings: Optional[List[str]] = None,
    ) -> List[SlideScriptItem]:
        """Generates diverse, topic-aware continuation slides without duplicating existing headings."""
        clean_topic = LLMScriptGenerator._clean_topic_title(
            topic.replace("Chuyên đề:", "").replace("Deep Dive:", "").strip(),
            max_chars=52,
        ) or ("nội dung này" if language == "vi" else "this topic")
        catalog = _VI_EXPANSION_BLUEPRINTS if language == "vi" else _EN_EXPANSION_BLUEPRINTS
        used = {h.strip().lower() for h in (existing_headings or [])}

        ordered = [bp for bp in catalog if bp[1].strip().lower() not in used]
        if len(ordered) < count:
            ordered.extend(catalog)

        generated: List[SlideScriptItem] = []
        for idx in range(count):
            bp = ordered[idx % len(ordered)]
            cycle = idx // len(ordered)
            heading = bp[1] if cycle == 0 else f"{bp[1]} ({cycle + 1})"
            generated.append(
                SlideScriptItem(
                    slide_index=idx + 1,
                    layout=bp[0],
                    heading=heading,
                    bullet_points=list(bp[2]),
                    voiceover_script=bp[3].format(topic=clean_topic),
                    visual_keywords=bp[4],
                )
            )
        return generated

    @staticmethod
    def _generate_fallback_mock_script(
        prompt: str,
        language: SupportedLanguage,
        theme: str,
        target_slides: Optional[int] = None,
    ) -> PresentationScript:
        """Deterministic language-accurate dev fallback when GEMINI_API_KEY is not set."""
        clean_topic = LLMScriptGenerator._clean_topic_title(prompt, max_chars=58)

        if language == "vi":
            base_script = PresentationScript(
                title=f"Chuyên đề: {clean_topic}",
                language="vi",
                theme=theme,
                slides=[
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
                ],
            )
        else:
            base_script = PresentationScript(
                title=f"Deep Dive: {clean_topic}",
                language=language,
                theme=theme,
                slides=[
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
                ],
            )

        desired = (
            max(3, min(MAX_PRESENTATION_SLIDES, target_slides))
            if target_slides is not None
            else 3
        )
        if desired > len(base_script.slides):
            extra = LLMScriptGenerator._generate_fallback_continuation_slides(
                topic=clean_topic,
                language=language,
                count=desired - len(base_script.slides),
                existing_headings=[s.heading for s in base_script.slides],
            )
            return LLMScriptGenerator.merge_continuation_slides(base_script, extra)
        return base_script
