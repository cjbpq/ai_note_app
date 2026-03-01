/**
 * LaTeX 公式检测工具
 *
 * 用于判断文本中是否包含 LaTeX 数学公式，
 * 以便智能选择 MathWebView 或原生 Text 渲染，避免不必要的 WebView 开销。
 *
 * 何时使用：
 * - 在 MathAwareText 组件中作为分流依据
 * - 在列表/数组场景中预判是否需要 WebView 渲染
 *
 * 何时不使用：
 * - 已确定一定包含公式的字段（如 sections.content），直接用 MathWebView
 * - 纯系统文案/UI 文本，不可能含公式
 */

/**
 * 检测文本中是否包含 LaTeX 数学公式
 *
 * 覆盖的语法：
 * - $$...$$ (块级公式)
 * - $...$ (行内公式，不跨行)
 * - \(...\) (行内公式)
 * - \[...\] (块级公式)
 * - \begin{...}...\end{...} (LaTeX 环境，如 pmatrix, cases, align 等)
 * - 常见独立 LaTeX 命令（\frac, \sum, \alpha 等）
 *
 * @param text 待检测的字符串（null/undefined 安全）
 * @returns 是否包含 LaTeX 公式
 */
export function containsLatex(text: string | undefined | null): boolean {
  if (!text) return false;

  // 1. 块级公式 $$...$$
  if (/\$\$[\s\S]+?\$\$/.test(text)) return true;

  // 2. 行内公式 $...$（不跨行，至少包含一个非数字字符以减少 "$10" 误报）
  if (/\$(?=[^\$\n]*[a-zA-Z\\{}_^])[^\$\n]+?\$/.test(text)) return true;

  // 3. \[...\] 块级公式
  if (/\\\[[\s\S]+?\\\]/.test(text)) return true;

  // 4. \(...\) 行内公式
  if (/\\\([\s\S]+?\\\)/.test(text)) return true;

  // 5. \begin{...} LaTeX 环境（pmatrix, cases, align, equation 等）
  if (/\\begin\{[a-zA-Z*]+\}/.test(text)) return true;

  // 6. 常见独立 LaTeX 命令（即使没被分隔符包裹，也说明含有公式意图）
  if (
    /\\(?:frac|dfrac|tfrac|sum|prod|int|iint|iiint|oint|lim|sqrt|vec|hat|bar|dot|ddot|tilde|overline|underline|overbrace|underbrace|binom|mathbb|mathcal|mathfrak|mathrm|text|operatorname|alpha|beta|gamma|delta|epsilon|varepsilon|zeta|eta|theta|vartheta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|phi|varphi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Phi|Psi|Omega|infty|partial|nabla|cdot|cdots|ldots|vdots|ddots|leq|geq|neq|approx|equiv|sim|simeq|cong|propto|subset|supset|subseteq|supseteq|cap|cup|in|notin|forall|exists|nexists|rightarrow|leftarrow|Rightarrow|Leftarrow|leftrightarrow|Leftrightarrow|implies|iff|times|div|pm|mp|circ|oplus|otimes)\b/.test(
      text,
    )
  )
    return true;

  return false;
}

/**
 * 检测字符串数组中是否有任意一项包含 LaTeX
 *
 * @param arr 字符串数组（null/undefined 安全）
 * @returns 数组中是否有至少一项包含 LaTeX
 */
export function anyContainsLatex(arr: string[] | undefined | null): boolean {
  if (!arr || !Array.isArray(arr)) return false;
  return arr.some((item) => containsLatex(item));
}
