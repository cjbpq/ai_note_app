/// Custom exceptions for the app

/// Base exception class
abstract class AppException implements Exception {
  final String message;
  final int? statusCode;
  
  const AppException(this.message, [this.statusCode]);
  
  @override
  String toString() => message;
}

/// Network related exceptions
class NetworkException extends AppException {
  const NetworkException([String message = 'Network error occurred']) : super(message);
}

class TimeoutException extends AppException {
  const TimeoutException([String message = 'Request timed out']) : super(message);
}

class NoInternetException extends AppException {
  const NoInternetException([String message = 'No internet connection']) : super(message);
}

/// Auth related exceptions
class UnauthorizedException extends AppException {
  const UnauthorizedException([String message = 'Unauthorized']) : super(message, 401);
}

class TokenExpiredException extends AppException {
  const TokenExpiredException([String message = 'Token expired']) : super(message, 401);
}

class ForbiddenException extends AppException {
  const ForbiddenException([String message = 'Access forbidden']) : super(message, 403);
}

/// Server related exceptions
class ServerException extends AppException {
  const ServerException([String message = 'Server error']) : super(message, 500);
}

class NotFoundException extends AppException {
  const NotFoundException([String message = 'Resource not found']) : super(message, 404);
}

class BadRequestException extends AppException {
  const BadRequestException([String message = 'Bad request']) : super(message, 400);
}

/// Validation exceptions
class ValidationException extends AppException {
  final Map<String, List<String>>? errors;
  
  const ValidationException(String message, [this.errors]) : super(message, 422);
}

/// Cache exceptions
class CacheException extends AppException {
  const CacheException([String message = 'Cache error']) : super(message);
}
