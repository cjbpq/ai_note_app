//预备渲染：1.图片base64转换
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result); // 成功返回 Base64
    reader.onerror = (error) => reject(error);
  });
}

// 一.左侧目录栏 点击展开和隐藏的功能设计
const libaries = document.querySelector(".left ul");
libaries.addEventListener("click", (e) => {
  if (e.target.tagName === "H5") {
    const ul = e.target.nextElementSibling;
    ul.classList.toggle("collapsed");

    //2.点击目录栏展开后箭头向下
  }
});

//二.上传按钮点击设计:点击上传文件后返回输出的文档笔记(较为复杂 需要前后台数据存储和处理)
//默认关闭按钮 只有输入了文件或者成功或失败返回再启用
//1.点击相机调用图片库文件
const upload = document.querySelector(".upload");
const inPut = document.querySelector("#file-upload");
const btn = document.querySelector(".btn-primary");
btn.disabled = true;
//模拟调用
upload.addEventListener("click", () => {
  inPut.click();
});
//2.当检测到有文件上传时启用按钮 提示确认上传

// 获取用户选的文件  设定为了全局变量
let file;

inPut.addEventListener("change", (e) => {
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

//3.完成模拟（真实文件上传） 异步函数
//接收的笔记title 和content
let outPutTitle = "";
let outPutContent = "";
//token请求头
const myToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3Nzc3Nzc3IiwiZXhwIjoxNzY1MDc4NjQ2fQ.4R7TRzoxrdsjpc5-cuEPHTuEmkCX0icRe58qfzYw928";
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
  //*3.2真实的文件上传流程 但是当上传失败时会阻止运行吗？ 如果阻止运行 下面的分支结构可能需要修改
  // 3.2.1. 上传图片 返回任务id
  const formData = new FormData();
  formData.append("file", file);

  let jobId = null;
  try {
    const response = await fetch(
      "http://20.214.240.47:8000/api/v1/library/notes/from-image",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${myToken}`,
          // 注意：使用 FormData 时，浏览器会自动设置 Content-Type，不要手动设置
        },
        body: formData,
      }
    );
    //fetch后查询是否错误 抛出阻止代码执行
    if (!response.ok) throw new Error(`上传失败：${response.status}`);
    const result = await response.json();
    //测试错误 应该会在await返回后才创建吧？ 否则为null就会报错  也就是说所有涉及异步都同步代码都会等到异步完成后才执行吗？ await导致后续代码都等待返回 按顺序执行
    console.log(1, result);

    console.log("上传成功，任务id是：", result.job_id);
    jobId = result.job_id;
  } catch (error) {
    console.error("上传失败", error);
  }
  console.log(jobId);
  //3.2.2实时任务id查询  接收笔记id
  let noteId = null;
  try {
    let result = "";
    while (!noteId) {
      const response = await fetch(
        `http://20.214.240.47:8000/api/v1/upload/jobs/${jobId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${myToken}`,
            "Content-Type": "application/json",
          },
          // GET 请求不能带 body
        }
      );
      if (!response.ok) throw new Error(`查询失败：${response.status}`);
      result = await response.json();
      noteId = result.note_id;
    }
    console.log(2, result);
    console.log("查询成功，笔记id是：", noteId);
  } catch (error) {
    console.error("查询失败", error);
  }

  //3.2.3用笔记Id查询笔记 获取笔记内容 （json格式）

  try {
    const response = await fetch(
      `http://20.214.240.47:8000/api/v1/library/notes/${noteId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${myToken}`,
          "Content-Type": "application/json",
        },
        // GET 请求不能带 body
      }
    );
    if (!response.ok) throw new Error(`查询失败：${response.status}`);
    const result = await response.json();
    console.log(3, result);
    console.log("获取成功，笔记标题是：", result.title);
    outPutTitle = result.title;
    outPutContent = result.structured_data.summary;
  } catch (error) {
    console.error("获取失败", error);
  }
  //3.2.4输出 成功或者失败
  //非空执行  这里的疑问就在于害怕前面的异步代码没有执行时直接执行这行同步代码导致content为空判断失败后不再进行判断  每秒一次用于测试 可能有点慢
  //实际上由于await导致不会优先执行同步代码  而且之前一直有throw抛出错误 导致走到这里的话必然已经返回笔记结果

  //清空输入缓存
  // inPut.value = "";//注意这里的清空缓存需要滞后 再保存函数完成后（后端数据库告知200后清空）

  const card = this.nextElementSibling;

  btn.disabled = false;
  btn.innerHTML = "点击上传";
  //调用output输出
  outPut(outPutTitle, outPutContent);
  card.style.display = "flex";
  //重置按钮
  btn.innerHTML = "拍照上传图片";
  btn.disabled = true;
});
function outPut(my_title, my_content) {
  let title = document.querySelector(".output h3");
  let content = document.querySelector(".output p");
  //均采用模板字符串 可以换行也便于后台接受数据  需要前面所返回的json数据解析出需要的数据放到这里
  title.innerHTML = my_title;
  content.innerHTML = my_content;
}

//三.需要一个用户登录设置功能
const user_login = document.querySelector(".user img");
user_login.addEventListener("click", () => {
  //页面跳转到登录界面  或者是简单的开一个小的窗口 ？
  //没有预先设置a 标签的话只能更改url地址？ 然后再登录成功后再返回（哦哦那就还需要一个我们的宣传index界面 来作为没有登录的用户的临时中转站 登录后进入main)
  window.location.href = "../login/login.html";
});

//四.库目录进入子页面 仓库
//设计：为最大的ul绑定事件 通过检查是否是所需要的A 被点击 然后为每个li带上一个特殊的标记(pid sid) 好在进入到read界面有适当的渲染
//或者是为a设定跳转页面 但是很显然最后肯定是要跳到同一个页面内后设置渲染函数来搞得
const Library = document.querySelector(".left");
Library.addEventListener("click", (e) => {
  //判断是否是A
  if (e.target.tagName !== "A") {
    return;
  }
  //到这里确定点击了a标签 但是不知道点的是哪个a标签  在这里先不做区分了（后续通过e.target查询） 直接跳转到read界面
  e.preventDefault(); // 阻止 a 标签的默认跳转行为
  window.location.href = `../read/read.html?pid=${e.target.dataset.pid}&sid=${e.target.dataset.sid}`; //传递pid sid 的url参数
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

//六.笔记存储逻辑： 前提：需要一个能够实时刷新左侧目录栏的函数 那么需要一个“数据库”？像画板一样保存真实的目录栏 然后每次更新数据后调用render()函数
//同时这个目录栏还需要能够根据真实所需要的笔记排版来刷新 就是每个子目录里有多少个笔记
//！存储部分：当点击save按钮后数据还需要发给后端告诉 这个笔记需要存储  那么这里是否需要后端给我建一个笔记的数据库 让他在后端存储 完了之后返回给我data 然后我再根据data来刷新前端（那么这样子是否会略微有点慢？）
//summary:点击保存——>告知后端刷新数据库——>返回新的data——>前端刷新目录栏
//problem:这个异步过程是否会慢 导致前端体验不流畅？但可能也不会因为只是一个简单的存储刷新

//1.首先完成一个前端模拟渲染脚本 自己的data（后端传过来 经过去jso化）+render()函数渲染
//1.1本地数据存储与获取
const file1 = ""; //这里的图片是和我上面传给后端的file一样的吗 如果是的话我是否就可以直接在前端每次自己直接去save的时候存储起来了
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
        pic: file1,
      },
      {
        id: 2,
        title: "童年",
        content: "这里是要返回的笔记内容",
        pic: file1,
      },
    ],
  },
  {
    class: "Math",
    sons: [
      {
        id: 1,
        title: "故乡的秋",
        content: "这里是要返回的笔记内容",
        pic: file1,
      },
    ],
  },
  {
    class: "English",
    sons: [
      {
        id: 1,
        title: "童年",
        content: "这里是要返回的笔记内容",
        pic: file1,
      },
    ],
  },
];
//那么下面的对象就要涉及深度处理了（大多数时候可能是两层） 至于说后端准备返回的数据是否是这种形式 我觉得可以由前端自己来全权管理（因为毕竟咱们这个笔记类型的数据 也并没有很复杂 而且确实比较需要前端反应）
//只是说需要在很多地方加以管理

//模拟一下真实的本地存储 因为前端也要注意存储关键信息 用于渲染 比如是在后端第一次返回笔记的时候其实已经可以将其中的信息提取出来然后去存储到本地了
localStorage.setItem("data", JSON.stringify(data));
let my_data = JSON.parse(localStorage.getItem("data")); //从本地获得数据

//1.2界面渲染(注意在页面每次跳转时都要及时渲染 因为页面会刷新)
//下面是需要写的一个渲染函数  可不可以双层嵌套渲染 首先根据class渲染出需要的几个大的分类库 然后再次渲染其内部的li
function render() {
  //1.2.1最小笔记子目渲染  用数组方法来为html添加要渲染的数据
  //   const newdata = my_data.map(function (ele, index) {
  //     return `
  // <li><a href="#">${ele.title}</a></li>
  // `;
  //   });
  //   document.querySelector(`#${my_data[0].class} ul`).innerHTML =
  //     newdata.join(""); //空字符串转换为html文本

  //1.2.2渲染分类目  目标：建立几个独立的分类目 语文，数学，英语
  //从哪里读取数据？（oo对的至于有几个的问题 只要根据返回来的元数据修改就OK 本质上是直接对数据进行"html“化 然后再整体（渲染）添加到文本中）
  //感觉还是嵌套对象比较方便 就是很像真实的笔记结构 而且也节省空间
  //那么现在整理后的数据格式感觉似乎对某一个分类目集中处理是一个更好的选择？ class,sons数组都有 分别处理为大的分类和子目html好像就可以
  //这样子其他的数组元素依次类推就OK
  // const one = my_data[0]; //获取某一个分类目 下面对他进行处理  直接赋值似乎没有导致数据丢失 但是似乎会对原始数据直接修改 因为复杂数据类型传的是栈内的地址
  // console.log(one); //没有丢失
  // one.class = "";
  // console.log(my_data[0]); //但是被修改了  因此需要深拷贝处理 毕竟不想修改我的前端数据库
  // const fa = _.cloneDeep(my_data[0]); //父级对象
  //子目数组 下面进行修改
  //   const sons = fa.sons.map(function (ele, index) {
  //     return `
  // <li><a href="#">${ele.title}</a></li>
  // `;
  //   }); //sons数组中存放的就是html化后的文本

  //下面是直接对fa对象进行操作 还是再重新创建一个？  由于现在的外层仍然只是一个数据所以再这里先实验一下单个父级目录的一次渲染
  // document.querySelector(".left ul").innerHTML = `
  //         <li id=${fa.class}>
  //           <h5>
  //             ${fa.class}
  //             <svg
  //               t="1763690579466"
  //               class="icon"
  //               viewBox="0 0 1024 1024"
  //               version="1.1"
  //               xmlns="http://www.w3.org/2000/svg"
  //               p-id="10117"
  //               width="200"
  //               height="200"
  //             >
  //               <path
  //                 d="M761.6 489.6l-432-435.2c-9.6-9.6-25.6-9.6-35.2 0-9.6 9.6-9.6 25.6 0 35.2l416 416-416 425.6c-9.6 9.6-9.6 25.6 0 35.2s25.6 9.6 35.2 0l432-441.6C771.2 515.2 771.2 499.2 761.6 489.6z"
  //                 p-id="10118"
  //               ></path>
  //             </svg>
  //           </h5>
  //           <ul>
  //             ${sons.join("")}
  //           </ul>
  //         </li>`;

  //这样的话成功的添加了一个li分类目 后续改为数组Map即可
  //注意这里的fa,sons操作都是针对于my_data[0]重新建立的一个模板似的临时操作数组 或者对象 使得结构更加清晰 也不会影响原始数据
  //一个父级目录的渲染完成了 下面对整个my_data数组进行逐个的类似修改   然后再用newdata一次性给ul赋值Li
  //1.2.3整个目录的渲染
  //首先需要拷贝一个my_data数组的临时操作数组
  // const newdata = _.cloneDeep(my_data); //得到一个完整的拷贝数组
  //下面需要遍历newdata进行html化的处理  似乎有点问题 那么后续还需要再次接收
  //那么是否直接对my_data进行上面2的处理 然后返回刚刚的Html文本似乎就可以了
  const newdata = my_data.map(function (ele, index) {
    //这里的深拷贝已经做了预防处理了 注意到ele===my_data[0]
    const fa = _.cloneDeep(ele); //父级对象
    const pid = index; //父级id
    //子目数组 下面进行修改
    const sons = fa.sons.map(function (ele, index) {
      const sid = index; //子级id
      return ` 
<li><a href="#" data-pid=${pid} data-sid=${sid}  >${ele.title}</a></li>
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
render();
//至此 左侧的目录栏刷新已经完备 只需在合适的时候调用render即可（当然还有查找 删除等可能需要后端数据 本地数据同步修改...似乎 那么直接修改data原始数据不就ok了）

// 有关简单的笔记存储界面的实时渲染 也就是弹窗中的笔记目录栏要和左侧真实刷新的一样  而且当用户选择了某一个真实的目录栏后需要左侧重新渲染，当然也需要存储到本地
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
  //哦不不 我需要的标题和内容都已经在我的card内了 只是一些其他的数据可能在异步过程中没有传出来 这个的话后续再想办法存出来？优先最小可行方案
  //一会儿这个save直接放到modal的点击事件中 当作回调函数即可
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
  inPut.value = ""; // 清空 input
  //5.重新渲染
  render();

  console.log(my_data);

  //还需要改这个逻辑 实在太史而且没有健壮性
}
