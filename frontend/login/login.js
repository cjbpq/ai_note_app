//*相关事宜说明：
//2.登录界面的ui实在太丑 还需要用原始css,tailwind等优化设计
//5.没有禁用按钮的设定 应当适当节流防止重复触发
//备注我的账号：7777777 123456

//一.注册模块
//1.用户名输入：3-10位的大小写字母数字和下划线组合
const uname = document.querySelector("#uname");
//规则
const unameReg = /^[a-zA-Z0-9_]{3,10}$/;
//检测
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
const email = document.querySelector("#email");
//规则
const emailReg = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
//检测
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
//规则
const pword = document.querySelector("#password");
//检测
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

//4.提交前的表单验证以及后台注册提交
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
  //2.发送后端异步注册并返回用户id 调用一个异步api请求
  register(uname.value, email.value, pword.value);
});

//二.登录模块（注意这里均不再进行其他不必要的检验）
//1.用户名
const logName = document.querySelector("#uname_log");
//2.密码
const logPwod = document.querySelector("#password_log");
//3.绑定按钮登录事件
const btnLog = document.querySelector(".login_btn");
btnLog.addEventListener("click", () => {
  //检验用户名和密码非空（基础的检验）
  if (logName.value.trim() === "" || logPwod.value.trim() === "") {
    alert("用户名和密码不能为空!");
    return false;
  }
  //异步登录api请求
  login(logName.value, logPwod.value); //异步函数内部会因为await等待 但是我外面的代码并不会等待 不在等待队列内
});

// 三.登录注册的切换模块 及设计优化
const nav = document.querySelector(".nav");
nav.addEventListener("click", function (e) {
  //首先判断是否是登录或者注册之一
  if (e.target.tagName !== "LI") {
    return;
  }
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
