/**
 * 搜索组件统一导出
 *
 * 包含搜索页面的各个子组件：
 * - SearchIdleContent: 初始态（搜索历史 + 引导提示）
 * - SearchHistory: 搜索历史记录列表
 * - SearchEmpty: 无结果空状态
 *
 * 以下组件当前未使用（本地搜索无需），保留供后续后端深度搜索扩展：
 * - SearchSkeleton: 加载骨架屏
 * - SearchError: 错误状态
 */
export { FilterSummaryBar } from "./FilterSummaryBar";
export { SearchEmpty } from "./SearchEmpty";
export { SearchError } from "./SearchError";
export { SearchHistory } from "./SearchHistory";
export { SearchIdleContent } from "./SearchIdleContent";
export { SearchSkeleton } from "./SearchSkeleton";
