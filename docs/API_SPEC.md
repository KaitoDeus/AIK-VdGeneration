# AIK-VdGeneration: Data Contracts & API Specifications

## 1. Client Video Generation Request
`POST /api/v1/videos/generate`

```json
{
  "prompt": "Giải thích điện toán đám mây cho người mới bắt đầu",
  "language": "vi",
  "aspect_ratio": "16:9",
  "target_duration_seconds": 60,
  "style": {
    "theme": "modern_tech",
    "color_palette": "indigo_slate",
    "font_pair": "Inter_Roboto"
  },
  "voice_settings": {
    "provider": "edge_tts",
    "voice_id": "vi-VN-HoaiMyNeural",
    "speed": 1.0
  }
}
```

### Response (Immediate 202 Accepted)
```json
{
  "job_id": "job_984f88e1-0cf2-491b",
  "status": "queued",
  "estimated_time_seconds": 45,
  "websocket_url": "wss://api.example.com/ws/jobs/job_984f88e1-0cf2-491b"
}
```

---

## 2. LLM Structured Output Schema
The LLM must produce output strictly adhering to this JSON Schema:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "title": { "type": "string" },
    "language": { "type": "string", "enum": ["vi", "en"] },
    "theme": { "type": "string" },
    "slides": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "slide_index": { "type": "integer" },
          "layout": {
            "type": "string",
            "enum": ["title_intro", "bullet_list", "split_card", "quote_highlight", "conclusion_cta"]
          },
          "heading": { "type": "string" },
          "bullet_points": {
            "type": "array",
            "items": { "type": "string" }
          },
          "voiceover_script": { "type": "string" },
          "visual_keywords": { "type": "string" }
        },
        "required": ["slide_index", "layout", "heading", "voiceover_script", "visual_keywords"]
      }
    }
  },
  "required": ["title", "language", "slides"]
}
```

---

## 3. Remotion Composition Input Props
Before starting video rendering, the orchestrator compiles the final props for Remotion:

```json
{
  "project_title": "Điện toán đám mây cơ bản",
  "fps": 30,
  "width": 1920,
  "height": 1080,
  "theme": {
    "backgroundColor": "#0f172a",
    "primaryColor": "#38bdf8",
    "textColor": "#f8fafc",
    "fontFamily": "Inter, sans-serif"
  },
  "slides": [
    {
      "slide_index": 1,
      "layout": "title_intro",
      "heading": "Điện toán đám mây là gì?",
      "bullet_points": ["Không còn lưu dữ liệu trên ổ cứng đơn thuần", "Truy cập mọi nơi qua Internet"],
      "voiceover_audio_url": "/audio_temp/job_123_slide_1.mp3",
      "voiceover_duration_seconds": 5.4,
      "calculated_frames": 162,
      "background_image_url": "/assets/cloud_network.jpg"
    }
  ],
  "bgm": {
    "enabled": true,
    "audio_url": "/music/ambient_tech.mp3",
    "volume": 0.15
  }
}
```

---

## 4. WebSocket Progress Payload
Clients listen to events over WebSockets to display animated progress:

```json
{
  "job_id": "job_984f88e1-0cf2-491b",
  "step": "rendering_video",
  "progress_percentage": 78,
  "message": "Đang kết xuất khung hình video... (78%)",
  "timestamp": "2026-11-14T04:40:00Z"
}
```
