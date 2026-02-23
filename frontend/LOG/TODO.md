# � 项目任务清单 (TODO List)

> 历史已完成任务请查看 [History.md](History.md) | 长期规划请参考 [ROADMAP.md](ROADMAP.md)

------------------------------------分隔线---------------------------------------------------------

## 一、ROADMAP:阶段 2 — 体验打磨与错误处理闭环 🔧

**项目进度路线**

**目标**：把"能用"提升到"好用"—— 错误有提示、操作有反馈、表单有校验、关键路径无白屏。

### 2.1 错误处理体系补全

> Toast 基础设施已就绪，核心工作是逐模块把"错误码 → i18n key → toast 类型"串起来。

### 2.2 表单校验与输入体验

### 2.3 关键 UI/UX 修复

- [x] 修复：Android development build 删除笔记偶发原生崩溃（react-native-screens/native-stack 竞态）✅ 2026-02-21（已归档到 History）
- [x] 功能/UI：搜索功能全流程打通 — 6 状态搜索页 + API 接入 + 标题关键词高亮 ✅ 2026-02-21（已归档到 History）
  - 重大决策：分类/标签 Chip 暂用硬编码演示，后续后端 API 升级后接入真实筛选；不新增 Store
  - 架构实现：Service(searchNotes) → Hook(useSearch + 防抖 + 状态机) → UI(search.tsx + 4 个子组件)
  - UI 位置：`app/search.tsx` 入口在 `app/(tabs)/read.tsx` Appbar 搜索图标
  - 兼容性：全跨平台，无 Android/iOS 差异
  - 后续迭代：后端支持分类/标签搜索后接入真实筛选 Chip；评估是否需要搜索历史记录；摘要片段展示评估

- [ ] 防御性编程扩展：将 `utils/safeData.ts` 复用到非 Note 模块（Scan/Auth/Settings）并补最小回归检查

### 2.4 Types 清理

- [ ] 审查 `types/index.ts`，移除不再使用的类型；补充缺失的 JSDoc

------------------------------------分隔线---------------------------------------------------------

## 二、即时TODO

**收集调试过程中的即使bug/新增功能**

- [x] 接口适配/Bug修复：后端多图功能扩展 — 图片字段数组化全流程适配 + 收藏红心 Bug 修复 ✅ 2026-02-22
  - 重大决策：底层类型全量改为数组（imageUrls/imageFilenames/imageSizes），UI 层暂取 `[0]` 单张显示；上传 FormData field 从 `file` 改为 `files`
  - 架构实现：Types(Note/RawNoteFromAPI/JobResponse) → Service(normalizeNote 数组适配+兼容旧字段回退, uploadImageNote field 更名) → Database(v4 schema 重建) → UI(所有图片消费点取 `[0]`)
  - 涉及文件：`types/index.ts`, `services/noteService.ts`, `services/database.ts`, `hooks/useUploadTasks.ts`, `app/(tabs)/read.tsx`, `app/search.tsx`, `app/note/[id].tsx`, `components/note-card.tsx`
  - 收藏红心修复：无图片时在标题行右侧显示红心图标，有图时仍叠加在图片右上角
  - 兼容性：全跨平台，无 Android/iOS 差异
  - 后续迭代：多图 UI 开发（轮播/网格）；多图上传 UI（选取多张照片）

- [x] 多图上传 & 展示 UI 迭代 ✅ 2026-02-22
  - 重大决策：FlatList 实现轮播（零依赖）+ react-native-image-viewing 全屏查看器（带 pinch-to-zoom）；相册多选跳过裁剪、拍照保留裁剪
  - 架构实现：Config(MAX_UPLOAD_COUNT) → Store(pickedImageUris[]) → Hook(useImagePicker 多选/追加/上限校验) → Service(uploadImageNote 接收 string[]) → UI(首页多图网格 + 笔记详情轮播)
  - 新增组件：`components/common/ImageCarousel.tsx`（可复用轮播）、`components/common/ImageViewerModal.tsx`（全屏查看器）
  - 改造组件：`components/note/NoteImage.tsx`（单图→多图轮播+全屏）、`app/(tabs)/index.tsx`（多图网格预览+添加更多弹层）
  - 涉及文件：`types/index.ts`, `constants/config.ts`, `store/useScanStore.ts`, `hooks/useImagePicker.ts`, `hooks/useUploadTasks.ts`, `hooks/useScanNotes.ts`, `services/noteService.ts`, `i18n/zh.ts`, `i18n/en.ts`
  - 兼容性：全跨平台，无 Android/iOS 差异
  - 后续迭代：多图场景大体积优化（expo-image-manipulator 前端压缩）；上传进度百分比

- [x] 新增本地搜索历史记录 ✅ 2026-02-23
  - 重大决策：数据结构采用简单 `string[]`（仅存笔记标题），长标题 UI 层 `numberOfLines=1` 截断；记录时机为用户点击搜索结果笔记卡片时
  - 架构实现：Config(MAX_SEARCH_HISTORY=10 + STORAGE_KEYS) → Service(searchHistoryService: AsyncStorage CRUD) → Hook(useSearchHistory: TanStack Query 包裹) → UI(SearchHistory 组件 + SearchIdleContent 集成)
  - 新增文件：`services/searchHistoryService.ts`、`hooks/useSearchHistory.ts`、`components/search/SearchHistory.tsx`
  - 改造文件：`components/search/SearchIdleContent.tsx`（接入搜索历史 + ScrollView 包裹）、`app/search.tsx`（接入 history hook + 点击笔记记录历史）、`components/search/index.ts`（导出新组件）、`constants/config.ts`、`i18n/zh.ts`、`i18n/en.ts`
  - 兼容性：全跨平台，无 Android/iOS 差异
  - 后续迭代：搜索历史点击后可直接跳转对应笔记（需存 noteId）；历史记录上限可配置化
- [x] 搜索功能前端升级（本地搜索） ✅ 2026-02-23
  - 重大决策：完全移除后端搜索 API，改为消费 useNotes TanStack Query 缓存做内存过滤（JS Pipeline）；防抖 600ms→300ms；状态机 6 态简化为 3 态（idle/results/empty）
  - 架构实现：Hook(useSearch 重写：useNotes 缓存 → extractCategories/extractTags 动态提取 → filterNotes Pipeline[分类→标签AND→关键词includes→收藏优先+时间倒序]) → UI(search.tsx 筛选 Chips 固定区域始终可见 + 状态机简化 + 暂无笔记/筛选空态) → Service(移除 noteService.searchNotes)
  - 改造文件：`hooks/useSearch.ts`（全量重写）、`app/search.tsx`（状态机+筛选Chips+active filters）、`components/search/SearchIdleContent.tsx`（移除硬编码分类/标签，简化为历史+引导）、`components/search/SearchEmpty.tsx`（支持filter-only空态）、`services/noteService.ts`（移除searchNotes+清理imports）、`types/index.ts`（SearchState简化）、`constants/config.ts`（debounce 300ms + MAX_TAG_DISPLAY_COUNT）、`i18n/zh.ts`/`i18n/en.ts`（新增6个key）、`components/search/index.ts`（更新注释）
  - 兼容性：全跨平台，无 Android/iOS 差异
  - 后续迭代：
    - [ ] 搜索页筛选区域 UI 精调（分类/标签 Chip 布局优化，当前为 MVP 功能优先）
    - [ ] 考虑笔记内容搜索（当前仅标题，正文搜索需评估 SQLite FTS5）
    - [ ] 搜索历史点击可直接跳转对应笔记（需存 noteId）
    - [ ] 分类系统完善（自定义分类 / AI 建议分类 / 接入 GET /library/categories）
    - [ ] 骨架屏 SearchSkeleton 和 SearchError 组件保留未删，后续后端深度搜索可复用

- [ ] 分类系统UI初步设计

- [x] 分类系统 MVP 全流程开发 ✅ 2026-02-24
  - 重大决策：纯后端聚合策略(GET /categories) + 本地 AsyncStorage 缓存新建分类；阅读页 Drawer 选用 react-native-drawer-layout（轻量无手势库依赖）；筛选工具函数抽取为 utils/noteFilters.ts 共享
  - 架构实现：
    - Service: `categoryService.ts`（fetchCategories + 本地新建分类 CRUD）
    - Hook: `useCategories.ts`（TanStack Query 合并后端+本地 + noteCount 统计）
    - Utils: `noteFilters.ts`（extractCategories/extractTags/filterNotes/filterNotesByCategory 纯函数）
    - UI-上传: `CategoryPicker.tsx`（可展开下拉选择器 + 新建分类入口）→ 集成至 `app/(tabs)/index.tsx`
    - UI-阅读: `CategoryDrawer.tsx`（侧边栏分类列表+系统分类）→ 集成至 `app/(tabs)/read.tsx`（Drawer 包裹 + 汉堡菜单）
    - UI-搜索: `FilterSummaryBar.tsx`（已选筛选汇总栏）→ 集成至 `app/search.tsx`（可折叠筛选区+Badge+视觉区分）
  - 涉及文件（新建）：`services/categoryService.ts`, `hooks/useCategories.ts`, `utils/noteFilters.ts`, `components/upload/CategoryPicker.tsx`, `components/read/CategoryDrawer.tsx`, `components/read/index.ts`, `components/search/FilterSummaryBar.tsx`
  - 涉及文件（修改）：`types/index.ts`, `constants/config.ts`, `hooks/useUploadTasks.ts`, `hooks/useSearch.ts`, `i18n/zh.ts`, `i18n/en.ts`, `app/(tabs)/index.tsx`, `app/(tabs)/read.tsx`, `app/search.tsx`, `components/upload/index.ts`, `components/search/index.ts`
  - 兼容性：全跨平台，无 Android/iOS 差异
  - 后续迭代：
    - [ ] 真机测试分类全流程（上传选分类 → 阅读页 Drawer 筛选 → 搜索页筛选联动）
    - [ ] GET /categories API 返回格式真机验证（当前做了多格式防御适配）
    - [ ] 分类编辑/删除/重命名功能（需后端支持）
    - [ ] Drawer 内收藏夹入口（已预留 i18n key，待收藏系统完善后接入）
    - [ ] 分类 Chip 数量过多时的折叠/展开优化
    - [ ] AI 智能分类推荐（根据笔记内容自动建议分类）



------------------------------------分隔线---------------------------------------------------------

## 三、关键架构优化 (Refactoring & Tech Debt)

### 数学公式引擎 (Math Engine Iteration)

- [ ] **P1 (短期)**: 内容清洗管道 (Hook/Service 层预处理 LaTeX 分隔符)。
- [ ] **P1 (短期)**: 渲染失败兜底 (显示原始文本 + 错误标记上报)。
- [ ] **P2 (中期)**: 评估 MathJax v3 SVG 方案 (更高兼容性)。
- [ ] **P2 (中期)**: 全内容 WebView 渲染模式 (针对重公式长文)。
- [ ] **P3 (长期)**: 服务端预渲染 (SVG/PNG)。

### 离线优先架构 (Offline First)

- [ ] **离线刷新重构**: 本地优先读/写 -> 失败回滚 -> 后台同步队列。
- [ ] **Store 类型完善**: 完善 useScanStore, useUIStore 的 TypeScript 类型定义。
- [ ] **Token 刷新策略**: 添加 Token 主动刷新策略（过期前自动刷新）。
- [ ] **Secure Storage**: 生产环境评估 expo-secure-store 替代 AsyncStorage 存储 Token。

### 后端与接口

- [ ] **删除操作可恢复性**: 评估删除后 Snackbar `撤销` action（本地回滚 + 服务端补偿）方案。
- [ ] **注册逻辑完善**: 待后端接入真实邮箱限制。
- [ ] **错误响应结构标准化（后端协同）**: 建议后端补齐统一 `code/message/details`（含 409/429 业务码），前端可从状态码映射升级为业务码精确映射。
- [ ] **注册错误码临时兜底回收**: 当前前端将注册 400 临时映射为“用户名已存在”；待后端统一校验后改为按业务 `code` 精确提示。

> 提示：本次已先补齐“规范/映射表”；下一步建议把 422 映射落到具体模块（Service/Hooks）里，接入全局 toast。

------------------------------------分隔线---------------------------------------------------------

## 四、长期功能（迭代）计划

### 后续处理/优化：

- [ ] **全局导航体验优化**：在导航切换时，尤其是阅读列表相关界面总会出现退出白屏动画 考虑freezeonBlur等其他UI/UX优化阶段调优方案
- [ ] **多设备限制**: 开发后期需完成多设备同步登录限制。
- [ ] **Toast 队列优化**: 评估高频触发时的消息堆积问题，考虑为 Error 消息增加时长或优先级。
- [ ] **Auth UI 升级（方案B）**: 登录/注册改为同壳层局部切换（固定标题/背景，仅表单区域动画）。
- [ ] **UX bug**:当用户上传单张从相册选择的手机完整截屏后，默认全屏裁剪导致无法正常裁剪
- [ ] **导出功能**: 支持导出笔记为 Image/PDF/Text。

- [ ] **收藏系统 (Favorites)**
  - [ ] **收藏列表页**: 独立的页面仅展示已收藏笔记。
  - [ ] **离线同步**: SQLite 缓存需同步 is_favorite 字段状态。

- [ ] **用户中心 & 设置 (Settings)**
  - [ ] 搭建用户中心各个基础跳转页面。
  - [ ] 配置 React Native Paper 全局字体 (Fonts) 规范。

- [x] **搜索功能迭代 (Search)**
  - [x] 全局搜索入口与实现（标题关键字检索 + 6 状态 UI） ✅ 2026-02-21
  - [x] 分类/标签筛选接入真实后端 API（当前硬编码占位）✅ 2026-02-23 本地检索实现
  - [x] 搜索历史记录功能评估  ✅ 2026-02-23 实现简单标题记录
  - [ ] 搜索结果摘要片段展示（需后端返回匹配片段或前端截取）

- [ ] **分类功能优化**

-[ ] **多任务上传后续迭代**

- [ ] **真机回归**：Android 真机测试多任务上传（权限 → 拍照 → 并发上传 → 轮询 → 自动保存 → 角标通知 → 跳转详情全链路）
- [ ] **SSE 评估**：当后端 `/upload/jobs/{job_id}/stream` 稳定后，评估用 SSE 替代轮询（减少请求量 + 实时性更好）
- [ ] **任务持久化评估**：当前任务仅存于内存（Session 级），App 杀死即丢失；如用户反馈有需要可考虑 AsyncStorage 持久化
- [ ] **错误码精细化**：上传失败目前统一 toast，后续可按 413(文件过大)/415(格式不支持)/429(限流) 等给出差异化提示
- [ ] **useScanNotes 清理**：已标记 @deprecated，确认无回归风险后可安全删除
- [ ] **上传进度百分比**：当前仅显示"上传中/处理中"文字，后续可借助 axios onUploadProgress 展示真实百分比

- [ ] **进阶功能**
