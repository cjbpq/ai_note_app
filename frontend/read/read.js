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

//二.页面关联性设计？
//右上角用户登录
const user_login = document.querySelector(".user img");
user_login.addEventListener("click", () => {
  window.location.href = "../login/login.html";
});
//左上角返回主页
const back_mian = document.querySelector(".back");
back_mian.addEventListener("click", () => {
  window.location.href = "../main/main.html";
});

//三.render渲染逻辑：从本地的数据中再次渲染
//1.左侧的库目录渲染
let my_data = JSON.parse(localStorage.getItem("data"));
function renderLibrary() {
  //1。左侧渲染
  const newdata = my_data.map(function (ele, index) {
    const fa = _.cloneDeep(ele); //父级对象
    const pid = index; //父级id
    //子目数组 下面进行修改
    const sons = fa.sons.map(function (ele, index) {
      const sid = index; //子级id
      return ` 
<li><a href="#" data-pid=${pid} data-sid=${sid}>${ele.title}</a></li>
`;
    }); //sons数组中存放的就是html化后的文本

    return `  
          <li id=${fa.class}>
            <h5>
              ${fa.class}
              <svg
                t="1763690579466"
                class="icon"
                viewBox="0 0 1024 1024"
                version="1.1"
                xmlns="http://www.w3.org/2000/svg"
                p-id="10117"
                width="200"
                height="200"
              >
                <path
                  d="M761.6 489.6l-432-435.2c-9.6-9.6-25.6-9.6-35.2 0-9.6 9.6-9.6 25.6 0 35.2l416 416-416 425.6c-9.6 9.6-9.6 25.6 0 35.2s25.6 9.6 35.2 0l432-441.6C771.2 515.2 771.2 499.2 761.6 489.6z"
                  p-id="10118"
                ></path>
              </svg>
            </h5>
            <ul>
              ${sons.join("")}
            </ul>
          </li>`;
  });
  //至此newdata中的数据已经完全html化 原来的对象数据变成了现在的html文本
  document.querySelector(".left ul").innerHTML = newdata.join(""); //赋值
}
renderLibrary(); //页面刷新执行script时就会渲染  当然有操作的时候也需要渲染

//2.右侧渲染
//2.0渲染函数设置
function renderContent(title, content, pic) {
  document.querySelector(".note_title").innerHTML = title || "笔记标题";
  document.querySelector(".note_content p").innerHTML = content || "笔记内容";
  // document.querySelector(".origin_pic img").src = pic; //如果没有加载出来可能会显示是一个未加载的图片
  //异常处理 如果没有图片设置就直接不显示
  const img = document.querySelector(".origin_pic img");
  if (pic) {
    img.src = pic; // 直接用 Base64 字符串
    img.style.display = "block";
  } else {
    img.style.display = "none";
  }
  //注意到这个过程中一定需要直到自己目前选中（点击）的是哪一个子目 用他们来替换上面的一大串  因而需要在为子目绑定的事件里回调这个函数
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
