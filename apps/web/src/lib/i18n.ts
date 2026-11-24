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
      'shorts-vi': string;
      'shorts-en': string;
    };
    modeLabel: string;
    modePresentationBtn: string;
    modeShortVideoBtn: string;
    shortActiveSummary: string;
    voiceSpeedLabel: string;
    generateShortBtn: string;
    promptLabel: string;
    promptPlaceholder: string;
    promptMinError: string;
    languageLabel: string;
    languageVi: string;
    languageEn: string;
    languageMismatchNotice: string;
    languageMismatchSwitchBtn: string;
    aspectRatioLabel: string;
    aspect169: string;
    aspect916: string;
    themeDurationLabel: string;
    slideCountAuto: string;
    themeNames: {
      modern_tech: string;
      corporate: string;
      minimal: string;
    };
    voiceLabel: string;
    auditionButton: string;
    auditionLoading: string;
    auditionError: string;
    soundDesignLabel: string;
    bgmEnableLabel: string;
    bgmDuckingLabel: string;
    bgmPreviewBtn: string;
    bgmUploadBtn: string;
    bgmUploadingBtn: string;
    bgmUploadHint: string;
    bgmRemoveBtn: string;
    bgmMissingFileError: string;
    bgmUploadError: string;
    subtitlesEnableLabel: string;
    subtitleStyles: {
      karaoke_pill: string;
      minimal_line: string;
      bold_highlight: string;
    };
    renderImmediateCheckbox: string;
    draftScriptBtn: string;
    generateBtn: string;
    processingBtn: string;
    enqueueError: string;
    scriptError: string;
    compileError: string;
    channelContextLabel: string;
    channelUrlPlaceholder: string;
    analyzeChannelBtn: string;
    analyzingChannelBtn: string;
    channelToggleNotesBtn: string;
    channelNotesPlaceholder: string;
    channelUsePromptBtn: string;
    channelClearBtn: string;
    channelNicheLabel: string;
    channelAudienceLabel: string;
    channelToneLabel: string;
    channelPillarsLabel: string;
    channelFollowersUnit: string;
    channelActiveNote: string;
    channelAnalyzeError: string;
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
    audioReadyNotice: string;
    masterComplete: string;
    exportPropsBtn: string;
    downloadSrtBtn: string;
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
    aiExpandLabel: string;
    aiExpand5Btn: string;
    aiExpand10Btn: string;
    aiExpandingBtn: string;
    aiExpandError: string;
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
        'shorts-vi': 'PRODUCT SHORT (30S)',
        'shorts-en': 'SHORTS HOOK (30S)',
      },
      modeLabel: 'PRODUCTION FORMAT:',
      modePresentationBtn: 'Landscape (16:9)',
      modeShortVideoBtn: 'Portrait (9:16)',
      shortActiveSummary: '9:16 VERTICAL (1080x1920) · 4-SCENE HOOK · SUBTITLES ON · FAST PACE',
      voiceSpeedLabel: 'Pacing',
      generateShortBtn: 'Generate Short Video 9:16',
      promptLabel: 'Presentation Topic or Raw Narrative',
      promptPlaceholder:
        'Describe your presentation topic in English or Vietnamese (e.g., Explain Event-Driven Architecture for engineering teams)...',
      promptMinError: 'Prompt must contain at least 3 characters.',
      languageLabel: 'Language',
      languageVi: 'VIETNAMESE',
      languageEn: 'ENGLISH',
      languageMismatchNotice:
        'Vietnamese characters detected in prompt while Video Language is set to English.',
      languageMismatchSwitchBtn: 'Switch to Vietnamese',
      aspectRatioLabel: 'Aspect Ratio',
      aspect169: '16:9 WIDESCREEN (1920×1080)',
      aspect916: '9:16 VERTICAL (1080×1920)',
      themeDurationLabel: 'Theme & Target Duration',
      slideCountAuto: 'AUTO SLIDES',
      themeNames: {
        modern_tech: 'MODERN TECH',
        corporate: 'CORPORATE',
        minimal: 'MINIMAL',
      },
      voiceLabel: 'Narrator Voice',
      auditionButton: 'AUDITION VOICE SAMPLE',
      auditionLoading: 'SYNTHESIZING SAMPLE...',
      auditionError: 'Unable to preview voice audio.',
      soundDesignLabel: 'Background Music',
      bgmEnableLabel: 'Add Background Music',
      bgmDuckingLabel: 'Auto Ducking (-10dB Speech)',
      bgmPreviewBtn: 'Preview Music',
      bgmUploadBtn: 'Upload Music (.MP3 / .WAV)',
      bgmUploadingBtn: 'Processing Audio...',
      bgmUploadHint:
        'Upload your own audio file (MP3, WAV, M4A, OGG) to mix behind narration.',
      bgmRemoveBtn: 'Remove',
      bgmMissingFileError:
        'Please upload a background music file first or uncheck Add Background Music.',
      bgmUploadError: 'Failed to upload background music file.',
      subtitlesEnableLabel: 'Auto Subtitles (Whisper)',
      subtitleStyles: {
        karaoke_pill: 'HIGHLIGHT PILL',
        minimal_line: 'MINIMAL LINE',
        bold_highlight: 'BOLD HIGHLIGHT',
      },
      renderImmediateCheckbox: 'Compile final 1080p MP4 via Remotion immediately',
      draftScriptBtn: 'Draft Script First',
      generateBtn: 'Generate Presentation',
      processingBtn: 'Processing...',
      enqueueError: 'Failed to enqueue job.',
      scriptError: 'Script generation failed.',
      compileError: 'Compilation failed.',
      channelContextLabel: 'TikTok Channel Context',
      channelUrlPlaceholder: 'https://www.tiktok.com/@username or @username',
      analyzeChannelBtn: 'Read Channel Context',
      analyzingChannelBtn: 'Reading Profile...',
      channelToggleNotesBtn: '+ Add Bio / Notes',
      channelNotesPlaceholder:
        'Optional: paste creator bio or sample video topics if TikTok limits automated profile fetching.',
      channelUsePromptBtn: 'Use Suggested Topic',
      channelClearBtn: 'Clear',
      channelNicheLabel: 'Niche',
      channelAudienceLabel: 'Audience',
      channelToneLabel: 'Tone & Style',
      channelPillarsLabel: 'Content Pillars',
      channelFollowersUnit: 'followers',
      channelActiveNote: 'Channel context attached — scripts will match this channel style.',
      channelAnalyzeError: 'Unable to read TikTok channel profile.',
    },
    progress: {
      sectionEyebrow: 'LIVE EXECUTION TELEMETRY',
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
      audioReadyNotice:
        'Script and voiceover synthesis complete (80%). Automatic MP4 rendering was unchecked — review slides below and click "Compile & Render 1080p MP4" to export the final video.',
      masterComplete: 'MASTER RENDER COMPLETE',
      exportPropsBtn: 'Export Remotion Props JSON',
      downloadSrtBtn: 'Download Subtitles (.SRT)',
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
      sectionEyebrow: 'INTERACTIVE SLIDE REVIEWER & CANVAS',
      synthAudioBtn: 'Synthesize Audio Only',
      compileRenderBtn: 'Compile & Render 1080p MP4',
      compilingBtn: 'COMPILING...',
      slidesCounter: 'SLIDES',
      addSlideBtn: '+ ADD',
      removeSlideBtn: 'REMOVE',
      aiExpandLabel: 'AI AUTO-EXPAND',
      aiExpand5Btn: '+5 AI SLIDES',
      aiExpand10Btn: '+10 AI SLIDES',
      aiExpandingBtn: 'GENERATING...',
      aiExpandError: 'Failed to auto-generate continuation slides.',
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
      sectionEyebrow: 'JOBS ARCHIVE',
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
        'shorts-vi': 'VIDEO SHORT 30S',
        'shorts-en': 'SHORTS HOOK 30S',
      },
      modeLabel: 'ĐỊNH DẠNG SẢN XUẤT:',
      modePresentationBtn: 'Chiều ngang (16:9)',
      modeShortVideoBtn: 'Chiều dọc (9:16)',
      shortActiveSummary: 'KHUNG DỌC 9:16 (1080x1920) · 4 CẢNH HOOK · PHỤ ĐỀ ĐẬM · NHỊP NHANH',
      voiceSpeedLabel: 'Tốc Độ',
      generateShortBtn: 'Tạo Video Short 9:16',
      promptLabel: 'Chủ Đề Thuyết Trình Hoặc Nội Dung Thô',
      promptPlaceholder:
        'Nhập chủ đề bài thuyết trình bằng tiếng Việt hoặc tiếng Anh (ví dụ: Giải thích kiến trúc Điện toán Đám mây cho người mới bắt đầu)...',
      promptMinError: 'Prompt phải chứa ít nhất 3 ký tự.',
      languageLabel: 'Ngôn Ngữ Video',
      languageVi: 'TIẾNG VIỆT',
      languageEn: 'TIẾNG ANH',
      languageMismatchNotice:
        'Phát hiện nội dung Tiếng Việt trong khi Ngôn Ngữ Video đang chọn Tiếng Anh (giọng đọc sẽ bị ngọng).',
      languageMismatchSwitchBtn: 'Chuyển sang Tiếng Việt',
      aspectRatioLabel: 'Tỷ Lệ Khung Hình',
      aspect169: '16:9 MÀN HÌNH NGANG (1920×1080)',
      aspect916: '9:16 DỌC DI ĐỘNG (1080×1920)',
      themeDurationLabel: 'Giao Diện & Thời Lượng',
      slideCountAuto: 'SLIDE TỰ ĐỘNG',
      themeNames: {
        modern_tech: 'CÔNG NGHỆ HIỆN ĐẠI',
        corporate: 'DOANH NGHIỆP',
        minimal: 'TỐI GIẢN',
      },
      voiceLabel: 'Giọng Thuyết Minh',
      auditionButton: 'NGHE THỬ GIỌNG ĐỌC',
      auditionLoading: 'ĐANG TỔNG HỢP MẪU...',
      auditionError: 'Không thể phát thử giọng đọc.',
      soundDesignLabel: 'Lồng Nhạc Nền',
      bgmEnableLabel: 'Bật Lồng Nhạc Nền',
      bgmDuckingLabel: 'Tự Động Giảm Nhạc Khi Đọc (-10dB)',
      bgmPreviewBtn: 'Nghe Thử Nhạc',
      bgmUploadBtn: 'Tải Nhạc Lên (.MP3 / .WAV)',
      bgmUploadingBtn: 'Đang Xử Lý Nhạc...',
      bgmUploadHint:
        'Tự tải tệp nhạc nền của bạn (MP3, WAV, M4A, OGG) để hệ thống tự động lồng vào video.',
      bgmRemoveBtn: 'Xóa Nhạc',
      bgmMissingFileError:
        'Vui lòng tải lên tệp nhạc nền trước hoặc bỏ chọn Bật Lồng Nhạc Nền.',
      bgmUploadError: 'Không thể tải lên tệp nhạc nền.',
      subtitlesEnableLabel: 'Tạo Phụ Đề Tự Động (Whisper)',
      subtitleStyles: {
        karaoke_pill: 'NỔI BẬT (PILL)',
        minimal_line: 'TỐI GIẢN LINE',
        bold_highlight: 'CHỮ ĐẬM NỔI BẬT',
      },
      renderImmediateCheckbox: 'Kết xuất ngay video MP4 1080p bằng Remotion',
      draftScriptBtn: 'Soạn Kịch Bản Trước',
      generateBtn: 'Tạo Video Thuyết Trình',
      processingBtn: 'Đang Xử Lý...',
      enqueueError: 'Không thể đẩy tác vụ vào hàng đợi.',
      scriptError: 'Tạo kịch bản thất bại.',
      compileError: 'Biên dịch video thất bại.',
      channelContextLabel: 'Ngữ Cảnh Kênh TikTok (Channel Context)',
      channelUrlPlaceholder: 'https://www.tiktok.com/@tenkenh hoặc @tenkenh',
      analyzeChannelBtn: 'Đọc Context Kênh',
      analyzingChannelBtn: 'Đang Phân Tích Kênh...',
      channelToggleNotesBtn: '+ Thêm Mô Tả / Ghi Chú',
      channelNotesPlaceholder:
        'Tùy chọn: dán bio kênh hoặc danh sách chủ đề video mẫu nếu TikTok giới hạn truy cập tự động.',
      channelUsePromptBtn: 'Dùng Chủ Đề Gợi Ý',
      channelClearBtn: 'Xóa',
      channelNicheLabel: 'Ngách nội dung',
      channelAudienceLabel: 'Khán giả mục tiêu',
      channelToneLabel: 'Phong cách & Giọng điệu',
      channelPillarsLabel: 'Trụ cột nội dung',
      channelFollowersUnit: 'người theo dõi',
      channelActiveNote: 'Đã gắn context kênh — kịch bản tạo ra sẽ bám sát phong cách tài khoản này.',
      channelAnalyzeError: 'Không thể đọc ngữ cảnh từ liên kết TikTok này.',
    },
    progress: {
      sectionEyebrow: 'GIÁM SÁT TIẾN ĐỘ THỜI GIAN THỰC',
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
      audioReadyNotice:
        'Đã tạo xong kịch bản & giọng đọc (80%). Chế độ tự động xuất MP4 đang tắt — hãy kiểm tra hoặc mở rộng slide bên dưới rồi bấm "BIÊN DỊCH & XUẤT MP4 1080P" để hoàn tất video.',
      masterComplete: 'KẾT XUẤT VIDEO HOÀN TẤT',
      exportPropsBtn: 'Xuất JSON Remotion Props',
      downloadSrtBtn: 'Tải Phụ Đề (.SRT)',
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
      sectionEyebrow: 'TRÌNH DUYỆT & CHỈNH SỬA SLIDE TRỰC QUAN',
      synthAudioBtn: 'Chỉ Tạo Giọng Đọc',
      compileRenderBtn: 'Biên Dịch & Xuất MP4 1080p',
      compilingBtn: 'ĐANG BIÊN DỊCH...',
      slidesCounter: 'DANH SÁCH SLIDE',
      addSlideBtn: '+ THÊM',
      removeSlideBtn: 'XÓA',
      aiExpandLabel: 'TẠO THÊM BẰNG AI',
      aiExpand5Btn: '+5 SLIDE AI',
      aiExpand10Btn: '+10 SLIDE AI',
      aiExpandingBtn: 'ĐANG TẠO...',
      aiExpandError: 'Không thể tự động tạo thêm slide.',
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
      sectionEyebrow: 'LƯU TRỮ TÁC VỤ',
      title: 'Lịch Sử Kết Xuất Gần Đây',
      refreshBtn: 'Làm Mới Danh Sách',
      emptyState: 'Chưa có tác vụ tạo video nào được ghi nhận trong phiên làm việc hiện tại.',
      untitledJob: 'Bài Thuyết Trình Chưa Đặt Tên',
      footerLeft: 'AIK-VDGENERATION STUDIO · KIẾN TRÚC VIDEO ĐỒNG BỘ ÂM THANH',
      footerRight: 'HỆ THỐNG ĐƠN SẮC PHẲNG · ZERO RADIUS · ZERO ELEVATION',
    },
  },
};
