'use client';

import React from 'react';
import { Parser } from 'html-to-react';

import './steps.scss';

import { useRenderSettings } from '../../hooks/useRenderSettings';
import ProcessMedia from '@/app/user-website/blocks/ProcessMedia';
import RenderButtons from '../RenderButtons';

type Props = {
  block: any;
  isAboveFold?: boolean;
}

/**
 * An ordered sequence, rendered as one.
 *
 * Written because there was nowhere good to put a process. A sequence was
 * going into either a Grid or a Tab Slider, and both of them lie about it in
 * a different way. A grid says these things happen at the same time, which is
 * the one thing a process does not do. The tab slider says only the step you
 * are looking at matters: it is a horizontal carousel that holds inactive
 * panels at `opacity: .15`, so five steps arrive as one readable panel and
 * four grey ghosts, and it deliberately bleeds off the right edge, which is
 * fine for a services showcase and wrong in the middle of an article.
 *
 * So the order is carried by the markup rather than by the styling: a real
 * `<ol>`, whose numbers come from a CSS counter rather than from text in the
 * DOM. Everything is on screen at once and everything is in the document, so
 * a reader can see the shape of the process without clicking, and a crawler
 * reads all of it without running anything. That also makes the block a
 * direct match for HowTo schema, which is the reason it is worth having on an
 * article page at all.
 *
 * Media is optional per step, and the block has to look deliberate without
 * it - most processes are described rather than illustrated, and a step block
 * that only works with a picture per step is a step block nobody can use.
 */
export default function Steps({ block, isAboveFold }: Props) {
  const { content: { contentAbove, items, buttons }, settings, media } = block;
  const {
    responsiveHeight,
    overlayJSX,
    contentSize,
    getComposedClassNames,
    contentPositionClass,
    buttonPosition,
    overlayTextClass,
    sectionSize,
    notContained,
    buttonType,
    borderStyle,
    manualSpacingStyle,
    customBackgroundColorStyle,
    gapStyles,
  } = useRenderSettings(block);

  const steps = Array.isArray(items) ? items : [];
  const parser = Parser();

  return (
    <section
      className={`user-website-steps ${getComposedClassNames()} ${contentPositionClass} ${overlayTextClass}`}
      style={{
        ...(notContained && sectionSize),
        ...borderStyle,
        ...manualSpacingStyle,
        ...customBackgroundColorStyle,
        ...gapStyles,
        minHeight: responsiveHeight,
      }}
    >
      <div className="grid-wrapper" style={{ ...(contentSize) }}>
        <div className="content-wrapper">
          {contentAbove && <div className="content-above">{parser.parse(contentAbove)}</div>}

          {steps.length > 0 && (
            <ol className="steps-list">
              {steps.map((step: any, index: number) => (
                <li className="step" key={index}>
                  <div className="step-body">
                    <div className="step-text">
                      {step.title && <h4>{parser.parse(step.title)}</h4>}
                      {step.content && parser.parse(step.content)}
                    </div>
                    {step.media && (
                      <div className="step-media">
                        <ProcessMedia
                          media={step.media}
                          sizes="(max-width: 768px) 100vw, 320px"
                          priority={isAboveFold && index === 0}
                        />
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}

          <RenderButtons
            buttons={buttons}
            buttonPosition={buttonPosition}
            contrastButtonType={buttonType}
            sectionBackground={settings?.backgroundColor}
          />
        </div>
      </div>
      {media && (
        <div className="media-wrapper">
          {overlayJSX}
          <ProcessMedia media={media} opacity={settings?.opacityPercent} sizes="100vw" priority={isAboveFold} isBackground />
        </div>
      )}
    </section>
  );
}
