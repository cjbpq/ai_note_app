import Link from "next/link"
import Image from "next/image"
import { APP_CONFIG } from "@/lib/config"

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

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-secondary/50 border-t border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo 和产品名 */}
          <div className="flex items-center gap-3">
            <Image 
              src="/images/logo.png" 
              alt="邮雁智记 Logo" 
              width={40} 
              height={40}
              className="rounded-lg"
            />
            <div>
              <h3 className="font-semibold text-foreground">{APP_CONFIG.name}</h3>
              <p className="text-sm text-muted-foreground">AI+智慧笔记</p>
            </div>
          </div>

          {/* 链接 */}
          <div className="flex items-center gap-6">
            <Link 
              href={APP_CONFIG.GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <GitHubIcon className="w-5 h-5" />
              <span className="text-sm">GitHub</span>
            </Link>
            <Link 
              href={APP_CONFIG.GITHUB_RELEASES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              下载
            </Link>
          </div>
        </div>

        {/* 版权信息 */}
        <div className="mt-8 pt-6 border-t border-border text-center">
          <p className="text-sm text-muted-foreground">
            &copy; {currentYear} {APP_CONFIG.name}. 开源项目，遵循 MIT 协议。
          </p>
        </div>
      </div>
    </footer>
  )
}
