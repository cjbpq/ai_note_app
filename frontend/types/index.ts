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
  imageUrl?: string; // 完整图片 URL
  imageFilename?: string;
  imageSize?: number;
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
  // 图片相关
  imageUrl?: string;
  image_url?: string;
  image_filename?: string;
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
  onPress?: () => void;
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
 */
export interface NoteCategory {
  id: string;
  name: string;
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
  result?: RawNoteFromAPI;
}

export type UploadResponse = JobResponse;
export type JobStatusResponse = JobResponse;

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
