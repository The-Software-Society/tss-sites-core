'use client'

import { useMemo } from 'react'

type Props = {
  cssContent: string
}

/** Site CSS must accompany the server markup, before the first paint.
 * Installing it in an effect briefly rendered every custom page without its
 * layout or colour tokens. A React-owned style also updates and cleans up in
 * the editor without a second, imperative copy in document.head.
 */
export default function CustomCSS({ cssContent }: Props) {
  const css = useMemo(() => ({
    // Do not allow a literal HTML closing tag to end the SSR style element.
    __html: (cssContent || '').replace(/<\/style/gi, '<\\/style'),
  }), [cssContent])

  if (!cssContent?.trim()) return null
  return <style id='custom-site-css' dangerouslySetInnerHTML={css} />
}
