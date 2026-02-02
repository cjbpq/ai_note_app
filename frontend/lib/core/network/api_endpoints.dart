/// API Endpoints
class ApiEndpoints {
  // Auth
  static const String register = '/auth/register';
  static const String login = '/auth/login';
  static const String refreshToken = '/auth/refresh';
  static const String me = '/auth/me';
  static const String deleteAccount = '/auth/me';

  // Notes (Library)
  static const String notes = '/library/notes';
  static String noteDetail(String id) => '/library/notes/$id';
  static String noteFavorite(String id) => '/library/notes/$id/favorite';
  static String noteExport(String id) => '/library/notes/$id/export';
  static const String noteFromImage = '/library/notes/from-image';
  static const String uploadImage = '/library/notes/from-image';
  static const String textFromImage = '/library/text/from-image';
  static const String search = '/library/search';
  static const String categories = '/library/categories';

  // Upload
  static const String upload = '/upload/upload';
  static String jobStatus(String jobId) => '/upload/jobs/$jobId';
  static String jobStream(String jobId) => '/upload/jobs/$jobId/stream';
}
