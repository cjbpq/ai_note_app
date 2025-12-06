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
