"use client"

import { useState } from "react"
import { HelpCircle, ChevronDown, ChevronUp, Shield, Download, Settings, CheckCircle } from "lucide-react"

export function InstallGuide() {
  const [isExpanded, setIsExpanded] = useState(false)

  const steps = [
    {
      icon: Download,
      title: "下载安装包",
      description: "点击下载按钮，等待 APK 文件下载完成"
    },
    {
      icon: Settings,
      title: "允许安装",
      description: "如提示「未知来源应用」，点击「设置」并允许此次安装"
    },
    {
      icon: Shield,
      title: "忽略风险提示",
      description: "如提示「可能存在风险」，点击「更多详情」→「仍要安装」"
    },
    {
      icon: CheckCircle,
      title: "完成安装",
      description: "安装完成后即可打开使用"
    }
  ]

  return (
    <div className="w-full max-w-md mx-auto mt-4">
      {/* 触发按钮 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors mx-auto group"
      >
        <HelpCircle className="w-4 h-4" />
        <span>首次安装遇到问题？</span>
        <span className="text-white group-hover:underline">查看安装指南</span>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>

      {/* 展开内容 */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? "max-h-[500px] opacity-100 mt-4" : "max-h-0 opacity-0"
        }`}
      >
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 border border-white/20">
          <div className="text-sm font-medium text-white mb-4">
            Android 安装步骤
          </div>
          
          <div className="space-y-4">
            {steps.map((step, index) => (
              <div key={index} className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <step.icon className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white">
                    {index + 1}. {step.title}
                  </div>
                  <div className="text-xs text-white/70 mt-0.5">
                    {step.description}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-white/20">
            <p className="text-xs text-white/60 leading-relaxed">
              由于本应用尚未上架应用商店，Android 系统会显示安全提示，这是正常现象。
              我们的应用开源在 GitHub，代码完全透明可查。
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
