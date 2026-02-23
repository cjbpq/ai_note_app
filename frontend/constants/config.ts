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
  JOB_MAX_RETRIES: 45, // 最大轮询次数

  // 表单验证规则
  VALIDATION: {
    USERNAME_MIN: 3,
    USERNAME_MAX: 10,
    PASSWORD_MIN: 8,
    PASSWORD_MAX: 20,
  },

  // 图片配置
  IMAGE: {
    MAX_SIZE_MB: 10,
    ALLOWED_TYPES: ["image/jpeg", "image/png"],

    // 单次上传允许的最大图片数量（后端限制 10 张）
    MAX_UPLOAD_COUNT: 10,

    // ── Picker / 相机参数 ──────────────────────────────
    // quality: 0~1，越高图片越清晰但文件越大，影响上传速度
    // 0.8 是清晰度与体积的平衡点；校园网较慢时可降至 0.6
    PICKER_QUALITY: 0.8,

    // 是否允许用户在选图/拍照后进入系统裁剪界面
    // 注意：Android 系统裁剪体验一般，后续可能替换为自定义方案
    PICKER_ALLOWS_EDITING: true,

    // 是否启用固定裁剪比例
    // false: 使用系统自由裁切（推荐，操作更灵活）
    // true : 使用 PICKER_ASPECT 固定比例
    PICKER_CROP_USE_FIXED_ASPECT: false,

    // 裁剪框宽高比 [宽, 高]，仅在 PICKER_ALLOWS_EDITING=true 时生效
    // [4,3] 适合横向笔记；如需竖向 A4 纸可改为 [3,4]
    PICKER_ASPECT: [4, 3] as [number, number],
  },

  // 搜索相关
  SEARCH_DEBOUNCE_MS: 300, // 搜索防抖延迟（毫秒）— 本地搜索可更快响应
  MAX_SEARCH_HISTORY: 10, // 本地搜索历史最大保留条数
  MAX_TAG_DISPLAY_COUNT: 15, // 搜索页标签 Chip 最大展示数量（按频次 Top N）

  // 分类相关
  MAX_CATEGORY_NAME_LENGTH: 20, // 新建分类名称最大长度
  CATEGORY_STALE_TIME: 1000 * 60 * 5, // 分类缓存新鲜时间 5 分钟

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
    REFRESH: "/auth/refresh", // Token 刷新接口
    ME: "/auth/me", // 获取当前用户信息
  },
  LIBRARY: {
    UPLOAD_IMAGE: "/library/notes/from-image",
    GET_NOTE: "/library/notes",
    SEARCH_NOTES: "/library/search", // GET /library/search?q=keyword
    GET_CATEGORIES: "/library/categories",
    TOGGLE_FAVORITE: (id: string) => `/library/notes/${id}/favorite`,
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
  AUTH_USER: "auth_user", // 用户信息持久化
  USER_INFO: "user_info",
  NOTES_CACHE: "notes_cache",
  TOKEN_EXPIRES_AT: "token_expires_at", // Token 过期时间
  UI_THEME_MODE: "ui_theme_mode", // 主题模式（浅色/深色/跟随系统）
  SEARCH_HISTORY: "search_history", // 本地搜索历史记录
  LOCAL_NEW_CATEGORIES: "local_new_categories", // 本地新建但尚未上传的分类名列表
} as const;
