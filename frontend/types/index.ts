// ========================================
// 【核心业务类型】
// ========================================

/**
 * 笔记实体
 * 对应后端返回的笔记数据结构
 */
export interface Note {
  id: string;
  title: string;
  content: string;
  date: string;
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
