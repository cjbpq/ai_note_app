import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:flutter_math_fork/flutter_math.dart';

/// 支持 LaTeX 数学公式的 Markdown 渲染器
class LatexMarkdown extends StatelessWidget {
  final String data;
  final bool selectable;
  final MarkdownStyleSheet? styleSheet;

  const LatexMarkdown({
    super.key,
    required this.data,
    this.selectable = true,
    this.styleSheet,
  });

  @override
  Widget build(BuildContext context) {
    // 解析内容，分离文本和 LaTeX 公式
    final widgets = _parseContent(context, data);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: widgets,
    );
  }

  List<Widget> _parseContent(BuildContext context, String content) {
    final widgets = <Widget>[];
    final theme = Theme.of(context);

    // 匹配 LaTeX 公式: $$...$$ (块级) 或 $...$ (行内)
    // 也支持 \[...\] 和 \(...\) 格式
    final blockLatexRegex = RegExp(r'\$\$(.+?)\$\$|\\\[(.+?)\\\]', dotAll: true);
    final inlineLatexRegex = RegExp(r'\$(.+?)\$|\\\((.+?)\\\)');

    // 先处理块级公式
    final parts = content.split(blockLatexRegex);
    final blockMatches = blockLatexRegex.allMatches(content).toList();

    int matchIndex = 0;
    for (int i = 0; i < parts.length; i++) {
      final part = parts[i];

      if (part.isNotEmpty) {
        // 处理行内公式
        widgets.addAll(_parseInlineLatex(context, part, inlineLatexRegex));
      }

      // 添加块级公式
      if (matchIndex < blockMatches.length) {
        final match = blockMatches[matchIndex];
        final latex = match.group(1) ?? match.group(2) ?? '';
        if (latex.isNotEmpty) {
          widgets.add(
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Center(
                child: _buildMathWidget(latex.trim(), theme, isBlock: true),
              ),
            ),
          );
        }
        matchIndex++;
      }
    }

    return widgets;
  }

  List<Widget> _parseInlineLatex(
    BuildContext context,
    String content,
    RegExp regex,
  ) {
    final widgets = <Widget>[];
    final theme = Theme.of(context);

    // 检查是否有行内公式
    if (!regex.hasMatch(content)) {
      // 没有行内公式，直接渲染 Markdown
      widgets.add(
        MarkdownBody(
          data: content,
          selectable: selectable,
          styleSheet: styleSheet ??
              MarkdownStyleSheet(
                p: theme.textTheme.bodyLarge,
                h1: theme.textTheme.headlineMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
                h2: theme.textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
                h3: theme.textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
                code: theme.textTheme.bodyMedium?.copyWith(
                  fontFamily: 'monospace',
                  backgroundColor: theme.colorScheme.surfaceContainerHighest,
                ),
                codeblockDecoration: BoxDecoration(
                  color: theme.colorScheme.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(8),
                ),
                blockquoteDecoration: BoxDecoration(
                  border: Border(
                    left: BorderSide(
                      color: theme.colorScheme.primary,
                      width: 4,
                    ),
                  ),
                ),
              ),
        ),
      );
      return widgets;
    }

    // 有行内公式，需要混合渲染
    final matches = regex.allMatches(content).toList();
    int lastEnd = 0;

    for (final match in matches) {
      // 添加公式前的文本
      if (match.start > lastEnd) {
        final textBefore = content.substring(lastEnd, match.start);
        if (textBefore.trim().isNotEmpty) {
          widgets.add(
            MarkdownBody(
              data: textBefore,
              selectable: selectable,
              styleSheet: styleSheet,
            ),
          );
        }
      }

      // 添加行内公式
      final latex = match.group(1) ?? match.group(2) ?? '';
      if (latex.isNotEmpty) {
        widgets.add(
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
            child: _buildMathWidget(latex.trim(), theme, isBlock: false),
          ),
        );
      }

      lastEnd = match.end;
    }

    // 添加最后一段文本
    if (lastEnd < content.length) {
      final textAfter = content.substring(lastEnd);
      if (textAfter.trim().isNotEmpty) {
        widgets.add(
          MarkdownBody(
            data: textAfter,
            selectable: selectable,
            styleSheet: styleSheet,
          ),
        );
      }
    }

    return widgets;
  }

  Widget _buildMathWidget(String latex, ThemeData theme, {required bool isBlock}) {
    try {
      return Math.tex(
        latex,
        textStyle: TextStyle(
          fontSize: isBlock ? 18 : 16,
          color: theme.colorScheme.onSurface,
        ),
        mathStyle: isBlock ? MathStyle.display : MathStyle.text,
        onErrorFallback: (error) {
          // 如果 LaTeX 解析失败，显示原始文本
          return Text(
            isBlock ? '\$\$$latex\$\$' : '\$$latex\$',
            style: TextStyle(
              fontFamily: 'monospace',
              fontSize: isBlock ? 16 : 14,
              color: theme.colorScheme.error,
            ),
          );
        },
      );
    } catch (e) {
      // 捕获任何异常，回退显示原始文本
      return Text(
        isBlock ? '\$\$$latex\$\$' : '\$$latex\$',
        style: TextStyle(
          fontFamily: 'monospace',
          fontSize: isBlock ? 16 : 14,
          color: theme.colorScheme.onSurfaceVariant,
        ),
      );
    }
  }
}
