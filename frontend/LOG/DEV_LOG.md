# 🛠️ 项目开发日志 (Dev Log)

> 记录项目的核心变更、架构决策与每日进展。

## 📅 2026-02-24 | 分类系统 MVP 全流程开发

### 1. 功能与交付

- **分类系统三屏联动**：上传页 CategoryPicker（选/建分类）、阅读页 CategoryDrawer（侧边栏筛选）、搜索页筛选增强（可折叠+Badge+FilterSummaryBar）。
- **共享数据层建设**：categoryService + useCategories Hook + noteFilters 工具函数，三屏共享同一数据源。
- **i18n 补全**：新增 ~25 个中英文 key，覆盖分类选择/Drawer/搜索/错误提示全场景。

### 2. 关键决策

- **数据策略**：纯后端聚合（GET /categories 返回去重分类名）+ 本地 AsyncStorage 暂存新建分类；无独立"创建分类" API，分类随笔记上传隐式创建。
- **Drawer 方案**：react-native-drawer-layout（轻量，无 react-native-gesture-handler/reanimated 额外依赖）。
- **筛选工具共享**：从 useSearch.ts 抽取 ~100 行 extractCategories/extractTags/filterNotes 到 utils/noteFilters.ts，search + read 共享。
- **Chip 视觉区分**：分类 Chip 方角(borderRadius:4)、标签 Chip 圆角(borderRadius:16)，增强可识别性。

### 3. 架构落点

| 层级    | 文件                                  | 职责                                     |
| ------- | ------------------------------------- | ---------------------------------------- |
| Service | `categoryService.ts`                  | 后端分类 API + 本地新建分类 CRUD         |
| Hook    | `useCategories.ts`                    | TanStack Query 合并后端+本地 + noteCount |
| Utils   | `noteFilters.ts`                      | 纯函数：分类/标签提取 + 过滤 Pipeline    |
| UI-上传 | `CategoryPicker.tsx` → `index.tsx`    | 可展开下拉 + 新建分类入口                |
| UI-阅读 | `CategoryDrawer.tsx` → `read.tsx`     | Drawer 侧边栏 + 汉堡菜单 + 副标题        |
| UI-搜索 | `FilterSummaryBar.tsx` → `search.tsx` | 可折叠筛选 + Badge + 汇总栏              |

### 4. 兼容性

- 全跨平台，无 Android/iOS 差异。react-native-drawer-layout 官方推荐，Android/iOS 一致。

### 5. 后续 TODO

- 真机测试分类全流程（上传 → Drawer 筛选 → 搜索联动）
- GET /categories API 返回格式真机验证
- 分类编辑/删除/重命名（需后端支持）
- Drawer 内收藏夹入口（待收藏系统完善）
- AI 智能分类推荐

## 📅 2026-02-22 | 搜索功能全流程打通与体验修复

### 1. 功能与交付

- **搜索功能全流程打通**：实现 6 状态搜索页、API 接入及标题关键词高亮。
- **原生崩溃修复**：修复 Android development build 删除笔记时偶发的原生崩溃（react-native-screens/native-stack 竞态）。
- **文档与规范增强**：完善 Copilot 开发指南，明确 Android 优先策略、API 错误映射表及交付审查规范。

### 2. 关键决策

- **搜索筛选**：分类/标签 Chip 暂用硬编码演示，待后端 API 升级后接入真实筛选；不新增 Store。
- **开发规范**：明确 Android 真机优先，iOS 尽量保持一致性；有不兼容需提前报出。

### 3. 架构落点

- **搜索功能**：
  - Service: `searchNotes`
  - Hook: `useSearch` + 防抖 + 状态机
  - UI: `app/search.tsx` + 4 个子组件（入口在 `app/(tabs)/read.tsx` Appbar 搜索图标）
- **错误处理规范**：明确 UI→Hooks→Services 分层下的错误解析与 toast 触发位置，减少 UI try-catch。

### 4. 兼容性与风险

- **搜索功能**：全跨平台，无 Android/iOS 差异。

### 5. 后续 TODO

- 后端支持分类/标签搜索后接入真实筛选 Chip。
- 评估是否需要搜索历史记录及摘要片段展示。
- 把 422/常见错误码映射规范逐步落实到各业务模块 Service/Hooks，并在 TODO 中持续跟踪。

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
- **iOS 兼容性增强**: 配置了 `NSAppTransportSecurity` 以允许 iOS 端访问 HTTP 后端，并调整 EAS Profile 以支持真机预览构建。

## 2026-02-08 ~ 2026-02-09 | 产品化体验冲刺与功能补全 (Polish & Features Coverage)

在生产包构建之前，为了确保 App 具备基本可用的产品形态，进行了密集的 UI 细节打磨与缺失功能补全。

### 1. 拍照与媒体流程 (Camera & Media)

- **拍照双入口**: 改造首页 Header，分离「拍照」与「相册」入口，满足即时记录需求。
- **权限分级**: 基于 useImagePicker 实现了相册与相机权限的按需申请，并配置了符合 Store 规范的权限说明文案 (iOS/Android)。
- **参数标准化**: 统一图片压缩质量、格式与裁剪比例，平衡上传体积与识别清晰度。

### 2. UI/UX 深度打磨 (Polish)

- **深色模式 (Dark Mode)**: 实现了基于 React Native Paper Theme 的深色模式切换，完成了 Store 持久化与 Root Provider 注入。
- **视觉一致性**:
  - 底部 TabBar 与顶部 Header 颜色跟随主题，消除原生组件的突兀感。
  - 移除首页与阅读页多余的 Stack Header，利用 SafeAreaView 精细控制布局。
- **交互修复**:
  - 修复了扫描结果页预览过长导致保存按钮无法点击的阻塞 bug。
  - 修复了且优化了取消保存的逻辑闭环。

### 3. 关键 Bug 修复 (Critical Fixes)

- **多账号数据隔离**:
  - 修复了切换账号后本地数据残留的问题。
  - 方案：React Query Key 注入 userId + 登出时强制清理 SQLite 与内存缓存，彻底杜绝串号风险。
- **Toast 优化**: 修复了保存成功后 Toast 不显示的问题。

### 4. 数学渲染最终章 (Math Finalization)

- **P0 级离线化**: 编写 scripts/generate-math-assets.mjs 脚本，将 KaTeX 字体文件转为 Base64 并内联到 CSS 中，实现了真正的 **Zero-Network** 启动与渲染。

## 📅 2026-02-15 | 错误处理闭环 + 表单校验 + 编辑体验 Plan B

本日围绕“错误可理解、操作可恢复、关键路径无白屏”做体验闭环：补齐 Auth/上传/详情/网络层错误提示，完善表单校验，并落地编辑模式 Plan B。

### 1. 功能与交付

- **UI 层 API 错误处理检查表**：新增可按页面验收的检查表，作为后续逐页回归的执行清单。
- **错误提示体系补全**：登录/注册、上传/生成笔记、笔记详情（403/404）、通用网络层（断网/5xx）均补齐可展示的错误提示与引导。
- **表单体验**：登录非空校验、注册强密码与重复确认，并将校验文案统一接入 i18n。
- **关键 UX 修复**：Auth 页主题一致性、Android 真机系统栏外观一致性、笔记删除成功/失败 Toast 闭环。
- **编辑体验重设计**：落地 Plan B（结构化字段轻编辑 + 章节/建议只读），并打通保存成功/失败反馈闭环。

### 2. 关键决策

- 以“页面验收清单 + 统一 toast 映射”推动错误处理落地，避免 UI 层到处散落 try-catch。
- 编辑模式采用 Plan B，优先保证预览/编辑数据源一致（均操作 structuredData），为后续 Plan B+ / Plan C 留扩展空间。

### 3. 架构落点

- **Service**：产出可映射的错误信息（i18n key/message），避免 UI 关心 axios 细节。
- **Hooks**：通过 React Query 的 isError/error 与 onError（必要时）触发 toast，保证 UI 层保持轻薄。
- **UI**：表单错误态样式（Paper TextInput error）+ ErrorScreen/返回引导 + 成功/失败反馈闭环。
- **Store**：编辑表单由 useNoteEditStore 统一承载与重置，避免组件内状态漂移。

### 4. 兼容性与风险

- Android/iOS：本次主要为通用逻辑与样式修复，无明显平台差异；已做 Android 真机回归（系统导航栏 + 键盘场景）。
- 风险：toast 高频场景仍需持续观察队列堆积与优先级策略。

### 5. 后续 TODO

- 将 422 / 常见业务错误码逐步下沉到各模块 Service/Hooks 的统一解析，减少重复映射。
- 继续推进 Plan B+（sections 可编辑）或评估 Plan C（全 Markdown 编辑器）。

## 📅 2026-02-19 | 防御性数据归一化 + 开发技能体系 + 图片裁切体验

本日聚焦“防闪退/可维护”：对 structuredData 渲染链路做防御性审查并在 Service 层归一化，同时新增两项规范化 Skill，并优化图片截取上传体验。

### 1. 功能与交付

- **防御性编程系统审查**：逐页检查 `?.` / `??` 与 map/spread 路径，重点收敛 structuredData 的数组/章节字段。
- **safeData 工具收敛**：抽取 `utils/safeData.ts`，沉淀可复用的数组/章节归一化方法，减少重复判空。
- **技能体系补全**：新增 `safe-data-guard` 与 `update-devlog` Skill，形成可重复执行的“规范→落地→验收”流程。
- **照片截取体验优化**：支持自由裁切与原图直传，优先保障 Android 可用，iOS 保持兼容（系统交互存在差异）。

### 2. 关键决策

- structuredData 的“不可信输入”优先在 Service 层做运行时归一化，UI 仅保留最小兜底，避免“到处补丁”。
- 将口头规范升级为 Skill 文档，降低后续沟通/返工成本。

### 3. 架构落点

- **Service**：noteService 增加 structured_data 归一化入口，统一清洗数组/章节。
- **UI**：涉及 map/spread 的组件路径补最小防御（可选链/空值合并/安全工具复用）。
- **Hooks**：图片选择逻辑在 useImagePicker 扩展 mode 参数，UI 仅触发并消费结果。

### 4. 兼容性与风险

- Android：支持自由裁切；iOS：使用系统裁切能力并允许原图直传（交互差异需接受）。
- 风险：后续新增字段进入 UI 前仍需强制走 Service/Hook 归一化，否则容易回归闪退。

### 5. 后续 TODO

- 将 `utils/safeData.ts` 复用扩展到 Scan/Auth/Settings 等非 Note 模块，并做最小回归检查。

## 📅 2026-02-21 | 多任务并发上传系统（从单任务阻塞到异步任务托盘）

本次完成了拍照上传→AI笔记生成工作流的全面重构：从单任务阻塞式 Modal 迁移到多任务并发上传 + 独立轮询 + 任务托盘 + 自动保存 + 角标通知的完整异步架构。

### 1. 功能与交付

- **多任务并发上传引擎**：最多 3 个任务同时上传/轮询，超出排队等待自动调度。
- **任务托盘 UI**：首页底部展示上传任务列表（缩略图 + 状态 + 操作按钮），支持最多 3 个可见项 + 滚动。
- **自动保存笔记**：任务完成后自动调用 `syncNoteToLocal` 写入 SQLite + 刷新笔记列表缓存。
- **Snackbar 通知 + 跳转**：完成时弹出 Snackbar 带"查看"按钮，一键跳转笔记详情页。
- **阅读 Tab 角标**：有未读已完成任务时在底部 Tab 显示角标数字。
- **HomeScreen 重写**：移除旧版 Modal 确认弹窗与全屏 Loading 遮罩，改为"拍照即提交、后台异步处理"的轻量体验。
- **防重复提交**：5 秒窗口内同一图片 URI 自动拦截，避免用户连续点击导致重复上传。
- **失败重试**：失败任务支持一键重试（重新发起上传 + 轮询），也可单独移除。

### 2. 关键决策

- **轮询 vs SSE**：选择轮询方案（2s 间隔 × 最多 30 次 = 60s 超时），理由是后端 SSE 接口尚需验证稳定性，轮询对新手更友好、可预期、容易调试。后续可按需迁移。
- **Session 级内存 vs 持久化**：任务状态仅存 Zustand 内存，App 杀死即清空。理由是 MVP 阶段用户理解成本低（"退出就没了"），避免引入 AsyncStorage 序列化/恢复的复杂性。
- **并发上限 3**：后端允许 10 个并发，取 3 为安全值，兼顾移动端网络带宽与用户体验。
- **旧 Hook 保留不删**：`useScanNotes.ts` 标记 `@deprecated`，暂不删除以避免隐性回归。
- **useScanStore 简化**：保留 `pickedImageUri` / `setPickedImageUri` 供 HomeScreen 和 useImagePicker 使用，扫描相关字段标记为兼容旧接口保留。

### 3. 架构落点

#### 3.1 新增文件

| 文件                                   | 层级  | 职责                                                                |
| -------------------------------------- | ----- | ------------------------------------------------------------------- |
| `store/useUploadTaskStore.ts`          | Store | 多任务 CRUD + 5 个高性能 selector（按引用稳定）                     |
| `hooks/useUploadTasks.ts`              | Hooks | 上传调度、独立轮询（ref 计时器）、自动保存、Snackbar 通知、队列推进 |
| `components/upload/UploadTaskItem.tsx` | UI    | 单任务卡片：缩略图 + 状态文字 + 操作按钮                            |
| `components/upload/UploadTaskTray.tsx` | UI    | 任务列表容器：标题 + 计数 + 清除已完成按钮                          |
| `components/upload/index.ts`           | UI    | Barrel 导出                                                         |

#### 3.2 修改文件

| 文件                        | 变更                                                                                            |
| --------------------------- | ----------------------------------------------------------------------------------------------- |
| `types/index.ts`            | 新增 `UploadTask`、`UploadTaskStatus`；`JobResponse` 增加 `file_url`/`progress_url`/`queued_at` |
| `i18n/zh.ts` + `i18n/en.ts` | 新增 `upload.task.*` 共 16 个 i18n key                                                          |
| `app/(tabs)/index.tsx`      | 全量重写：移除 Modal/Loading，接入 useUploadTasks + UploadTaskTray                              |
| `app/(tabs)/_layout.tsx`    | 阅读 Tab 增加 `tabBarBadge`（未读完成数）                                                       |
| `store/useScanStore.ts`     | 增加注释说明职责收窄，保留旧字段兼容                                                            |
| `hooks/useScanNotes.ts`     | 顶部增加 @deprecated 注释                                                                       |

#### 3.3 数据流（一次完整上传的生命周期）

```
用户拍照 → useImagePicker.setPickedImageUri
  → HomeScreen.handleUpload → useUploadTasks.submitTask(uri)
    → addTask(queued) → processQueue()
      → updateTask(uploading) → noteService.uploadImageNote(uri)
        → 后端返回 { job_id } → replaceTaskId(tempId, jobId)
          → updateTask(processing) → startPolling(jobId, 2s)
            → noteService.getJobStatus(jobId) [每 2s]
              → status === COMPLETED → stopPolling
                → noteService.getNoteById(noteId) [获取标题]
                  → noteService.syncNoteToLocal(note) [写 SQLite]
                    → queryClient.invalidateQueries(["notes"]) [刷新列表]
                      → updateTask(completed, noteId, title)
                        → showToast("笔记已就绪", action: "查看")
                          → processQueue() [推进下一个排队任务]
```

### 4. 兼容性与风险

- **Android/iOS**：本次均为纯 JS/React 层实现，无原生模块差异。`expo-image` 缩略图渲染、Expo Router 跳转均跨平台兼容。
- **风险点**：
  - 轮询计时器在 App 后台时可能被系统暂停，回到前台后会继续但可能超时 → 建议后续增加前台恢复检测
  - 当前未处理 App 卸载（`beforeremove` 事件未拦截旅途中任务的提示）→ 用户预期为"退出即丢"符合 Session 级设计

### 5. 后续 TODO

- 真机回归：Android 全链路测试（拍照 → 并发 → 轮询 → 保存 → 角标 → 跳转）
- SSE 评估：后端接口稳定后考虑替代轮询
- 任务持久化：如用户反馈需要，可增加 AsyncStorage 方案
- `useScanNotes` 清理：确认无回归后删除
- 上传进度百分比：借助 axios onUploadProgress 展示真实进度
