import type { Metadata } from 'next'
import './globals.css'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://an1307.vn'
const TITLE = 'An1307 — Tài Xỉu'
const DESC = 'Sản phẩm giải trí & giáo dục. Chọn ₮ hoặc Ӿ, đặt chíp ảo theo thời gian thực.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESC,
  icons: { icon: '/logo.jpg', apple: '/logo.jpg' },
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    url: SITE_URL,
    siteName: 'An1307',
    title: TITLE,
    description: DESC,
    images: [{ url: '/logo.jpg', width: 1200, height: 630, alt: 'An1307' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESC,
    images: ['/logo.jpg'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="antialiased">{children}</body>
    </html>
  )
}
