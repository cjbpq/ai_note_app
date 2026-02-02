import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';
import '../../config/app_config.dart';
import '../storage/secure_storage.dart';
import '../errors/exceptions.dart';
import 'api_endpoints.dart';

final logger = Logger(
  printer: PrettyPrinter(methodCount: 0, errorMethodCount: 5, lineLength: 50),
);

/// Provider for Dio client
final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(BaseOptions(
    baseUrl: AppConfig.apiBaseUrl,
    connectTimeout: Duration(milliseconds: AppConfig.connectTimeout),
    receiveTimeout: Duration(milliseconds: AppConfig.receiveTimeout),
    sendTimeout: Duration(milliseconds: AppConfig.sendTimeout),
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  ));
  
  final tokenStorage = ref.watch(tokenStorageProvider);
  
  // Add interceptors
  dio.interceptors.add(TokenInterceptor(tokenStorage, dio, ref));
  dio.interceptors.add(LoggingInterceptor());
  dio.interceptors.add(ErrorInterceptor());
  
  return dio;
});

/// Token interceptor - handles authentication and token refresh
class TokenInterceptor extends QueuedInterceptor {
  final TokenStorage _tokenStorage;
  final Dio _dio;
  final Ref _ref;
  bool _isRefreshing = false;
  
  TokenInterceptor(this._tokenStorage, this._dio, this._ref);
  
  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    // Add token to request if available
    final token = await _tokenStorage.getToken();
    if (token != null && token.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }
  
  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    // Handle 401 Unauthorized - try to refresh token
    if (err.response?.statusCode == 401 && !_isRefreshing) {
      _isRefreshing = true;
      
      try {
        final newToken = await _refreshToken();
        if (newToken != null) {
          await _tokenStorage.saveToken(newToken);
          
          // Retry the failed request with new token
          final options = err.requestOptions;
          options.headers['Authorization'] = 'Bearer $newToken';
          
          final response = await _dio.fetch(options);
          _isRefreshing = false;
          return handler.resolve(response);
        }
      } catch (e) {
        logger.e('Token refresh failed: $e');
      }
      
      _isRefreshing = false;
      // Token refresh failed - clear storage and redirect to login
      await _tokenStorage.clearAll();
    }
    
    handler.next(err);
  }
  
  Future<String?> _refreshToken() async {
    try {
      final token = await _tokenStorage.getToken();
      if (token == null) return null;
      
      final response = await Dio(BaseOptions(
        baseUrl: AppConfig.apiBaseUrl,
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
      )).post(ApiEndpoints.refreshToken);
      
      return response.data['access_token'];
    } catch (e) {
      logger.e('Refresh token error: $e');
      return null;
    }
  }
}

/// Logging interceptor
class LoggingInterceptor extends Interceptor {
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    logger.d('REQUEST[${options.method}] => PATH: ${options.path}');
    handler.next(options);
  }
  
  @override
  void onResponse(Response response, ResponseInterceptorHandler handler) {
    logger.d('RESPONSE[${response.statusCode}] => PATH: ${response.requestOptions.path}');
    handler.next(response);
  }
  
  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    logger.e('ERROR[${err.response?.statusCode}] => PATH: ${err.requestOptions.path}');
    logger.e('Error message: ${err.message}');
    handler.next(err);
  }
}

/// Error handling interceptor
class ErrorInterceptor extends Interceptor {
  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    final exception = _mapDioException(err);
    handler.reject(DioException(
      requestOptions: err.requestOptions,
      error: exception,
      response: err.response,
      type: err.type,
    ));
  }
  
  AppException _mapDioException(DioException err) {
    switch (err.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return const TimeoutException();
      
      case DioExceptionType.connectionError:
        return const NoInternetException();
      
      case DioExceptionType.badResponse:
        return _mapStatusCode(err.response?.statusCode, err.response?.data);
      
      case DioExceptionType.cancel:
        return const NetworkException('Request cancelled');
      
      default:
        return NetworkException(err.message ?? 'Unknown error');
    }
  }
  
  AppException _mapStatusCode(int? statusCode, dynamic data) {
    String? message;

    if (data is Map) {
      final detail = data['detail'];
      if (detail is String) {
        // detail 是字符串
        message = detail;
      } else if (detail is List && detail.isNotEmpty) {
        // detail 是列表（FastAPI 验证错误格式）
        // 尝试提取第一个错误的 msg 字段
        final firstError = detail.first;
        if (firstError is Map && firstError['msg'] != null) {
          message = firstError['msg'].toString();
        } else {
          // 如果没有 msg 字段，将整个 detail 列表转为字符串
          message = detail.map((e) => e is Map ? (e['msg'] ?? e.toString()) : e.toString()).join('; ');
        }
      } else {
        message = data['message']?.toString();
      }
    }

    switch (statusCode) {
      case 400:
        return BadRequestException(message ?? 'Bad request');
      case 401:
        return UnauthorizedException(message ?? 'Unauthorized');
      case 403:
        return ForbiddenException(message ?? 'Forbidden');
      case 404:
        return NotFoundException(message ?? 'Not found');
      case 422:
        return ValidationException(message ?? 'Validation error');
      case 500:
      case 502:
      case 503:
        return ServerException(message ?? 'Server error');
      default:
        return ServerException(message ?? 'Unknown server error');
    }
  }
}
