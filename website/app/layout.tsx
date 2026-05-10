import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: '邮雁智记 - AI+智慧笔记APP',
  description: '拍照即笔记·自动分类·可检索可复习。AI+智慧笔记APP，把课堂快照变成有效资产。',
  keywords: ['邮雁智记', 'AI笔记', '智能笔记', '学习工具', '课堂笔记', '拍照笔记'],
  authors: [{ name: '邮雁智记团队' }],
  openGraph: {
    title: '邮雁智记 - AI+智慧笔记APP',
    description: '拍照即笔记·自动分类·可检索可复习',
    type: 'website',
  },
  icons: {
    icon: '/images/logo.png',
    apple: '/images/logo.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#1e3a5f',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" className="bg-background">
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
