/// Application configuration
class AppConfig {
  // API Configuration
  static const String apiBaseUrl = 'http://20.214.240.47:8000/api/v1';
  
  // Timeouts (in milliseconds)
  static const int connectTimeout = 30000;
  static const int receiveTimeout = 30000;
  static const int sendTimeout = 60000;
  
  // Storage Keys
  static const String accessTokenKey = 'access_token';
  static const String userDataKey = 'user_data';
  static const String themeKey = 'theme_mode';
  static const String localeKey = 'locale';
  
  // Image Configuration
  static const int maxImageWidth = 1920;
  static const int maxImageHeight = 1080;
  static const int maxImageSizeBytes = 10 * 1024 * 1024; // 10MB
  static const int imageQuality = 80;
}
