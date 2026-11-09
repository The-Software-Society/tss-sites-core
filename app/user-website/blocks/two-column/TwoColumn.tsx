'use client';

import React, { useRef, useState, useMemo, useCallback } from 'react'
import './two-column.scss';
import { Parser } from 'html-to-react';
import ProcessMedia from '@/app/user-website/blocks/ProcessMedia';
import { getBackgroundMediaCompat } from '@/app/user-website/helpers/resolveBlockMedia';
import { useRenderSettings } from '../../hooks/useRenderSettings';
import { useBaseWebsiteContext } from '../../globals/BaseWebsiteContextProvider';
import RenderButtons from '../RenderButtons';

type Props = {
  block: any;
  state: any;
  dispatch: React.Dispatch<any>;
  isAboveFold?: boolean;
}

export default function TwoColumn({ block, state, dispatch, isAboveFold }: Props) {
  const { content: blockContent, settings } = block;
  const { state: baseState } = useBaseWebsiteContext();

  // Read columns, sort by order
  const sortedColumns = useMemo(() => {
    const cols = blockContent?.columns || [];
    return [...cols].sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
  }, [blockContent?.columns]);

  const textColumn = sortedColumns.find((c: any) => c.type === 'text');
  const content = textColumn?.content || '';
  const buttons = textColumn?.buttons || [];
  const rawMedia = block.media;
  const media = (typeof rawMedia === 'object' && !Array.isArray(rawMedia) && rawMedia !== null)
    ? rawMedia.inlineMedia || null
    : rawMedia || null;

  const {
    responsiveHeight,
    buttonType,
    contentPositionClass,
    typeClass,
    contentSize,
    getComposedClassNames,
    noContainers,
    buttonPosition,
    overlayTextClass,
    borderStyle,
    manualSpacingStyle,
    customBackgroundColorStyle
  } = useRenderSettings(block);

  const videoMode = settings?.videoMode || 'autoplay-muted';

  // Look up the media item for dimensions + type detection
  const mediaItem = useMemo(() =>
    media ? baseState?.allMedia?.find((m: any) => m.uuid === media) : null,
    [media, baseState?.allMedia]
  );

  const isContain = !!settings?.containMedia;

  // State for actual media dimensions detected at runtime (only used when DB dims unavailable)
  const [mediaDimensions, setMediaDimensions] = useState<{ w: number; h: number } | null>(null);

  const handleDimensionsReady = useCallback((w: number, h: number) => {
    // Only update if we don't already have DB dimensions — avoids unnecessary re-render/CLS
    if (!mediaItem?.width || !mediaItem?.height) {
      setMediaDimensions({ w, h });
    }
  }, [mediaItem?.width, mediaItem?.height]);

  // Prefer DB dimensions (available from SSR), fallback to runtime-detected
  const aspectRatio = (mediaItem?.width && mediaItem?.height)
    ? `${mediaItem.width} / ${mediaItem.height}`
    : (mediaDimensions ? `${mediaDimensions.w} / ${mediaDimensions.h}` : undefined);

  // Determine if inline media is a video
  const isVideo = useMemo(() => {
    if (!mediaItem?.url) return false;
    return ['.mp4', '.webm', '.mov'].some(ext => mediaItem.url.toLowerCase().endsWith(ext));
  }, [mediaItem]);

  // Video control state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);

  // Compute ProcessMedia props based on videoMode
  const videoProps = useMemo(() => {
    if (!isVideo) return {};
    switch (videoMode) {
      case 'click-to-play':
        return { autoPlay: false, muted: false };
      case 'autoplay-click-sound':
        return { autoPlay: true, muted: true };
      default:
        return { autoPlay: true, muted: true };
    }
  }, [videoMode, isVideo]);

  const handlePlayClick = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.play();
    setIsPlaying(true);
    setHasStarted(true);
  }, []);

  const handleMuteToggle = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  }, []);

  // Resolve any color name/hex to CSS value
  const resolveColor = (color: string | undefined) => {
    if (!color || color === 'None' || color === 'transparent') return undefined;
    if (color.startsWith('#')) return color;
    return `var(--color-${color.toLowerCase()})`;
  };

  // Column media border — on .media-content
  const borderColor = settings?.mediaBorderColor;
  const borderThickness = settings?.mediaBorderThickness || 2;
  const hasBorder = borderColor && borderColor !== 'None' && borderColor !== 'transparent';
  const borderValue = hasBorder
    ? `${borderThickness}px solid ${resolveColor(borderColor)}`
    : undefined;
  const mediaBorderStyle = borderValue ? { border: borderValue } : {};

  // Column media background color
  const columnBgColor = resolveColor(settings?.columnBackgroundColor);
  const columnBgStyle = columnBgColor ? { backgroundColor: columnBgColor } : {};

  // Column media overlay
  const columnOverlayColor = resolveColor(settings?.columnOverlayColor);
  const columnOverlayPercent = settings?.columnOverlayPercent || 0;
  const columnOverlayJSX = columnOverlayColor && columnOverlayPercent > 0 ? (
    <div className="overlay" style={{ background: columnOverlayColor, opacity: columnOverlayPercent / 100 }} />
  ) : null;

  // Background border
  const bgBorderColor = resolveColor(settings?.bgBorderColor);
  const bgBorderThickness = settings?.bgBorderThickness || 2;
  const bgBorderValue = bgBorderColor ? `${bgBorderThickness}px solid ${bgBorderColor}` : undefined;
  const bgBorderStyle = bgBorderValue ? { border: bgBorderValue } : {};

  // Derive reverse from column order (media-first = reversed)
  const isReversed = sortedColumns[0]?.type === 'media';

  // Background media — prefer block.media.backgroundMedia, fall back to content.backgroundMedia
  const backgroundMedia = getBackgroundMediaCompat(block);

  // Show video controls only when inline media is a video and mode requires it
  const showPlayOverlay = isVideo && videoMode === 'click-to-play' && !hasStarted;
  const showMuteButton = isVideo && videoMode === 'autoplay-click-sound';
  const showPlayPauseButton = isVideo && videoMode === 'click-to-play' && hasStarted;

  return (
    <section
      className={`user-website-two-column ${getComposedClassNames()} ${isReversed ? 'reverse' : ''} ${settings?.bgContainMedia ? 'bg-contain' : ''} ${contentPositionClass} ${overlayTextClass}`}
      style={{...customBackgroundColorStyle, ...borderStyle, ...manualSpacingStyle}}
    >
      {backgroundMedia && (
        <div className="background-wrapper" style={bgBorderStyle}>
          {settings?.overlayPercent > 0 && (
            <div
              className="overlay"
              style={{
                background: resolveColor(settings?.imageOverlayColor) || 'var(--color-overlay-background)',
                opacity: settings.overlayPercent / 100,
              }}
            />
          )}
          <ProcessMedia media={backgroundMedia} opacity={settings?.bgOpacityPercent ?? settings?.opacityPercent} sizes="100vw" priority={isAboveFold} isBackground />
        </div>
      )}
      <div
        className={`grid-wrapper`}
        style={{
          ...(contentSize),
          minHeight: responsiveHeight,
        }}
      >
        <div className={`content-wrapper`}>
          {content && Parser().parse(content)}
          <RenderButtons
            buttons={buttons}
            buttonPosition={buttonPosition}
            contrastButtonType={buttonType}
          />
        </div>
        {blockContent?.iframe_override ? (
          Parser().parse(blockContent?.iframe_override)
        ) : (
          media && (
            <div className="media-wrapper" style={isContain ? columnBgStyle : undefined}>
              <div
                className="media-content"
                style={{
                  ...(isContain ? {} : columnBgStyle),
                  ...(isContain && borderValue ? { border: borderValue } : {}),
                  ...(isContain && aspectRatio
                    ? { '--media-aspect-ratio': aspectRatio } as React.CSSProperties
                    : {}),
                }}
              >
                {columnOverlayJSX}
                <ProcessMedia
                  media={media}
                  opacity={settings?.columnOpacityPercent ?? settings?.opacityPercent}
                  mediaRef={videoRef}
                  style={!isContain && borderValue ? { border: borderValue, borderRadius: 'inherit' } : undefined}
                  onDimensionsReady={isContain ? handleDimensionsReady : undefined}
                  sizes="(max-width: 768px) 100vw, 50vw"
                  priority={isAboveFold}
                  {...videoProps}
                />
                {showPlayOverlay && (
                  <div className="play-overlay" onClick={handlePlayClick}>
                    <div className="play-icon">
                      <div className="play-triangle" />
                    </div>
                  </div>
                )}
                {showPlayPauseButton && (
                  <button
                    className="video-control-btn"
                    aria-label={isPlaying ? 'Pause video' : 'Play video'}
                    onClick={() => {
                      if (!videoRef.current) return;
                      if (videoRef.current.paused) {
                        videoRef.current.play();
                        setIsPlaying(true);
                      } else {
                        videoRef.current.pause();
                        setIsPlaying(false);
                      }
                    }}
                  >
                    {isPlaying ? (
                      <div className="pause-icon">
                        <span /><span />
                      </div>
                    ) : (
                      <div className="play-triangle small" />
                    )}
                  </button>
                )}
                {showMuteButton && (
                  <button className="video-control-btn" aria-label={isMuted ? 'Unmute video' : 'Mute video'} onClick={handleMuteToggle}>
                    {isMuted ? (
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0012 7.5v2a2.5 2.5 0 010 5v2A4.5 4.5 0 0016.5 12zM3.27 3L2 4.27l6.18 6.18L2 16.73 3.27 18l6.18-6.18L12 14.45v3.55l-2.73-2.73L8 16.54l4 4V18l.73-.73L18.73 23 20 21.73l-9-9L3.27 3z"/>
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0012 7.5v9a4.5 4.5 0 004.5-4.5zM12 3.23v2.06a7 7 0 010 13.42v2.06A9 9 0 0012 3.23z"/>
                      </svg>
                    )}
                  </button>
                )}
              </div>
            </div>
          )
        )}

      </div>
    </section>
  )
}
