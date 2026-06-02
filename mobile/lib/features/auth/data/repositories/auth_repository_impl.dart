import 'package:dartz/dartz.dart';
import 'package:dio/dio.dart';

import '../../../../core/errors/exceptions.dart';
import '../../../../core/errors/failures.dart';
import '../../../../core/network/api_client.dart';
import '../../domain/entities/user.dart';
import '../../domain/repositories/auth_repository.dart';
import '../datasources/auth_remote_datasource.dart';

class AuthRepositoryImpl implements AuthRepository {
  final AuthRemoteDataSource _remote;
  final ApiClient _client;

  const AuthRepositoryImpl(this._remote, this._client);

  @override
  Future<Either<Failure, User>> login(String email, String password) async {
    try {
      final result = await _remote.login(email, password);
      await _client.saveToken(result.token);
      return Right(result.user);
    } on DioException catch (e) {
      return Left(_mapDioError(e));
    } on AuthException {
      return const Left(AuthFailure('Identifiants incorrects'));
    } on NetworkException {
      return const Left(NetworkFailure());
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message, statusCode: e.statusCode));
    }
  }

  @override
  Future<Either<Failure, User>> register(String email, String password) async {
    try {
      final result = await _remote.register(email, password);
      await _client.saveToken(result.token);
      return Right(result.user);
    } on DioException catch (e) {
      return Left(_mapDioError(e));
    } on NetworkException {
      return const Left(NetworkFailure());
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message, statusCode: e.statusCode));
    }
  }

  @override
  Future<Either<Failure, User>> getCurrentUser() async {
    try {
      return Right(await _remote.getCurrentUser());
    } on DioException catch (e) {
      return Left(_mapDioError(e));
    } on AuthException {
      return const Left(AuthFailure());
    } on NetworkException {
      return const Left(NetworkFailure());
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    }
  }

  Failure _mapDioError(DioException e) {
    final inner = e.error;
    if (inner is AuthException) return const AuthFailure('Identifiants incorrects');
    if (inner is NetworkException) return const NetworkFailure();
    if (inner is ServerException) return ServerFailure(inner.message, statusCode: inner.statusCode);
    return ServerFailure(e.message ?? 'Erreur réseau');
  }

  @override
  Future<Either<Failure, void>> logout() async {
    await _client.clearToken();
    return const Right(null);
  }

  @override
  Future<bool> isAuthenticated() => _client.hasToken();
}
