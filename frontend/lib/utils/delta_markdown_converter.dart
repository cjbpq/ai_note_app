import 'package:flutter_quill/flutter_quill.dart';
import 'package:flutter_quill/quill_delta.dart';

/// Delta-Markdown 双向转换工具类
///
/// 用于在 flutter_quill 的 Delta 格式和 Markdown 文本之间进行转换
/// 支持的格式包括：粗体、斜体、标题、列表、代码块、LaTeX 公式
class DeltaMarkdownConverter {
  DeltaMarkdownConverter._();

  /// 将 Delta 转换为 Markdown 文本
  ///
  /// [delta] - flutter_quill 的 Delta 对象
  /// 返回 Markdown 格式的字符串
  static String deltaToMarkdown(Delta delta) {
    final buffer = StringBuffer();
    final operations = delta.toList();

    for (int i = 0; i < operations.length; i++) {
      final op = operations[i];

      if (op.isInsert) {
        final data = op.data;
        final attributes = op.attributes;

        if (data is String) {
          String text = data;

          // 处理带属性的文本
          if (attributes != null && attributes.isNotEmpty) {
            text = _applyAttributes(text, attributes);
          }

          buffer.write(text);
        } else if (data is Map) {
          // 处理嵌入对象（如图片）
          buffer.write(_handleEmbed(data));
        }
      }
    }

    return _postProcessMarkdown(buffer.toString());
  }

  /// 将 Markdown 文本转换为 Delta
  ///
  /// [markdown] - Markdown 格式的字符串
  /// 返回 flutter_quill 的 Delta 对象
  static Delta markdownToDelta(String markdown) {
    final delta = Delta();
    final lines = markdown.split('\n');

    for (int i = 0; i < lines.length; i++) {
      final line = lines[i];
      final isLastLine = i == lines.length - 1;

      if (line.isEmpty) {
        // 空行
        if (!isLastLine) {
          delta.insert('\n');
        }
        continue;
      }

      // 解析并处理每一行
      _parseLine(line, delta, isLastLine);
    }

    // 确保 Delta 以换行符结尾（Quill 要求）
    final ops = delta.toList();
    if (ops.isEmpty || !_endsWithNewline(ops.last)) {
      delta.insert('\n');
    }

    return delta;
  }

  /// 从 Document 获取 Markdown
  static String documentToMarkdown(Document document) {
    return deltaToMarkdown(document.toDelta());
  }

  /// 从 Markdown 创建 Document
  static Document markdownToDocument(String markdown) {
    return Document.fromDelta(markdownToDelta(markdown));
  }

  // ============ 私有辅助方法 ============

  /// 应用文本属性生成 Markdown 标记
  static String _applyAttributes(String text, Map<String, dynamic> attributes) {
    String result = text;

    // 处理代码块（优先级最高，不与其他格式混合）
    if (attributes['code-block'] == true) {
      return result; // 代码块在行级别处理
    }

    // 处理行内代码
    if (attributes['code'] == true) {
      return '`$result`';
    }

    // 处理粗体和斜体
    final bold = attributes['bold'] == true;
    final italic = attributes['italic'] == true;

    if (bold && italic) {
      result = '***$result***';
    } else if (bold) {
      result = '**$result**';
    } else if (italic) {
      result = '*$result*';
    }

    // 处理删除线
    if (attributes['strike'] == true) {
      result = '~~$result~~';
    }

    // 处理链接
    if (attributes['link'] != null) {
      result = '[$result](${attributes['link']})';
    }

    return result;
  }

  /// 处理嵌入对象
  static String _handleEmbed(Map<dynamic, dynamic> data) {
    // 处理图片
    if (data.containsKey('image')) {
      final url = data['image'];
      return '![]($url)';
    }

    // 处理视频
    if (data.containsKey('video')) {
      final url = data['video'];
      return '[video]($url)';
    }

    // 处理分割线
    if (data.containsKey('divider')) {
      return '\n---\n';
    }

    return '';
  }

  /// 后处理 Markdown 文本
  static String _postProcessMarkdown(String markdown) {
    // 清理多余的空行
    String result = markdown.replaceAll(RegExp(r'\n{3,}'), '\n\n');

    // 确保 LaTeX 公式标记完整
    // 保持 $...$ 和 $$...$$ 格式不变

    return result.trim();
  }

  /// 解析 Markdown 行并添加到 Delta
  static void _parseLine(String line, Delta delta, bool isLastLine) {
    // 检查标题
    final headerMatch = RegExp(r'^(#{1,6})\s+(.*)$').firstMatch(line);
    if (headerMatch != null) {
      final level = headerMatch.group(1)!.length;
      final content = headerMatch.group(2)!;
      _parseInlineText(content, delta);
      delta.insert('\n', {'header': level});
      return;
    }

    // 检查代码块标记
    if (line.startsWith('```')) {
      // 代码块的开始/结束标记，跳过
      return;
    }

    // 检查无序列表
    final ulMatch = RegExp(r'^[-*+]\s+(.*)$').firstMatch(line);
    if (ulMatch != null) {
      final content = ulMatch.group(1)!;
      _parseInlineText(content, delta);
      delta.insert('\n', {'list': 'bullet'});
      return;
    }

    // 检查有序列表
    final olMatch = RegExp(r'^(\d+)\.\s+(.*)$').firstMatch(line);
    if (olMatch != null) {
      final content = olMatch.group(2)!;
      _parseInlineText(content, delta);
      delta.insert('\n', {'list': 'ordered'});
      return;
    }

    // 检查引用块
    final quoteMatch = RegExp(r'^>\s*(.*)$').firstMatch(line);
    if (quoteMatch != null) {
      final content = quoteMatch.group(1)!;
      _parseInlineText(content, delta);
      delta.insert('\n', {'blockquote': true});
      return;
    }

    // 检查分割线
    if (RegExp(r'^[-*_]{3,}$').hasMatch(line.trim())) {
      delta.insert({'divider': true});
      delta.insert('\n');
      return;
    }

    // 普通文本行
    _parseInlineText(line, delta);
    if (!isLastLine) {
      delta.insert('\n');
    }
  }

  /// 解析行内文本格式
  static void _parseInlineText(String text, Delta delta) {
    if (text.isEmpty) return;

    // 定义内联格式的正则表达式
    final patterns = [
      // LaTeX 块公式 (优先级最高)
      _InlinePattern(
        RegExp(r'\$\$([^$]+)\$\$'),
        (match) => {'text': '\$\$${match.group(1)}\$\$', 'attributes': <String, dynamic>{}},
      ),
      // LaTeX 行内公式
      _InlinePattern(
        RegExp(r'\$([^$\n]+)\$'),
        (match) => {'text': '\$${match.group(1)}\$', 'attributes': <String, dynamic>{}},
      ),
      // 粗斜体
      _InlinePattern(
        RegExp(r'\*\*\*([^*]+)\*\*\*'),
        (match) => {'text': match.group(1), 'attributes': {'bold': true, 'italic': true}},
      ),
      // 粗体
      _InlinePattern(
        RegExp(r'\*\*([^*]+)\*\*'),
        (match) => {'text': match.group(1), 'attributes': {'bold': true}},
      ),
      // 斜体
      _InlinePattern(
        RegExp(r'\*([^*]+)\*'),
        (match) => {'text': match.group(1), 'attributes': {'italic': true}},
      ),
      // 行内代码
      _InlinePattern(
        RegExp(r'`([^`]+)`'),
        (match) => {'text': match.group(1), 'attributes': {'code': true}},
      ),
      // 删除线
      _InlinePattern(
        RegExp(r'~~([^~]+)~~'),
        (match) => {'text': match.group(1), 'attributes': {'strike': true}},
      ),
      // 链接
      _InlinePattern(
        RegExp(r'\[([^\]]+)\]\(([^)]+)\)'),
        (match) => {'text': match.group(1), 'attributes': {'link': match.group(2)}},
      ),
      // 图片
      _InlinePattern(
        RegExp(r'!\[([^\]]*)\]\(([^)]+)\)'),
        (match) => {'embed': {'image': match.group(2)}, 'attributes': <String, dynamic>{}},
      ),
    ];

    // 使用递归方式解析内联格式
    _parseWithPatterns(text, delta, patterns, 0);
  }

  /// 使用模式列表递归解析文本
  static void _parseWithPatterns(
    String text,
    Delta delta,
    List<_InlinePattern> patterns,
    int patternIndex,
  ) {
    if (text.isEmpty) return;

    if (patternIndex >= patterns.length) {
      // 所有模式都已检查，插入纯文本
      delta.insert(text);
      return;
    }

    final pattern = patterns[patternIndex];
    final match = pattern.regex.firstMatch(text);

    if (match == null) {
      // 当前模式没有匹配，尝试下一个模式
      _parseWithPatterns(text, delta, patterns, patternIndex + 1);
      return;
    }

    // 处理匹配前的文本
    if (match.start > 0) {
      _parseWithPatterns(text.substring(0, match.start), delta, patterns, patternIndex + 1);
    }

    // 处理匹配的内容
    final result = pattern.handler(match);
    if (result.containsKey('embed')) {
      delta.insert(result['embed']);
    } else {
      final matchText = result['text'] as String;
      final attributes = result['attributes'] as Map<String, dynamic>;
      if (attributes.isNotEmpty) {
        delta.insert(matchText, attributes);
      } else {
        delta.insert(matchText);
      }
    }

    // 处理匹配后的文本
    if (match.end < text.length) {
      _parseWithPatterns(text.substring(match.end), delta, patterns, 0);
    }
  }

  /// 检查操作是否以换行符结尾
  static bool _endsWithNewline(Operation op) {
    if (op.isInsert && op.data is String) {
      return (op.data as String).endsWith('\n');
    }
    return false;
  }
}

/// 内联格式模式
class _InlinePattern {
  final RegExp regex;
  final Map<String, dynamic> Function(RegExpMatch match) handler;

  _InlinePattern(this.regex, this.handler);
}
