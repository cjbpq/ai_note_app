"use client"

import { useState, useEffect } from "react"
import { X } from "lucide-react"

export function WechatOverlay() {
  const [isWechatOrQQ, setIsWechatOrQQ] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase()
    const isWechat = ua.includes("micromessenger")
    const isQQ = ua.includes("qq/") || ua.includes("qqbrowser")
    setIsWechatOrQQ(isWechat || isQQ)
  }, [])

  if (!isWechatOrQQ || dismissed) {
    return null
  }

  return (
    <div 
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm"
      onClick={() => setDismissed(true)}
    >
      {/* 关闭按钮 */}
      <button 
        className="absolute top-4 left-4 text-white/70 hover:text-white p-2"
        onClick={() => setDismissed(true)}
      >
        <X className="w-6 h-6" />
      </button>

      {/* 右上角箭头指示 */}
      <div className="absolute top-4 right-6">
        <div className="animate-bounce">
          <svg 
            width="60" 
            height="60" 
            viewBox="0 0 60 60" 
            fill="none"
            className="text-white"
          >
            <path 
              d="M30 50 L30 15 M30 15 L15 30 M30 15 L45 30" 
              stroke="currentColor" 
              strokeWidth="3" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
            <circle 
              cx="48" 
              cy="8" 
              r="6" 
              stroke="currentColor" 
              strokeWidth="2"
              strokeDasharray="4 2"
            />
          </svg>
        </div>
      </div>

      {/* 主提示内容 */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 max-w-sm border border-white/20">
          <div className="text-white text-xl font-semibold mb-4">
            请在浏览器中打开
          </div>
          
          <div className="text-white/90 text-base mb-6 leading-relaxed">
            点击右上角 
            <span className="inline-flex items-center mx-1 px-2 py-0.5 bg-white/20 rounded text-sm font-medium">
              ···
            </span> 
            按钮
            <br />
            选择「在浏览器中打开」
          </div>

          <div className="text-white/60 text-sm mb-6">
            微信/QQ 内无法直接下载安装包
          </div>

          <div className="border-t border-white/20 pt-4">
            <span className="text-white/50 text-xs">
              点击任意位置继续浏览
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
