import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'VOID PROTOCOL',
  description: 'Choose your side. Bet your energy.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="antialiased">{children}</body>
    </html>
  )
}
