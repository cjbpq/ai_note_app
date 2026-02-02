// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Chinese (`zh`).
class AppLocalizationsZh extends AppLocalizations {
  AppLocalizationsZh([String locale = 'zh']) : super(locale);

  @override
  String get appName => 'AI 笔记';

  @override
  String get welcomeBack => '欢迎回来';

  @override
  String get loginToContinue => '登录以继续使用 AI Note';

  @override
  String get username => '用户名';

  @override
  String get usernameHint => '请输入用户名';

  @override
  String get password => '密码';

  @override
  String get passwordHint => '请输入密码';

  @override
  String get login => '登录';

  @override
  String get noAccount => '还没有账号？';

  @override
  String get registerNow => '立即注册';

  @override
  String get createAccount => '创建账号';

  @override
  String get email => '邮箱';

  @override
  String get emailHint => '请输入邮箱地址';

  @override
  String get confirmPassword => '确认密码';

  @override
  String get confirmPasswordHint => '请再次输入密码';

  @override
  String get register => '注册';

  @override
  String get hasAccount => '已有账号？';

  @override
  String get loginNow => '立即登录';

  @override
  String get myNotes => '我的笔记';

  @override
  String get search => '搜索';

  @override
  String get noNotes => '暂无笔记';

  @override
  String get noNotesHint => '上传图片开始创建您的第一篇笔记';

  @override
  String get noteDetail => '笔记详情';

  @override
  String get editNote => '编辑笔记';

  @override
  String get deleteNote => '删除笔记';

  @override
  String deleteNoteConfirm(String title) {
    return '确定要删除 \"$title\" 吗？';
  }

  @override
  String get cancel => '取消';

  @override
  String get delete => '删除';

  @override
  String get save => '保存';

  @override
  String get title => '标题';

  @override
  String get titleHint => '请输入笔记标题';

  @override
  String get category => '分类';

  @override
  String get tags => '标签';

  @override
  String get tagsHint => '输入标签';

  @override
  String get originalText => '原始文本';

  @override
  String get uploadImage => '上传图片';

  @override
  String get uploadImageTitle => '上传图片创建笔记';

  @override
  String get uploadImageHint => '拍照或从相册选择图片，AI 将自动识别并整理内容';

  @override
  String get takePhoto => '拍照';

  @override
  String get gallery => '相册';

  @override
  String get startUpload => '开始上传';

  @override
  String get reselect => '重新选择';

  @override
  String get imageReceived => '图片已接收';

  @override
  String get imageStored => '图片已存储';

  @override
  String get queued => '排队处理中';

  @override
  String get ocrPending => '文字识别中...';

  @override
  String get ocrDone => '文字识别完成';

  @override
  String get aiPending => 'AI 整理笔记中...';

  @override
  String get aiDone => 'AI 处理完成';

  @override
  String get persisted => '笔记已生成';

  @override
  String get failed => '处理失败';

  @override
  String get processing => '处理中...';

  @override
  String get noteCreated => '笔记创建成功！';

  @override
  String get noteDeleted => '笔记已删除';

  @override
  String get saveFailed => '保存失败';

  @override
  String get saveSuccess => '保存成功';

  @override
  String get settings => '设置';

  @override
  String get theme => '主题';

  @override
  String get themeLight => '浅色';

  @override
  String get themeDark => '深色';

  @override
  String get themeSystem => '跟随系统';

  @override
  String get selectTheme => '选择主题';

  @override
  String get about => '关于';

  @override
  String get logout => '退出登录';

  @override
  String get logoutConfirm => '确定要退出登录吗？';

  @override
  String get loading => '加载中...';

  @override
  String get retry => '重试';

  @override
  String get error => '错误';

  @override
  String get networkError => '网络错误';

  @override
  String get all => '全部';

  @override
  String get favorites => '收藏';

  @override
  String get filterByCategory => '分类筛选';

  @override
  String get searchNotes => '搜索笔记';

  @override
  String get searchHint => '输入关键词搜索';

  @override
  String get noSearchResults => '没有找到相关笔记';

  @override
  String get recentSearches => '最近搜索';

  @override
  String get clearHistory => '清除历史';

  @override
  String get pleaseEnterUsername => '请输入用户名';

  @override
  String get pleaseEnterPassword => '请输入密码';

  @override
  String get pleaseEnterEmail => '请输入邮箱';

  @override
  String get pleaseEnterValidEmail => '请输入有效的邮箱地址';

  @override
  String get usernameMinLength => '用户名至少3个字符';

  @override
  String get passwordMinLength => '密码至少6位';

  @override
  String get passwordMismatch => '两次密码输入不一致';

  @override
  String get pleaseConfirmPassword => '请确认密码';

  @override
  String get pleaseEnterTitle => '请输入标题';

  @override
  String get registerSuccess => '注册成功，请登录';

  @override
  String get selectImageFailed => '选择图片失败';

  @override
  String get loadCategoryFailed => '加载分类失败';

  @override
  String get noteNotFound => '笔记不存在';

  @override
  String get uploadingNewNote => '正在上传新笔记...';

  @override
  String get cannotDeleteFavorite => '收藏的笔记不能删除，请先取消收藏';

  @override
  String get switchEditMode => '切换编辑模式';

  @override
  String get previewMode => '预览';

  @override
  String get wysiwygMode => '富文本';

  @override
  String get sourceMode => '源码';

  @override
  String get unsavedChanges => '未保存的更改';

  @override
  String get unsavedChangesMessage => '您有未保存的更改，确定要离开吗？';

  @override
  String get savedSuccessfully => '保存成功';

  @override
  String get discardChanges => '放弃更改';

  @override
  String get saveChanges => '保存更改';
}
