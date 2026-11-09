import React from 'react'
import Link from 'next/link'
import './dashboard.css'

export const metadata = {
  title: 'TSS Sites',
  description: 'Block-based sites, static export and an SEO toolkit.',
  robots: { index: false, follow: false },
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-US">
      <body>
        <div className="shell">
          <header className="topbar">
            <Link href="/" className="brand">TSS Sites</Link>
            <nav>
              <Link href="/">Sites</Link>
              <Link href="/audit">SEO audit</Link>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  )
}
