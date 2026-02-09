# 🛠️ 项目开发日志 (Dev Log)

> 记录项目的核心变更、架构决策与每日进展。

## 📅 2026-02-04 | 核心架构重构与稳健性升级 (Phase 1 Refactoring)

本日重点完成了核心链路的稳健性升级（鉴权、错误处理）以及 UI/架构的规范化重构。

### 1. 🏗️ 架构重构 (Architecture & Refactoring)

- **组件拆分与解耦**:
  - 将臃肿的笔记详情页 `app/note/[id].tsx` 拆分为原子组件（`NoteImage`, `NoteMetaInfo`, `NoteEditForm`, `NoteContent`），统一归档至 `components/note/`。
  - 将编辑状态逻辑抽离至 `store/useNoteEditStore.ts`，实现视图与逻辑分离。
- **状态管理规范化**:
  - 审查并修正 `store` 层代码，确保只管理 Client State。
  - 修复 `useAuthStore` 中的硬编码 Key 和 Token 清理不彻底的问题。
  - 确保 `useScanStore` 在重置时能够完全清理图片 URI 等临时状态。

### 2. 🔐 核心服务升级 (Core Services)

- **Token 鉴权闭环**:
  - 新增 `services/tokenService.ts` 统一接管 Token 的 CRUD 操作。
  - **Axios 拦截器升级**: 实现了 `401 Unauthorized` 自动拦截 -> 调用 Refresh Token 接口 -> 静默重试原请求的完整流程。
  - 实现了 Refresh Token 失效时的安全降级策略（自动清理数据 -> 广播登出事件 -> 跳转登录页）。
- **事件驱动解耦**: 引入 `EventEmitter` 处理 Service 层到 UI 层的跳转通知，避免循环依赖。

### 3. 🧩 UI/UX 体验优化 (User Experience)

- **全局反馈系统**:
  - 废弃原生 `Alert`，引入 React Native Paper 的 `Snackbar` 组件。
  - 构建 `useToastStore` + `GlobalSnackbar` 方案，支持全局无侵入式调用成功/失败/警告提示。
- **防丢数据机制**:
  - 实现**草稿自动保存**：编辑中途退出自动写入 `AsyncStorage`。
  - 实现**草稿恢复检测**：再次进入编辑页时智能提示恢复历史草稿。
- **通用状态组件**: 封装统一的 `LoadingScreen` 和 `ErrorScreen`，提升应用一致性。
- **界面细节**: 优化笔记列表卡片展示，去除冗余的预览文本。

### 4. 📝 关键新增/变更文件

- `services/tokenService.ts`: Token 管理服务
- `components/common/GlobalSnackbar.tsx`: 全局通知组件
- `hooks/useToast.ts`: Toast 调用钩子
- `components/note/*`: 笔记详情页拆分组件

## 2026-02-05 ~ 2026-02-07 | 结构化笔记引擎与数学渲染升级 (Structured Note & Math Engine)

本阶段完成了笔记详情页的深度重构（从纯文本转向结构化数据展示），并彻底解决了数学公式渲染的离线化与稳定性问题，同时补充了注册与收藏功能。

### 1. 结构化笔记重构 (Structured Note Engine)

> 完成 Phase 1-4 全链路开发，对接 NoteResponse.structured_data

- **数据层升级**:
  _ **Types**: 扩展 SmartNoteData 等类型定义，Schema v3 迁移（新增 16 列）。
  _ **Service**: 实现
  ormalizeStructuredData (snakecamelCase) 及全字段映射，支持 API 格式互转。
- **UI 组件化 (components/note/)**:
  - 拆分出 NoteSummaryCard (摘要), NoteKeyPoints (要点), NoteSections (章节), NoteStudyAdvice (建议) 等 10+ 个独立组件。
  - **混合渲染策略**: 优先展示结构化组件，缺失时自动兜底显示原始 Markdown 文本。
  - **编辑模式适配**: 编辑状态下自动隐藏结构化组件，仅保留元数据编辑。
- _(后续迭代)_: 结构化内容的直接编辑功能（目前仅支持元数据编辑）。

### 2. 数学公式离线渲染 (Math Integration)

- **零 CDN 依赖**:
  - 将 Markdown 解析迁移至本地 (marked)。
  - KaTeX CSS/JS/auto-render 实现本地化内联 (constants/mathAssets.ts)，消除白屏问题。
- **渲染稳定性增强**:
  - 实现公式预处理（保护 LaTeX 分隔符）。
  - **统一渲染**: 标题与正文共用 WebView 渲染管道，支持标题含公式。
  - 优化块级公式横向滚动与字号自适应。
- _(后续计划)_: **P0级** - KaTeX 字体文件 Base64 内联（目前字体仍需首次联网请求）；MathJax v3 SVG 方案评估。

### 3. 新特性与业务完善 (New Features)

- ** 收藏功能 (Favorites)**:
  - 实现了全链路数据流（API + Local Cache + UI）。
  - 添加乐观更新 (Optimistic Update) 体验，无延迟切换状态。
  - _(后续计划)_: 独立的收藏列表页；is_favorite 字段的离线数据库同步。
- ** 用户认证 (Auth)**:
  - 完成注册页面表单 UI 及 app/login.tsx 跳转逻辑。

### 4. 基础设施优化 (Infrastructure)

- **数据一致性**: 审查本地数据库缓存逻辑，确保删除 API 优先操作本地缓存。
- **国际化**: 扩展
  oteDetail 相关 8+ 个 i18n 键值，涵盖所有新组件。

### 5. 关键新增/变更文件

-     ypes/index.ts: 结构化笔记类型定义
- services/noteService.ts: 结构化数据映射与转换
- components/note/\*.tsx: 全套结构化展示组件
- components/MathWebView.tsx: 升级版数学渲染容器
- constants/mathAssets.ts: 本地化 KaTeX 资源

## 📅 2026-02-09 | EAS Build 配置落地 (Pre-MVP Release Setup)

本日完成了 EAS Build 前的关键配置落地，目标是让云端构建可重复、环境变量可控，并为后续上架流程打好基础。

### 1. EAS 构建配置

- 新增 `eas.json`：提供 development / preview / production 三套 profile。
- 环境变量注入：在各 profile 中显式设置 `EXPO_PUBLIC_API_URL` 与 `EXPO_PUBLIC_USE_MOCK=false`，避免云端构建时回落到 localhost。
- Android：全 profile 使用 `apk` 构建类型。由于目前主攻国内市场和手动分发验证，放弃 Google Play 专用的 AAB 格式，采用兼容性最广的 APK。
- iOS：由于当前缺少 iOS 真机，development/preview 先使用 simulator 构建用于基础验证（后续再补齐真机调试与发布流程）。

### 2. 应用标识与基础信息

- 更新 app 名称：SnapNote邮雁智记
- 更新 slug：snap-note
- 设置包名/标识符：Android `com.cjbghy.smartnote` + iOS `com.cjbghy.smartnote`
- 设置 scheme：snapnote（为后续深链/路由留好基础）

### 3. 新架构开关决策

- 将 `newArchEnabled` 设置为 `false`（偏向 MVP 稳定性，降低原生兼容风险放大）。 由于eas build报错限制,重新改为 ` true`
- TODO：未来如需开启新架构，将单独做一次真机回归与 EAS 构建验证。

## 📅 2026-02-09 | 首次生产环境构建成功 (First Success Build)

### 1. 构建成果

- **Android APK**: 经过网络代理调试与 `.easignore` 优化，成功产出第一个生产环境 APK。
- **环境验证**: 确认 Managed Workflow 模式下无需本地保留 `android/ios` 目录，构建逻辑完全托管于 EAS 云端。

### 2. 关键优化点

- **瘦身上传**: 通过 `.easignore` 过滤掉 2MB+ 的非必要文件，极大提升了国内网络环境下的上传成功率。
- **配置固化**: 完成了 `app.json` 与 `eas.json` 的基准配置，后续发版将直接沿用此套逻辑。
- **网络安全性修复**: 针对 Android 生产环境默认禁止 HTTP 的限制，引入 `expo-build-properties` 开启 `usesCleartextTraffic`，解决生产包对接 IP 后端时的 Network Error 问题。

##  2026-02-08 ~ 2026-02-09 | 产品化体验冲刺与功能补全 (Polish & Features Coverage)

在生产包构建之前，为了确保 App 具备基本可用的产品形态，进行了密集的 UI 细节打磨与缺失功能补全。

### 1.  拍照与媒体流程 (Camera & Media)
*   **拍照双入口**: 改造首页 Header，分离「拍照」与「相册」入口，满足即时记录需求。
*   **权限分级**: 基于 useImagePicker 实现了相册与相机权限的按需申请，并配置了符合 Store 规范的权限说明文案 (iOS/Android)。
*   **参数标准化**: 统一图片压缩质量、格式与裁剪比例，平衡上传体积与识别清晰度。

### 2.  UI/UX 深度打磨 (Polish)
*   **深色模式 (Dark Mode)**: 实现了基于 React Native Paper Theme 的深色模式切换，完成了 Store 持久化与 Root Provider 注入。
*   **视觉一致性**:
    *   底部 TabBar 与顶部 Header 颜色跟随主题，消除原生组件的突兀感。
    *   移除首页与阅读页多余的 Stack Header，利用 SafeAreaView 精细控制布局。
*   **交互修复**:
    *   修复了扫描结果页预览过长导致保存按钮无法点击的阻塞 bug。
    *   修复了且优化了取消保存的逻辑闭环。

### 3.  关键 Bug 修复 (Critical Fixes)
*   **多账号数据隔离**:
    *   修复了切换账号后本地数据残留的问题。
    *   方案：React Query Key 注入 userId + 登出时强制清理 SQLite 与内存缓存，彻底杜绝串号风险。
*   **Toast 优化**: 修复了保存成功后 Toast 不显示的问题。

### 4.  数学渲染最终章 (Math Finalization)
*   **P0 级离线化**: 编写 scripts/generate-math-assets.mjs 脚本，将 KaTeX 字体文件转为 Base64 并内联到 CSS 中，实现了真正的 **Zero-Network** 启动与渲染。
