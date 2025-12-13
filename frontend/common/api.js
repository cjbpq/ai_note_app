/*
这里放之后的api请求函数名称规范
1.主页上传：mainUpload()
2.注册：register(uname,email,pword)
3.登录：login(uname,pword)
*/
// 异步api请求：主页上传
async function mainUpload(inputFile) {
  //只能调用时从本地获取了 因为会过期 后面还需要加一个定期获取token的功能 或者是要求重新登录
  const my_token = localStorage.getItem("auth_token");
  //1. 上传图片 返回job_id
  const formData = new FormData();
  formData.append("file", inputFile);
  let job_id = null;
  try {
    const response = await fetch(
      CONFIG.API_BASE_URL + CONFIG.ENDPOINTS.UPLOAD_IMAGE,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${my_token}`,
        },
        body: formData,
      }
    );
    //fetch后查询是否错误 抛出阻止代码执行
    if (!response.ok) throw new Error(`上传失败：${response.status}`);
    const result = await response.json();
    console.log("上传成功，任务id是：", result.job_id);
    job_id = result.job_id;
  } catch (error) {
    console.error("上传失败", error);
  }
  //2.实时任务id查询  接收note_id
  let note_id = null;
  try {
    let result = "";
    while (!note_id) {
      const response = await fetch(
        CONFIG.API_BASE_URL + CONFIG.ENDPOINTS.GET_JOB + `/${job_id}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${my_token}`,
            "Content-Type": "application/json",
          },
          // GET 请求不能带 body
        }
      );
      if (!response.ok) throw new Error(`查询失败：${response.status}`);
      result = await response.json();
      note_id = result.note_id;
      // 如果还没拿到 note_id，等待 1 秒后再次查询，避免疯狂请求
      if (!note_id) {
        await sleep(1000);
      }
    }
    console.log("查询成功，笔记id是：", note_id);
  } catch (error) {
    console.error("查询失败", error);
  }

  //3.用note_id查询笔记 获取笔记内容 （json格式）
  try {
    const response = await fetch(
      CONFIG.API_BASE_URL + CONFIG.ENDPOINTS.GET_NOTE + `/${note_id}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${my_token}`,
          "Content-Type": "application/json",
        },
        // GET 请求不能带 body
      }
    );
    if (!response.ok) throw new Error(`查询失败：${response.status}`);
    const result = await response.json();
    console.log("获取成功，笔记标题是：", result.title);
    return {
      output_title: result.title,
      output_content: result.structured_data.summary,
    };
  } catch (error) {
    console.error("获取失败", error);
  }
}

//异步api请求：注册
async function register(uname, email, pword) {
  const data = {
    username: uname,
    email: email,
    password: pword,
  };
  try {
    const response = await fetch(
      CONFIG.API_BASE_URL + CONFIG.ENDPOINTS.REGISTER,
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

//异步api请求：登录
async function login(uname, pword) {
  //注意后端要求json输入 所以不能用表单提交
  let auth_token = null;
  const data = {
    username: uname,
    password: pword,
  };

  //异步请求
  try {
    const response = await fetch(CONFIG.API_BASE_URL + CONFIG.ENDPOINTS.LOGIN, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    //校验错误
    if (!response.ok) throw new Error(`登录失败，${response.status}`); //使用throw抛出错误阻止代码继续执行
    const result = await response.json(); //接收数据
    console.log(
      `登录成功,auth_token:${result.access_token},token_type:${result.token_type}`
    );
    //传出token
    auth_token = result.access_token;
    //保存到本地存储
    localStorage.setItem("auth_token", auth_token);
    //更新常量中的authToken
    CONFIG.my_token = auth_token;
    alert("登录成功！");
    location.href = "../main/main.html";
  } catch (error) {
    console.error("登录失败", error);
  } finally {
    console.log(auth_token); //最后无论如何都打印让我看看有没有值
  }
}
