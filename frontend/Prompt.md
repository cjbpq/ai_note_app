# Commander Prompt:

Command:
“请基于 copilot-instructions.md 中的架构规范执行任务。

架构检查：涉及数据操作时，请确保 Types -> Service (Mock) -> Hooks -> UI 的实现顺序。
规范检查：所有文本提取到 i18n，所有配置提取到 constants，所有颜色使用 theme。
任务目标：[在这里填入你今天要做的具体功能...]”

# 其他规范prompt示例：

“创建一个保存按钮。

文字内容：请在 zh.ts 中添加 key common.save，并在组件中使用 i18n.t 调用。
交互配置：点击时的透明度请应用 APP_CONFIG.ACTIVE_OPACITY。
样式：颜色使用 theme.colors.primary。”

“使用 useNotes.ts 里的 addNote 方法，帮我在 index.tsx 做一个添加笔记的按钮和简单表单。” ——————有功能要求但缺少一定的UI规范

# 四步走策略（架构分离）：

- 第一步：**定义数据 (Types)**:“我要做一个‘添加笔记’功能。请先在 index.ts 中帮我定义 Note 的接口，包含标题、内容、图片数组、创建时间。”
- 第二步：**打通后厨 (Services)**:“请在 api.ts 中添加 createNote 函数，发送 POST 请求。同时在 database.ts 中添加 insertNote 函数用于离线存储。”
- 第三步：**封装逻辑 (Hooks)** —— 这是最关键的一步:“创建一个 useCreateNote 的 Custom Hook。使用 React Query 的 useMutation。

要求 1: 成功(onSuccess)后，让 queryClient 自动刷新笔记列表。
要求 2: 如果网络请求失败，尝试存入 SQLite（如果有离线需求）或返回错误。”

- 第四步：**构建界面 (UI)**:“现在帮我修改 index.tsx。添加一个悬浮按钮 FAB，点击跳转到新建页。在新建页使用刚才的 useCreateNote hook 来提交数据。UI 风格参考 Material Design。”


## 任务目标
[简述要做什么]

## 当前上下文
- 相关文件路径：[xxx]
- 依赖的类型定义：[xxx]
- 需要调用的 Service/Hook：[xxx]

## 具体要求
1. [要求1]
2. [要求2]
3. 遵循 Instructions 中的 [xxx] 规范

## 验收标准
- [ ] TypeScript 编译无错误
- [ ] 遵循主题颜色规范
- [ ] 添加关键注释


## 代码审查清单
## 必查项 ✅
- [ ] 是否有硬编码的中文字符？→ 改用 i18n
- [ ] 是否有硬编码的颜色值？→ 改用 useTheme()
- [ ] 是否在组件内直接调用 axios？→ 应该调用 Hook
- [ ] 是否有 `any` 类型？→ 应该明确类型
- [ ] 数组/对象访问是否用了 `?.` 和 `??`？

## 可选项 ⚡
- [ ] 有没有添加关键注释？
- [ ] 组件是否可复用？
- [ ] 样式是否分离到 StyleSheet？