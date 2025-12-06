//问题：1.用户的注册与否登录与否的多种情况可能未考虑周全 算了 用户首次进入本web应当没有注册，本地没有存储，所以首先去注册，然后存储到本地，同时上传后端（但是因为已经注册过，所以返回了400错误）
//在实际的用户应用过程中不应当仅考虑单线程的过程 还应考虑多种情况（要么就是把各个环节条分缕析 不要拖泥带水 不明所以）
//2.登录界面的ui实在太丑 还需要用原始css,tailwind等优化设计
//3.在登录界面已有的token怎么传到upload界面？  就是我的web应该如何架构和联系？
//4.后续这个史山还需要大改  html,css,js都很史：包括命名，实现逻辑，css规范，整体结构管理等 但js的事件逻辑和异步函数部分还相对可以
//5.没有禁用按钮的设定 应当适当节流防止重复触发
//一.注册模块
//1.用户名输入：3-10位的大小写字母数字和下划线组合
const uname = document.querySelector("#uname");
//测试
uname.value = "7777777";

const unameReg = /^[a-zA-Z0-9_]{3,10}$/;
uname.addEventListener("change", verify_uname);
function verify_uname() {
  if (!unameReg.test(uname.value)) {
    uname.nextElementSibling.innerHTML =
      "×请输入3-10位的大小写字母数字和下划线组合";
    return false;
  }
  //检验通过
  uname.nextElementSibling.innerHTML = "";
  return true;
}

//2.邮箱：通用邮箱验证

const emailReg = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const email = document.querySelector("#email");
//测试
email.value = "alamiers@foxmail.com";
email.addEventListener("change", verify_email);
function verify_email() {
  if (!emailReg.test(email.value)) {
    email.nextElementSibling.innerHTML = "×请输入正确的邮箱地址";
    return false;
  }
  //检验通过
  email.nextElementSibling.innerHTML = "";
  return true;
}

//3.密码：6-12位大小写字母数字组合
const pwdReg = /^[a-zA-Z0-9]{6,12}$/;
const pword = document.querySelector("#password");
//测试
pword.value = "123456";
pword.addEventListener("change", verify_pword);
function verify_pword() {
  if (!pwdReg.test(pword.value)) {
    pword.nextElementSibling.innerHTML = "×请输入6-12位大小写字母数字组合";
    return false;
  }
  //检验通过
  pword.nextElementSibling.innerHTML = "";
  return true;
}

//4.提交前的表单验证
const btnReg = document.querySelector(".register_btn");

btnReg.addEventListener("click", () => {
  //先检查再提交到后台
  if (!(verify_uname() && verify_email() && verify_pword())) {
    alert("请先检查后提交!");
    return false;
  }
  //正确后的数据提交与保存：一份保存本地，一份发送后台进入异步请求
  //1.保存本地
  localStorage.setItem("username", `${uname.value}`);
  localStorage.setItem("email", `${email.value}`);
  localStorage.setItem("password", `${pword.value}`);
  //2.发送后端异步注册并返回用户id 调用一个异步函数
  register(uname.value, email.value, pword.value);
});
async function register(uname, email, pword) {
  const data = {
    username: uname,
    email: email,
    password: pword,
  };
  //   console.log(formData);
  //   for (const pair of formData.entries()) {
  //     console.log(pair[0] + ": " + pair[1]);
  //   }
  try {
    const response = await fetch(
      "http://20.214.240.47:8000/api/v1/auth/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }
    );
    //首先检查是否已经注册 如果是直接return
    if (!response.ok) {
      if (response.status === 400) {
        alert("您已经注册过了！");
      }
      throw new Error(`注册失败，${response.status}`);
    }
    const result = await response.json();
    console.log(`注册成功,id:${result.id}`);
  } catch (error) {
    console.error("注册失败", error);
  }
}
//二.登录模块
//首先完成用户名和密码的输入设置以及按钮的静态设计 然后添加和修改输入提示，表单校验等动态设计
//问题：由于内容与注册模块相似，那么是不是可以以某种方式将两种验证合并？ 但是登录时似乎不需要很严格的输入检验
//1.用户名验证  实时验证但是不再给提示  只在最后的登录按钮触发后再回去提示是否有错误  这里的检查应当是与后台中存储的数据相比 并且如果本地中甚至没有数据则需要反馈注册
localStorage.setItem("username", 7777777); //测试
const logName = document.querySelector("#uname_log");
logName.value = "7777777"; //测试使用

function verify_logName() {
  //与本地数据相比 看是否相等 但是这里要注意如果没有查找到怎么办 所以必须在这里提前判断
  if (!localStorage.getItem("username")) {
    alert("您还没有注册，请先注册!");
    console.log("未查找到用户名");
    return false;
  }
  const locName = localStorage.getItem("username");
  if (logName.value !== locName) {
    console.log("请检查用户名");
    logName.nextElementSibling.innerHTML = "用户名不正确";
    return false;
  }
  logName.nextElementSibling.innerHTML = "";
  return true;
}

//2.仿照上例的密码验证  但是这里需要注意在密码验证的时候似乎 需要与用户名验证是一个先后关系 否则可能会连续报错未注册
localStorage.setItem("password", 123456); //测试
const logPwod = document.querySelector("#password_log");
logPwod.value = "123456"; //测试使用

function verify_logPwod() {
  //与本地数据相比 看是否相等 但是这里要注意如果没有查找到怎么办 所以必须在这里提前判断
  if (!localStorage.getItem("password")) {
    alert("您还没有注册，请先注册!");
    console.log("未查找到密码");
    return false;
  }
  const locPwod = localStorage.getItem("password");
  if (logPwod.value !== locPwod) {
    console.log("请检查密码");
    logPwod.nextElementSibling.innerHTML = "密码不正确";
    return false;
  }
  logPwod.nextElementSibling.innerHTML = "";
  return true;
}
//但是alert提示似乎不应该出现在这里 因为用户只要一输入就会弹出未注册提示？难道不应该是在点击登录的时候提示吗？那么似乎之前的实时验证不必要了？

//3.绑定按钮登录事件  首先校验用户名和密码:未注册与不匹配提示
const btnLog = document.querySelector(".login_btn");
let authToken = "";
btnLog.addEventListener("click", () => {
  //3.1分开校验 如果用户名不正确就可以直接返回了可能更舒服 但是先不管
  if (!(verify_logName() && verify_logPwod())) {
    //oo这里的&&已经做了截断处理 第一个不通过就不会进行第二个的判断了
    return false; //不成功直接提示并返回
  }
  //如果成功则下面需要进行异步函数请求
  login(logName.value, logPwod.value); //异步函数内部会因为await等待 但是我外面的代码并不会等待 不在等待队列内
});
//4.异步登录函数封装
async function login(uname, pword) {
  //现在已经通过了本地的表单校验 按理来说可以直接提交到后台进行登录的工作流处理 然后返回我auth需要的token（并且这个时候后台也会自动再次校验）
  //注意后端要求json输入 所以不能用表单提交
  const data = {
    username: uname,
    password: pword,
  };

  //异步请求
  try {
    const response = await fetch(
      "http://20.214.240.47:8000/api/v1/auth/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }
    );
    //校验错误
    if (!response.ok) throw new Error(`登录失败，${response.status}`); //使用throw抛出错误阻止代码继续执行
    const result = await response.json(); //接收数据
    console.log(
      `登录成功,auth_token:${result.access_token},token_type:${result.token_type}`
    );
    //传出token
    authToken = result.access_token;
    localStorage.setItem("auth_token", authToken);
    alert("登录成功！");
    location.href = "../main/main.html";
  } catch (error) {
    console.error("登录失败", error);
  } finally {
    console.log(authToken); //最后无论如何都打印让我看看有没有值
    //那么下面就有一个问题，我在这边获得的auth怎么传到我的upload界面，两个甚至不在同一个web上  存储到本地cookie中
    //设计了页面的跳转（目前是这样计划的 因为后续还需要曾添个人用户界面 所以就分离了）
  }
}

// 三.登录注册的切换模块 及设计优化
//考虑到后续会进行类似操作 不如此处直接采取事件委托加分类判断处理
// const nav_log=document.querySelector(".nav .login_nav")
// const nav_reg=document.querySelector(".nav .register_nav")
const nav = document.querySelector(".nav");
nav.addEventListener("click", function (e) {
  //首先判断是否是登录或者注册之一
  if (e.target.tagName !== "LI") {
    return;
  }
  // console.log(e.target);
  const nav_li = e.target;
  //1.切换active类
  //删除现在的 增加this
  document.querySelector(".nav .active").classList.remove("active");
  nav_li.classList.add("active");

  //2.切换下面盒子的内容  通过css方法实现 并不是一定要通过js  通过增加或者删除注册状态的类来实现是否将大盒子左移
  if (nav_li.innerHTML.trim() === "注册") {
    document.querySelector(".mid ul").classList.add("mode_register");
  } else {
    document.querySelector(".mid ul").classList.remove("mode_register");
  }
});
