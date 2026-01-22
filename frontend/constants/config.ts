/**
 * 应用全局配置
 *存放那些"固定的、业务相关的、不需要根据环境变化的值"。
 * 注意：敏感信息放 . env 文件
 */
export const ROUTES = {
  HOME: "(tabs)/index", // 示例：虽然 Expo Router 是基于文件的，但在做跳转时定义常量可以防手误
  LOGIN: "login",
  NOTE_DETAIL: "/note", // 笔记详情页基础路径，使用时拼接 ID: `/note/${id}`
};

export const APP_CONFIG = {
  // API 端点 (从 . env 读取)
  // 使用 .trim() 防止 .env 配置中末尾意外的空格导致请求 URL 错误 (如: /api/v1 /library...)
  API_BASE_URL: (
    process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api/v1"
  ).trim(),

  // 静态资源基础 URL
  // 用于拼接后端返回的相对图片路径（如 /static/xxx.jpg → http://host/static/xxx.jpg）
  // 注意：静态文件路径不需要 /api/v1 前缀
  STATIC_BASE_URL: (() => {
    const apiUrl = (
      process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api/v1"
    ).trim();
    // 从 API URL 中提取服务器根地址（移除 /api/v1 等路径后缀）
    try {
      const url = new URL(apiUrl);
      return `${url.protocol}//${url.host}`;
    } catch {
      // 如果 URL 解析失败，简单删除 /api 路径
      return apiUrl.replace(/\/api.*$/, "");
    }
  })(),

  // 数据库相关
  DB_NAME: "campus_notes.db",

  // 超时配置
  REQUEST_TIMEOUT: 10000, // 10秒
  JOB_POLL_INTERVAL: 2000, // 任务轮询间隔 2秒
  JOB_MAX_RETRIES: 30, // 最大轮询次数

  // 表单验证规则
  VALIDATION: {
    USERNAME_MIN: 3,
    USERNAME_MAX: 10,
    PASSWORD_MIN: 6,
    PASSWORD_MAX: 12,
  },

  // 图片配置
  IMAGE: {
    MAX_SIZE_MB: 10,
    ALLOWED_TYPES: ["image/jpeg", "image/png"],
  },

  // UI 交互相关
  TOAST_DURATION: 2000, // 弹窗提示停留时间
  ACTIVE_OPACITY: 0.7, // 按钮按下时的透明度

  // 业务逻辑相关
  MAX_TITLE_LENGTH: 50, // 笔记标题最大长度
  MAX_CONTENT_PREVIEW_LENGTH: 100, // 列表页预览文字长度
} as const;

/**
 * API 端点路径
 */
export const ENDPOINTS = {
  AUTH: {
    LOGIN: "/auth/login",
    REGISTER: "/auth/register",
  },
  LIBRARY: {
    UPLOAD_IMAGE: "/library/notes/from-image",
    GET_NOTE: "/library/notes",
    GET_CATEGORIES: "/library/categories",
  },
  UPLOAD: {
    GET_JOB: "/upload/jobs",
  },
} as const;

/**
 * 本地存储 Key（统一管理避免拼写错误）
 */
export const STORAGE_KEYS = {
  AUTH_TOKEN: "auth_token",
  USER_INFO: "user_info",
  NOTES_CACHE: "notes_cache",
} as const;
