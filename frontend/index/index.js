//一.跳转
const reg_btn = document.querySelector(".cta-button");
reg_btn.addEventListener("click", () => {
  location.href = "../login/login.html";
});

document.querySelector(".nav-links").addEventListener("click", (e) => {
  if (e.target.tagName === "A") {
    location.href = "../login/login.html";
  }
});

// ============================================
// 二. 移动端汉堡菜单控制
// ============================================

const hamburgerBtn = document.querySelector(".hamburger-btn");
const navLinks = document.querySelector(".nav-links");
const navOverlay = document.querySelector(".nav-overlay");

// 切换菜单状态
function toggleMenu() {
  hamburgerBtn.classList.toggle("active");
  navLinks.classList.toggle("open");
  navOverlay.classList.toggle("show");
}

// 关闭菜单
function closeMenu() {
  hamburgerBtn.classList.remove("active");
  navLinks.classList.remove("open");
  navOverlay.classList.remove("show");
}

// 汉堡按钮点击
hamburgerBtn.addEventListener("click", toggleMenu);

// 遮罩层点击关闭
navOverlay.addEventListener("click", closeMenu);

// 点击导航链接后也关闭菜单
navLinks.addEventListener("click", (e) => {
  if (e.target.tagName === "A") {
    closeMenu();
  }
});
