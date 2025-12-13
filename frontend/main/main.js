//规范：全部大写字母表示常量 小驼峰表示函数 下划线表示特定的量或者对象

//这里放置几个关键的全局变量声明
// let file;

// 一.左侧目录栏 点击展开和隐藏的功能设计
const libaries = document.querySelector(".left ul");
libaries.addEventListener("click", (e) => {
  if (e.target.tagName === "H5") {
    const ul = e.target.nextElementSibling;
    ul.classList.toggle("collapsed");

    //2.点击目录栏展开后箭头向下
  }
});

//二.上传按钮点击设计:点击上传文件后返回输出的文档笔记
//1.点击相机调用图片库文件
const upload = document.querySelector(".upload");
const input = document.querySelector("#file-upload");
const btn = document.querySelector(".btn-primary");
btn.disabled = true;
//模拟调用
upload.addEventListener("click", () => {
  input.click();
});
//2.当检测到有文件上传时启用按钮 提示确认上传

// 获取用户选的文件  设定为了全局变量
let file;
input.addEventListener("change", (e) => {
  file = e.target.files[0];
  console.log(file);
  //检验是否为空
  if (!file) return;
  //输出文件名  最好能够提示一下上传的文件     或者！！做一个图片的预览框
  const tips = document.querySelector(".tips");
  tips.innerHTML = `您所上传的图片是：<br />[${file.name}]`;

  btn.innerHTML = "确认上传";
  btn.disabled = false;
});

//3.文件上传 异步请求
btn.addEventListener("click", async function (e) {
  e.preventDefault();
  //3.0这里还需要进行一个清除之前的设置的操作 因为进入了一轮新的事件循环
  //隐藏card
  document.querySelector(".card").style.display = "none"; //如果已经是None了也没有影响
  //save按钮重置
  document.querySelector(".save").classList.remove("disabled");

  //3.1加载样式处理 在异步等待过程中持续进行 除非返回结果或者抛出错误  并且要复位或者做出相应提示处理
  btn.innerHTML = "正在处理...";
  btn.disabled = true;

  //*3.2 异步api请求：主页上传
  const result_upload = await mainUpload(file);

  //3.3输出 成功或者失败  这里缺少一个失败处理
  const card = this.nextElementSibling;
  btn.disabled = false;
  btn.innerHTML = "点击上传";
  //调用output输出
  outPutShow(result_upload.output_title, result_upload.output_content);
  card.style.display = "flex";
  //重置按钮
  btn.innerHTML = "拍照上传图片";
  btn.disabled = true;
});
function outPutShow(my_title, my_content) {
  document.querySelector(".output h3").innerHTML = my_title;
  document.querySelector(".output p").innerHTML = my_content;
}

//三.需要一个用户登录设置功能
const user_login = document.querySelector(".user img");
user_login.addEventListener("click", () => {
  navigateTo("../login/login.html");
});

//四.库目录进入子页面 仓库
//设计：为最大的ul绑定事件 通过检查是否是所需要的A 被点击 然后为每个li带上一个特殊的标记(pid sid) 好在进入到read界面有适当的渲染
const Library = document.querySelector(".left");
Library.addEventListener("click", (e) => {
  if (e.target.tagName !== "A") {
    return;
  }
  e.preventDefault(); // 阻止 a 标签的默认跳转行为
  navigateTo(
    `../read/read.html?pid=${e.target.dataset.pid}&sid=${e.target.dataset.sid}`
  ); //传递pid sid 的url参数
});

// 五.弹窗交互设置
const overlay = document.querySelector(".modal_overlay");
const save = document.querySelector(".save"); //保存按钮 后续在存储笔记时也要用到
//打开
save.addEventListener("click", () => {
  overlay.style.display = "flex";
  //防止多次重复点击  但是在card重新刷新的时候需要去掉这个disabled类 当然还需要隐藏掉card（这些都是在确定上传时的逻辑 中）
  save.classList.add("disabled");
});
//关闭
overlay.addEventListener("click", (e) => {
  if (e.target.tagName === "LI") {
    overlay.style.display = "none";
    saveData(e.target.dataset.pid); //这边需要传进去一个所选中的分类目的id序列号 便于后续查找
    alert(`已保存到 ${e.target.innerHTML} `);
  }
});

//六.笔记存储逻辑：
//！存储部分：当点击save按钮后数据还需要发给后端告诉 这个笔记需要存储  那么这里是否需要后端给我建一个笔记的数据库 让他在后端存储 完了之后返回给我data 然后我再根据data来刷新前端（那么这样子是否会略微有点慢？）
//summary:点击保存——>告知后端刷新数据库——>返回新的data——>前端刷新目录栏
//problem:这个异步过程是否会慢 导致前端体验不流畅？但可能也不会因为只是一个简单的存储刷新

//1.首先完成一个前端模拟渲染脚本 自己的data（后端传过来 经过去json化）+render()函数渲染
//1.1本地数据存储与获取
//后端数据
data = [
  {
    //父级的分类目
    class: "Chinese",
    //对象数组存放该类下的子目
    sons: [
      {
        id: 1,
        title: "故乡的秋",
        content: "这里是要返回的笔记内容",
        pic: "../uploads/正则表达式中常见字符类预定义.png",
      },
      {
        id: 2,
        title: "童年",
        content: "这里是要返回的笔记内容",
        pic: "../uploads/Snipaste_2025-11-18_21-55-28.png",
      },
    ],
  },
  {
    class: "Math",
    sons: [
      {
        id: 1,
        title: "祥林嫂",
        content: "这里是要返回的笔记内容",
        pic: "../uploads/Snipaste_2025-11-18_16-11-56.png",
      },
    ],
  },
  {
    class: "English",
    sons: [
      {
        id: 1,
        title: "哈基米",
        content: "这里是要返回的笔记内容",
        pic: "../uploads/Snipaste_2025-11-06_14-12-05.png",
      },
    ],
  },
];

//存储后端数据
localStorage.setItem("data", JSON.stringify(data));
let my_data = JSON.parse(localStorage.getItem("data")); //从本地获得数据

//1.2界面渲染(注意在页面每次跳转时都要及时渲染 因为页面会刷新)
renderLibrary(my_data);
//至此 左侧的目录栏刷新已经完备 只需在合适的时候调用render即可（当然还有查找 删除等可能需要后端数据 本地数据同步修改...似乎 那么直接修改data原始数据不就ok了）

//2.save弹窗和存储渲染  需要对modal-overlay操作
//2.1先实现一个简单的父级目录渲染（不涉及子目录渲染和下拉显示） 可以达到一级保存即可
const chooseData = my_data.map(function (ele, index) {
  //这里暂时只对父级元素处理  后续可能需要对子目处理 比如下拉菜单
  const fa = _.cloneDeep(ele); //父级对象
  return `<li data-pid=${index}>${fa.class}</li>`;
}); //得到一个存放着所有父级分类目的html化数组
overlay.querySelector("ul").innerHTML = chooseData.join(""); //这里需要放进去需要的Li数组

//下面需要处理真实的保存逻辑:前端传入图片-后端返回标题和内容等数据-前端点击save按钮并完成目录位置选择后需要本地存储＋告知后端+本地数据再次渲染（注意前面的前端数据不要清除）
// 2.2数据存储本地＋后端：file title content等
//2.2.1首先实现一个比较简单的将笔记直接存到分类目下  只需要对sons进行操作添加一个对象 但是注意到这个过程涉及事件逻辑 不如再分装一个存储函数？
async function saveData(pid) {
  //逻辑：在选择完成需要的分类目后直接为本地的data中的sons数组添加一个对象

  //1.异步的保存请求（后续也可能会在生成笔记前 优先选择要放置的位置 然后不再多余请求？） 但是这里就还是标准化处理了

  //这里先用来写前端本地的图片转换  原理：将图片用api转换为base64字符串存储 需要使用时直接用字符串替换img的src即可（但是存储有限）

  let base64Pic = "";
  if (file) {
    try {
      base64Pic = await fileToBase64(file); // 等待转换完成
    } catch (e) {
      console.error("图片转换失败", e);
    }
  }

  //2.修改my_data 通过pid查找到需要添加的分类目
  my_data[pid].sons.push({
    id: my_data[pid].sons.length + 1, //后续可能修改
    title: document.querySelector(".output h3").innerHTML,
    content: document.querySelector(".output p").innerHTML,
    pic: base64Pic || "", //base64字符串
  });
  //3.修改本地的数据（注意这里的存储需要注意看是否存满了 因为图片存在了本地）
  try {
    localStorage.setItem("data", JSON.stringify(my_data));
  } catch (e) {
    if (e.name === "QuotaExceededError") {
      alert("存储空间已满！图片太大了，请清除一些旧笔记或使用小图。");
      // 这里可能需要回滚 push 操作
      my_data[pid].sons.pop();
    }
  }

  //4.清空目前的数据
  file = null; //清空file
  input.value = ""; // 清空 input
  //5.重新渲染
  renderLibrary(my_data);

  console.log(my_data);

  //还需要改这个逻辑 实在太史而且没有健壮性
}

// ============================================
// 七. 移动端抽屉式目录栏控制
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

// 点击目录栏中的笔记链接后也关闭抽屉（提升移动端体验）
leftDrawer.addEventListener("click", (e) => {
  if (e.target.tagName === "A") {
    closeDrawer();
  }
});
