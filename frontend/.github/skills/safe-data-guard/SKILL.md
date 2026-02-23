---
name: safe-data-guard
description: 统一处理不可信数据的防御性编程技能；在进入 UI 渲染前完成数组/章节归一化，避免 map/filter/spread 引发闪退
---

# safe-data-guard

## 1) 这个 Skill 解决什么问题

当数据来自 API、AsyncStorage、路由参数、历史草稿或 unknown 输入时，字段可能出现类型漂移（例如期望 `string[]` 实际却是 `null`、`string` 或对象）。

这个 Skill 的目标是：

- 在 **Service/Hooks** 先归一化，再交给 UI；
- 统一复用 `utils/safeData.ts`，避免页面里重复手写 `Array.isArray(...)`；
- 让 `map/filter/spread` 前的数据总是“可安全操作”。

---

## 2) 触发条件（看到这些就应该启用）

满足任意一条即可启用：

1. 代码即将对外部数据执行 `map/filter/spread/length`。
2. 新增或修改了 `structuredData` / `tags` / `warnings` / `sections` 等数组字段。
3. UI 层接收的数据来源不是本地常量（如服务端响应、缓存、路由、草稿恢复）。
4. 发现页面中出现重复的 `Array.isArray(...)` + 过滤逻辑。

---

## 3) 执行步骤（严格顺序）

1. **定位风险点**
   - 搜索 `map(`、`...`（spread）、`.length`、可疑数组字段访问。
2. **优先使用现有工具函数**
   - `toSafeStringArray`
   - `toOptionalSafeStringArray`
   - `toSafeSections`
   - `toOptionalSafeSections`
3. **决定放置层级**
   - 优先放在 Service/Hooks。
   - UI 只保留轻量兜底，避免把清洗逻辑散落在页面里。
4. **统一风格收敛**
   - 同模块里出现相同问题时一次性收敛，不留“半旧半新”写法。
5. **同步记录**
   - 在 TODO 里写明：本次完成重点 + 后续注意事项。

---

## 4) 约束与禁忌

- 禁止在多个页面复制粘贴同类判空逻辑。
- 禁止 UI 层直接对 unknown 数据做 `map/spread`。
- 不要为了防御性改动引入新业务行为（如改变排序、去重策略、文案逻辑）。
- 不要跨层越级（UI 直连 Service 内部实现细节）。

---

## 5) 产出验收标准

完成后必须满足：

- 所有新增/修改路径都能解释“为什么这里使用 safeData”。
- 诊断无新增 TypeScript 错误。
- TODO 已补充本次条目（完成项 + 遗留项）。
- Android/iOS 兼容性结论明确（通常为“无平台差异”）。

---

## 6) 快速决策表（何时用哪个）

- 需要得到稳定 `string[]`：`toSafeStringArray`
- 需要“空即缺省”（返回 `undefined`）：`toOptionalSafeStringArray`
- 需要章节数组（heading/content）：`toSafeSections`
- 需要章节“空即缺省”：`toOptionalSafeSections`

---

## 7) 示例（文字说明，不放大段模板代码）

- Service 解析后端 `structured_data.meta.warnings`：使用 `toOptionalSafeStringArray`。
- UI 渲染 tags 芯片前：使用 `toSafeStringArray`，再 `map`。
- 章节渲染组件收到 `sections?: unknown`：先 `toSafeSections`，空数组直接不渲染。

---

## 8) 与项目规则的关系

该 Skill 与项目的“防御性工具复用（强制）”一致：

- 新增同类工具优先放在 `utils/safeData.ts`；
- 优先复用，不重复造轮子；
- 当需求涉及 Settings/Scan/Auth 也同样适用。
