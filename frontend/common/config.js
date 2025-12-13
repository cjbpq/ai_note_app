/**
 * 全局配置常量
 * 使用方式：在 HTML 中引入此文件后，可直接访问 CONFIG 对象
 */
const CONFIG = {
  // API 基础地址
  API_BASE_URL: "http://20.214.240.47:8000/api/v1",

  // API 端点
  ENDPOINTS: {
    LOGIN: "/auth/login",
    REGISTER: "/auth/register",
    UPLOAD_IMAGE: "/library/notes/from-image",
    GET_JOB: "/upload/jobs", // 需要拼接 jobId
    GET_NOTE: "/library/notes", // 需要拼接 noteId
  },

  // 本地存储的 key 名称（统一管理，避免拼写错误）
  STORAGE_KEYS: {
    AUTH_TOKEN: "auth_token",
    USERNAME: "username",
    PASSWORD: "password",
    EMAIL: "email",
    DATA: "data",
  },

  // 表单验证正则
  REGEX: {
    USERNAME: /^[a-zA-Z0-9_]{3,10}$/,
    EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    PASSWORD: /^[a-zA-Z0-9]{6,12}$/,
  },
};
