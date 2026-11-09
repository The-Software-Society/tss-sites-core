'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import Image from 'next/image';

//context
import { useBaseWebsiteContext } from '@/app/user-website/globals/BaseWebsiteContextProvider';

import type { MediaItem } from '@/app/lib/sites/types';

interface Props {
  media: string;
  scrollingZoom?: boolean;
  mediaRef?: any;
  opacity?: number;
  className?: string;
  style?: any;
  svgColor?: string;
  autoPlay?: boolean;
  muted?: boolean;
  priority?: boolean;
  sizes?: string;
  isBackground?: boolean;
  onDimensionsReady?: (width: number, height: number) => void;
}

const InlineSvg = React.forwardRef<HTMLDivElement, {
  url: string;
  color: string;
  width: number;
  height: number;
  className?: string;
  opacity?: number;
  style?: any;
}>(({ url, color, width, height, className, opacity, style }, ref) => {
  const [svgMarkup, setSvgMarkup] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then(r => r.text())
      .then(text => {
        if (cancelled) return;
        // Strip any <?xml?> or <!DOCTYPE> preamble
        let svg = text.replace(/<\?xml[^?]*\?>/gi, '').replace(/<!DOCTYPE[^>]*>/gi, '').trim();
        // Replace non-"none" fill values with currentColor (preserve fill="none")
        svg = svg.replace(/fill="(?!none")([^"]*)"/gi, 'fill="currentColor"');
        // Replace non-"none" stroke values with currentColor (preserve stroke="none")
        svg = svg.replace(/stroke="(?!none")([^"]*)"/gi, 'stroke="currentColor"');
        // Handle inline style fill/stroke
        svg = svg.replace(/fill:\s*(?!none)[^;}"]+/gi, 'fill:currentColor');
        svg = svg.replace(/stroke:\s*(?!none)[^;}"]+/gi, 'stroke:currentColor');
        setSvgMarkup(svg);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [url]);

  if (!svgMarkup) return null;

  return (
    <div
      ref={ref}
      className={className}
      style={{
        width,
        height,
        maxWidth: '100%',
        opacity: opacity ? opacity / 100 : 1,
        color: color,
        ...style,
      }}
      dangerouslySetInnerHTML={{ __html: svgMarkup.replace(
        /<svg\b/,
        '<svg style="width:100%;height:100%;"'
      )}}
    />
  );
});
InlineSvg.displayName = 'InlineSvg';

function LazyVideo({
  mediaMemo,
  priority,
  mediaRef,
  scrollingZoom,
  className,
  style,
  opacity,
  autoPlay,
  muted,
  onDimensionsReady,
}: {
  mediaMemo: MediaItem;
  priority?: boolean;
  mediaRef?: any;
  scrollingZoom?: boolean;
  className?: string;
  style?: any;
  opacity?: number;
  autoPlay?: boolean;
  muted?: boolean;
  onDimensionsReady?: (width: number, height: number) => void;
}) {
  const [inView, setInView] = useState(!!priority);
  const [loaded, setLoaded] = useState(false);
  const observerRef = useRef<HTMLDivElement>(null);
  const videoCodec = mediaMemo.url?.split('.').pop() === 'mov' ? 'mp4' : mediaMemo.url?.split('.').pop();

  useEffect(() => {
    if (priority || inView || !observerRef.current) return;

    // Measure first, then observe.
    //
    // An IntersectionObserver callback is not guaranteed to arrive promptly:
    // Chrome throttles them in background and non-foregrounded tabs, and a
    // reader who lands mid-page on an anchor link is already looking at the
    // element before the observer has said anything. In both cases the video
    // sat behind its placeholder indefinitely while the element was plainly on
    // screen. A synchronous check costs one layout read and removes the whole
    // class of problem.
    const rect = observerRef.current.getBoundingClientRect();
    const margin = 200;
    const alreadyVisible =
      rect.bottom > -margin &&
      rect.top < (window.innerHeight || 0) + margin &&
      rect.width > 0 &&
      rect.height > 0;
    if (alreadyVisible) {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: `${margin}px` }
    );
    observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [priority, inView]);

  if (!inView) {
    return (
      <div
        ref={observerRef}
        className={`shimmer-placeholder ${className || ''}`}
        style={{
          aspectRatio: mediaMemo.width && mediaMemo.height ? `${mediaMemo.width}/${mediaMemo.height}` : '16/9',
          width: '100%',
          height: '100%',
          ...style,
        }}
      />
    );
  }

  return (
    <div className={className} style={{
      display: 'grid',
      width: '100%',
      height: '100%',
      aspectRatio: mediaMemo.width && mediaMemo.height ? `${mediaMemo.width}/${mediaMemo.height}` : '16/9',
      ...style,
    }}>
      <div
        className="shimmer-placeholder"
        style={{
          gridArea: '1/1',
          width: '100%',
          height: '100%',
          opacity: loaded ? 0 : 1,
          transition: 'opacity 0.3s ease-out',
          pointerEvents: 'none',
        }}
      />
      <video
        ref={mediaRef}
        loop
        muted={muted !== false}
        playsInline
        preload={priority ? 'auto' : 'metadata'}
        autoPlay={autoPlay !== false}
        // Transparent poster lets the browser "paint" the video element immediately,
        // so the shimmer underneath becomes the visual LCP instead of waiting for video decode.
        poster="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
        {...(priority ? { fetchPriority: 'high' as const } : {})}
        {...(scrollingZoom ? { className: 'scrollingZoom' } : {})}
        style={{
          gridArea: '1/1',
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: loaded ? (opacity ? opacity / 100 : 1) : 0,
          transition: 'opacity 0.3s ease-out',
        }}
        onCanPlay={() => setLoaded(true)}
        onLoadedMetadata={(e: any) => {
          const vid = e.target as HTMLVideoElement;
          if (vid.videoWidth && vid.videoHeight) {
            onDimensionsReady?.(vid.videoWidth, vid.videoHeight);
          }
        }}
      >
        <source src={mediaMemo.url!} type={`video/${videoCodec}`} />
      </video>
    </div>
  );
}

export default function ProcessMedia({ media, mediaRef, opacity, scrollingZoom, className, style, svgColor, autoPlay, muted, priority, sizes, isBackground, onDimensionsReady }: Props) {
  const { state } = useBaseWebsiteContext();

  const mediaMemo = useMemo(() =>
    state?.allMedia?.find((m: MediaItem) => m.uuid === media) || null,
    [state?.allMedia, media]
  );

  // allMedia not loaded yet — show shimmer placeholder in the exact media slot
  if (!state?.allMedia || state.allMedia.length === 0) {
    const primaryColor = state?.website?.colors?.primary || '#cccccc';
    return (
      <div
        className={`shimmer-placeholder ${className || ''}`}
        style={{
          '--shimmer-base': `${primaryColor}15`,
          '--shimmer-highlight': `${primaryColor}30`,
          width: '100%',
          aspectRatio: '16/9',
          opacity: opacity ? opacity / 100 : 1,
          ...style,
        } as React.CSSProperties}
      />
    );
  }

  if (!mediaMemo?.url) return null;

  const videoExtensions = ['.mp4', '.webm', '.mov'];
  const isVideo = videoExtensions.some(ext => mediaMemo.url?.toLowerCase().endsWith(ext));

  const isSvg = mediaMemo.url?.toLowerCase().endsWith('.svg');

  if (isSvg && svgColor) {
    return (
      <InlineSvg
        ref={mediaRef}
        url={mediaMemo.url!}
        color={svgColor}
        width={mediaMemo.width || 200}
        height={mediaMemo.height || 200}
        className={`svg-color-mask ${className || ''}`}
        opacity={opacity}
        style={style}
      />
    );
  }

  if (isSvg) {
    return (
      <img
        ref={mediaRef}
        src={mediaMemo.url}
        alt={mediaMemo.alt || mediaMemo.name || 'SVG'}
        width={mediaMemo.width || undefined}
        height={mediaMemo.height || undefined}
        style={{ opacity: opacity ? opacity / 100 : 1, maxWidth: '100%', ...style }}
        {...(className ? { className } : {})}
      />
    );
  }

  if (isVideo) {
    return (
      <LazyVideo
        mediaMemo={mediaMemo}
        priority={priority}
        mediaRef={mediaRef}
        scrollingZoom={scrollingZoom}
        className={className}
        style={style}
        opacity={opacity}
        autoPlay={autoPlay}
        muted={muted}
        onDimensionsReady={onDimensionsReady}
      />
    );
  }

  return (
    <Image
      ref={mediaRef}
      src={mediaMemo.url}
      alt={mediaMemo.alt || mediaMemo.name || ''}
      width={mediaMemo.width}
      height={mediaMemo.height}
      sizes={sizes || "(max-width: 640px) 100vw, (max-width: 1024px) 75vw, (max-width: 1920px) 50vw, 33vw"}
      quality={isBackground ? 65 : (state?.website?.settings?.imageQuality || 80)}
      priority={priority}
      style={{ opacity: opacity ? opacity / 100 : 1, ...style }}
      {...(scrollingZoom ? { className: 'scrollingZoom' } : {})}
      {...(className ? { className } : {})}
      onLoad={(e: any) => {
        const img = e.target as HTMLImageElement;
        if (img.naturalWidth && img.naturalHeight) {
          onDimensionsReady?.(img.naturalWidth, img.naturalHeight);
        }
      }}
    />
  );
}
