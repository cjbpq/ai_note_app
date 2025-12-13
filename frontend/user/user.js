// ============================================
// 用户个人中心页面逻辑
// ============================================

// 一、页面初始化 - 渲染用户信息
document.addEventListener("DOMContentLoaded", () => {
  renderUserInfo();
  renderStats();
});

// 二、渲染用户信息
function renderUserInfo() {
  // 从 localStorage 获取用户信息（后续可改为从后端获取）
  const userInfo = JSON.parse(localStorage.getItem("userInfo")) || {
    username: "游客用户",
    email: "未登录",
    avatar: "../uploads/f2ed2c69e1ccc614c0f1ce6f383cdd8c.jpg",
  };

  document.getElementById("username").textContent = userInfo.username;
  document.getElementById("email").textContent = userInfo.email;

  if (userInfo.avatar) {
    document.getElementById("user-avatar").src = userInfo.avatar;
  }
}

// 三、渲染统计数据
function renderStats() {
  // 从 localStorage 获取笔记数据
  const data = JSON.parse(localStorage.getItem("data")) || [];

  // 计算分类数
  const categoryCount = data.length;

  // 计算笔记总数
  let noteCount = 0;
  data.forEach((category) => {
    noteCount += category.sons ? category.sons.length : 0;
  });

  // 计算使用天数（简单模拟，可改为真实注册时间）
  const registerDate = localStorage.getItem("registerDate");
  let daysCount = 1;
  if (registerDate) {
    const diffTime = Math.abs(new Date() - new Date(registerDate));
    daysCount = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  } else {
    // 首次使用，记录日期
    localStorage.setItem("registerDate", new Date().toISOString());
  }

  document.getElementById("note-count").textContent = noteCount;
  document.getElementById("category-count").textContent = categoryCount;
  document.getElementById("days-count").textContent = daysCount;
}

// 四、退出登录
document.getElementById("logout-btn").addEventListener("click", () => {
  if (confirm("确定要退出登录吗？")) {
    // 清除登录状态（保留笔记数据）
    localStorage.removeItem("userInfo");
    localStorage.removeItem("token");

    // 跳转到登录页
    window.location.href = "../login/login.html";
  }
});

// 五、菜单项点击（预留功能）
document.querySelectorAll(".menu-item").forEach((item, index) => {
  item.addEventListener("click", () => {
    const menuNames = ["我的笔记", "设置", "帮助与反馈", "关于"];

    switch (index) {
      case 0: // 我的笔记
        window.location.href = "../read/read.html";
        break;
      case 1: // 设置
        alert("设置功能开发中...");
        break;
      case 2: // 帮助与反馈
        alert("如有问题请联系：support@ainote.com");
        break;
      case 3: // 关于
        alert("AI-Note v1.0\n智能笔记助手");
        break;
    }
  });
});
