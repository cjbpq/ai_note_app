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
-  **注释规范**：请在生成代码时提供关键注释，解释每一块代码的作用。
- 如果涉及复杂的原生配置，请优先使用 Expo 的自动化方案。
-  **交付要求**：在每一次正式的交付任务时都要明确表明完成了哪些工作。
-  **预先感知**：基于开发者的新手背景，需要在对项目进行关键决策时提出自己觉得与开发和维护优秀的代码架构上有较大缺陷的隐藏问题，以供开发者考虑和决策。
- **错误处理**: 我不知道如何优雅地处理报错。请在生成网络请求代码时，优先使用 React Query 的状态（isError, error）来处理，避免在组件中堆积过多的 `try-catch` 代码块。如果必须捕获，请使用全局或 Service 层的统一错误处理机制。
- **防御性编程**: 在处理数组或对象时，请总是假设它们可能为空，使用可选链 `?.` 或空值合并 `??` 来防止 App 闪退。

## 3. 项目架构与代码规范 (严格执行)

### 3.1 分层架构 (The Layered Architecture)

我们采用严格的 **UI -> Hooks -> Services** 单向依赖架构，严禁越级调用。

1.  **UI 层 (Components/Screens)**:
    - **职责**: 只负责渲染界面和响应用户交互。
    - **禁忌**: 严禁直接调用 `axios` 或数据库 SQL。严禁处理复杂的业务逻辑。
    - **数据来源**: 必须且只能通过 Custom Hooks (如 `useNotes`) 获取数据。

2.  **Hooks 层 (`/hooks`)**:
    - **职责**: 作为 UI 和 Service 的中间人 (ViewModel)。
    - **实现**: 使用 **Tanstack Query** (`useQuery`, `useMutation`) 管理服务端状态（缓存、自动刷新）。
    - **规范**: 对应每个业务模块创建一个 Hook 文件，如 `useNotes.ts`。

3.  **Service 层 (`/services`)**:
    - **职责**: 处理纯粹的数据请求（API 调用、数据库读写）。
    - **规范**: 函数必须是无状态的 `async` 函数。支持 Mock 模式切换。

4.  **Store 层 (`/store`)**:
    - **职责**: 使用 **Zustand** 管理**纯客户端状态**（如：用户偏好、搜索框文字、UI 开关）。
    - **禁忌**: 不要用 Zustand 存储从服务器拉取的业务数据（交给 React Query）。

### 3.2 编码规范

- **常量管理**:
  - 业务逻辑中的“魔术数字”和配置项（如超时时间、最大字符限制）必须提取到 `/constants/config.ts` 的 `APP_CONFIG` 中。
  - 路由名称等固定值应定义在 `constants` 中。
  - 敏感信息（API URL, Keys）必须走 `.env` 环境变量。

- **i18n 国际化**:
  - UI 中**严禁**硬编码任何中文字符串。
  - **流程**: 新增文本 -> 在 `i18n/zh.ts` 添加 Key -> 在组件中使用 `i18n.t('key')`。

- **类型定义**:
  - 所有的 TypeScript 接口 (Interfaces) 必须定义在 `/types/index.ts` 中，禁止在组件内部散乱定义。

- **样式与主题**:
  - 布局使用 `StyleSheet.create`。
  - 颜色必须使用 `useTheme()` 获取，严禁硬编码 hex 颜色值。

- **代码风格**:
  - 项目使用Prettier和ESLint进行代码格式化和检查，所有生成的代码必须符合.prettierrc和.eslintrc的规则。

## 4. 当前核心目标

- 分阶段完成UI界面，拍照->上传处理->回馈笔记工作流，前后端协调整理笔记库，用户登录认证等基本功能
- 后续迭代优化UI设计，功能拓展（图片分类库），细节处理等

## 5.当前项目完成情况

- **已完成**:
  - 基础环境搭建 (Expo SDK 50+, TypeScript)
  - 路由结构 (Expo Router Tab + Stack)
  - 核心架构搭建:
    - Service 层 (Axios + Mock 模式)
    - Hooks 层 (React Query 封装 CRUD)
    - 常量管理 (config.ts + .env)
    - 国际化 (i18n)
  - 数据库集成 (Expo SQLite)

- **待办 (TODO)**:
  - 完善 UI 界面 (添加/编辑笔记页面)
  - 集成 expo-image-picker (拍照/选图)
  - 实现图片上传逻辑
  - 用户登录认证
