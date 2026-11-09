import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import ProcessMedia from '../ProcessMedia';
import { PhoneIcon as Phone, EmailIcon as Email } from '../../assets/icons';
import { evaluateLogoTextContrast } from '../../helpers/ContrastEvaluators';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  state: any
}

export default function MobileMenu({
  isOpen,
  onClose,
  state,
}: MobileMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [openDropdowns, setOpenDropdowns] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';

      // Focus first interactive element
      const firstFocusable = menuRef.current?.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ) as HTMLElement;
      firstFocusable?.focus();
    } else {
      document.body.style.overflow = '';
      previousFocusRef.current?.focus();
      setOpenDropdowns([]); // Reset dropdowns when menu closes
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const toggleDropdown = (linkId: string, e: React.MouseEvent) => {
    e.preventDefault();
    setOpenDropdowns(prev =>
      prev.includes(linkId)
        ? prev.filter(id => id !== linkId)
        : [...prev, linkId]
    );
  };

  return (
    <div
      ref={menuRef}
      className={`mobile-menu ${isOpen ? 'is-open' : ''}`}
    >
      <div className="mobile-menu-container">
        <div className="mobile-menu-header">
          <button
            type="button"
            onClick={onClose}
            className="mobile-menu-close"
            aria-label="Close menu"
          >
            <div className="mobile-menu-close-bar"></div>
            <div className="mobile-menu-close-bar"></div>
          </button>
        </div>

        {(() => {
          // Check if text logo needs contrast adjustment (only when no image logo)
          const needsLogoContrast = !state?.website?.global_logo && state?.website?.colors?.headerBackground && state?.website?.colors?.headerText
            ? evaluateLogoTextContrast(
                state.website.colors.headerBackground,
                state.website.colors.headerText,
                state.website.colors
              ).needsContrast
            : false;

          return (
            <Link
              href="/"
              className={`mobile-menu-logo-wrapper ${needsLogoContrast ? 'logo-contrast' : ''}`}
              // An image logo gives the link no accessible text of its own.
              aria-label={state?.website?.company ? `${state.website.company} home` : 'Home'}
            >
              {state?.website?.global_logo ? (
                <ProcessMedia
                  media={state?.website?.global_logo}
                  className="mobile-menu-logo"
                  sizes="200px"
                />
              ) : (
                <p className="mobile-menu-company">{state?.website?.company}</p>
              )}
            </Link>
          );
        })()}
        <nav className="mobile-menu-nav">
          {state?.website?.header?.links?.map((link: any, linkIdx: number) => {
            const hasDropdown = link?.dropdownLinks?.length > 0;
            const isDropdownOpen = openDropdowns.includes(link.id);
            const linkKey = link?.id ?? `${link?.href || ''}-${link?.text || ''}-${linkIdx}`;

            if (hasDropdown) {
              return (
                <div
                  key={`mobile-dropdown-${linkKey}`}
                  className={`mobile-menu-dropdown ${isDropdownOpen ? 'is-open' : ''}`}
                >
                  <div className="mobile-menu-link-wrapper">
                    <Link
                      href={link.href || '#'}
                      className="mobile-menu-link"
                      onClick={(e) => toggleDropdown(link.id, e)}
                    >
                      {link.text}
                    </Link>
                    <div className="arrow-wrapper">
                      <div className="arrow-left"></div>
                      <div className="arrow-right"></div>
                    </div>
                  </div>
                  <div className={`mobile-menu-dropdown-content ${isDropdownOpen ? 'is-open' : ''}`}>
                    {link.dropdownLinks
                      .sort((a: any, b: any) => a.order - b.order)
                      .map((dropdownLink: any, ddIdx: number) => {
                        const ddKey = dropdownLink?.id ?? `${dropdownLink?.href || ''}-${dropdownLink?.text || ''}-${ddIdx}`;
                        return (
                          <Link
                            key={`mobile-dropdown-link-${ddKey}`}
                            href={dropdownLink.href || '#'}
                            className="mobile-menu-dropdown-link"
                            onClick={onClose}
                          >
                            {dropdownLink.text}
                          </Link>
                        );
                      })
                    }
                  </div>
                </div>
              );
            }

            return (
              <Link
                key={`mobile-link-${linkKey}`}
                href={link.href || '#'}
                className="mobile-menu-link"
                onClick={onClose}
              >
                {link.text}
              </Link>
            );
          })}
        </nav>

        {(state?.website?.header?.showPhone || state?.website?.header?.showEmail) && (
          <div className="mobile-menu-contact">
            {state?.website?.header?.showPhone && (state?.website?.header?.phoneOverride || state?.website?.phone) && (
              <a href={`tel:${state?.website?.header?.phoneOverride || state?.website?.phone}`} className="mobile-menu-link contact-icon" onClick={onClose}>
                <Phone className="phone-icon" />
                <span>{state?.website?.header?.phoneOverride || state?.website?.phone}</span>
              </a>
            )}
            {state?.website?.header?.showEmail && (state?.website?.header?.emailOverride || state?.website?.email) && (
              <a href={`mailto:${state?.website?.header?.emailOverride || state?.website?.email}`} className="mobile-menu-link contact-icon" onClick={onClose}>
                <Email className="email-icon" />
                <span>{state?.website?.header?.emailOverride || state?.website?.email}</span>
              </a>
            )}
          </div>
        )}

        {state?.website?.header?.ctaButton && (
          <Link
            href={state?.website?.header?.ctaButton.link || '#'}
            className="mobile-menu-cta btn"
            {...state?.website?.header?.ctaButton.open_new_tab ? { target: '_blank', rel: 'noopener noreferrer' } : {}}
            onClick={onClose}
          >
            {state?.website?.header?.ctaButton.text}
          </Link>
        )}
      </div>
    </div>
  );
}