import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const valueProps = [
  {
    title: "可行 Feasible",
    subtitle: "技术可落地",
    icon: (
      <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
      </svg>
    ),
    points: [
      "VLM视觉语言模型，精准识别图片内容",
      "Local-first策略，平衡隐私与性能",
      "异步编排架构，保证流畅体验"
    ],
    color: "bg-blue-500/10 text-blue-600"
  },
  {
    title: "连续 Continuous",
    subtitle: "知识可积累",
    icon: (
      <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 12a9 9 0 11-6.219-8.56"/>
        <polyline points="21 3 21 9 15 9"/>
      </svg>
    ),
    points: [
      "课堂快照不再碎片化",
      "自动转化为结构化笔记",
      "形成可持续积累的知识库"
    ],
    color: "bg-teal-500/10 text-teal-600"
  },
  {
    title: "实用 Practical",
    subtitle: "学习更高效",
    icon: (
      <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
    points: [
      "大幅减少手动整理时间",
      "智能检索快速定位信息",
      "内置复习功能强化记忆"
    ],
    color: "bg-pink-500/10 text-pink-600"
  }
]

export function ValuePropsSection() {
  return (
    <section className="py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 标题 */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            邮雁智记的核心价值
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            从技术可行性到实际使用价值，我们专注于解决真实的学习痛点
          </p>
        </div>

        {/* 价值卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {valueProps.map((prop, index) => (
            <Card key={index} className="bg-card border-border hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className={`w-16 h-16 rounded-2xl ${prop.color} flex items-center justify-center mb-4`}>
                  {prop.icon}
                </div>
                <CardTitle className="text-xl">{prop.title}</CardTitle>
                <p className="text-muted-foreground text-sm">{prop.subtitle}</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {prop.points.map((point, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-accent mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      <span className="text-muted-foreground text-sm">{point}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
