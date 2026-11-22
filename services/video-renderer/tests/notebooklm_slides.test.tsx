/**
 * Automated Verification & Test Suite for NotebookLM-Inspired Per-Slide Visual Diversity:
 * Alternating Light/Dark Palettes, Procedural Animated SVG Infographics, & Layout Sub-Variants.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('remotion', async () => {
  const ReactMod = await import('react');
  return {
    useCurrentFrame: () => 28,
    useVideoConfig: () => ({
      fps: 30,
      durationInFrames: 240,
      width: 1920,
      height: 1080,
      id: 'SlidePresentation',
    }),
    spring: () => 1,
    interpolate: (
      input: number,
      inputRange: readonly number[],
      outputRange: readonly number[]
    ) => {
      if (input <= inputRange[0]) return outputRange[0];
      if (input >= inputRange[inputRange.length - 1]) {
        return outputRange[outputRange.length - 1];
      }
      const ratio = (input - inputRange[0]) / (inputRange[1] - inputRange[0] || 1);
      return outputRange[0] + ratio * (outputRange[1] - outputRange[0]);
    },
    AbsoluteFill: ({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) =>
      ReactMod.createElement('div', { 'data-remotion': 'AbsoluteFill', style }, children),
    Img: ({ src, style }: { src: string; style?: React.CSSProperties }) =>
      ReactMod.createElement('img', { src, style }),
    staticFile: (p: string) => `/${p.replace(/^\/+/, '')}`,
  };
});

import { SlideCard } from '../src/components/SlideCard';
import { SlideData } from '../src/types';
import {
  SLIDE_PALETTES,
  resolveSlidePalette,
  resolveVisualVariant,
} from '../src/utils/slidePalettes';
import { DEFAULT_THEME } from '../src/utils/timing';

describe('NotebookLM Per-Slide Palette Alternation & Visual Variants', () => {
  it('alternates distinct dark studio and light paper palettes across slides 1..8', () => {
    const seenIds = new Set<string>();
    const palettes = Array.from({ length: SLIDE_PALETTES.length }, (_, i) =>
      resolveSlidePalette(i + 1, 'bullet_list', DEFAULT_THEME, false)
    );

    palettes.forEach((p, idx) => {
      seenIds.add(p.id);
      if (idx > 0) {
        expect(p.id).not.toBe(palettes[idx - 1].id);
        expect(p.backgroundColor).not.toBe(palettes[idx - 1].backgroundColor);
        expect(p.isLight).not.toBe(palettes[idx - 1].isLight);
      }
    });

    expect(seenIds.size).toBe(8);
  });

  it('assigns distinct procedural visual variants for repeated bullet_list and split_card slides', () => {
    const bulletVariants = [2, 3, 4].map((idx) =>
      resolveVisualVariant({
        slide_index: idx,
        layout: 'bullet_list',
        heading: `Topic Section ${idx}`,
        voiceover_duration_seconds: 5,
      })
    );
    expect(new Set(bulletVariants).size).toBe(3);

    const splitVariants = [2, 3, 4].map((idx) =>
      resolveVisualVariant({
        slide_index: idx,
        layout: 'split_card',
        heading: `Analysis Point ${idx}`,
        voiceover_duration_seconds: 5,
      })
    );
    expect(new Set(splitVariants).size).toBe(3);
  });

  it('renders bespoke animated SVG diagrams and contrasting palettes inside SlideCard', () => {
    const deck: SlideData[] = [
      {
        slide_index: 1,
        layout: 'title_intro',
        heading: 'Architecture Overview',
        bullet_points: ['Async queue', 'Audio-driven pacing'],
        voiceover_duration_seconds: 5,
      },
      {
        slide_index: 2,
        layout: 'bullet_list',
        heading: 'Quy Trình Tự Động Từng Bước',
        bullet_points: ['Input Parsing', 'TTS Synthesis', 'Remotion Encode'],
        voiceover_duration_seconds: 6,
      },
      {
        slide_index: 3,
        layout: 'split_card',
        heading: 'So Sánh Hiệu Năng Xử Lý',
        bullet_points: ['Before: Manual editing', 'After: Instant studio pipeline'],
        voiceover_duration_seconds: 6,
      },
      {
        slide_index: 4,
        layout: 'bullet_list',
        heading: 'Kiến Trúc Hệ Sinh Thái Mở Rộng',
        bullet_points: ['Gateway', 'Worker', 'Web Studio', 'Storage'],
        voiceover_duration_seconds: 6,
      },
      {
        slide_index: 5,
        layout: 'split_card',
        heading: 'Lộ Trình Triển Khai Chiến Lược',
        bullet_points: ['Phase 1: Core', 'Phase 2: Studio', 'Phase 3: Scale'],
        voiceover_duration_seconds: 6,
      },
      {
        slide_index: 6,
        layout: 'quote_highlight',
        heading: 'Great storytelling merges crisp visuals with natural rhythm.',
        bullet_points: ['Design Principle'],
        voiceover_duration_seconds: 5,
      },
    ];

    const rendered = deck.map((s) => renderToStaticMarkup(<SlideCard slide={s} totalSlides={6} />));

    // Slide 1 (Dark Sapphire Studio + Orbital SVG)
    expect(rendered[0]).toContain('data-palette-id="sapphire_studio"');
    expect(rendered[0]).toContain('data-visual-variant="orbital_hero"');
    expect(rendered[0]).toContain('data-testid="visual-svg-orbital"');

    // Slide 2 (Light Warm Editorial Paper + Process Flow Beam SVG)
    expect(rendered[1]).toContain('data-palette-id="warm_editorial_paper"');
    expect(rendered[1]).toContain('data-visual-variant="process_pipeline"');
    expect(rendered[1]).toContain('data-testid="visual-svg-process-beam"');
    expect(rendered[1]).toContain('radial-gradient');

    // Slide 3 (Dark Emerald Forest + Metric Bars SVG)
    expect(rendered[2]).toContain('data-palette-id="emerald_forest"');
    expect(rendered[2]).toContain('data-visual-variant="compare_bars"');
    expect(rendered[2]).toContain('data-testid="visual-svg-compare-bars"');

    // Slide 4 (Light Cobalt Porcelain + Knowledge Graph SVG)
    expect(rendered[3]).toContain('data-palette-id="cobalt_porcelain"');
    expect(rendered[3]).toContain('data-visual-variant="knowledge_graph"');
    expect(rendered[3]).toContain('data-testid="visual-svg-knowledge-graph"');

    // Slide 5 (Dark Aubergine Spark + Milestone Roadmap SVG)
    expect(rendered[4]).toContain('data-palette-id="aubergine_spark"');
    expect(rendered[4]).toContain('data-visual-variant="milestone_roadmap"');
    expect(rendered[4]).toContain('data-testid="visual-svg-roadmap"');

    // Slide 6 (Light Sage Botanical + Focus Callout Quote)
    expect(rendered[5]).toContain('data-palette-id="sage_botanical"');
    expect(rendered[5]).toContain('data-visual-variant="focus_callout"');
  });

  it('differentiates modern_tech, corporate, and minimal themes visually & removes robotic labels', () => {
    const sampleSlide: SlideData = {
      slide_index: 1,
      layout: 'title_intro',
      heading: 'Strategic Growth Architecture',
      bullet_points: ['Clarity over clutter', 'Human-centered typography'],
      voiceover_duration_seconds: 5,
    };

    const techHtml = renderToStaticMarkup(
      <SlideCard
        slide={sampleSlide}
        totalSlides={4}
        theme={{
          preset: 'modern_tech',
          backgroundColor: '#132B63',
          primaryColor: '#38BDF8',
          textColor: '#FFFFFF',
          fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif',
        }}
      />
    );
    const corpHtml = renderToStaticMarkup(
      <SlideCard
        slide={sampleSlide}
        totalSlides={4}
        theme={{
          preset: 'corporate',
          backgroundColor: '#102A43',
          primaryColor: '#E6A852',
          textColor: '#F8FAFC',
          fontFamily: 'Georgia, "Times New Roman", "Noto Serif", serif',
        }}
      />
    );
    const minimalHtml = renderToStaticMarkup(
      <SlideCard
        slide={sampleSlide}
        totalSlides={4}
        theme={{
          preset: 'minimal',
          backgroundColor: '#FFF0EB',
          primaryColor: '#EA580C',
          textColor: '#292524',
          fontFamily: '"Helvetica Neue", "Segoe UI", Arial, sans-serif',
        }}
      />
    );

    expect(techHtml).toContain('data-theme-preset="modern_tech"');
    expect(techHtml).toContain('data-palette-id="sapphire_studio"');
    expect(techHtml).toContain('font-weight:800');

    expect(corpHtml).toContain('data-theme-preset="corporate"');
    expect(corpHtml).toContain('data-palette-id="corp_admiralty_navy"');
    expect(corpHtml).toContain('Georgia');
    expect(corpHtml).toContain('font-weight:700');

    expect(minimalHtml).toContain('data-theme-preset="minimal"');
    expect(minimalHtml).toContain('data-palette-id="minimal_peach_silk"');
    expect(minimalHtml).toContain('font-weight:500');

    for (const html of [techHtml, corpHtml, minimalHtml]) {
      expect(html).not.toContain('KEYNOTE BRIEFING');
      expect(html).not.toContain('ACTION 01');
      expect(html).not.toContain('SUMMARY COMPLETE');
    }
  });
});
