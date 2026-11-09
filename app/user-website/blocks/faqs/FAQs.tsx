'use client';
import React, { useState } from 'react';
import { Parser } from 'html-to-react';
import './faq.scss';
import { useRenderSettings } from '../../hooks/useRenderSettings';
import ProcessMedia from '@/app/user-website/blocks/ProcessMedia';

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const MinusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

type Props = {
  block: any;
  state: any;
  dispatch: React.Dispatch<any>;
  isAboveFold?: boolean;
}

const getColorValue = (color: string) => {
  if (!color) return undefined;
  if (color === 'transparent') return 'transparent';
  return color.startsWith('#') ? color : `var(--color-${color.toLowerCase()})`;
};

const getShadowColorValue = (color: string) => {
  if (!color || color === 'transparent') return null;
  if (color.startsWith('#')) {
    const hex = color.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `${r}, ${g}, ${b}`;
  }
  return `var(--color-${color.toLowerCase()}-rgb)`;
};

export default function FAQs({ block, state, dispatch, isAboveFold }: Props) {
  const { content: { contentAbove, items }, settings, media } = block;
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const htmlParser = Parser();

  const {
    responsiveHeight,
    overlayJSX,
    typeClass,
    contentSize,
    getComposedClassNames,
    noContainers,
    contentPositionClass,
    overlayTextClass,
    sectionSize,
    notContained,
    borderStyle,
    manualSpacingStyle,
    customBackgroundColorStyle
  } = useRenderSettings(block);

  const layout = settings?.layout || 'Default';

  const handleQuestionClick = (index: number) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveIndex(prevIndex => prevIndex === index ? null : index);
  };

  const handleAnswerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const faqItemStyle: React.CSSProperties = {};
  const bgColor = getColorValue(settings?.faqItemBackgroundColor);
  if (bgColor) faqItemStyle.backgroundColor = bgColor;

  const borderColor = getColorValue(settings?.faqItemBorderColor);
  if (borderColor) {
    faqItemStyle.borderColor = borderColor;
    faqItemStyle.borderStyle = 'solid';
    faqItemStyle.borderWidth = `${settings?.faqItemBorderThickness || 1}px`;
  }

  if (settings?.faqItemShadowColor === 'transparent') {
    faqItemStyle.boxShadow = 'none';
  } else {
    const shadowRgb = getShadowColorValue(settings?.faqItemShadowColor);
    if (shadowRgb) {
      faqItemStyle.boxShadow = `0 4px 12px rgba(${shadowRgb}, 0.15)`;
    }
  }

  const hasItemStyling = !!(settings?.faqItemBackgroundColor || settings?.faqItemBorderColor || settings?.faqItemShadowColor);
  const applyItemStyle = layout === 'Cards' || layout === 'Side by Side';

  const iconColorStyle: Record<string, string> = {};
  if (settings?.faqIconColor) {
    const iconColor = getColorValue(settings.faqIconColor);
    if (iconColor) iconColorStyle['--faq-icon-color'] = iconColor;
  }

  const renderDefault = () => (
    <div className="faq-blocks faq-layout-default">
      {items.map((faq: any, index: number) => (
        <div
          key={index}
          className={`faq-box ${activeIndex === index ? 'active' : ''}`}
        >
          <div className="faq-question-wrapper" onClick={handleQuestionClick(index)}>
            <h5>{htmlParser.parse(faq.question)}</h5>
            <div className="openclose">
              {activeIndex === index ? <MinusIcon /> : <PlusIcon />}
            </div>
          </div>
          <div className="faq-content" onClick={handleAnswerClick}>
            {htmlParser.parse(faq.answer)}
          </div>
        </div>
      ))}
    </div>
  );

  const renderCards = () => (
    <div className="faq-blocks faq-layout-cards">
      {items.map((faq: any, index: number) => {
        const isActive = activeIndex === index;
        return (
          <div
            key={index}
            className={`faq-card ${isActive ? 'active' : ''}`}
            style={applyItemStyle ? faqItemStyle : undefined}
          >
            <div className="faq-question-wrapper" onClick={handleQuestionClick(index)}>
              <h5>{htmlParser.parse(faq.question)}</h5>
              <div className="faq-icon-circle">
                {isActive ? <ChevronDownIcon /> : <PlusIcon />}
              </div>
            </div>
            <div className="faq-content" onClick={handleAnswerClick}>
              {htmlParser.parse(faq.answer)}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderSideBySide = () => (
    <div className={`faq-blocks faq-layout-side-by-side ${hasItemStyling ? 'styled-items' : ''}`}>
      <div className="faq-side-left">
        {contentAbove && htmlParser.parse(contentAbove)}
      </div>
      <div className="faq-side-right">
        {items.map((faq: any, index: number) => (
          <div
            key={index}
            className={`faq-box ${activeIndex === index ? 'active' : ''}`}
            style={applyItemStyle ? faqItemStyle : undefined}
          >
            <div className="faq-question-wrapper" onClick={handleQuestionClick(index)}>
              <h5>{htmlParser.parse(faq.question)}</h5>
              <div className="openclose">
                {activeIndex === index ? <MinusIcon /> : <PlusIcon />}
              </div>
            </div>
            <div className="faq-content" onClick={handleAnswerClick}>
              {htmlParser.parse(faq.answer)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderNumbered = () => (
    <div className="faq-blocks faq-layout-numbered">
      {items.map((faq: any, index: number) => (
        <div key={index} className="faq-numbered-item">
          <span className="faq-number">{String(index + 1).padStart(2, '0')}</span>
          <div className="faq-numbered-spacer" />
          <h5 className="faq-numbered-question">{htmlParser.parse(faq.question)}</h5>
          <div className="faq-numbered-answer">
            {htmlParser.parse(faq.answer)}
          </div>
        </div>
      ))}
    </div>
  );

  const isSideBySide = layout === 'Side by Side';

  return (
    <section
      className={`faq ${getComposedClassNames()} ${contentPositionClass} ${overlayTextClass}`}
      style={{
        ...(notContained && sectionSize),
        ...borderStyle,
        ...manualSpacingStyle,
        ...iconColorStyle,
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
        <div className={`content-wrapper`}>
          {!isSideBySide && contentAbove && htmlParser.parse(contentAbove)}
          {items && items.length > 0 && (
            layout === 'Cards' ? renderCards() :
            layout === 'Side by Side' ? renderSideBySide() :
            layout === 'Numbered' ? renderNumbered() :
            renderDefault()
          )}
        </div>
      </div>
      {media &&
        <div className="media-wrapper">
          {overlayJSX}
          <ProcessMedia media={media} opacity={settings?.opacityPercent} sizes="100vw" priority={isAboveFold} />
        </div>
      }
    </section>
  );
}
