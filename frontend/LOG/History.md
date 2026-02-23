# ✅ 已完成任务历史归档 (Completed Task History)

> 本文件自动归档自 [TODO.md](TODO.md) 中已完成的项目，作为项目里程碑的详细记录。

## 📌 Phase 1: 核心链路与基础架构 (Core & Infrastructure)

### API 联调

- [x] 完善 axios 拦截器 (处理 401 未授权自动刷新/跳转登录) ✅ 2026-02-04

### 代码清理与重构 (Part 1)

- [x] UI 层重构: `app/note/[id].tsx` 拆分为 `components/note/` (Image, Meta, Edit, Content) ✅ 2026-02-04
- [x] Types 层重构: 封装规范类型并与后端严格对接
- [x] Store 层规范化 ✅ 2026-02-04
  - 修复 `useAuthStore` 硬编码 Key / Token 清理逻辑
  - 明确 Client State (Zustand) vs Server State (React Query) 边界

### 遗留项重构 (Part 1.5)

- [x] **全局反馈系统 (Snackbar)** ✅ 2026-02-04
  - 创建 `useToastStore` / `hooks/useToast` / `GlobalSnackbar`
  - 替换相关页面的 Alert 为 Snackbar
- [x] **Token 鉴权升级** ✅ 2026-02-04
  - `tokenService.ts` 统一管理
  - Axios 401 自动刷新 + 失败降级策略
  - `authEventEmitter` 解耦 Service/UI
- [x] **草稿自动保存** ✅ 2026-02-04
  - 离开编辑自动保存 / 进入编辑提示恢复
- [x] **通用状态组件** (Loading/Error Screen) ✅ 2026-02-04

## 📌 Phase 2: 功能补全与结构化笔记 (Features & Structured Note)

### 缺失功能修复

- [x] 注册流程: UI 表单 + 跳转逻辑 (`app/register.tsx`) ✅ 2026-02-05
- [x] 笔记组件: 去除列表预览文本 ✅ 2026-02-04
- [x] 本地数据库: 缓存一致性审查 (删除操作优先本地) ✅ 2026-02-07
- [x] **数学公式引擎** ✅ 2026-02-07 ~ 2026-02-08
  - Markdown 解析本地化 (marked)
  - KaTeX 资源完全内联 (CSS/JS/Fonts Base64) - **Zero CDN**
  - Android/iOS WebView 统一渲染管道 (Auto-height, Scrolling)
- [x] **收藏功能** (Favorites) ✅ 2026-02-07
  - 全链路数据流 / 乐观更新 / UI 状态切换
- [x] 笔记内容替换: 使用结构化组件替代原始文本 ✅

### 笔记详情页重构 (Structured Data)

- [x] **Phase 1 (Type/DB)**: Schema v3, SmartNote Types ✅
- [x] **Phase 2 (Service)**: Snake/Camel case mapping, JSON serialization ✅
- [x] **Phase 3 (UI)**: 10+ 结构化组件 (Summary, KeyPoints, Sections) + 国际化 ✅
- [x] **Phase 4 (Edit/Polish)**: 编辑模式适配 / UI 布局优化 / 编译验证 ✅ 2026-02-07

## 📌 Phase 3: 体验打磨与生产环境准备 (Polish & Production)

### 基础体验优化

- [x] Service 层适配: `fetchNotes` API 兼容性检查 ✅ 2026-02-09
- [x] **拍照功能** ✅ 2026-02-09
  - `useImagePicker` 扩展 `takePhoto`
  - 首页双入口 (相册/拍照) / 权限分离请求
- [x] **UI 修复与优化** ✅ 2026-02-09
  - 修复扫描预览阻塞 / 取消保存 Bug
  - 移除首页/阅读页 Header / 适配 SafeArea / 阅读页 Appbar 优化
  - 深色模式支持 (Dark Mode) + TabBar/Header 主题跟随
  - Android/iOS 权限文案配置 (NSCameraUsageDescription 等)
- [x] **多账号数据隔离** ✅ 2026-02-09
  - React Query Key 增加 `userId` 维度
  - 登出清理 Query 缓存与 SQLite 数据
- [x] **EAS 真机验证**
  - 相机权限 / 拍照 URI / 相册流程验证通过

### 生产构建 (Build)

- [x] EAS Build 配置 (eas.json profiles)
- [x] 生成首个生产环境 APK
- [x] Math Assets 生成脚本 (`generate-math-assets.mjs`)

## 📌 Phase 4: 错误处理闭环与开发规范收敛 (Error Handling & Dev Workflow)

### 2026-02-15 | 错误处理闭环 + 表单校验 + 编辑体验 Plan B

- [x] 测试文档：新增 UI 层 API 错误处理体系检查表（可直接按页面验收）✅ 2026-02-15
  - 文档位置：`LOG/API_ERROR_CHECKLIST.md`
  - 重大决策：以“页面可执行步骤 + 预期 UI 表现 + 勾选结果”形式输出，降低新手验收门槛
  - 后续迭代：可追加真实后端业务错误码（code）专项检查列

- [x] **登录/注册**：密码错误、用户名已存在、格式校验不通过、限流 → 友好提示 + 表单字段定位 ✅ 2026-02-15
- [x] **上传/生成笔记**：超时、断网、文件过大、Job 失败/排队中/限流 → 步骤级错误提示 + 重试引导 ✅ 2026-02-15
- [x] **笔记详情**：404（已删除）、403（无权限）→ ErrorScreen + 返回引导 ✅ 2026-02-15
- [x] **通用网络层**：断网检测 → 全局 toast/横幅；5xx → 统一"服务暂时不可用" ✅ 2026-02-15
- [x] Toast 队列策略评估（Error 优先/可中断 Info/避免高频堆积）✅ 2026-02-15

- [x] **登录表单**：非空校验 + 错误状态样式（Paper TextInput error prop）✅ 2026-02-15
- [x] **注册表单**：强密码规则 + 重复密码确认（纯前端侧）✅ 2026-02-15
- [x] 所有校验文案走 i18n ✅ 2026-02-15
- [x] 登录页密码输入“瞬时明文”做 Android/iOS 真机回归（不同输入法与自动填充场景）✅ 2026-02-15

- [x] 登录/注册页底部 Tab 栏 主题未同步深色模式 ✅ 2026-02-15
- [x] Android 真机回归：三键导航/手势导航 + 键盘弹出场景下底部系统栏外观一致性✅ 2026-02-15
- [x] 笔记删除反馈闭环：删除成功/失败均显示 Toast（Hooks 层统一处理）✅ 2026-02-15

- [x] 编辑模式体验重设计：Plan B 方案落地（标题/分类/标签Chip/摘要/要点列表可编辑，章节与建议只读）+ 保存成功/失败闭环 ✅ 2026-02-15
  - 重大决策：采用 Plan B（元数据+结构化字段轻编辑），保证预览/编辑数据源一致（均操作 structuredData）
  - 架构实现：Store(useNoteEditStore 全量重写 formData) → UI(NoteEditForm 全量重写) → Page([id].tsx 适配 buildInitialFormData+handleSave 合并 structuredData)
  - 兼容性：无平台差异
  - 后续迭代：Plan B+ 可扩展 sections 编辑；长期 Plan C 全 Markdown 编辑器

- [x] **Auth 切页过渡优化**: 登录/注册切换动画统一 + 深色模式过渡瞬白修复。✅ 2026-02-15
- [x] **主题一致性**: 登录+注册页面底部的 Tab 栏未同步主题模式切换。✅ 2026-02-15

### 2026-02-19 | 防御性数据归一化 + 技能体系补全 + 图片裁切体验

- [x] 防御性编程系统审查：逐页检查 `?.` / `??`（重点 structuredData 各字段渲染路径）✅ 2026-02-19
  - 重大决策：优先在 Service 层做 structured_data 运行时归一化（数组/章节字段清洗），UI 层仅做最小兜底，避免“到处补丁”
  - 架构实现：Service(noteService.normalizeStructuredData) 统一清洗；UI([id].tsx / NoteEditForm / NoteMetaInfo) 对 map/spread 增加 Array.isArray 防御
  - 兼容性：无平台差异（Android/iOS 通用）
  - 本次完成重点：已抽取 `utils/safeData.ts`（toSafeStringArray / toOptionalSafeStringArray / toSafeSections / toOptionalSafeSections），并完成 Note 模块同一风格收敛（noteService、[id].tsx、NoteEditForm、NoteMetaInfo、NoteKeyPoints、NoteWarnings、NoteSections）
  - 后续注意事项：新增接口字段进入 UI 前必须先经 Service/Hook 层归一化；UI 禁止直接对 unknown 数据做 `map/spread`；若新增同类逻辑优先复用 `utils/safeData.ts`，避免再出现多套判空实现

- [x] 开发规范/工具：新增 `safe-data-guard` Skill（防御性数据归一化）✅ 2026-02-19
  - 重大决策：将“提醒式规范”升级为“可复用 Skill”，降低后续重复口头提醒成本
  - 架构实现：新增 `.github/skills/safe-data-guard/SKILL.md`，定义触发条件、执行步骤、禁忌与验收标准
  - 后续注意事项：后续新增页面（含 Settings）涉及不可信数据时，优先按该 Skill 落地并复用 `utils/safeData.ts`

- [x] 开发规范/工具：新增 `update-devlog` Skill（TODO→DEV_LOG→History 自动整理）✅ 2026-02-19
  - 重大决策：将“日终手工整理日志”升级为“可重复执行技能”，减少日志遗漏与重复记录
  - 架构实现：完善 `.github/skills/update-devlog/SKILL.md`，定义时间范围解析、去重规则、归档步骤与异常处理
  - 后续注意事项：日终执行时优先使用该 Skill；多日整理需显式给出范围（如“近3天”）以提升准确性

- [x] 功能/UI：优化照片截取操作（自由裁切 + 原图直传） ✅ 2026-02-19
  - 重大决策：采用 Android 优先的方案 A，在不引入重型原生依赖的前提下提升操作自由度
  - 架构实现：UI(Home) 增加模式选择弹层；Hook(useImagePicker) 增加 mode 参数并按模式构建 picker options；Store 与 Service 无需改动
  - UI 位置：首页拍照主按钮与相册入口触发后的处理方式选择
  - 兼容性：Android 支持自由裁切；iOS 使用系统裁切能力并允许原图直传（存在系统交互差异）
  - 后续迭代：若要求 Android/iOS 完全一致裁切体验，需评估自定义裁切页（开发维护成本更高）

### 2026-02-22 | 搜索功能全流程打通与体验修复

- [x] 功能/UI：搜索功能全流程打通 — 6 状态搜索页 + API 接入 + 标题关键词高亮 ✅ 2026-02-21
  - 重大决策：分类/标签 Chip 暂用硬编码演示，后续后端 API 升级后接入真实筛选；不新增 Store
  - 架构实现：Service(searchNotes) → Hook(useSearch + 防抖 + 状态机) → UI(search.tsx + 4 个子组件)
  - UI 位置：`app/search.tsx` 入口在 `app/(tabs)/read.tsx` Appbar 搜索图标
  - 兼容性：全跨平台，无 Android/iOS 差异
  - 后续迭代：后端支持分类/标签搜索后接入真实筛选 Chip；评估是否需要搜索历史记录；摘要片段展示评估
- [x] 修复：Android development build 删除笔记偶发原生崩溃（react-native-screens/native-stack 竞态）✅ 2026-02-21
- [x] 文档/规范：增强 Copilot 开发指南（Android 优先、API 错误→Toast、交付审查、错误映射表）✅ 2026-02-09
  - 重大决策：Android 真机优先，iOS 尽量保持一致性；有不兼容需提前报出
  - 架构实现：明确 UI→Hooks→Services 分层下的错误解析与 toast 触发位置，减少 UI try-catch
  - 特殊细节：新增“错误场景→i18n key→toast 类型”小表，避免后续重复造轮子
  - 后续迭代：把 422/常见错误码映射规范逐步落实到各业务模块 Se rvice/Hooks，并在 TODO 中持续跟踪

### 2026-02-21 | 多任务并发上传系统（从单任务阻塞到异步任务托盘）

- [x] 功能/架构：多任务并发上传 + 异步轮询 + 任务托盘 + 阅读Tab角标 ✅ 2026-02-21
  - 重大决策：
    - 轮询 vs SSE → 选轮询（2s × 30次），SSE 后续评估
    - Session 级内存 vs 持久化 → Session 级，App 杀死即清
    - 并发上限 3（后端允许 10）
    - 自动保存 + Snackbar 通知（带"查看"跳转）
  - 架构实现：
    - Store: `useUploadTaskStore`（任务 CRUD + 5 个 selector）
    - Hooks: `useUploadTasks`（调度引擎 — 并发控制/独立轮询/自动保存/通知/队列推进）
    - UI: `UploadTaskItem` + `UploadTaskTray`（任务卡片 + 托盘容器）
    - Page: `index.tsx` 全量重写（移除 Modal/Loading → 接入异步上传）
    - Layout: `_layout.tsx` 阅读 Tab 增加未读角标
  - i18n: 新增 `upload.task.*` 共 16 key（zh + en）
  - 类型: 新增 `UploadTask`、`UploadTaskStatus`；补全 `JobResponse`（file_url/progress_url/queued_at）
  - 兼容性：纯 JS/React 层实现，Android/iOS 无差异
  - 清理: `useScanNotes` 标记 @deprecated；`useScanStore` 注释收窄职责（保留 pickedImageUri 兼容）
  - 后续迭代：
    - 真机全链路回归（Android 优先）
    - SSE 替代轮询评估
    - 任务持久化评估
    - useScanNotes 安全删除
    - 上传进度百分比（axios onUploadProgress）
