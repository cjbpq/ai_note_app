import axios, {
  AxiosError,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";

// 这里应该换成你的真实后端地址
// 提示：如果是安卓模拟器，localhost 通常需要换成 10.0.2.2，或者使用局域网 IP
const BASE_URL = "http://localhost:3000/api";

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000, // 10秒超时
  headers: {
    "Content-Type": "application/json",
  },
});

// 请求拦截器：可以在这里统一添加 Token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // 示例：const token = await AsyncStorage.getItem('token');
    // if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  },
);

// 响应拦截器：可以在这里统一处理 401, 500 等错误
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response.data; // 直接返回 data 部分，简化调用
  },
  (error: AxiosError) => {
    // 可以在这里打印日志或触发全局提示
    console.error("API Error:", error.response?.status, error.message);
    return Promise.reject(error);
  },
);

export default api;
