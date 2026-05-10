"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { APP_CONFIG } from "@/lib/config"

// Android 图标 SVG
function AndroidIcon({ className }: { className?: string }) {
  return (
    <svg 
      className={className} 
      viewBox="0 0 24 24" 
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M17.523 15.341c-.5 0-.908.406-.908.908s.408.908.908.908.908-.406.908-.908-.408-.908-.908-.908zm-11.046 0c-.5 0-.908.406-.908.908s.408.908.908.908.908-.406.908-.908-.408-.908-.908-.908zm11.4-6.744l1.958-3.39a.408.408 0 00-.706-.408l-1.983 3.433a12.186 12.186 0 00-5.146-1.086c-1.85 0-3.591.378-5.146 1.086L4.871 4.799a.408.408 0 00-.706.408l1.958 3.39C2.638 10.449.399 14.139.399 18.444h23.202c0-4.305-2.239-7.995-5.724-9.847zM6.477 15.341c-.5 0-.908.406-.908.908s.408.908.908.908.908-.406.908-.908-.408-.908-.908-.908zm11.046 0c-.5 0-.908.406-.908.908s.408.908.908.908.908-.406.908-.908-.408-.908-.908-.908z"/>
    </svg>
  )
}

// GitHub 图标 SVG
function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg 
      className={className} 
      viewBox="0 0 24 24" 
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
    </svg>
  )
}

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <nav 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled 
          ? "bg-background/95 backdrop-blur-md shadow-sm border-b border-border" 
          : "bg-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo 和产品名 */}
          <Link href="/" className="flex items-center gap-3">
            <Image 
              src="/images/logo.png" 
              alt="邮雁智记 Logo" 
              width={40} 
              height={40}
              className="rounded-lg"
            />
            <span className="font-semibold text-lg text-foreground hidden sm:block">
              邮雁智记
            </span>
          </Link>

          {/* 右侧按钮 */}
          <div className="flex items-center gap-3">
            <Link 
              href={APP_CONFIG.GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <GitHubIcon className="w-5 h-5" />
              <span className="text-sm">GitHub</span>
            </Link>
            
            <Button asChild className="gap-2">
              <Link 
                href={APP_CONFIG.APK_DOWNLOAD_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                <AndroidIcon className="w-4 h-4" />
                <span>下载 Android 版</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  )
}
