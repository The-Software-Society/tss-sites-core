import React from 'react';
import Link from 'next/link';

/**
 * A simple structured footer: the business, its main links, contact details
 * and a copyright line, using the platform's footer row/cell markup and styles.
 *
 * The platform's footer is a row/cell layout edited in the builder (logo,
 * links, contact, socials, text, copyright and map cells, plus policy links
 * generated from published legal pages). That editor is on the roadmap; until
 * then a site's footer reads `website.footer.links` and falls back to the
 * header navigation.
 */
export default function SiteFooter({ website }: { website?: any }) {
  if (!website) return null;
  const footer = website.footer || {};
  const links: Array<{ text: string; href: string; order?: number }> =
    (footer.links?.length ? footer.links : website.header?.links || [])
      .slice()
      .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
  const year = new Date().getFullYear();
  const copyright = footer.copyright || `© ${year} ${website.company || ''}`.trim();

  return (
    <footer className="contained" id="user-site-footer">
      <div className="container">
        <div className="footer-row" style={{ gap: 'var(--responsive-text-gap)', justifyContent: 'space-between' }}>
          <div className="footer-cell footer-cell--logo" style={{ gap: 'calc(var(--responsive-text-gap) / 2)' }}>
            <p><strong>{website.company}</strong></p>
            {footer.tagline && <p>{footer.tagline}</p>}
          </div>
          {links.length > 0 && (
            <nav className="footer-cell footer-cell--links" aria-label="Footer">
              <div className="footer-links-wrapper">
                <div className="footer-links-list column">
                  {links.map((link, i) => (
                    <Link key={`${link.href}-${i}`} href={link.href || '/'} className="footer-link">{link.text}</Link>
                  ))}
                </div>
              </div>
            </nav>
          )}
          {(website.phone || website.email || website.address) && (
            <div className="footer-cell footer-cell--contact">
              <div className="footer-contact-items">
                {website.address && <p className="contact-item">{website.address}</p>}
                {website.phone && <a className="contact-item" href={`tel:${String(website.phone).replace(/[^0-9+]/g, '')}`}>{website.phone}</a>}
                {website.email && <a className="contact-item" href={`mailto:${website.email}`}>{website.email}</a>}
              </div>
            </div>
          )}
        </div>
        <div className="footer-row">
          <div className="footer-cell footer-cell--copyright">
            <p>{copyright}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
