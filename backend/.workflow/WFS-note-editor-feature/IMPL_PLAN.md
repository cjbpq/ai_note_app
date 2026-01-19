---
identifier: WFS-note-editor-feature
source: "User requirements - Revision 2"
revision: 2
architecture: "详情页内编辑模式（混合 WYSIWYG + Markdown 源码）"
analysis: .workflow/WFS-note-editor-feature/.process/ANALYSIS_RESULTS.md
---

# Implementation Plan: 笔记编辑功能（详情页内编辑模式）

## Summary

本项目为 AI 笔记应用添加笔记编辑功能，采用**详情页内编辑模式**，支持三种内容展示方式：预览、WYSIWYG 编辑、Markdown 源码编辑。核心架构改为在现有 `note_detail_page.dart` 中实现模式切换，用户通过 AppBar 按钮在三种模式间切换，编辑内容统一存储为 Markdown 格式到 `original_text` 字段。

## Revision History

- **Revision 1**: 独立编辑页面架构（已废弃）
- **Revision 2** (Current): 详情页内编辑模式 - 用户反馈后的架构调整

## Context Analysis

- **Project**: AI 笔记应用 Flutter 前端 + FastAPI 后端
- **Frontend**: Flutter 3.10.4, Dart, flutter_riverpod 2.6.1
- **Existing Components**:
  - LatexMarkdown widget (用于预览渲染)
  - note_detail_page.dart (需改造)
  - noteDetailProvider (需扩展编辑状态)
- **New Dependencies**:
  - flutter_quill (WYSIWYG 编辑器)
  - markdown (Delta-Markdown 转换)
- **Data Storage**: original_text 字段存储 Markdown 格式
- **LaTeX Support**: 保留 $inline$ 和 $$block$$ 公式格式

## Architecture Decisions (REVISED)

### 1. 编辑位置
- **决策**: 详情页内编辑（note_detail_page.dart 改造）
- **理由**: 用户反馈希望避免页面跳转，在当前页面直接编辑
- **影响**: 需要改造现有详情页，添加条件渲染逻辑

### 2. 编辑模式
- **决策**: 混合模式 - 同时支持 WYSIWYG 和 Markdown 源码编辑
- **三种模式**:
  1. **预览模式** (preview): 使用 LatexMarkdown 渲染（现有组件）
  2. **WYSIWYG 编辑** (wysiwyg): 使用 flutter_quill 富文本编辑器
  3. **Markdown 源码编辑** (markdown): 使用 TextFormField 编辑纯文本
- **理由**: 满足不同用户习惯，技术用户可直接编辑 Markdown

### 3. 模式切换
- **决策**: AppBar 按钮切换
- **实现**: PopupMenuButton 或 SegmentedButton
- **状态管理**: 使用 NoteEditMode 枚举和 noteDetailProvider
- **内容同步**: 切换模式时保存当前内容并加载到新编辑器

### 4. 数据存储
- **决策**: 统一使用 Markdown 格式存储
- **字段**: original_text (后端已有)
- **转换**: WYSIWYG 模式下需要 Delta <-> Markdown 双向转换

## Affected Files (New Plan)

### 新建文件
1. `lib/models/note_edit_mode.dart` - 编辑模式枚举
2. `lib/utils/delta_markdown_converter.dart` - Delta-Markdown 转换工具
3. `lib/presentation/widgets/note_content_editor.dart` - WYSIWYG 编辑器封装
4. `lib/presentation/widgets/markdown_source_editor.dart` - Markdown 源码编辑器

### 修改文件
1. `pubspec.yaml` - 添加依赖
2. `lib/providers/notes_provider.dart` - 添加编辑状态管理
3. `lib/presentation/pages/notes/note_detail_page.dart` - 大幅改造（核心文件）

## Task Breakdown

- **Task Count**: 8 tasks
- **Hierarchy**: Flat structure (8 leaf tasks)
- **Dependencies**: Sequential with some parallelizable tasks

### Task List

1. **IMPL-001**: 添加编辑器依赖包
   - Priority: High | Complexity: Low
   - Adds: flutter_quill, markdown to pubspec.yaml
   - Blocks: All other tasks

2. **IMPL-002**: 创建编辑模式状态管理
   - Priority: High | Complexity: Medium
   - Creates: NoteEditMode enum, extends noteDetailProvider
   - Depends: IMPL-001
   - Blocks: IMPL-003, IMPL-004, IMPL-005, IMPL-006

3. **IMPL-003**: 创建 Delta-Markdown 转换工具
   - Priority: High | Complexity: High
   - Creates: DeltaMarkdownConverter with bidirectional conversion
   - Depends: IMPL-001
   - Blocks: IMPL-004, IMPL-005

4. **IMPL-004**: 创建 WYSIWYG 编辑器组件
   - Priority: High | Complexity: Medium
   - Creates: NoteContentEditor widget wrapping flutter_quill
   - Depends: IMPL-001, IMPL-003
   - Blocks: IMPL-006, IMPL-007

5. **IMPL-005**: 创建 Markdown 源码编辑器组件
   - Priority: Medium | Complexity: Low
   - Creates: MarkdownSourceEditor widget (TextFormField)
   - Depends: IMPL-001
   - Blocks: IMPL-006, IMPL-007

6. **IMPL-006**: 改造详情页 - 添加模式切换 UI
   - Priority: High | Complexity: Medium
   - Modifies: note_detail_page.dart AppBar
   - Adds: Mode switch button
   - Depends: IMPL-002, IMPL-004, IMPL-005
   - Blocks: IMPL-007

7. **IMPL-007**: 改造详情页 - 实现内容区域模式切换
   - Priority: High | Complexity: High
   - Modifies: note_detail_page.dart body
   - Implements: Conditional rendering, content sync, save functionality
   - Depends: IMPL-002, IMPL-004, IMPL-005, IMPL-006
   - Blocks: IMPL-008

8. **IMPL-008**: 测试与验证编辑功能
   - Priority: High | Complexity: Medium
   - Creates: Unit tests and integration tests
   - Validates: Mode switching, content sync, format conversion, LaTeX rendering
   - Depends: IMPL-007

## Implementation Plan

### Phase 1: 依赖和基础架构 (Tasks 1-2)
- **Duration**: ~2 hours
- **Deliverables**:
  - Dependencies added
  - Edit mode state management ready
- **Success Criteria**:
  - `flutter pub get` succeeds
  - NoteEditMode enum and provider state accessible

### Phase 2: 核心转换和编辑器组件 (Tasks 3-5)
- **Duration**: ~6 hours
- **Deliverables**:
  - Delta-Markdown converter
  - WYSIWYG editor component
  - Markdown source editor component
- **Parallelizable**: Tasks 4 and 5 can run in parallel after Task 3
- **Success Criteria**:
  - Conversion tools tested manually
  - Editors render and accept input

### Phase 3: 详情页改造 (Tasks 6-7)
- **Duration**: ~5 hours
- **Deliverables**:
  - Mode switch UI in AppBar
  - Content area with conditional rendering
  - Save functionality
- **Success Criteria**:
  - 3 modes switchable
  - Content syncs correctly
  - Save updates backend

### Phase 4: 测试与验证 (Task 8)
- **Duration**: ~4 hours
- **Deliverables**:
  - Unit tests (15+ cases)
  - Integration tests
  - Coverage report
- **Success Criteria**:
  - All tests pass
  - Coverage ≥80%
  - LaTeX rendering validated

### Total Estimated Time: ~17 hours

## Resource Requirements

### Tools
- Flutter SDK 3.10.4
- Dart analysis tools
- flutter_test for testing
- lcov for coverage reports

### Dependencies
- flutter_quill: WYSIWYG editor
- markdown: Format conversion
- flutter_riverpod: State management (existing)

### Documentation
- flutter_quill documentation
- Quill Delta format specification
- Markdown syntax reference

## Success Criteria

### Functional
- [x] User can switch between 3 modes via AppBar button
- [x] Preview mode renders Markdown with LaTeX correctly
- [x] WYSIWYG mode supports rich text editing
- [x] Markdown mode allows source code editing
- [x] Content syncs correctly across modes
- [x] Save functionality updates original_text in backend
- [x] LaTeX formulas preserved in all conversions

### Technical
- [x] Test coverage ≥80%
- [x] No performance degradation in detail page
- [x] Proper error handling for conversion failures
- [x] State management follows existing patterns

### User Experience
- [x] Smooth mode switching without flicker
- [x] Clear indication of current mode
- [x] Save confirmation feedback
- [x] Responsive UI on mobile devices

## Risk Mitigation

### Risk 1: Delta-Markdown 转换精度
- **Mitigation**: Comprehensive unit tests, fallback to plain text if conversion fails
- **Contingency**: Use markdown package's built-in converters as fallback

### Risk 2: 详情页改造影响现有功能
- **Mitigation**: Incremental changes, preserve existing LatexMarkdown preview
- **Contingency**: Feature flag to toggle new edit functionality

### Risk 3: LaTeX 渲染在编辑器中的兼容性
- **Mitigation**: Treat LaTeX as plain text in editors, only render in preview
- **Contingency**: Add LaTeX escape/unescape logic in converter

## Notes

- This is Revision 2 of the implementation plan, reflecting the architectural change to in-place editing in detail page
- Original plan (separate edit page) is archived in `.workflow/WFS-note-editor-feature/.archive/IMPL_PLAN_v1.md`
- Focus on user feedback: avoid page navigation, provide flexible editing modes
