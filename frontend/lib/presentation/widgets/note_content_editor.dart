import 'package:flutter/material.dart';
import 'package:flutter_quill/flutter_quill.dart';
import '../../utils/delta_markdown_converter.dart';

/// WYSIWYG 富文本编辑器组件
///
/// 封装 flutter_quill 编辑器，提供富文本编辑能力
/// 支持 Markdown 内容的加载和提取
class NoteContentEditor extends StatefulWidget {
  /// 初始 Markdown 内容
  final String initialMarkdown;

  /// 内容变化回调
  final ValueChanged<String>? onContentChanged;

  /// 是否显示工具栏
  final bool showToolbar;

  /// 是否只读模式
  final bool readOnly;

  /// 自动获取焦点
  final bool autofocus;

  /// 占位文本
  final String placeholder;

  /// 最小高度
  final double? minHeight;

  /// 最大高度
  final double? maxHeight;

  const NoteContentEditor({
    super.key,
    this.initialMarkdown = '',
    this.onContentChanged,
    this.showToolbar = true,
    this.readOnly = false,
    this.autofocus = false,
    this.placeholder = '开始编辑...',
    this.minHeight,
    this.maxHeight,
  });

  @override
  State<NoteContentEditor> createState() => NoteContentEditorState();
}

class NoteContentEditorState extends State<NoteContentEditor> {
  late QuillController _controller;
  final FocusNode _focusNode = FocusNode();
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _initializeController();
  }

  /// 初始化控制器
  void _initializeController() {
    try {
      if (widget.initialMarkdown.isEmpty) {
        _controller = QuillController.basic();
      } else {
        // 将 Markdown 转换为 Delta
        final delta = DeltaMarkdownConverter.markdownToDelta(widget.initialMarkdown);
        final document = Document.fromDelta(delta);
        _controller = QuillController(
          document: document,
          selection: const TextSelection.collapsed(offset: 0),
        );
      }
    } catch (e) {
      // 如果转换失败，创建空文档
      _controller = QuillController.basic();
      debugPrint('Failed to initialize editor: $e');
    }

    // 监听内容变化
    _controller.addListener(_onContentChanged);
  }

  void _onContentChanged() {
    if (widget.onContentChanged != null) {
      final markdown = getMarkdownContent();
      widget.onContentChanged!(markdown);
    }
  }

  @override
  void didUpdateWidget(NoteContentEditor oldWidget) {
    super.didUpdateWidget(oldWidget);
    // 如果初始内容变化，重新初始化
    if (oldWidget.initialMarkdown != widget.initialMarkdown) {
      _controller.removeListener(_onContentChanged);
      _controller.dispose();
      _initializeController();
    }
  }

  @override
  void dispose() {
    _controller.removeListener(_onContentChanged);
    _controller.dispose();
    _focusNode.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  /// 获取当前 Markdown 内容
  String getMarkdownContent() {
    return DeltaMarkdownConverter.documentToMarkdown(_controller.document);
  }

  /// 设置 Markdown 内容
  void setMarkdownContent(String markdown) {
    try {
      final delta = DeltaMarkdownConverter.markdownToDelta(markdown);
      final document = Document.fromDelta(delta);
      _controller.document = document;
      _controller.moveCursorToEnd();
    } catch (e) {
      debugPrint('Failed to set content: $e');
    }
  }

  /// 获取 QuillController (供外部高级操作)
  QuillController get controller => _controller;

  /// 清空内容
  void clear() {
    _controller.clear();
  }

  /// 聚焦编辑器
  void focus() {
    _focusNode.requestFocus();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // 工具栏
        if (widget.showToolbar && !widget.readOnly) _buildToolbar(theme),

        // 编辑器
        Expanded(
          child: Container(
            constraints: BoxConstraints(
              minHeight: widget.minHeight ?? 200,
              maxHeight: widget.maxHeight ?? double.infinity,
            ),
            decoration: BoxDecoration(
              color: theme.colorScheme.surface,
              border: Border.all(
                color: theme.colorScheme.outlineVariant,
                width: 1,
              ),
              borderRadius: BorderRadius.circular(8),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(7),
              child: _buildEditor(theme),
            ),
          ),
        ),
      ],
    );
  }

  /// 构建工具栏
  Widget _buildToolbar(ThemeData theme) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(8),
      ),
      child: QuillSimpleToolbar(
        controller: _controller,
        config: QuillSimpleToolbarConfig(
          showAlignmentButtons: false,
          showBackgroundColorButton: false,
          showCenterAlignment: false,
          showClearFormat: true,
          showCodeBlock: true,
          showColorButton: false,
          showDirection: false,
          showFontFamily: false,
          showFontSize: false,
          showHeaderStyle: true,
          showIndent: false,
          showInlineCode: true,
          showJustifyAlignment: false,
          showLeftAlignment: false,
          showLink: true,
          showListBullets: true,
          showListCheck: false,
          showListNumbers: true,
          showQuote: true,
          showRedo: true,
          showRightAlignment: false,
          showSearchButton: false,
          showSmallButton: false,
          showStrikeThrough: true,
          showSubscript: false,
          showSuperscript: false,
          showUnderLineButton: false,
          showUndo: true,
          multiRowsDisplay: false,
          buttonOptions: QuillSimpleToolbarButtonOptions(
            base: QuillToolbarBaseButtonOptions(
              iconSize: 20,
              iconButtonFactor: 1.2,
            ),
          ),
        ),
      ),
    );
  }

  /// 构建编辑器
  Widget _buildEditor(ThemeData theme) {
    return QuillEditor(
      controller: _controller,
      focusNode: _focusNode,
      scrollController: _scrollController,
      config: QuillEditorConfig(
        scrollable: true,
        autoFocus: widget.autofocus,
        expands: false,
        padding: const EdgeInsets.all(16),
        placeholder: widget.placeholder,
        readOnlyMouseCursor: SystemMouseCursors.text,
        customStyles: DefaultStyles(
          paragraph: DefaultTextBlockStyle(
            theme.textTheme.bodyLarge!.copyWith(
              height: 1.6,
              color: theme.colorScheme.onSurface,
            ),
            HorizontalSpacing.zero,
            const VerticalSpacing(8, 8),
            const VerticalSpacing(0, 0),
            null,
          ),
          h1: DefaultTextBlockStyle(
            theme.textTheme.headlineMedium!.copyWith(
              fontWeight: FontWeight.bold,
              color: theme.colorScheme.onSurface,
            ),
            HorizontalSpacing.zero,
            const VerticalSpacing(16, 8),
            const VerticalSpacing(0, 0),
            null,
          ),
          h2: DefaultTextBlockStyle(
            theme.textTheme.headlineSmall!.copyWith(
              fontWeight: FontWeight.bold,
              color: theme.colorScheme.onSurface,
            ),
            HorizontalSpacing.zero,
            const VerticalSpacing(12, 6),
            const VerticalSpacing(0, 0),
            null,
          ),
          h3: DefaultTextBlockStyle(
            theme.textTheme.titleLarge!.copyWith(
              fontWeight: FontWeight.bold,
              color: theme.colorScheme.onSurface,
            ),
            HorizontalSpacing.zero,
            const VerticalSpacing(10, 4),
            const VerticalSpacing(0, 0),
            null,
          ),
          inlineCode: InlineCodeStyle(
            style: TextStyle(
              fontFamily: 'monospace',
              fontSize: 14,
              color: theme.colorScheme.onSurfaceVariant,
              backgroundColor: theme.colorScheme.surfaceContainerHighest,
            ),
          ),
          placeHolder: DefaultTextBlockStyle(
            theme.textTheme.bodyLarge!.copyWith(
              color: theme.colorScheme.onSurfaceVariant.withValues(alpha: 0.6),
            ),
            HorizontalSpacing.zero,
            const VerticalSpacing(0, 0),
            const VerticalSpacing(0, 0),
            null,
          ),
        ),
      ),
    );
  }
}
