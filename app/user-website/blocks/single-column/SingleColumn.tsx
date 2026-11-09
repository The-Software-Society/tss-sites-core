'use client';
import React, { useMemo } from 'react';
import Link from 'next/link';
import './single-column.scss';
import { Parser } from 'html-to-react';
import { useRenderSettings } from '../../hooks/useRenderSettings';
import ProcessMedia from '@/app/user-website/blocks/ProcessMedia';
import RenderButtons from '../RenderButtons';

type Props = {
  block: any;
  isAboveFold?: boolean;
}

export default function SingleColumn({ block, isAboveFold }: Props) {
  const { content: { content, buttons }, settings, media } = block;
  const {
    responsiveHeight,
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
    buttonType,
    borderStyle,
    manualSpacingStyle,
    customBackgroundColorStyle,
    gapStyles
  } = useRenderSettings(block);

  return (
    <section 
      className={`user-website-single-column ${getComposedClassNames()} ${contentPositionClass} ${overlayTextClass}`}
      style={{
        ...(notContained && sectionSize ),
        ...borderStyle,
        ...manualSpacingStyle,
        ...customBackgroundColorStyle,
        ...gapStyles,
        minHeight: responsiveHeight
      }}
    > 
      <div 
        className={`grid-wrapper`}
        style={{
          ...(contentSize) 
        }}
      >
        <div className={`content-wrapper`}>
          {content && Parser().parse(content)}
          <RenderButtons 
            buttons={buttons} 
            buttonPosition={buttonPosition}
            contrastButtonType={buttonType}
            sectionBackground={settings?.backgroundColor}
          />
        </div>
      </div>
      {media && 
        <div className="media-wrapper">
          {overlayJSX}
          <ProcessMedia media={media} opacity={settings?.opacityPercent} sizes="100vw" priority={isAboveFold} isBackground />
        </div>
      }
    </section>
  );
}