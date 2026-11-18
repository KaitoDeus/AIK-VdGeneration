export type UiLocale = 'vi' | 'en';

export interface StudioDictionary {
  header: {
    brand: string;
    workspace: string;
    archive: string;
    apiOnline: string;
    apiOffline: string;
    queuePrefix: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
  };
  form: {
    sectionEyebrow: string;
    sectionTitle: string;
    templatesLabel: string;
    templateNames: {
      'tech-explainer': string;
      educational: string;
      'pitch-deck': string;
      marketing: string;
    };
    promptLabel: string;
    promptPlaceholder: string;
    promptMinError: string;
    languageLabel: string;
    languageVi: string;
    languageEn: string;
    aspectRatioLabel: string;
    aspect169: string;
    aspect916: string;
    themeDurationLabel: string;
    themeNames: {
      modern_tech: string;
      corporate: string;
      minimal: string;
    };
    voiceLabel: string;
    auditionButton: string;
    auditionLoading: string;
    auditionError: string;
    renderImmediateCheckbox: string;
    draftScriptBtn: string;
    generateBtn: string;
    processingBtn: string;
    enqueueError: string;
    scriptError: string;
    compileError: string;
  };
  progress: {
    sectionEyebrow: string;
    title: string;
    wsStreaming: string;
    wsClosed: string;
    steps: {
      queued: string;
      script: string;
      audio: string;
      render: string;
    };
    statuses: Record<string, string>;
    errorPrefix: string;
    masterComplete: string;
    exportPropsBtn: string;
    downloadMp4Btn: string;
    refreshSignedUrlBtn: string;
    refreshingSignedUrlBtn: string;
    storageLocal: string;
    storageS3: string;
    storageR2: string;
    eventLogTitle: string;
    waitingEvents: string;
    durationLabel: string;
    framesUnit: string;
  };
  reviewer: {
    sectionEyebrow: string;
    synthAudioBtn: string;
    compileRenderBtn: string;
    compilingBtn: string;
    slidesCounter: string;
    addSlideBtn: string;
    removeSlideBtn: string;
    synthesizedAudioTitle: string;
    framesAt30Fps: string;
    slideHeadingLabel: string;
    layoutTemplateLabel: string;
    bulletPointsLabel: string;
    voiceoverScriptLabel: string;
    visualKeywordsLabel: string;
    fetchStockBtn: string;
    searchingStockBtn: string;
    clearBgBtn: string;
    stockFallbackNote: string;
    defaultSlideHeadingPrefix: string;
    defaultSlideBulletA: string;
    defaultSlideBulletB: string;
    defaultSlideVoiceover: string;
  };
  archive: {
    sectionEyebrow: string;
    title: string;
    refreshBtn: string;
    emptyState: string;
    untitledJob: string;
    footerLeft: string;
    footerRight: string;
  };
}

export const STUDIO_DICTIONARY: Record<UiLocale, StudioDictionary> = {
  en: {
    header: {
      brand: 'AIK — STUDIO',
      workspace: 'WORKSPACE',
      archive: 'ARCHIVE',
      apiOnline: 'API ONLINE',
      apiOffline: 'API OFFLINE',
      queuePrefix: 'QUEUE',
    },
    hero: {
      eyebrow: 'PHASE 02 · WEB STUDIO WORKSPACE',
      title: 'Prompt to Synchronized Slide Video.',
      subtitle:
        'Structured bilingual script synthesis with Gemini 3.8 Flash, precision audio-driven timelines in English and Vietnamese, and automated 1080p Remotion rendering.',
    },
    form: {
      sectionEyebrow: '01 / PROMPT & PARAMETERS',
      sectionTitle: 'Script & Voice Configuration',
      templatesLabel: 'Templates:',
      templateNames: {
        'tech-explainer': 'TECH EXPLAINER',
        educational: 'EDUCATIONAL',
        'pitch-deck': 'PITCH DECK',
        marketing: 'MARKETING',
      },
      promptLabel: 'Presentation Topic or Raw Narrative',
      promptPlaceholder:
        'Describe your presentation topic in English or Vietnamese (e.g., Explain Event-Driven Architecture for engineering teams)...',
      promptMinError: 'Prompt must contain at least 3 characters.',
      languageLabel: 'Language',
      languageVi: 'VIETNAMESE',
      languageEn: 'ENGLISH',
      aspectRatioLabel: 'Aspect Ratio',
      aspect169: '16:9 WIDESCREEN (1920×1080)',
      aspect916: '9:16 VERTICAL (1080×1920)',
      themeDurationLabel: 'Theme & Target Duration',
      themeNames: {
        modern_tech: 'MODERN TECH',
        corporate: 'CORPORATE',
        minimal: 'MINIMAL',
      },
      voiceLabel: 'Narrator Voice',
      auditionButton: 'AUDITION VOICE SAMPLE',
      auditionLoading: 'SYNTHESIZING SAMPLE...',
      auditionError: 'Unable to preview voice audio.',
      renderImmediateCheckbox: 'Compile final 1080p MP4 via Remotion immediately',
      draftScriptBtn: 'Draft Script First',
      generateBtn: 'Generate Presentation',
      processingBtn: 'Processing...',
      enqueueError: 'Failed to enqueue job.',
      scriptError: 'Script generation failed.',
      compileError: 'Compilation failed.',
    },
    progress: {
      sectionEyebrow: '02 / LIVE EXECUTION TELEMETRY',
      title: 'Pipeline Status',
      wsStreaming: 'STREAMING',
      wsClosed: 'CLOSED',
      steps: {
        queued: 'QUEUED',
        script: 'SCRIPT (LLM)',
        audio: 'AUDIO (TTS)',
        render: 'RENDER (MP4)',
      },
      statuses: {
        queued: 'QUEUED',
        generating_script: 'GENERATING SCRIPT',
        script_ready: 'SCRIPT READY',
        synthesizing_audio: 'SYNTHESIZING AUDIO',
        audio_ready: 'AUDIO READY',
        rendering_video: 'RENDERING VIDEO',
        completed: 'COMPLETED',
        failed: 'FAILED',
      },
      errorPrefix: 'ERROR',
      masterComplete: 'MASTER RENDER COMPLETE',
      exportPropsBtn: 'Export Remotion Props JSON',
      downloadMp4Btn: 'Download 1080p MP4',
      refreshSignedUrlBtn: 'Refresh Signed URL',
      refreshingSignedUrlBtn: 'Signing URL...',
      storageLocal: 'LOCAL STREAM',
      storageS3: 'AWS S3 SIGNED',
      storageR2: 'CLOUDFLARE R2',
      eventLogTitle: 'WebSocket Event Log',
      waitingEvents: 'Waiting for pipeline telemetry events...',
      durationLabel: 'DURATION',
      framesUnit: 'FRAMES',
    },
    reviewer: {
      sectionEyebrow: '03 / INTERACTIVE SLIDE REVIEWER & CANVAS',
      synthAudioBtn: 'Synthesize Audio Only',
      compileRenderBtn: 'Compile & Render 1080p MP4',
      compilingBtn: 'COMPILING...',
      slidesCounter: 'SLIDES',
      addSlideBtn: '+ ADD',
      removeSlideBtn: 'REMOVE',
      synthesizedAudioTitle: 'SYNTHESIZED SLIDE AUDIO',
      framesAt30Fps: 'frames @ 30fps',
      slideHeadingLabel: 'Slide Heading',
      layoutTemplateLabel: 'Layout Template',
      bulletPointsLabel: 'Bullet Points (One per line, max 5)',
      voiceoverScriptLabel: 'Voiceover Script (Narrator Speech)',
      visualKeywordsLabel: 'Stock Visual Keywords (English)',
      fetchStockBtn: 'Search Stock Visuals',
      searchingStockBtn: 'Searching...',
      clearBgBtn: 'Use Gradient',
      stockFallbackNote:
        'No Unsplash/Pexels key configured or no match found — slide will gracefully render with CSS radial gradient.',
      defaultSlideHeadingPrefix: 'Key Point — Slide',
      defaultSlideBulletA: 'First supporting insight',
      defaultSlideBulletB: 'Second supporting insight',
      defaultSlideVoiceover: 'Add your voiceover narration for this slide here.',
    },
    archive: {
      sectionEyebrow: '04 / JOBS ARCHIVE',
      title: 'Recent Render History',
      refreshBtn: 'Refresh Archive',
      emptyState: 'No queued or completed presentation jobs recorded in the active session yet.',
      untitledJob: 'Untitled Presentation Job',
      footerLeft: 'AIK-VDGENERATION STUDIO · AUDIO-FIRST VIDEO ARCHITECTURE',
      footerRight: 'MONOCHROME FLAT SYSTEM · ZERO RADIUS · ZERO ELEVATION',
    },
  },
  vi: {
    header: {
      brand: 'AIK — STUDIO',
      workspace: 'KHÔNG GIAN TẠO',
      archive: 'LỊCH SỬ RENDER',
      apiOnline: 'API TRỰC TUYẾN',
      apiOffline: 'API NGOẠI TUYẾN',
      queuePrefix: 'HÀNG ĐỢI',
    },
    hero: {
      eyebrow: 'GIAI ĐOẠN 02 · WEB STUDIO WORKSPACE',
      title: 'Biến Prompt thành Video Slide Đồng Bộ.',
      subtitle:
        'Phân rã kịch bản song ngữ chuẩn cấu trúc với Gemini 3.8 Flash, đồng bộ khung hình theo trường độ giọng đọc Anh - Việt và kết xuất tự động video 1080p bằng Remotion.',
    },
    form: {
      sectionEyebrow: '01 / PROMPT & THAM SỐ CẤU HÌNH',
      sectionTitle: 'Thiết Lập Kịch Bản & Giọng Đọc',
      templatesLabel: 'Mẫu nhanh:',
      templateNames: {
        'tech-explainer': 'GIẢI THÍCH CÔNG NGHỆ',
        educational: 'GIÁO DỤC',
        'pitch-deck': 'GỌI VỐN (PITCH)',
        marketing: 'TIẾP THỊ',
      },
      promptLabel: 'Chủ Đề Thuyết Trình Hoặc Nội Dung Thô',
      promptPlaceholder:
        'Nhập chủ đề bài thuyết trình bằng tiếng Việt hoặc tiếng Anh (ví dụ: Giải thích kiến trúc Điện toán Đám mây cho người mới bắt đầu)...',
      promptMinError: 'Prompt phải chứa ít nhất 3 ký tự.',
      languageLabel: 'Ngôn Ngữ Video',
      languageVi: 'TIẾNG VIỆT',
      languageEn: 'TIẾNG ANH',
      aspectRatioLabel: 'Tỷ Lệ Khung Hình',
      aspect169: '16:9 MÀN HÌNH NGANG (1920×1080)',
      aspect916: '9:16 DỌC DI ĐỘNG (1080×1920)',
      themeDurationLabel: 'Giao Diện & Thời Lượng',
      themeNames: {
        modern_tech: 'CÔNG NGHỆ HIỆN ĐẠI',
        corporate: 'DOANH NGHIỆP',
        minimal: 'TỐI GIẢN',
      },
      voiceLabel: 'Giọng Thuyết Minh',
      auditionButton: 'NGHE THỬ GIỌNG ĐỌC',
      auditionLoading: 'ĐANG TỔNG HỢP MẪU...',
      auditionError: 'Không thể phát thử giọng đọc.',
      renderImmediateCheckbox: 'Kết xuất ngay video MP4 1080p bằng Remotion',
      draftScriptBtn: 'Soạn Kịch Bản Trước',
      generateBtn: 'Tạo Video Thuyết Trình',
      processingBtn: 'Đang Xử Lý...',
      enqueueError: 'Không thể đẩy tác vụ vào hàng đợi.',
      scriptError: 'Tạo kịch bản thất bại.',
      compileError: 'Biên dịch video thất bại.',
    },
    progress: {
      sectionEyebrow: '02 / GIÁM SÁT TIẾN ĐỘ THỜI GIAN THỰC',
      title: 'Trạng Thái Pipeline',
      wsStreaming: 'ĐANG STREAM',
      wsClosed: 'ĐÃ ĐÓNG',
      steps: {
        queued: 'HÀNG ĐỢI',
        script: 'KỊCH BẢN (LLM)',
        audio: 'ÂM THANH (TTS)',
        render: 'KẾT XUẤT (MP4)',
      },
      statuses: {
        queued: 'ĐANG CHỜ',
        generating_script: 'ĐANG TẠO KỊCH BẢN',
        script_ready: 'ĐÃ CÓ KỊCH BẢN',
        synthesizing_audio: 'ĐANG TẠO GIỌNG ĐỌC',
        audio_ready: 'ĐÃ CÓ ÂM THANH',
        rendering_video: 'ĐANG KẾT XUẤT VIDEO',
        completed: 'HOÀN TẤT',
        failed: 'THẤT BẠI',
      },
      errorPrefix: 'LỖI',
      masterComplete: 'KẾT XUẤT VIDEO HOÀN TẤT',
      exportPropsBtn: 'Xuất JSON Remotion Props',
      downloadMp4Btn: 'Tải Xuống MP4 1080p',
      refreshSignedUrlBtn: 'Làm Mới Link Signed',
      refreshingSignedUrlBtn: 'Đang Ký URL...',
      storageLocal: 'PHÁT NỘI BỘ',
      storageS3: 'AWS S3 SIGNED',
      storageR2: 'CLOUDFLARE R2',
      eventLogTitle: 'Nhật Ký Sự Kiện WebSocket',
      waitingEvents: 'Đang chờ sự kiện tiến độ từ pipeline...',
      durationLabel: 'THỜI LƯỢNG',
      framesUnit: 'KHUNG HÌNH',
    },
    reviewer: {
      sectionEyebrow: '03 / TRÌNH DUYỆT & CHỈNH SỬA SLIDE TRỰC QUAN',
      synthAudioBtn: 'Chỉ Tạo Giọng Đọc',
      compileRenderBtn: 'Biên Dịch & Xuất MP4 1080p',
      compilingBtn: 'ĐANG BIÊN DỊCH...',
      slidesCounter: 'DANH SÁCH SLIDE',
      addSlideBtn: '+ THÊM',
      removeSlideBtn: 'XÓA',
      synthesizedAudioTitle: 'ÂM THANH SLIDE ĐÃ TỔNG HỢP',
      framesAt30Fps: 'khung hình @ 30fps',
      slideHeadingLabel: 'Tiêu Đề Slide',
      layoutTemplateLabel: 'Mẫu Bố Cục (Layout)',
      bulletPointsLabel: 'Các Ý Chính (Mỗi dòng 1 ý, tối đa 5)',
      voiceoverScriptLabel: 'Lời Thoại Thuyết Minh (Voiceover)',
      visualKeywordsLabel: 'Từ Khóa Tìm Ảnh Nền (Tiếng Anh)',
      fetchStockBtn: 'Tìm Ảnh Nền Stock',
      searchingStockBtn: 'Đang Tìm...',
      clearBgBtn: 'Dùng Nền Gradient',
      stockFallbackNote:
        'Chưa cấu hình API Key Unsplash/Pexels hoặc không có ảnh phù hợp — slide sẽ tự động dùng nền Gradient chuẩn mực.',
      defaultSlideHeadingPrefix: 'Ý Chính — Slide',
      defaultSlideBulletA: 'Luận điểm bổ trợ thứ nhất',
      defaultSlideBulletB: 'Luận điểm bổ trợ thứ hai',
      defaultSlideVoiceover: 'Nhập lời thoại thuyết minh cho slide này tại đây.',
    },
    archive: {
      sectionEyebrow: '04 / LƯU TRỮ TÁC VỤ',
      title: 'Lịch Sử Kết Xuất Gần Đây',
      refreshBtn: 'Làm Mới Danh Sách',
      emptyState: 'Chưa có tác vụ tạo video nào được ghi nhận trong phiên làm việc hiện tại.',
      untitledJob: 'Bài Thuyết Trình Chưa Đặt Tên',
      footerLeft: 'AIK-VDGENERATION STUDIO · KIẾN TRÚC VIDEO ĐỒNG BỘ ÂM THANH',
      footerRight: 'HỆ THỐNG ĐƠN SẮC PHẲNG · ZERO RADIUS · ZERO ELEVATION',
    },
  },
};
