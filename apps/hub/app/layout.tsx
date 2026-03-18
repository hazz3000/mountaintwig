import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title:       'Mountain Twig Games',
  description: 'Play games. Earn coins. Challenge friends.',
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://mountaintwìggames.com'
  ),
  openGraph: {
    title:       'Mountain Twig Games',
    description: 'Play games. Earn coins. Challenge friends.',
    siteName:    'Mountain Twig Games',
    type:        'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  )
}
