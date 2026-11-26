"""
LLM Script Generation Service (Milestone M1.2).
Transforms user prompts into strictly validated multi-slide presentation scripts
using the official Google GenAI SDK (`google-genai` >= 3.2.0) Interactions API
and Structured Outputs (`response_format`).
"""

import json
import logging
import os
import re
import time
from typing import Dict, List, Optional, Tuple, Type, TypeVar

from dotenv import load_dotenv
from google import genai
from pydantic import BaseModel, ValidationError

from ..schemas import (
    ChannelContextProfile,
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
1. Break down the content into 3 to 30 logical slides (Introduction, Key Insights, Story/Contrast, Visual Perspective, Conclusion) matching the requested slide count.
2. Each slide must have:
   - "slide_index": 1-based sequential integer (1, 2, 3...).
   - "heading": Clear, natural, catchy human headline (under 9 words). Avoid robotic label prefixes.
   - "bullet_points": Minimalist talking highlights or crisp natural phrases (NOT numbered bullets like "Step 1:" or dense bulleted checklists). Use 1 to 2 concise subtitle sentences on "title_intro" and "quote_highlight", and 2 to 3 succinct statements on body slides.
   - "voiceover_script": Natural, spoken narrative text (2 to 4 sentences). Use conversational, engaging language with clear punctuation (commas, periods) so TTS pauses naturally. Do NOT include markdown syntax (`**`, `` ` ``, `#`) in spoken text.
   - "visual_keywords": 3 to 5 concrete English photography keywords describing specific scenes, objects, lighting, and setting (e.g. "developer coding neon monitor closeup" or "street food steaming bowl warm lighting") — NEVER vague abstract words like "abstract concept".
   - "layout": One of ["title_intro", "bullet_list", "split_card", "quote_highlight", "conclusion_cta"].
3. Visual Diversity & Editorial Rhythm:
   - Always start Slide 1 with "title_intro" and end the final slide with "conclusion_cta".
   - Actively vary middle slide layouts across "split_card", "quote_highlight", and "bullet_list" — do NOT overuse "bullet_list", and NEVER place the same layout on two consecutive body slides.
   - Write bold, story-driven, surprising headlines rather than dry academic chapter labels (avoid cliché headings like "Overview", "Tổng Quan", or "Key Pillars").
4. Strict Language Consistency: Write "title", "heading", "bullet_points", and "voiceover_script" 100% in the requested language ("vi" -> pure natural Vietnamese; "en" -> natural English). Never mix English sentences into Vietnamese scripts. Keep only "visual_keywords" in English.
5. Output: Strict JSON matching the provided schema. No markdown formatting outside the JSON object.
"""

_DOMAIN_VISUAL_SCENES: Dict[str, List[str]] = {
    "tech_it": [
        "software developer glowing code monitor dark desk",
        "modern computer hardware microchip circuit macro",
        "server rack neon blue lights data center",
        "minimalist programmer laptop mechanical keyboard workspace",
        "futuristic digital interface hologram screen studio",
    ],
    "gaming": [
        "gaming setup neon purple rgb keyboard monitor",
        "esports controller glowing cyber studio desk",
        "dramatic neon arcade lights dark room",
        "high tech streaming microphone headphones studio",
        "cyberpunk cityscape neon reflection night",
    ],
    "culinary": [
        "chef cooking wok flame restaurant kitchen",
        "delicious asian noodle bowl warm lighting closeup",
        "artisan coffee espresso pour cafe counter",
        "fresh vibrant ingredients wooden table photography",
        "street food night market warm bokeh lights",
    ],
    "finance": [
        "modern glass skyscraper skyline golden hour",
        "financial analytics monitor trading desk workspace",
        "startup founders brainstorming glass boardroom",
        "luxury modern architecture interior warm light",
        "minimalist notebook coffee desk strategy meeting",
    ],
    "travel": [
        "dramatic mountain sunrise clouds landscape wide",
        "tropical turquoise coastline aerial nature view",
        "vibrant night city street neon lanterns",
        "hiking traveler backpack misty mountain peak",
        "historic cultural temple golden sunset light",
    ],
    "education": [
        "modern university library warm sunlight books",
        "creative design desk notebook sketches pen",
        "science laboratory glass flasks glowing light",
        "student focused laptop coffee shop window",
        "architecture museum minimalist bright atrium",
    ],
    "creator": [
        "filmmaker cinema camera studio colorful lighting",
        "podcast microphone studio foam neon accent",
        "video editing timeline monitor color grading",
        "creative studio ring light smartphone tripod",
        "stage spotlight bokeh creative photography",
    ],
    "general": [
        "creative studio colorful spotlight workspace",
        "modern architecture glass interior warm sunlight",
        "focused craftsperson desk close up natural light",
        "dynamic motion light trails dark background",
        "minimalist editorial table design inspiration",
    ],
}


def _detect_script_domain(combined_text: str) -> str:
    """Infers visual & narrative domain from topic + channel metadata for context-accurate slides."""
    lower = (combined_text or "").lower()
    domain_patterns = [
        ("tech_it", r"(congthichit|lập trình|\bcode\b|\bcoding\b|\bdev\b|\bsoftware\b|\bmicroservice|\bcloud\b|\bserver\b|\bhardware\b|\bpc\b|\blaptop\b|công nghệ|\bai\b|\bit\b)"),
        ("gaming", r"(\bgame\b|\bgaming\b|\besports\b|\bstream\b|\banime\b|\bfps\b|combo|rank|gaming gear)"),
        ("culinary", r"(ẩm thực|món ăn|nấu ăn|cà phê|\bcoffee\b|\bfood\b|\bcooking\b|\brecipe\b|quán ngon)"),
        ("finance", r"(gọi vốn|\bpitch\b|kinh doanh|tài chính|\bsaas\b|\bstartup\b|\bb2b\b|\bmarketing\b|\bfinance\b|\binvest\b)"),
        ("travel", r"(du lịch|\btravel\b|\bnature\b|thiên nhiên|biển|núi|khám phá)"),
        ("creator", r"(tiktok|shorts|reels|video ngắn|creator|sáng tạo nội dung|podcast|nhà sáng tạo)"),
        ("education", r"(học tập|giáo dục|tiếng anh|\benglish\b|\bstudy\b|\beducation\b|\bdesign\b|thiết kế)"),
    ]
    for domain, pattern in domain_patterns:
        if re.search(pattern, lower):
            return domain
    return "general"

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

    @staticmethod
    def _format_channel_context_block(channel_context: Optional[ChannelContextProfile]) -> str:
        if channel_context is None:
            return ""
        pillars = ", ".join(channel_context.content_pillars[:5]) or "General"
        keywords = ", ".join(channel_context.keywords[:6]) or "N/A"
        recent = " | ".join(channel_context.recent_video_titles[:3]) or "N/A"
        return (
            "\nCreator Channel Context (align tone, vocabulary, hooks & audience framing cleanly):\n"
            f"- Creator Account: {channel_context.display_name} ({channel_context.handle})\n"
            f"- Niche / Domain: {channel_context.niche_category}\n"
            f"- Target Audience: {channel_context.target_audience}\n"
            f"- Tone & Storytelling Style: {channel_context.tone_and_style}\n"
            f"- Core Content Pillars: {pillars}\n"
            f"- Topical Keywords: {keywords}\n"
            f"- Recent Topic References: {recent}\n"
        )

    def _build_user_prompt(
        self,
        prompt: str,
        language: SupportedLanguage,
        target_duration_seconds: int,
        theme: str,
        target_slides: Optional[int] = None,
        aspect_ratio: str = "16:9",
        video_format: Optional[str] = None,
        channel_context: Optional[ChannelContextProfile] = None,
    ) -> str:
        is_short = (video_format == "short") or (aspect_ratio == "9:16")
        estimated_slides = (
            max(3, min(MAX_PRESENTATION_SLIDES, target_slides))
            if target_slides is not None
            else (
                max(3, min(6, round(target_duration_seconds / 8)))
                if is_short
                else max(3, min(MAX_PRESENTATION_SLIDES, round(target_duration_seconds / 10)))
            )
        )
        lang_name = "Vietnamese" if language == "vi" else "English"
        strict_note = (
            "Write every title, heading, bullet point, and voiceover_script exclusively in Vietnamese."
            if language == "vi"
            else "Write every title, heading, bullet point, and voiceover_script exclusively in English."
        )
        short_guidance = (
            "\nVideo Format: VERTICAL SHORT VIDEO (9:16 TikTok / YouTube Shorts / Reels).\n"
            "- Slide 1 must deliver an immediate, curiosity-sparking scroll-stopping Hook heading (<= 6 words) and 1-2 ultra-short bullet teasers.\n"
            "- Keep all headings ultra-concise (3 to 6 words) and limit bullets to 1-3 short phrases (<= 7 words each) so large mobile typography stays crystal clear.\n"
            "- Keep voiceover_script fast, conversational, and high-energy (1 to 2 tight spoken sentences per slide matching short-form pacing).\n"
            if is_short
            else ""
        )
        channel_guidance = self._format_channel_context_block(channel_context)
        return (
            f"Topic / Source Prompt: {prompt}\n"
            f"Target Language: {language} ({lang_name}) — {strict_note}\n"
            f"Target Video Duration: ~{target_duration_seconds} seconds "
            f"(generate approximately {estimated_slides} slides)\n"
            f"Aspect Ratio: {aspect_ratio}\n"
            f"Visual Theme: {theme}\n"
            f"{short_guidance}{channel_guidance}\n"
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
        system_instruction: Optional[str] = None,
        use_google_search: bool = False,
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
                    create_kwargs = {
                        "model": current_model,
                        "input": user_input,
                        "system_instruction": system_instruction or SYSTEM_INSTRUCTION,
                        "generation_config": {"temperature": 0.4},
                        "response_format": {
                            "type": "text",
                            "mime_type": "application/json",
                            "schema": response_schema_model.model_json_schema(),
                        },
                    }
                    if use_google_search:
                        create_kwargs["tools"] = [{"type": "google_search"}]
                    interaction = client.interactions.create(**create_kwargs)

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
        aspect_ratio: str = "16:9",
        video_format: Optional[str] = None,
        channel_context: Optional[ChannelContextProfile] = None,
    ) -> Tuple[PresentationScript, str]:
        """
        Generates and validates a PresentationScript from a user prompt using
        the Gemini Interactions API (`client.interactions.create`).

        Returns:
            Tuple[PresentationScript, str]: The validated script object and the model ID used.
        """
        primary_model = model_override or self.default_model
        is_short = (video_format == "short") or (aspect_ratio == "9:16")

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
                    is_short=is_short,
                    channel_context=channel_context,
                ),
                f"{primary_model} (mock-fallback)",
            )

        user_input = self._build_user_prompt(
            prompt,
            language,
            target_duration_seconds,
            theme,
            target_slides=target_slides,
            aspect_ratio=aspect_ratio,
            video_format=video_format,
            channel_context=channel_context,
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
        channel_context: Optional[ChannelContextProfile] = None,
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
                channel_context=channel_context,
            )
            merged = self.merge_continuation_slides(script, generated_slides)
            return merged, f"{primary_model} (mock-fallback)"

        outline = "\n".join(
            f"- Slide {s.slide_index} ({s.layout}): {s.heading} | {', '.join(s.bullet_points)}"
            for s in script.slides
        )
        lang_name = "Vietnamese" if script.language == "vi" else "English"
        hint_line = f"\nFocus / Expansion Guidance: {topic_hint.strip()}" if topic_hint and topic_hint.strip() else ""
        channel_block = self._format_channel_context_block(channel_context)
        expand_prompt = (
            f"Presentation Title: {script.title}\n"
            f"Target Language: {script.language} ({lang_name}) — strictly keep ALL headings, bullet_points, "
            f"and voiceover_script exclusively in {lang_name}.\n"
            f"Existing Deck Outline:\n{outline}{hint_line}{channel_block}\n\n"
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
            return normalized.rstrip("([:,;-· ")

        clipped = normalized[:max_chars]
        if " " in clipped:
            clipped = clipped.rsplit(" ", 1)[0]
        return clipped.rstrip("([:,;-· ") or normalized[:max_chars].strip()

    @staticmethod
    def _generate_fallback_continuation_slides(
        topic: str,
        language: SupportedLanguage,
        count: int,
        existing_headings: Optional[List[str]] = None,
        channel_context: Optional[ChannelContextProfile] = None,
    ) -> List[SlideScriptItem]:
        """Generates diverse, topic-aware continuation slides without duplicating existing headings."""
        clean_topic = LLMScriptGenerator._clean_topic_title(
            topic.replace("Chuyên đề:", "").replace("Deep Dive:", "").strip(),
            max_chars=52,
        ) or ("nội dung này" if language == "vi" else "this topic")
        channel_block_text = (
            f"{channel_context.display_name} {channel_context.niche_category} "
            f"{' '.join(channel_context.keywords)} {' '.join(channel_context.content_pillars)}"
            if channel_context
            else ""
        )
        domain = _detect_script_domain(
            f"{topic} {channel_block_text}"
        )
        scene_pool = _DOMAIN_VISUAL_SCENES.get(domain, _DOMAIN_VISUAL_SCENES["general"])

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
            # Rotate authentic domain scenes cleanly so expansion slides showcase rich imagery
            scene_kw = scene_pool[(idx + 1) % len(scene_pool)] if domain != "general" else bp[4]
            generated.append(
                SlideScriptItem(
                    slide_index=idx + 1,
                    layout=bp[0],
                    heading=heading,
                    bullet_points=list(bp[2]),
                    voiceover_script=bp[3].format(topic=clean_topic),
                    visual_keywords=scene_kw,
                )
            )
        return generated

    @staticmethod
    def _generate_fallback_mock_script(
        prompt: str,
        language: SupportedLanguage,
        theme: str,
        target_slides: Optional[int] = None,
        is_short: bool = False,
        channel_context: Optional[ChannelContextProfile] = None,
    ) -> PresentationScript:
        """Deterministic context-grounded script generator when GEMINI_API_KEY is not set."""
        normalized_prompt = " ".join(prompt.split())
        clean_topic = LLMScriptGenerator._clean_topic_title(prompt, max_chars=52 if is_short else 58)
        channel_text = (
            f"{channel_context.display_name} {channel_context.handle} {channel_context.niche_category} "
            f"{' '.join(channel_context.content_pillars)} {' '.join(channel_context.keywords)} "
            f"{' '.join(channel_context.recent_video_titles[:3])}"
            if channel_context
            else ""
        )
        domain = _detect_script_domain(f"{prompt} {channel_text}")
        scene_pool = _DOMAIN_VISUAL_SCENES.get(domain, _DOMAIN_VISUAL_SCENES["general"])

        channel_intro_vi = (
            f"Theo đúng chất kể chuyện của kênh {channel_context.display_name} ({channel_context.niche_category}), "
            if channel_context
            else ""
        )
        channel_intro_en = (
            f"Tailored to {channel_context.display_name}'s voice ({channel_context.niche_category}), "
            if channel_context
            else ""
        )
        pillars = [p.strip() for p in (channel_context.content_pillars if channel_context else []) if p.strip()]
        domain_default_pillar_vi = {
            "tech_it": "Công Nghệ & Tư Duy Hệ Thống",
            "gaming": "Nhịp Độ Trận Đấu & Chiến Thuật",
            "culinary": "Hương Vị Bản Địa & Bếp Lửa",
            "finance": "Động Lực Tăng Trưởng & Dòng Tiền",
            "travel": "Khung Hình Thực Địa & Trải Nghiệm",
            "creator": "Nhịp Dựng & Câu Hook Bắt Mắt",
            "education": "Phương Pháp Trực Quan Dễ Nhớ",
        }.get(domain, "Giá Trị Thực Tế Cốt Lõi")
        domain_default_pillar_en = {
            "tech_it": "Engineering & Modern Systems",
            "gaming": "Competitive Mechanics & Flow",
            "culinary": "Craft Flavors & Kitchen Fire",
            "finance": "Growth Levers & Market Strategy",
            "travel": "Visual Story & Destination Feel",
            "creator": "High-Retention Pacing & Hooks",
            "education": "Clear Visual Mental Models",
        }.get(domain, "Real-World Practical Value")

        primary_pillar = pillars[0] if pillars else (
            domain_default_pillar_vi if language == "vi" else domain_default_pillar_en
        )
        secondary_pillar = pillars[1] if len(pillars) > 1 else (
            "Góc nhìn thị giác giàu cảm xúc" if language == "vi" else "Fresh visual perspective"
        )

        # Extract authentic subject cleanly on full normalized_prompt (never truncated mid-@handle)
        vi_stripped = re.sub(
            r"^(tạo video ngắn cuốn hút đúng phong cách kênh|giải thích|giới thiệu)\s*",
            "",
            normalized_prompt,
            flags=re.IGNORECASE,
        ).strip()
        if vi_stripped.startswith("@"):
            vi_handle = vi_stripped.split()[0]
            vi_rest = vi_stripped[len(vi_handle) :].strip(" ,.-:")
            subject_vi = vi_rest or (
                pillars[0]
                if pillars
                else (
                    f"{domain_default_pillar_vi} {vi_handle}"
                    if len(vi_handle) <= 14
                    else domain_default_pillar_vi
                )
            )
        else:
            subject_vi = LLMScriptGenerator._clean_topic_title(vi_stripped or normalized_prompt, max_chars=44)

        en_stripped = re.sub(
            r"^(create a punchy short presentation tailored to|explain|introduce)\s*",
            "",
            normalized_prompt,
            flags=re.IGNORECASE,
        ).strip()
        if en_stripped.startswith("@"):
            en_handle = en_stripped.split()[0]
            en_rest = en_stripped[len(en_handle) :].strip(" ,.-:")
            subject_en = en_rest or (pillars[0] if pillars else f"{domain_default_pillar_en} · {en_handle}")
        else:
            subject_en = LLMScriptGenerator._clean_topic_title(en_stripped or normalized_prompt, max_chars=42)

        subject_vi_short = LLMScriptGenerator._clean_topic_title(subject_vi, max_chars=38)
        subject_en_short = LLMScriptGenerator._clean_topic_title(subject_en, max_chars=38)

        if is_short and language == "vi":
            base_script = PresentationScript(
                title=f"Shorts: {clean_topic}",
                language="vi",
                theme=theme,
                slides=[
                    SlideScriptItem(
                        slide_index=1,
                        layout="title_intro",
                        heading=f"Điểm Sáng 30 Giây: {subject_vi_short}",
                        bullet_points=[primary_pillar, secondary_pillar],
                        voiceover_script=(
                            f"{channel_intro_vi}Đừng lướt qua nếu bạn muốn nắm ngay cốt lõi của {subject_vi} chỉ trong nửa phút."
                        ),
                        visual_keywords=scene_pool[0],
                    ),
                    SlideScriptItem(
                        slide_index=2,
                        layout="split_card",
                        heading=f"Khác Biệt Từ {LLMScriptGenerator._clean_topic_title(primary_pillar, max_chars=34)}",
                        bullet_points=[
                            "Đi thẳng vào bối cảnh thực tế ngay giây đầu",
                            "Nhịp cắt gãy gọn, hình ảnh tương phản cao",
                        ],
                        voiceover_script=(
                            f"Thay vì giải thích dài dòng, cách tiếp cận {primary_pillar} giúp người xem lập tức thấy kết quả trực quan."
                        ),
                        visual_keywords=scene_pool[1 % len(scene_pool)],
                    ),
                    SlideScriptItem(
                        slide_index=3,
                        layout="bullet_list",
                        heading="Ba Nguyên Tắc Đắt Giá Khi Kể Chuyện",
                        bullet_points=[
                            "Bối cảnh thực tế ngay 3 giây đầu",
                            "Chuyển động nhịp nhàng theo âm thanh",
                            secondary_pillar,
                        ],
                        voiceover_script=(
                            "Chỉ một khung hình đúng bối cảnh kết hợp nhịp chuyển động mượt sẽ giữ trọn sự tập trung đến giây cuối."
                        ),
                        visual_keywords=scene_pool[2 % len(scene_pool)],
                    ),
                    SlideScriptItem(
                        slide_index=4,
                        layout="conclusion_cta",
                        heading="Lưu Ý Tưởng & Bấm Máy Ngay",
                        bullet_points=[
                            "Áp dụng ngay cho tập tiếp theo",
                            "Giữ chất riêng nhưng nâng tầm thị giác",
                        ],
                        voiceover_script=(
                            "Hãy thử áp dụng công thức này cho video kế tiếp và theo dõi để khám phá thêm nhiều góc nhìn hay!"
                        ),
                        visual_keywords=scene_pool[3 % len(scene_pool)],
                    ),
                ],
            )
        elif is_short:
            base_script = PresentationScript(
                title=f"Shorts: {clean_topic}",
                language=language,
                theme=theme,
                slides=[
                    SlideScriptItem(
                        slide_index=1,
                        layout="title_intro",
                        heading=f"The 30-Second Hook: {subject_en_short}",
                        bullet_points=[primary_pillar, secondary_pillar],
                        voiceover_script=(
                            f"{channel_intro_en}Stop scrolling if you want the sharpest visual breakdown of {subject_en}."
                        ),
                        visual_keywords=scene_pool[0],
                    ),
                    SlideScriptItem(
                        slide_index=2,
                        layout="split_card",
                        heading=f"Inside {LLMScriptGenerator._clean_topic_title(primary_pillar, max_chars=36)}",
                        bullet_points=["Instant visual proof", "High-contrast pacing built for Shorts"],
                        voiceover_script=(
                            f"By leading with {primary_pillar}, viewers grasp the payoff before the three-second drop-off window."
                        ),
                        visual_keywords=scene_pool[1 % len(scene_pool)],
                    ),
                    SlideScriptItem(
                        slide_index=3,
                        layout="bullet_list",
                        heading="Three Rules Behind Memorable Shorts",
                        bullet_points=[
                            "Open inside a vivid real-world scene",
                            "Let dynamic motion pace each transition",
                            secondary_pillar,
                        ],
                        voiceover_script=(
                            "Pairing domain-authentic photography with rhythmic motion turns dry points into memorable moments."
                        ),
                        visual_keywords=scene_pool[2 % len(scene_pool)],
                    ),
                    SlideScriptItem(
                        slide_index=4,
                        layout="conclusion_cta",
                        heading="Bring This Energy To Your Next Reel",
                        bullet_points=["Lock in the hook", "Render 9:16 with synced captions"],
                        voiceover_script=(
                            "Save this flow for your next vertical release, and follow for sharper storytelling tactics."
                        ),
                        visual_keywords=scene_pool[3 % len(scene_pool)],
                    ),
                ],
            )
        elif language == "vi":
            base_script = PresentationScript(
                title=f"Chuyên đề: {clean_topic}",
                language="vi",
                theme=theme,
                slides=[
                    SlideScriptItem(
                        slide_index=1,
                        layout="title_intro",
                        heading=f"Góc Nhìn Sâu: {subject_vi_short}",
                        bullet_points=[primary_pillar, secondary_pillar],
                        voiceover_script=(
                            f"{channel_intro_vi}Chào mừng bạn cùng khám phá câu chuyện phía sau {subject_vi} qua những bối cảnh trực quan sống động."
                        ),
                        visual_keywords=scene_pool[0],
                    ),
                    SlideScriptItem(
                        slide_index=2,
                        layout="split_card",
                        heading=f"Điểm Sáng Từ {LLMScriptGenerator._clean_topic_title(primary_pillar, max_chars=34)}",
                        bullet_points=[
                            "Bối cảnh thực tế quyết định cách khán giả cảm nhận",
                            "Mỗi chuyển cảnh đều gắn với một luận điểm rõ nét",
                            "Kết hợp hình ảnh giàu cảm xúc và nhịp kể tự nhiên",
                        ],
                        voiceover_script=(
                            f"Điểm tạo nên sức hút của {subject_vi} không nằm ở lý thuyết khô khan, mà ở cách đặt đúng tình huống và hình ảnh vào từng nhịp kể."
                        ),
                        visual_keywords=scene_pool[1 % len(scene_pool)],
                    ),
                    SlideScriptItem(
                        slide_index=3,
                        layout="quote_highlight",
                        heading="Khán giả nhớ câu chuyện sống động, không nhớ những gạch đầu dòng rập khuôn.",
                        bullet_points=[secondary_pillar],
                        voiceover_script=(
                            "Khi màu sắc, ánh sáng và bố cục đồng điệu với chủ đề, thông điệp tự khắc chạm đến người xem mà không cần nhồi nhét chữ."
                        ),
                        visual_keywords=scene_pool[2 % len(scene_pool)],
                    ),
                    SlideScriptItem(
                        slide_index=4,
                        layout="conclusion_cta",
                        heading=f"Bước Tiếp Theo Với {LLMScriptGenerator._clean_topic_title(subject_vi, max_chars=30)}",
                        bullet_points=[
                            "Chọn bảng màu khớp tâm trạng chủ đề",
                            "Kết hợp ảnh bối cảnh thật với chuyển động mượt",
                        ],
                        voiceover_script=(
                            "Hãy thử làm mới ngay bộ slide tiếp theo bằng màu sắc đúng bối cảnh và đón chờ những phân tích sâu hơn trong tập tới."
                        ),
                        visual_keywords=scene_pool[3 % len(scene_pool)],
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
                        heading=f"Visual Story: {subject_en_short}",
                        bullet_points=[primary_pillar, secondary_pillar],
                        voiceover_script=(
                            f"{channel_intro_en}Let us unpack the real story behind {subject_en} through vivid visual scenes and sharp pacing."
                        ),
                        visual_keywords=scene_pool[0],
                    ),
                    SlideScriptItem(
                        slide_index=2,
                        layout="split_card",
                        heading=f"Inside {LLMScriptGenerator._clean_topic_title(primary_pillar, max_chars=36)}",
                        bullet_points=[
                            "Context-authentic visuals anchor every concept",
                            "Contrasting light and dark scenes sustain focus",
                            "Tight conversational narration drives rhythm",
                        ],
                        voiceover_script=(
                            f"What makes {subject_en} click is pairing real-world imagery and domain color with tight, human-first narration."
                        ),
                        visual_keywords=scene_pool[1 % len(scene_pool)],
                    ),
                    SlideScriptItem(
                        slide_index=3,
                        layout="quote_highlight",
                        heading="Great presentations look like cinema — vivid scenes, crisp tension, zero filler.",
                        bullet_points=[secondary_pillar],
                        voiceover_script=(
                            "When color temperature, imagery, and motion match the mood of the story, every idea lands effortlessly."
                        ),
                        visual_keywords=scene_pool[2 % len(scene_pool)],
                    ),
                    SlideScriptItem(
                        slide_index=4,
                        layout="conclusion_cta",
                        heading="Turn Context Into Living Motion",
                        bullet_points=[
                            "Refine slides on the interactive canvas",
                            "Compile into 1080p synchronized MP4",
                        ],
                        voiceover_script=(
                            "Put this visual system into practice on your next video, and customize any frame before rendering."
                        ),
                        visual_keywords=scene_pool[3 % len(scene_pool)],
                    ),
                ],
            )

        if target_slides is not None:
            desired = max(3, min(MAX_PRESENTATION_SLIDES, target_slides))
            if desired < len(base_script.slides):
                # Keep slide 1 + body slices + final CTA so count respects exact requested target_slides
                trimmed = [base_script.slides[0]] + base_script.slides[1 : desired - 1] + [base_script.slides[-1]]
                return PresentationScript(
                    title=base_script.title,
                    language=base_script.language,
                    theme=base_script.theme,
                    slides=LLMScriptGenerator._normalize_slides(trimmed),
                )
            if desired > len(base_script.slides):
                extra = LLMScriptGenerator._generate_fallback_continuation_slides(
                    topic=clean_topic,
                    language=language,
                    count=desired - len(base_script.slides),
                    existing_headings=[s.heading for s in base_script.slides],
                    channel_context=channel_context,
                )
                return LLMScriptGenerator.merge_continuation_slides(base_script, extra)
        elif not is_short:
            # Default 3-slide minimum contract when target_slides is omitted
            trimmed = [base_script.slides[0], base_script.slides[1], base_script.slides[-1]]
            return PresentationScript(
                title=base_script.title,
                language=base_script.language,
                theme=base_script.theme,
                slides=LLMScriptGenerator._normalize_slides(trimmed),
            )
        return base_script
