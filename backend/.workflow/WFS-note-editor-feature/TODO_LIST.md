# Tasks: 笔记编辑功能（详情页内编辑模式）

## Revision Information
- **Revision**: 2 (Current)
- **Architecture**: 详情页内编辑模式（混合 WYSIWYG + Markdown 源码）
- **Last Updated**: 2025-12-15

## Task Progress

- [ ] **IMPL-001**: 添加编辑器依赖包 → [📋](./.task/IMPL-001.json)
- [ ] **IMPL-002**: 创建编辑模式状态管理 → [📋](./.task/IMPL-002.json)
- [ ] **IMPL-003**: 创建 Delta-Markdown 转换工具 → [📋](./.task/IMPL-003.json)
- [ ] **IMPL-004**: 创建 WYSIWYG 编辑器组件 → [📋](./.task/IMPL-004.json)
- [ ] **IMPL-005**: 创建 Markdown 源码编辑器组件 → [📋](./.task/IMPL-005.json)
- [ ] **IMPL-006**: 改造详情页 - 添加模式切换 UI → [📋](./.task/IMPL-006.json)
- [ ] **IMPL-007**: 改造详情页 - 实现内容区域模式切换 → [📋](./.task/IMPL-007.json)
- [ ] **IMPL-008**: 测试与验证编辑功能 → [📋](./.task/IMPL-008.json)

## Status Legend
- `- [ ]` = Pending task
- `- [x]` = Completed task
- `[📋]` = Link to task JSON
- `[✅]` = Link to completion summary

## Dependencies Overview

```
IMPL-001 (依赖包)
  ├─→ IMPL-002 (状态管理)
  │     ├─→ IMPL-006 (模式切换 UI)
  │     └─→ IMPL-007 (内容区域)
  │
  ├─→ IMPL-003 (格式转换)
  │     ├─→ IMPL-004 (WYSIWYG 编辑器)
  │     └─→ [IMPL-007]
  │
  └─→ IMPL-005 (Markdown 编辑器)
        └─→ [IMPL-006, IMPL-007]

IMPL-007 (详情页改造)
  └─→ IMPL-008 (测试验证)
```

## Execution Order

### Phase 1: 基础设施
1. IMPL-001: 添加依赖包

### Phase 2: 核心组件
2. IMPL-002: 状态管理（并行于转换工具）
3. IMPL-003: Delta-Markdown 转换工具

### Phase 3: 编辑器组件（可并行）
4. IMPL-004: WYSIWYG 编辑器
5. IMPL-005: Markdown 源码编辑器

### Phase 4: UI 集成
6. IMPL-006: 模式切换 UI
7. IMPL-007: 内容区域改造

### Phase 5: 质量保证
8. IMPL-008: 测试与验证

## Key Features

### 三种编辑模式
- **预览模式**: LatexMarkdown 渲染（现有组件）
- **WYSIWYG 编辑**: flutter_quill 富文本编辑器
- **Markdown 源码**: TextFormField 等宽字体编辑

### 核心功能
- AppBar 按钮切换模式
- 内容在模式间同步
- 保存更新到 original_text
- LaTeX 公式支持（$inline$, $$block$$）

## Notes

- 本任务列表对应 Revision 2 架构（详情页内编辑）
- 所有任务均为 leaf tasks（无嵌套）
- 完成任务后将更新状态为 `[x]` 并添加总结链接
