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
