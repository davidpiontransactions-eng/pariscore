class ServerException implements Exception {
  final String message;
  final int? statusCode;

  const ServerException(this.message, {this.statusCode});

  @override
  String toString() => 'ServerException($statusCode): $message';
}

class NetworkException implements Exception {
  const NetworkException();
}

class AuthException implements Exception {
  const AuthException();
}

class CacheException implements Exception {
  const CacheException();
}
