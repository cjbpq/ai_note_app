// ========================================
// 【核心业务类型】
// ========================================

/**
 * 主题模式（用于浅色/深色切换）
 * - system: 跟随系统
 * - light: 浅色
 * - dark: 深色
 */
export type ThemeMode = "system" | "light" | "dark";

/**
 * 智慧笔记 - 结构化章节
 * 对应后端 structured_data.sections[] 中的每一项
 */
export interface SmartNoteSection {
  heading?: string;
  content?: string;
}

/**
 * 智慧笔记 - 元信息
 * 对应后端 structured_data.meta
 */
export interface SmartNoteMeta {
  subject?: string;
  promptProfile?: string;
  warnings?: string[];
  tags?: string[];
  originalNoteType?: string;
  provider?: string;
}

/**
 * 智慧笔记 - 完整结构化数据
 * 对应后端 structured_data JSON 的完整结构
 */
export interface SmartNoteData {
  title?: string;
  summary?: string;
  rawText?: string;
  sections?: SmartNoteSection[];
  keyPoints?: string[];
  studyAdvice?: string;
  meta?: SmartNoteMeta;
}

/**
 * 后端 structured_data 的原始类型 (snake_case)
 * 仅在 Service 层转换时使用
 */
export interface RawSmartNoteData {
  title?: string;
  summary?: string;
  raw_text?: string;
  sections?: { heading?: string; content?: string }[];
  key_points?: string[];
  study_advice?: string;
  meta?: {
    subject?: string;
    prompt_profile?: string;
    warnings?: string[];
    tags?: string[];
    original_note_type?: string;
    provider?: string;
    response?: Record<string, unknown>;
  };
}

/**
 * 笔记实体 - 完整版
 * 对应后端 NoteResponse schema 的所有字段
 */
export interface Note {
  id: string;
  title: string;
  content: string; // 对应后端 original_text
  date: string; // 对应后端 created_at
  updatedAt?: string; // 对应后端 updated_at
  tags: string[];
  /**
   * 多图 URL 数组（后端 image_urls，均已拼接完整地址）
   * UI 层取 imageUrls?.[0] 显示首张；后续多图 UI 可遍历该数组
   */
  imageUrls: string[];
  /** 多图原始文件名数组（后端 image_filenames） */
  imageFilenames: string[];
  /** 多图文件大小数组（后端 image_sizes，单位 bytes） */
  imageSizes: number[];
  category?: string;
  isFavorite?: boolean;
  isArchived?: boolean;
  userId?: string;
  deviceId?: string;
  structuredData?: SmartNoteData; // AI 结构化数据（完整版）
}

/**
 * 后端原始返回的笔记数据 (snake_case)
 * 仅用于 Service 层的类型转换
 */
export interface RawNoteFromAPI {
  id: string;
  title?: string;
  // 内容字段
  content?: string;
  original_text?: string;
  // 日期字段
  date?: string;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  // 标签
  tags?: string[] | string;
  // ── 多图字段（新后端 schema）──────────────────────
  /** 新后端：图片 URL 数组 */
  image_urls?: string[];
  /** 新后端：图片文件名数组 */
  image_filenames?: string[];
  /** 新后端：图片文件大小数组 */
  image_sizes?: number[];
  // ── 旧单图字段（兼容回退）────────────────────────
  /** @deprecated 旧后端单图字段，仅用于兼容迁移 */
  imageUrl?: string;
  /** @deprecated */
  image_url?: string;
  /** @deprecated */
  image_filename?: string;
  /** @deprecated */
  image_size?: number;
  // 分类
  categoryId?: string;
  category_id?: string;
  category?: string;
  // 结构化数据
  structuredData?: Record<string, unknown>;
  structured_data?: Record<string, unknown>;
  // 其他字段
  user_id?: string;
  device_id?: string;
  is_favorite?: boolean;
  is_archived?: boolean;
}

/**
 * 笔记卡片组件 Props（供 UI 层使用）
 */
export interface NoteCardProps {
  title: string;
  date?: string;
  tags?: string[];
  imageUrl?: string;
  isFavorite?: boolean;
  category?: string;
  summary?: string;
  /** 搜索场景：传入搜索关键词，卡片标题会高亮匹配部分 */
  highlightQuery?: string;
  onPress?: () => void;
}

// ========================================
// 【搜索相关类型】
// ========================================

/**
 * 搜索页状态机（本地搜索版）
 *
 * idle: 无任何筛选/关键词，展示分类标签 + 历史
 * results: 有筛选条件且有结果
 * empty: 有筛选条件但无匹配
 */
export type SearchState = "idle" | "results" | "empty";

/**
 * @deprecated 后端搜索已移除，改用本地搜索 Pipeline
 * 保留类型定义以备后续深度搜索扩展
 */
export interface SearchNotesParams {
  query: string;
  category?: string;
  tag?: string;
}

/**
 * 分类筛选 Chip 数据结构
 */
export interface CategoryFilter {
  id: string;
  label: string;
}

/**
 * 搜索结果（前端组装，包含匹配计数）
 */
export interface SearchResult {
  notes: Note[];
  total: number;
}

/**
 * 后端笔记列表 API 响应包装
 */
export interface NotesAPIResponse {
  notes: RawNoteFromAPI[];
  total?: number;
}

/**
 * 笔记分类
 * 对应后端 GET /library/categories 聚合结果 + 本地新建分类
 * 数据来源：
 *   1. 后端聚合：从用户笔记的 category 字段提取唯一集合
 *   2. 本地新建：用户在上传时手动输入的新分类名（暂存 AsyncStorage）
 *   3. 合并策略：后端优先 + 本地去重追加（上传成功后后端自然包含，本地缓存可清除）
 */
export interface NoteCategory {
  /** 分类唯一标识（= 分类名称，扁平结构无独立 ID） */
  id: string;
  /** 显示名称 */
  name: string;
  /** 该分类下笔记数量（后端聚合返回；本地新建为 0） */
  noteCount: number;
}

/**
 * 用户实体
 */
export interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
}

/**
 * 登录/注册表单
 */
export interface AuthForm {
  username: string;
  password: string;
  email?: string;
}

// ========================================
// 【API 响应类型】
// ========================================

/**
 * 任务信息响应 (上传/状态查询通用)
 * 注意：job_id 在状态查询响应中可能不返回，因此为可选
 */
export interface JobResponse {
  job_id?: string;
  note_id?: string;
  status: string;
  /** 后端返回的上传文件 URL 数组（相对路径，如 ["/static/xxx_0.png"]） */
  file_urls?: string[];
  /** @deprecated 旧单文件字段，兼容回退 */
  file_url?: string;
  /** 后端返回的 SSE 进度 URL（保留，后续可用） */
  progress_url?: string;
  /** 任务入队时间 */
  queued_at?: string;
  result?: RawNoteFromAPI;
}

export type UploadResponse = JobResponse;
export type JobStatusResponse = JobResponse;

// ========================================
// 【上传任务管理类型】
// ========================================

/**
 * 上传任务状态枚举
 *
 * 生命周期：queued → uploading → processing → completed / failed
 * - queued: 等待上传（并发已满时排队）
 * - uploading: 正在上传图片到后端
 * - processing: 后端 AI 正在处理生成笔记
 * - completed: 笔记生成完成
 * - failed: 任务失败（上传失败或 AI 处理失败）
 */
export type UploadTaskStatus =
  | "queued"
  | "uploading"
  | "processing"
  | "completed"
  | "failed";

/**
 * 单个上传任务
 * 用于首页任务托盘展示与后台轮询控制
 */
export interface UploadTask {
  /** 任务唯一标识（= 后端返回的 jobId，上传前使用临时 ID） */
  id: string;
  /** 本地图片 URI（第一张），用于缩略图展示 */
  imageUri: string;
  /** 本次上传的全部本地图片 URI 列表（多图上传） */
  imageUris?: string[];
  /** 上传时用户选择的分类名（透传到 note_type，不选则为 undefined → 后端默认"学习笔记"） */
  category?: string;
  /** 后端返回的文件 URL（拼接 STATIC_BASE_URL 后可用于网络缩略图） */
  fileUrl?: string;
  /** 当前任务状态 */
  status: UploadTaskStatus;
  /** 完成后关联的笔记 ID（来自 getJobStatus） */
  noteId?: string;
  /** 完成后获取的笔记标题（用于 Snackbar 显示） */
  noteTitle?: string;
  /** 失败时的错误信息 */
  error?: string;
  /** 任务创建时间戳 */
  createdAt: number;
  /** 用户是否已点击查看/处理过该任务 */
  isRead: boolean;
}

/**
 * 登录响应（Service 层返回格式）
 * 注意：这是 authService.login() 的返回类型，不是后端原始响应
 * 后端原始响应 { access_token, token_type } 在 authService 内部处理
 */
export interface LoginResponse {
  token: string;
  user: User;
}

/**
 * 更新笔记的 API 请求体
 */
export interface UpdateNoteRequest {
  title?: string;
  category?: string;
  tags?: string[];
  is_favorite?: boolean;
  original_text?: string;
  structured_data?: Record<string, unknown>;
}

/**
 * 编辑笔记的表单数据（前端使用）
 */
export interface NoteEditForm {
  title: string;
  content: string;
  tags: string[];
  category?: string;
}

// ========================================
// 【认证相关类型】
// ========================================

/**
 * Token 刷新响应
 */
export interface TokenRefreshResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  expires_at: string;
}

/**
 * 认证错误类型
 */
export enum AuthErrorType {
  TOKEN_EXPIRED = "TOKEN_EXPIRED",
  TOKEN_INVALID = "TOKEN_INVALID",
  REFRESH_FAILED = "REFRESH_FAILED",
  NETWORK_ERROR = "NETWORK_ERROR",
}

// ========================================
// 【全局反馈 Toast 类型】
// ========================================

/**
 * Toast 提示类型
 */
export type ToastType = "success" | "error" | "info" | "warning";

/**
 * 字段级错误映射
 * key: 表单字段名（如 username/password/email）
 * value: 已本地化的提示文案
 */
export type FieldErrorMap = Record<string, string>;

/**
 * Service 层统一错误对象参数
 * 说明：
 * - i18nKey：用于追踪映射来源（UI 默认只消费 message）
 * - statusCode：保留 HTTP 状态码，便于 UI 做分支渲染（如 404/403）
 * - fieldErrors：用于表单字段级提示定位
 */
export interface ServiceErrorOptions {
  message: string;
  i18nKey: string;
  toastType: ToastType;
  statusCode?: number;
  fieldErrors?: FieldErrorMap;
  actionKey?: string;
  retryable?: boolean;
}

/**
 * Service 层统一错误类型
 * UI/Hooks 不关心 axios 细节，只处理该错误对象
 */
export class ServiceError extends Error {
  i18nKey: string;
  toastType: ToastType;
  statusCode?: number;
  fieldErrors?: FieldErrorMap;
  actionKey?: string;
  retryable?: boolean;

  constructor(options: ServiceErrorOptions) {
    super(options.message);
    this.name = "ServiceError";
    this.i18nKey = options.i18nKey;
    this.toastType = options.toastType;
    this.statusCode = options.statusCode;
    this.fieldErrors = options.fieldErrors;
    this.actionKey = options.actionKey;
    this.retryable = options.retryable;
  }
}

/**
 * Toast 消息配置
 */
export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * 显示 Toast 的参数（不含 id，由 Store 自动生成）
 */
export type ShowToastParams = Omit<ToastMessage, "id">;
