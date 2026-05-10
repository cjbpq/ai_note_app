import Link from "next/link"
import { Button } from "@/components/ui/button"
import { APP_CONFIG } from "@/lib/config"
import { InstallGuide } from "@/components/install-guide"

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

// Download 图标 SVG
function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg 
      className={className} 
      viewBox="0 0 24 24" 
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  )
}

export function DownloadSection() {
  return (
    <section id="download" className="py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-3xl bg-primary p-8 sm:p-12 overflow-hidden">
          {/* 背景装饰 */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

          <div className="relative z-10 text-center">
            {/* 标题 */}
            <h2 className="text-3xl sm:text-4xl font-bold text-primary-foreground mb-4">
              立即下载体验
            </h2>
            <p className="text-primary-foreground/80 text-lg mb-8 max-w-xl mx-auto">
              开源免费，现已支持 Android 平台。扫码或点击按钮直接下载安装。
            </p>

            {/* 下载卡片 */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 sm:p-8 max-w-md mx-auto mb-8">
              {/* Android 图标和版本 */}
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center">
                  <AndroidIcon className="w-8 h-8 text-white" />
                </div>
                <div className="text-left">
                  <h3 className="text-xl font-semibold text-white">Android 版</h3>
                  <p className="text-white/70 text-sm">{APP_CONFIG.VERSION}</p>
                </div>
              </div>

              {/* 下载按钮 */}
              <Button 
                asChild 
                size="lg" 
                variant="secondary"
                className="w-full gap-2 py-6 text-lg font-semibold"
              >
                <Link 
                  href={APP_CONFIG.APK_DOWNLOAD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <DownloadIcon className="w-5 h-5" />
                  下载 APK 安装包
                </Link>
              </Button>

              {/* 文件信息 */}
              <p className="mt-3 text-white/60 text-xs">
                文件名: {APP_CONFIG.APK_FILENAME}
              </p>

              {/* 安装指南 */}
              <InstallGuide />
            </div>

            {/* GitHub 链接 */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link 
                href={APP_CONFIG.GITHUB_RELEASES_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-primary-foreground/80 hover:text-primary-foreground transition-colors"
              >
                <DownloadIcon className="w-4 h-4" />
                <span className="text-sm">查看所有版本</span>
              </Link>
              
              <span className="hidden sm:block text-primary-foreground/40">|</span>
              
              <Link 
                href={APP_CONFIG.GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-primary-foreground/80 hover:text-primary-foreground transition-colors"
              >
                <GitHubIcon className="w-4 h-4" />
                <span className="text-sm">GitHub 仓库</span>
              </Link>
            </div>

            {/* 提示信息 */}
            <div className="mt-8 pt-6 border-t border-white/10">
              <p className="text-white/60 text-sm">
                iOS 版本正在开发中，敬请期待
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
