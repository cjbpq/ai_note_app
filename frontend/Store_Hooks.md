# UI对接接口（hook功能及状态列表）

1. 身份认证 (Auth)
   Hook: useAuth()
   login({ username, password }): 登录动作
   register({ username, password, email }): 注册动作
   logout(): 退出登录
   isLoggingIn, loginError: UI 加载与错误反馈
   Store: useAuthStore
   isAuthenticated: 全局布尔值，用于路由守卫 (AuthGuard)
   user: 当前用户信息 { id, username, avatar }
   isRestoring: App 启动时的 Loading 状态
2. 我的笔记列表 (Note List)
   Hook: useNotes()
   notes (Array): 渲染列表数据源 FlatList data={notes}
   isLoading: 下拉刷新或初次加载的 loading Indicator
   refetch(): 下拉刷新的 onRefresh 回调
   deleteNote(id): 侧滑删除按钮的事件处理
   Store: useUIStore
   searchQuery: 绑定搜索框输入
   setSearchQuery(text): 搜索框 onChangeText
3. 智能扫描/拍照 (Smart Scan)
   Hook: useScanNotes()
   scanImage(uri): 核心入口。拍照库返回 uri 后直接调用此方法，后续全自动。
   isScanning: 如果为 true，展示全屏 Loading 遮罩或进度条。
   scanStep: 细分状态 (uploading | processing | finished)，用于显示 "正在上传..." 或 "AI处理中..."。
   scanError: 扫描失败时展示的错误信息。
   confirmScanResult({ id, ...data }): 如果需要用户修改 AI 结果后保存，调用此方法。
   Store: useScanStore
   scannedNoteId: 扫描完成后非空。监听此值变化，一旦有值，自动跳转到笔记详情页。
   resetScan(): 离开页面或开启新扫描前调用，重置状态。
