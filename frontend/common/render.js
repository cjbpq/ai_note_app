// 公共渲染函数
function renderLibrary(notedata) {
  //1.2.1最小笔记子目渲染  用数组方法来为html添加要渲染的数据
  //1.2.2渲染分类目  目标：建立几个独立的分类目 语文，数学，英语
  //1.2.3整个目录的渲染
  //需要拷贝一个my_data数组的临时操作数组
  const newdata = notedata.map(function (ele, index) {
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
  //这里依赖于左侧目录栏共同的索引
  document.querySelector(".left .library").innerHTML = newdata.join(""); //赋值
}
