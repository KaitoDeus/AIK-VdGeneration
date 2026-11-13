import { registerRoot, Composition } from 'remotion';
import { SlidePresentation } from './compositions/SlidePresentation';
import { VideoPresentationProps } from './types';

// Default mock props for local development preview
const defaultProps: VideoPresentationProps = {
  project_title: 'AIK-VdGeneration Presentation Demo',
  theme: {
    backgroundColor: '#0f172a',
    primaryColor: '#38bdf8',
    textColor: '#f8fafc',
  },
  slides: [
    {
      slide_index: 1,
      layout: 'title_intro',
      heading: 'Welcome to AIK-VdGeneration',
      bullet_points: [
        'Automated slide video generation from text prompts',
        'Synchronized bilingual English and Vietnamese voiceovers',
      ],
      voiceover_duration_seconds: 4.5,
    },
    {
      slide_index: 2,
      layout: 'bullet_list',
      heading: 'Remotion Engine & Queue System',
      bullet_points: [
        'Timeline duration dynamically driven by speech length',
        'Fluid spring animations with declarative React styling',
        'Scalable cloud rendering via serverless workers',
      ],
      voiceover_duration_seconds: 6.0,
    },
  ],
};

export const RemotionRoot: React.FC = () => {
  const fps = 30;

  return (
    <Composition
      id="SlidePresentation"
      component={SlidePresentation}
      durationInFrames={360} // default for preview
      fps={fps}
      width={1920}
      height={1080}
      defaultProps={defaultProps}
      calculateMetadata={({ props }) => {
        const totalFrames = props.slides.reduce((acc, slide) => {
          return acc + Math.max(90, Math.ceil((slide.voiceover_duration_seconds + 0.6) * fps));
        }, 0);

        return {
          durationInFrames: Math.max(90, totalFrames),
          fps,
          width: 1920,
          height: 1080,
        };
      }}
    />
  );
};

registerRoot(RemotionRoot);
