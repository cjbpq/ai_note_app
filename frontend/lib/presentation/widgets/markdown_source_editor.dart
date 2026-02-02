import 'package:flutter/material.dart';

/// Markdown 源码编辑器组件
///
/// 简洁的纯文本 Markdown 编辑器，使用等宽字体
/// 适合喜欢直接编辑 Markdown 源码的用户
class MarkdownSourceEditor extends StatefulWidget {
  /// 初始内容
  final String initialContent;

  /// 内容变化回调
  final ValueChanged<String>? onContentChanged;

  /// 是否只读
  final bool readOnly;

  /// 自动获取焦点
  final bool autofocus;

  /// 占位文本
  final String placeholder;

  /// 最小行数
  final int minLines;

  /// 最大行数 (null 表示无限制)
  final int? maxLines;

  const MarkdownSourceEditor({
    super.key,
    this.initialContent = '',
    this.onContentChanged,
    this.readOnly = false,
    this.autofocus = false,
    this.placeholder = '输入 Markdown 内容...',
    this.minLines = 10,
    this.maxLines,
  });

  @override
  State<MarkdownSourceEditor> createState() => MarkdownSourceEditorState();
}

class MarkdownSourceEditorState extends State<MarkdownSourceEditor> {
  late TextEditingController _controller;
  final FocusNode _focusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initialContent);
    _controller.addListener(_onContentChanged);
  }

  void _onContentChanged() {
    widget.onContentChanged?.call(_controller.text);
  }

  @override
  void didUpdateWidget(MarkdownSourceEditor oldWidget) {
    super.didUpdateWidget(oldWidget);
    // 如果初始内容变化且当前内容为空或与旧内容相同，更新内容
    if (oldWidget.initialContent != widget.initialContent) {
      if (_controller.text.isEmpty ||
          _controller.text == oldWidget.initialContent) {
        _controller.text = widget.initialContent;
      }
    }
  }

  @override
  void dispose() {
    _controller.removeListener(_onContentChanged);
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  /// 获取当前内容
  String getContent() {
    return _controller.text;
  }

  /// 设置内容
  void setContent(String content) {
    _controller.text = content;
    _controller.selection = TextSelection.collapsed(offset: content.length);
  }

  /// 清空内容
  void clear() {
    _controller.clear();
  }

  /// 聚焦编辑器
  void focus() {
    _focusNode.requestFocus();
  }

  /// 获取 TextEditingController (供外部高级操作)
  TextEditingController get controller => _controller;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
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
        child: TextFormField(
          controller: _controller,
          focusNode: _focusNode,
          readOnly: widget.readOnly,
          autofocus: widget.autofocus,
          maxLines: widget.maxLines,
          minLines: widget.minLines,
          keyboardType: TextInputType.multiline,
          textInputAction: TextInputAction.newline,
          style: TextStyle(
            fontFamily: 'Consolas, Monaco, monospace',
            fontSize: 14,
            height: 1.6,
            color: theme.colorScheme.onSurface,
          ),
          decoration: InputDecoration(
            hintText: widget.placeholder,
            hintStyle: TextStyle(
              fontFamily: 'Consolas, Monaco, monospace',
              fontSize: 14,
              color: theme.colorScheme.onSurfaceVariant.withValues(alpha: 0.6),
            ),
            filled: true,
            fillColor: theme.colorScheme.surfaceContainerLowest,
            contentPadding: const EdgeInsets.all(16),
            border: InputBorder.none,
            enabledBorder: InputBorder.none,
            focusedBorder: InputBorder.none,
            errorBorder: InputBorder.none,
            focusedErrorBorder: InputBorder.none,
          ),
          // 启用文本选择工具栏
          contextMenuBuilder: (context, editableTextState) {
            return AdaptiveTextSelectionToolbar.editableText(
              editableTextState: editableTextState,
            );
          },
        ),
      ),
    );
  }
}
