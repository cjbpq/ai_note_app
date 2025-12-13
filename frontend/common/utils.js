/**
 * 公共工具函数
 * 使用方式：在 HTML 中引入此文件后，可直接调用这些函数
 */

/**
 * 将文件转换为 Base64 字符串
 * @param {File} file - 文件对象
 * @returns {Promise<string>} Base64 字符串
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
}

/**
 * 获取 URL 查询参数
 * @param {string} paramName - 参数名
 * @returns {string|null} 参数值
 */
function getUrlParam(paramName) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(paramName);
}

/**
 * 页面跳转
 * @param {string} path - 相对路径
 */
function navigateTo(path) {
  window.location.href = path;
}

/**
 * 显示/隐藏元素
 * @param {HTMLElement} element - DOM 元素
 * @param {boolean} show - 是否显示
 */
function toggleDisplay(element, show) {
  element.style.display = show ? "block" : "none";
}

/**
 * 延迟等待函数（用于轮询等场景）
 * @param {number} ms - 等待的毫秒数
 * @returns {Promise<void>}
 * @example
 * // 在 async 函数中使用
 * await sleep(1000); // 等待 1 秒
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
//完整版
// function sleep(ms) {
//   return new Promise((resolve, reject) => {
//     setTimeout(() => {
//       resolve();  // 时间到了，调用 resolve 表示完成
//     }, ms);
//   });
// }
