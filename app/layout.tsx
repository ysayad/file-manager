import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from "@/components/ui/sonner"

export const metadata: Metadata = {
  title: 'Alienware Render Studio',
  description: 'Professional GPU-accelerated file rendering platform',
  generator: 'Next.js',
  icons: {
    icon: '/alienware-logo.svg',
    shortcut: '/alienware-logo.svg',
    apple: '/alienware-logo.svg',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
