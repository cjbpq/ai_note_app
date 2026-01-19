# AI 指令集：校园智慧笔记 App (Expo)

## 1. 核心技术栈 (严格遵守)

- **框架**: Expo (SDK 50+)
- **UI 库**: React Native Paper (Material Design 风格)
- **状态管理**: Zustand
- **导航**: Expo Router
- **存储**: AsyncStorage + SQLite
- **网络**: Axios + TanStack Query
- **图片处理**: expo-image-picker

## 2. 开发者背景（严格明确）

- 我是一名前端开发新手，能看懂基本逻辑但手写代码经验较少，对于技术栈和库的使用仅限于查阅官方文档明确大概用途，对于内在逻辑和性能等不是很清楚，所以尽量选择对新手友好易于维护的方案。
- 请在生成代码时提供关键注释，解释每一块代码的作用。
- 如果涉及复杂的原生配置，请优先使用 Expo 的自动化方案。
- 在每一次正式的交付任务时都要明确表明完成了哪些工作。
- 基于开发者的新手背景，需要在对项目进行关键决策时提出自己觉得与开发和维护优秀的代码架构上有较大缺陷的隐藏问题，以供开发者考虑和决策。
- **错误处理**: 我不知道如何优雅地处理报错。请在生成网络请求代码时，优先使用 React Query 的状态（isError, error）来处理，避免在组件中堆积过多的 `try-catch` 代码块。如果必须捕获，请使用全局或 Service 层的统一错误处理机制。
- **防御性编程**: 在处理数组或对象时，请总是假设它们可能为空，使用可选链 `?.` 或空值合并 `??` 来防止 App 闪退。

## 3. 项目架构准则 (新手友好型)

- **组件化**: 所有的 UI 组件放在 `/components` 下。
- **功能逻辑**:
  - **API 请求**: 所有的 HTTP 请求必须要封装在 `/services` 目录下 (例如 `services/noteService.ts`)，严禁在 UI 组件中直接调用 axios。
  - **数据钩子**: 使用 React Query (TanStack Query) 将 API 请求包装成 Custom Hooks (例如 `hooks/useNotes.ts`) 供 UI 调用。
- **样式规范**:
  - **布局与主题分离**: 继续使用 `StyleSheet.create` 处理布局（margin, padding, flex），但**严禁**在 StyleSheet 中硬编码颜色。
  - **主题一致性**: 必须使用 React Native Paper 的 `useTheme()` 钩子来获取颜色（如 `theme.colors.primary`），确保换肤和暗黑模式的兼容性。
- **代码风格**: 优先使用函数式组件和 Hooks，代码要求简洁、易读。
- **i18n国际化**: 在进行任何有关代码硬编码的语言问题时优先考虑i18n，只需要完成中文zh.ts部分，英文部分后续再集中处理。
- **Mock 策略**: 虽然后端 API 已就绪，但在进行纯 UI 开发或离线调试时，代码应具备易于切换到 Mock 数据的能力（例如在 Service 层保留 Mock 开关）。
- **类型定义**: 所有的 TypeScript 接口定义 (Interfaces) 如果跨文件使用，必须放在 `/types` 目录下，保持整洁。

## 4. 当前核心目标

- 分阶段完成UI界面，拍照->上传处理->回馈笔记工作流，前后端协调整理笔记库，用户登录认证等基本功能
- 后续迭代优化UI设计，功能拓展（图片分类库），细节处理等

## 5.当前项目完成情况

- 配置完成基础的开发环境，国际化，路由结构。但缺失axios网络请求，@tanstack/react-query管理服务端状态，expo-image-picker图片选择和拍摄
