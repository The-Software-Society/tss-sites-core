/**
 * The site's Google Fonts URL, and the woff2 files worth preloading.
 *
 * Lifted out of the site layout so the React render path and the static HTML
 * render path build the same <head> from one implementation. Two paths that
 * each grow their own copy of this is how a site ends up with different fonts
 * depending on which renderer answered the request.
 */
export function buildGoogleFontsUrl(
  fonts: Array<{ fontFamily: string; useCase: string }>,
  fontWeights: { title?: number; body?: number; link?: number }
): string | null {
  if (!fonts || fonts.length === 0) return null;

  const families = fonts.map(font => {
    let weight = 400;
    if (font.useCase === 'titlesFont') weight = fontWeights?.title || 400;
    else if (font.useCase === 'paragraphsFont' || font.useCase === 'bodyFont') weight = fontWeights?.body || 400;
    else if (font.useCase === 'buttonsFont') weight = fontWeights?.link || 400;
    // The stored value is a full CSS stack, not a family name. Google needs
    // just the family: passing "'Figtree', -apple-system, BlinkMacSystemFont,
    // 'Segoe UI', sans-serif" produced
    //   family='Figtree',+-apple-system,+BlinkMacSystemFont,…
    // which returns HTTP 400 and 6KB of Google's error page, as a
    // render-blocking request in the head, on every single page load. The site
    // then silently fell back to system fonts: four sites were affected,
    // including a live client whose brand serif had never once rendered.
    const family = font.fontFamily.split(',')[0].replace(/['"]/g, '').trim();
    if (!family) return null;
    return `family=${family.replace(/ /g, '+')}:wght@${weight}`;
  });

  const valid = families.filter(Boolean) as string[];
  if (!valid.length) return null;
  return `https://fonts.googleapis.com/css2?${valid.join('&')}&display=swap`;
}

const FONT_FETCH_HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' };

/**
 * Whether Google Fonts serves this family: true, false, or null when Google could not be
 * reached (unknown is not a no). Free, no key; the answer is cached for a day.
 */
export async function googleFontExists(family: string): Promise<boolean | null> {
  const name = family.replace(/['"]/g, '').trim();
  if (!name) return false;
  try {
    const res = await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(/%20/g, '+')}&display=swap`, { headers: FONT_FETCH_HEADERS, next: { revalidate: 86400 } } as RequestInit);
    if (res.ok) return true;
    return res.status === 400 ? false : null;
  } catch {
    return null;
  }
}

export async function fetchGoogleFontsCss(url: string): Promise<{ css: string; fontUrls: string[] } | null> {
  try {
    const res = await fetch(url, {
      headers: FONT_FETCH_HEADERS,
      next: { revalidate: 86400 },
    });
    let css: string;
    if (res.ok) css = await res.text();
    else {
      // Google rejects the whole request when one family in it is unknown. A theme naming a
      // font Google does not have (HS Meets, 2026-10-07) then lost every font on the site,
      // the valid ones included. Ask for each family on its own and keep the ones that load.
      const params = new URL(url).searchParams;
      const families = params.getAll('family');
      if (families.length < 2) return null;
      const sheets = await Promise.all(families.map(async (family) => {
        const one = new URL(url);
        one.search = '';
        one.searchParams.append('family', family);
        one.searchParams.set('display', params.get('display') || 'swap');
        const r = await fetch(one.toString(), { headers: FONT_FETCH_HEADERS, next: { revalidate: 86400 } } as RequestInit).catch(() => null);
        return r?.ok ? r.text() : '';
      }));
      css = sheets.filter(Boolean).join('\n');
      if (!css) return null;
    }
    // Preload the Latin face of each family, once, and nothing else.
    //
    // Google returns one @font-face per unicode subset — latin, latin-ext,
    // vietnamese, cyrillic and so on — and taking every url() from the sheet
    // preloaded all of them. On our own homepage that was eight preload tags
    // for six files, two of them duplicated, every one a high-priority request
    // competing with the LCP element for bandwidth on a throttled connection.
    // A preload that is not used before paint is worse than no preload.
    //
    // So: split into @font-face blocks, keep only the block whose unicode-range
    // covers basic Latin (U+0000-00FF), and de-duplicate what is left. Two
    // families means two files, which is what the page actually paints with.
    const blocks = css.split('@font-face').slice(1);
    const latin: string[] = [];
    for (const block of blocks) {
      const range = block.match(/unicode-range:\s*([^;]+);/)?.[1] || '';
      // No unicode-range at all means a single-subset face, which is wanted.
      if (range && !/U\+0{0,3}0-0{0,2}FF/i.test(range) && !/U\+0000/i.test(range)) continue;
      const url = block.match(/url\((https:\/\/fonts\.gstatic\.com[^)]+\.woff2)\)/)?.[1];
      if (url) latin.push(url);
    }
    const all = [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com[^)]+\.woff2)\)/g)].map(m => m[1]);
    // Fall back to the old behaviour only if the parse found nothing, and cap
    // it so a malformed sheet cannot reintroduce a wall of preloads.
    const chosen = latin.length ? latin : all.slice(0, 2);
    const fontUrls = [...new Set(chosen)];
    return { css, fontUrls };
  } catch {
    return null;
  }
}
