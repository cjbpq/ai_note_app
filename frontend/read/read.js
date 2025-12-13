//一.与主页面相同的左侧目录栏处理
const libaries = document.querySelector(".left ul");
libaries.addEventListener("click", (e) => {
  if (e.target.tagName === "H5") {
    // 优化选择兄弟元素：nextElementSibling 会自动跳过换行符/空格，直接找下一个标签
    const ul = e.target.nextElementSibling;
    ul.classList.toggle("collapsed");

    //2.点击目录栏展开后箭头向下
  }
});

//二.render渲染逻辑：从本地的数据中再次渲染
//1.左侧的库目录渲染
let my_data = JSON.parse(localStorage.getItem("data"));
renderLibrary(my_data); //页面刷新执行script时就会渲染  当然有操作的时候也需要渲染

//2.右侧渲染
//2.0渲染函数设置
//注意到这个过程中一定需要直到自己目前选中（点击）的是哪一个子目 用他们来替换上面的一大串  因而需要在为子目绑定的事件里回调这个函数
function renderContent(title, content, pic) {
  document.querySelector(".note_title").innerHTML = title || "笔记标题";
  document.querySelector(".note_content p").innerHTML = content || "笔记内容";
  //异常处理 如果没有图片设置就直接不显示
  const img = document.querySelector(".origin_pic img");
  if (pic) {
    img.src = pic; // 直接用 Base64 字符串
    img.style.display = "block";
  } else {
    img.style.display = "none";
  }
}
//2.1解析与预渲染模块
document.addEventListener("DOMContentLoaded", () => {
  // 1. 获取 URL 中的参数字符串 (例如 "?pid=0&sid=2")
  const queryString = window.location.search;

  // 2. 使用标准 API 解析参数
  const urlParams = new URLSearchParams(queryString);
  const pid = urlParams.get("pid");
  const sid = urlParams.get("sid");

  // 3. 拿着 ID 去“仓库”取数据
  // 注意：这里依然是用 localStorage，因为它是你的“前端数据库”
  const my_data = JSON.parse(localStorage.getItem("data"));
  //感觉有点冗余检查？
  if (my_data && my_data[pid] && my_data[pid].sons[sid]) {
    const targetNote = my_data[pid].sons[sid];
    // 4. 渲染页面
    renderContent(targetNote.title, targetNote.content, targetNote.pic);
  } else {
    console.error("找不到该笔记");
  }
});

//2.2选择切换右侧展示的笔记模块
document.querySelector(".left ul").addEventListener("click", (e) => {
  //那么这里有一个问题：怎么确定我点击的是哪一个元素？  总是感觉如果能为每一个子目笔记绑定一个id 并且可以直接通过这个Id找到这个笔记的相关信息 可能会对数组操作比较简化？
  //在这里先用标题遍历查找了？
  if (e.target.tagName !== "A") {
    return;
  }
  //直接通过之前设定的两个id查找   去my_data里 按着这个id路径就可以找到所有需要的数据了
  const note = my_data[e.target.dataset.pid].sons[e.target.dataset.sid]; //子目笔记对象
  const title = note.title;
  const content = note.content;
  const pic = note.pic;
  //调用renderContent函数丢进去  这样子就可以实现 点击子目——获取相关数据——渲染到页面中 的完整工作流了
  renderContent(title, content, pic);
});

// ============================================
// 三. 移动端抽屉式目录栏控制
// ============================================

const hamburgerBtn = document.querySelector(".hamburger-btn");
const leftDrawer = document.querySelector(".left");
const drawerOverlay = document.querySelector(".drawer-overlay");

// 打开抽屉
function openDrawer() {
  hamburgerBtn.classList.add("active");
  leftDrawer.classList.add("open");
  drawerOverlay.classList.add("show");
}

// 关闭抽屉
function closeDrawer() {
  hamburgerBtn.classList.remove("active");
  leftDrawer.classList.remove("open");
  drawerOverlay.classList.remove("show");
}

// 切换抽屉状态
function toggleDrawer() {
  if (leftDrawer.classList.contains("open")) {
    closeDrawer();
  } else {
    openDrawer();
  }
}

// 汉堡按钮点击
hamburgerBtn.addEventListener("click", toggleDrawer);

// 遮罩层点击关闭
drawerOverlay.addEventListener("click", closeDrawer);

// 点击笔记链接后关闭抽屉
leftDrawer.addEventListener("click", (e) => {
  if (e.target.tagName === "A") {
    closeDrawer();
  }
});

// 返回按钮事件（已有功能，确保移动端也能正常工作）
document.querySelector(".back").addEventListener("click", () => {
  window.location.href = "../main/main.html";
});
