export type SlideLayout = 
  | 'title_intro' 
  | 'bullet_list' 
  | 'split_card' 
  | 'quote_highlight' 
  | 'conclusion_cta';

export interface SlideData {
  slide_index: number;
  layout: SlideLayout;
  heading: string;
  bullet_points?: string[];
  voiceover_audio_url?: string;
  voiceover_duration_seconds: number;
  calculated_frames?: number;
  background_image_url?: string;
}

export interface VideoPresentationProps {
  project_title: string;
  theme?: {
    backgroundColor?: string;
    primaryColor?: string;
    textColor?: string;
  };
  slides: SlideData[];
}
