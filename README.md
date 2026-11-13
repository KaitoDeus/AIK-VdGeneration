# AIK-VdGeneration (AI Video Slide Presentation Generator)

> Nền tảng tự động hóa biến prompt nội dung thành video trình chiếu (slide-presentation) với hoạt ảnh mượt mà và giọng đọc song ngữ Anh - Việt chuẩn mực.

---

## 📁 Cấu trúc thư mục chuẩn (Project Architecture)

```
D:\AIK-VdGeneration/
├── .agent/                             # AI Agent Workflows & Workspace Rules
│   ├── rules/
│   │   ├── architecture-rules.md       # Quy tắc ranh giới độc lập giữa các service
│   │   └── audio-sync-rules.md         # Công thức đồng bộ độ dài âm thanh & khung hình video
│   └── skills/
│       ├── video-prompt-engineering/   # Skill: Prompt chuyển đổi ý tưởng sang kịch bản JSON
│       ├── tts-audio-sync/             # Skill: Quy trình tạo giọng đọc En/Vi & đo thời lượng
│       └── remotion-render-engine/     # Skill: Mẫu thiết kế chuyển động & Render Remotion
├── apps/
│   ├── web/                            # Web Studio UI (Next.js + Tailwind CSS)
│   └── mobile/                         # Mobile App Client (Flutter / React Native)
├── services/
│   ├── api-gateway/                    # API Backend điều phối tác vụ (FastAPI / Node)
│   └── video-renderer/                 # Engine kết xuất video bằng React (Remotion)
├── docs/                               # Bộ tài liệu kiến trúc & hiện thực chi tiết
│   ├── ARCHITECTURE.md                 # Kiến trúc tổng thể hệ thống, sơ đồ luồng dữ liệu Mermaid
│   ├── ROADMAP.md                      # Lộ trình 4 giai đoạn từ MVP đến Production Scale
│   ├── API_SPEC.md                     # Đặc tả JSON Schema & giao thức WebSocket
│   └── TTS_SETUP.md                    # Hướng dẫn chi tiết thiết lập giọng đọc Anh/Việt
├── scripts/
│   └── verify-env.ps1                  # Script tự động kiểm tra môi trường hệ thống
├── AGENTS.md                           # Tiêu chuẩn và chỉ dẫn cho AI Coding Agents
├── GEMINI.md                           # Quy tắc ứng xử và ngữ cảnh dành cho Gemini / Antigravity
├── MEMORY.md                           # Bộ nhớ dự án: Quyết định kiến trúc (ADR), trạng thái hiện tại
└── .gitignore                          # Cấu hình bỏ qua tệp tạm, cache render và file nhạy cảm
```

---

## 🧠 Tích hợp AI Skills & Memory System

Dự án được cấu hình sẵn hệ thống ngữ cảnh chuyên sâu dành cho các AI Agent (Antigravity, Cursor, Gemini):
1. **`MEMORY.md`:** Lưu trữ toàn bộ quyết định kiến trúc (ADR), tiến độ hiện tại và danh mục biến môi trường cần thiết.
2. **`AGENTS.md` & `GEMINI.md`:** Định hướng tư duy cho AI luôn tuân thủ nguyên lý: **"Âm thanh quyết định trường độ video (Audio-First Synchronicity)"**.
3. **`.agent/skills/`:** Chứa 3 quy trình công việc chuẩn:
   - `video-prompt-engineering`: Tạo prompt ép LLM trả về cấu trúc JSON slide chuẩn.
   - `tts-audio-sync`: Đo thời lượng âm thanh và bù trừ padding chuyển cảnh.
   - `remotion-render-engine`: Dựng video bằng code React với chuyển động lò xo (spring physics).

---

## 🗺️ Lộ trình triển khai (Roadmap Summary)

- **Giai đoạn 1 (Tuần 1 - 3) [ĐANG THỰC HIỆN]:** Hoàn thành lõi MVP. Prompt -> LLM -> JSON -> Edge-TTS (Anh/Việt) -> Remotion render file `.mp4` 1080p.
- **Giai đoạn 2 (Tuần 4 - 6):** Hàng đợi bất đồng bộ (Redis + BullMQ) + Next.js Web Studio giao diện tạo video thời gian thực.
- **Giai đoạn 3 (Tuần 7 - 9):** Render phân tán trên đám mây (Remotion Lambda), chèn nhạc nền tự động giảm âm lượng (Audio ducking), phụ đề chạy chữ karaoke.
- **Giai đoạn 4 (Tuần 10 - 12+):** Ứng dụng di động (Mobile App), bộ chỉnh sửa slide tương tác và tích hợp AI Avatar MC ảo.

Xem chi tiết tại: [docs/ROADMAP.md](file:///D:/AIK-VdGeneration/docs/ROADMAP.md).

---

## 🚀 Kiểm tra môi trường phát triển

Mở PowerShell và chạy:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\verify-env.ps1
```
