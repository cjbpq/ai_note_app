const features = [
  {
    icon: (
      <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
    ),
    title: "拍照智能识别",
    description: "拍摄课堂PPT、板书、教材，AI自动识别图片内容，精准提取文字与图表信息",
    highlight: "VLM视觉语言模型"
  },
  {
    icon: (
      <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <line x1="10" y1="9" x2="8" y2="9"/>
      </svg>
    ),
    title: "结构化笔记生成",
    description: "自动将识别内容转化为结构化学习笔记，统一格式便于阅读和复习",
    highlight: "强制统一输出格式"
  },
  {
    icon: (
      <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        <line x1="12" y1="11" x2="12" y2="17"/>
        <line x1="9" y1="14" x2="15" y2="14"/>
      </svg>
    ),
    title: "自动分类归档",
    description: "根据内容智能识别学科和主题，自动将笔记归类到对应文件夹",
    highlight: "AI智能分类"
  },
  {
    icon: (
      <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="11" cy="11" r="8"/>
        <path d="m21 21-4.35-4.35"/>
      </svg>
    ),
    title: "智能语义检索",
    description: "不只是关键词匹配，而是理解你的问题语义，精准找到相关笔记内容",
    highlight: "RAG向量化检索"
  },
  {
    icon: (
      <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        <line x1="9" y1="10" x2="15" y2="10"/>
      </svg>
    ),
    title: "AI对话问答",
    description: "基于你的笔记内容进行对话，像和私人助教讨论一样获取答案",
    highlight: "Chat工具链调用"
  },
  {
    icon: (
      <svg className="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
      </svg>
    ),
    title: "复习闭环",
    description: "笔记不只是存档，内置复习提醒和知识回顾，形成学习闭环",
    highlight: "知识巩固系统"
  }
]

export function FeaturesSection() {
  return (
    <section className="py-20 bg-secondary/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 标题 */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            核心功能
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            从拍照到复习的完整闭环，让学习资料真正发挥价值
          </p>
        </div>

        {/* 功能列表 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div 
              key={index} 
              className="group p-6 rounded-2xl bg-card border border-border hover:border-accent/50 hover:shadow-lg transition-all"
            >
              {/* 图标 */}
              <div className="w-16 h-16 rounded-xl bg-accent/10 flex items-center justify-center text-accent mb-6 group-hover:bg-accent/20 transition-colors">
                {feature.icon}
              </div>

              {/* 标题 */}
              <h3 className="text-xl font-semibold text-foreground mb-2">
                {feature.title}
              </h3>

              {/* 技术标签 */}
              <span className="inline-block px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium mb-3">
                {feature.highlight}
              </span>

              {/* 描述 */}
              <p className="text-muted-foreground text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
