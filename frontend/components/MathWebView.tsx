import { marked } from "marked";
import React, { useMemo, useRef, useState } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { useTheme } from "react-native-paper";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { AUTO_RENDER_JS, KATEX_CSS, KATEX_JS } from "../constants/mathAssets";

/**
 * MathWebView 组件 Props 定义
 * @param content - Markdown 格式的文本内容
 * @param title - 笔记标题（支持数学公式）
 * @param textColor - 文本颜色（适配主题）
 * @param backgroundColor - 背景颜色（适配主题）
 * @param style - 外部传入的样式容器
 */
interface MathWebViewProps {
  content: string;
  title?: string;
  textColor?: string;
  backgroundColor?: string;
  style?: ViewStyle;
}

// WebView 最小高度，确保始终可见
const MIN_HEIGHT = 120;

/**
 * MathWebView 组件
 *
 * 渲染架构（修复白屏问题）：
 * 1. Markdown 解析在 RN 侧完成（marked npm 包），不依赖任何外部 CDN
 * 2. 数学公式由本地化的 KaTeX JS/CSS 渲染（内联注入），无 CDN 依赖
 * 3. 内容 HTML 直接写入 DOM，WebView 只需展示，不运行重逻辑
 * 4. 自动高度（Auto-Height）通过 postMessage 通信实现
 */
const MathWebView: React.FC<MathWebViewProps> = ({
  content,
  title,
  textColor,
  backgroundColor,
  style,
}) => {
  const theme = useTheme();

  // 主题派生色：用于替换 HTML/CSS 中的硬编码 rgba 灰色（适配深色模式）
  const surfaceVariant = theme.colors.surfaceVariant;
  const outlineVariant = theme.colors.outlineVariant ?? theme.colors.outline;
  const onSurfaceVariant = theme.colors.onSurfaceVariant;

  // 使用 Paper 主题色，避免硬编码颜色（允许外部传入覆盖）
  const effectiveTextColor = textColor ?? theme.colors.onSurface;
  const effectiveBackgroundColor = backgroundColor ?? "transparent";

  const [height, setHeight] = useState(MIN_HEIGHT);
  const webViewRef = useRef<WebView>(null);

  // ========== 核心：在 RN 侧预解析 Markdown ==========
  // 先保护数学公式不被 Markdown 解析器破坏，再解析 Markdown，最后还原公式
  const parsedHtml = useMemo(() => {
    if (!content) return "";

    let text = content;
    const mathBlocks: { placeholder: string; original: string }[] = [];
    let counter = 0;

    // 保护 $$...$$ (块级公式)
    text = text.replace(/\$\$([\s\S]*?)\$\$/g, (match) => {
      const placeholder = `%%MATHBLOCK${counter++}%%`;
      mathBlocks.push({ placeholder, original: match });
      return placeholder;
    });

    // 保护 \[...\] (块级公式)
    text = text.replace(/\\\[([\s\S]*?)\\\]/g, (match) => {
      const placeholder = `%%MATHBLOCK${counter++}%%`;
      mathBlocks.push({ placeholder, original: match });
      return placeholder;
    });

    // 保护 $...$ (行内公式，不跨行)
    text = text.replace(/\$([^\$\n]+?)\$/g, (match) => {
      const placeholder = `%%MATHINLINE${counter++}%%`;
      mathBlocks.push({ placeholder, original: match });
      return placeholder;
    });

    // 保护 \(...\) (行内公式)
    text = text.replace(/\\\(([\s\S]*?)\\\)/g, (match) => {
      const placeholder = `%%MATHINLINE${counter++}%%`;
      mathBlocks.push({ placeholder, original: match });
      return placeholder;
    });

    // 用 marked 解析 Markdown → HTML
    marked.use({ breaks: true, gfm: true });
    let html = marked.parse(text) as string;

    // 还原数学公式（Markdown 解析不会破坏占位符）
    for (const { placeholder, original } of mathBlocks) {
      html = html.replace(placeholder, original);
    }

    return html;
  }, [content]);

  // ========== 生成完整 HTML 模板 ==========
  const generateHtml = (bodyHtml: string, noteTitle?: string) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    
    <!-- KaTeX 样式 (本地内联，无 CDN 依赖) -->
    <style>${KATEX_CSS}</style>
    
    <!-- 页面基础样式 -->
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, Ubuntu, "Helvetica Neue", sans-serif;
            font-size: 16px;
            line-height: 1.6;
            color: ${effectiveTextColor};
            background-color: ${effectiveBackgroundColor};
            margin: 0;
            padding: 16px;
            overflow-y: hidden;
            word-wrap: break-word;
        }
        h1 {
            font-size: 28px;
            line-height: 36px;
            font-weight: 400;
            margin-top: 0;
            margin-bottom: 16px;
            color: ${effectiveTextColor};
        }
        h2 { font-size: 22px; font-weight: 600; margin: 16px 0 8px; }
        h3 { font-size: 18px; font-weight: 600; margin: 12px 0 6px; }
        p { margin: 0 0 12px; }
        img {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            margin: 8px 0;
        }
        /* 数学公式优化 */
        .katex { font-size: 1.1em; }
        .katex-display {
            overflow-x: auto;
            overflow-y: hidden;
            padding: 8px 0;
            margin: 12px 0;
            -webkit-overflow-scrolling: touch;
        }
        .katex-display > .katex { text-align: center; }
        pre {
          background-color: ${surfaceVariant};
            padding: 12px;
            border-radius: 8px;
            overflow-x: auto;
            white-space: pre-wrap;
            font-size: 14px;
        }
        code {
          background-color: ${surfaceVariant};
            padding: 2px 4px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 14px;
        }
        pre code { background: none; padding: 0; }
        blockquote {
          border-left: 4px solid ${outlineVariant};
            margin: 8px 0;
            padding-left: 16px;
          color: ${onSurfaceVariant};
        }
        table { border-collapse: collapse; width: 100%; margin: 12px 0; }
        th, td { border: 1px solid ${outlineVariant}; padding: 8px; text-align: left; }
        th { background-color: ${surfaceVariant}; }
        a { color: ${theme.colors.primary}; }
        ul, ol { padding-left: 24px; margin: 8px 0; }
        li { margin-bottom: 4px; }
    </style>
</head>
<body>
    <!-- 标题区域 -->
    ${noteTitle ? `<h1>${noteTitle}</h1>` : ""}
    
    <!-- 正文区域 (RN 侧已预解析为 HTML，直接注入) -->
    <div id="content">${bodyHtml}</div>
    
    <!-- KaTeX 核心引擎 (本地内联) -->
    <script>${KATEX_JS}</script>
    <!-- KaTeX auto-render (本地内联) -->
    <script>${AUTO_RENDER_JS}</script>
    
    <script>
        // ===== 高度通信 =====
        function sendHeight() {
            var h = Math.max(document.body.scrollHeight, ${MIN_HEIGHT});
            if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'height', value: h }));
            }
        }

        // 内容已经在 DOM 中，立即发一次高度
        sendHeight();

        // ===== 数学公式渲染 =====
        try {
            if (typeof renderMathInElement === 'function') {
                renderMathInElement(document.body, {
                    delimiters: [
                        { left: '$$', right: '$$', display: true },
                        { left: '$', right: '$', display: false },
                        { left: '\\\\(', right: '\\\\)', display: false },
                        { left: '\\\\[', right: '\\\\]', display: true }
                    ],
                    throwOnError: false
                });
            }
        } catch(e) {
            // 公式渲染失败不影响正文展示
        }

        // 渲染后重新计算高度
        sendHeight();

        // 兜底：延迟再次上报高度（字体加载、图片加载等异步因素）
        setTimeout(sendHeight, 300);
        setTimeout(sendHeight, 1000);
        setTimeout(sendHeight, 3000);

        // 图片加载完后刷新高度
        document.querySelectorAll('img').forEach(function(img) {
            img.addEventListener('load', sendHeight);
        });

        // 窗口大小变化时刷新
        window.addEventListener('resize', sendHeight);
    </script>
</body>
</html>
  `;

  // ========== WebView 消息处理 ==========
  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "height" && data.value > 0) {
        setHeight(data.value);
      }
    } catch {
      // 忽略非 JSON 消息
    }
  };

  return (
    <View style={[styles.container, style, { height }]}>
      <WebView
        ref={webViewRef}
        originWhitelist={["*"]}
        source={{ html: generateHtml(parsedHtml, title) }}
        scrollEnabled={false}
        onMessage={onMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        style={[styles.webview, { backgroundColor: effectiveBackgroundColor }]}
        androidLayerType="hardware"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    overflow: "hidden",
  },
  webview: {
    width: "100%",
    backgroundColor: "transparent",
  },
});

export default MathWebView;
