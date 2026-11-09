
'use client';

import React, { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { Parser } from 'html-to-react';

//scss
import './large-media.scss';

//hooks
import { useRenderSettings } from '../../hooks/useRenderSettings';
import { useBaseWebsiteContext } from '../../globals/BaseWebsiteContextProvider';

//components
import ProcessMedia from '@/app/user-website/blocks/ProcessMedia';
import RenderButtons from '../RenderButtons';

type Props = {
  block: any;
  isAboveFold?: boolean;
}

export default function LargeMedia({ block, isAboveFold }: Props) {
  const { content: { content, contentAbove, buttons }, media, settings } = block;
  const { state: baseState } = useBaseWebsiteContext();
  const {
    responsiveHeight,
    buttonType,
    overlayJSX,
    typeClass,
    contentSize,
    getComposedClassNames,
    noContainers,
    contentPositionClass,
    buttonPosition,
    overlayTextClass,
    sectionSize,
    notContained,
    borderStyle,
    manualSpacingStyle,
    customBackgroundColorStyle
  } = useRenderSettings(block);

  // The `contain` setting, done the way the rest of the system does it.
  //
  // This block used to answer `contain` with `object-fit: contain` inside a
  // fixed 500px-tall box, which is the one approach the design rules single
  // out as wrong: contain leaves empty space *inside* the element, so the
  // border, corner radius and overlay all get drawn around the emptiness
  // rather than around the picture, and a wide screenshot ended up floating
  // in the middle of a box it did not fill and no longer lining up with its
  // own caption. Two Column and Grid already give the wrapper the media's own
  // aspect ratio and let `cover` fill it exactly; this now matches them.
  //
  // It depends on the stored width and height being right. If media is
  // recorded with the wrong dimensions the wrapper is the wrong shape and
  // `cover` does crop, which looks exactly like this rule being wrong and is
  // not. Fix the dimensions.
  const isContain = !!settings?.containMedia;
  const mediaItem = useMemo(
    () => (typeof media === 'string' ? baseState?.allMedia?.find((m: any) => m.uuid === media) : null),
    [media, baseState?.allMedia],
  );
  const [runtimeDimensions, setRuntimeDimensions] = useState<{ w: number; h: number } | null>(null);
  const handleDimensionsReady = useCallback((w: number, h: number) => {
    if (!mediaItem?.width || !mediaItem?.height) setRuntimeDimensions({ w, h });
  }, [mediaItem?.width, mediaItem?.height]);

  // Prefer the stored dimensions, which are available during SSR and so do
  // not cause a layout shift; fall back to what the file reports once loaded.
  const aspectRatio = (mediaItem?.width && mediaItem?.height)
    ? `${mediaItem.width} / ${mediaItem.height}`
    : (runtimeDimensions ? `${runtimeDimensions.w} / ${runtimeDimensions.h}` : undefined);

  return (
    <section 
      className={`large-media ${getComposedClassNames()} ${contentPositionClass} ${overlayTextClass}`}
      style={{
        ...(notContained && sectionSize ),
        ...borderStyle,
        ...manualSpacingStyle,
        ...customBackgroundColorStyle
      }}
    >
      <div
        className={`grid-wrapper`}
        style={{
          ...(contentSize),
          minHeight: responsiveHeight
        }}
      >
        <div className="content-wrapper">
          {contentAbove && Parser().parse(contentAbove)}
          <RenderButtons buttons={buttons} buttonPosition={buttonPosition} contrastButtonType={buttonType} />
        </div>
        {media &&
        <div
          className="media-wrapper"
          style={isContain && aspectRatio
            ? { '--media-aspect-ratio': aspectRatio } as React.CSSProperties
            : undefined}
        >
          {overlayJSX}
          <ProcessMedia
            media={media}
            opacity={settings?.opacityPercent}
            priority={isAboveFold}
            sizes="100vw"
            onDimensionsReady={isContain ? handleDimensionsReady : undefined}
          />
        </div>
      }
      </div>
    </section>
  )
}
