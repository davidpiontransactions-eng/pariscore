import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../constants/api_constants.dart';
import '../errors/exceptions.dart';

class ApiClient {
  late final Dio _dio;
  final FlutterSecureStorage _storage;

  static const String _tokenKey = 'ps_auth_token';

  ApiClient(this._storage) {
    _dio = Dio(
      BaseOptions(
        baseUrl: ApiConstants.baseUrl,
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 30),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );
    _dio.interceptors.addAll([
      _AuthInterceptor(_storage, _tokenKey),
      _ErrorInterceptor(),
    ]);
  }

  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? query,
    Options? options,
  }) =>
      _dio.get<T>(path, queryParameters: query, options: options);

  Future<Response<T>> post<T>(String path, {dynamic data}) =>
      _dio.post<T>(path, data: data);

  Future<void> saveToken(String token) =>
      _storage.write(key: _tokenKey, value: token);

  Future<void> clearToken() => _storage.delete(key: _tokenKey);

  Future<bool> hasToken() async =>
      (await _storage.read(key: _tokenKey)) != null;

  /// SSE stream — yields raw JSON string per `data:` line.
  Stream<String> sse(String path) async* {
    final token = await _storage.read(key: _tokenKey);
    final uri = Uri.parse('${ApiConstants.baseUrl}$path');
    final client = HttpClient();

    try {
      final request = await client.getUrl(uri);
      if (token != null) request.headers.add('Authorization', 'Bearer $token');
      request.headers.add('Accept', 'text/event-stream');
      request.headers.add('Cache-Control', 'no-cache');

      final response = await request.close();
      await for (final chunk in response.transform(utf8.decoder)) {
        for (final line in chunk.split('\n')) {
          final trimmed = line.trim();
          if (trimmed.startsWith('data: ') && trimmed.length > 6) {
            yield trimmed.substring(6);
          }
        }
      }
    } finally {
      client.close();
    }
  }
}

class _AuthInterceptor extends Interceptor {
  final FlutterSecureStorage _storage;
  final String _key;

  _AuthInterceptor(this._storage, this._key);

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final token = await _storage.read(key: _key);
    if (token != null) options.headers['Authorization'] = 'Bearer $token';
    handler.next(options);
  }
}

class _ErrorInterceptor extends Interceptor {
  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    if (err.response?.statusCode == 401) {
      handler.reject(err.copyWith(error: const AuthException()));
      return;
    }
    if (err.type == DioExceptionType.connectionTimeout ||
        err.type == DioExceptionType.receiveTimeout ||
        err.type == DioExceptionType.connectionError) {
      handler.reject(err.copyWith(error: const NetworkException()));
      return;
    }
    final msg = err.response?.data is Map
        ? (err.response!.data as Map)['error']?.toString() ?? err.message
        : err.message ?? 'Erreur serveur';
    handler.reject(err.copyWith(
      error: ServerException(msg ?? 'Erreur serveur',
          statusCode: err.response?.statusCode),
    ));
  }
}
