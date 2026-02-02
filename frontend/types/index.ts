// ========================================
// 【核心业务类型】
// ========================================

/**
 * 笔记实体
 * 对应后端返回的笔记数据结构
 *
 * 注意：后端可能返回不同的字段名，如：
 * - date / created_at / createdAt
 * - imageUrl / image_url
 * - categoryId / category_id
 *
 * 在 Service 层会进行字段名规范化处理
 */
export interface Note {
  id: string;
  title: string;
  content: string;
  date: string; // 统一使用 date，Service 层负责转换
  tags: string[];
  imageUrl?: string; // 原图URL
  categoryId?: string; // 分类ID
  structuredData?: {
    // AI处理后的结构化数据
    summary: string;
    keyPoints?: string[];
  };
}

/**
 * 后端原始返回的笔记数据 (可能包含下划线命名的字段)
 * 用于 Service 层的类型转换
 *
 * 根据后端实际返回结构：
 * - original_text → content
 * - category → categoryId
 * - created_at → date
 * - image_url → imageUrl
 */
export interface RawNoteFromAPI {
  id: string;
  title?: string;
  // 内容字段
  content?: string;
  original_text?: string; // 后端实际使用的字段名
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
  category?: string; // 后端实际使用的字段名
  // 结构化数据
  structuredData?: Record<string, unknown>;
  structured_data?: Record<string, unknown>;
  // 其他后端字段
  user_id?: string;
  device_id?: string;
  is_favorite?: boolean;
  is_archived?: boolean;
}

/**
 * 后端笔记列表 API 响应包装
 */
export interface NotesAPIResponse {
  notes: RawNoteFromAPI[];
}

/**
 * 笔记分类（对应原项目的 library）
 */
export interface NoteCategory {
  id: string;
  name: string; // 如 "语文", "数学"
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
  email?: string; // 仅注册时需要
}

// ========================================
// 【API 响应类型】
// ========================================

/**
 * 上传图片后返回的任务ID
 */
export interface UploadResponse {
  job_id: string;
  note_id?: string;
}

/**
 * 任务查询响应
 */
export interface JobStatusResponse {
  status: "pending" | "processing" | "completed" | "failed";
  note_id?: string;
}

/**
 * 登录响应
 */
export interface LoginResponse {
  token: string;
  user: User;
}

/**
 * 更新笔记的 API 请求体
 * 对应后端 PUT /api/v1/library/notes/{note_id}
 *
 * 注意：后端使用下划线命名和不同的字段名
 */
export interface UpdateNoteRequest {
  title?: string;
  category?: string; // 对应前端的 categoryId
  tags?: string[];
  is_favorite?: boolean;
  original_text?: string; // 对应前端的 content
  structured_data?: Record<string, unknown>;
}

/**
 * 编辑笔记的表单数据（前端使用）
 */
export interface NoteEditForm {
  title: string;
  content: string;
  tags: string[];
  categoryId?: string;
}
