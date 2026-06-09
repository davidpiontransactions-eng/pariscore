import 'package:dartz/dartz.dart';
import 'package:dio/dio.dart';

import '../../../../core/errors/exceptions.dart';
import '../../../../core/errors/failures.dart';
import '../../domain/entities/tennis_match.dart';
import '../../domain/repositories/tennis_repository.dart';
import '../datasources/tennis_remote_datasource.dart';

class TennisRepositoryImpl implements TennisRepository {
  const TennisRepositoryImpl(this._remote);

  final TennisRemoteDataSource _remote;

  @override
  Future<Either<Failure, List<TennisMatch>>> getLiveMatches() async {
    try {
      return Right(await _remote.getLiveMatches());
    } on DioException catch (e) {
      return Left(_mapDioError(e));
    } on NetworkException {
      return const Left(NetworkFailure());
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    }
  }

  @override
  Future<Either<Failure, List<TennisMatch>>> getUpcomingMatches() async {
    try {
      return Right(await _remote.getUpcomingMatches());
    } on DioException catch (e) {
      return Left(_mapDioError(e));
    } on NetworkException {
      return const Left(NetworkFailure());
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    }
  }

  Failure _mapDioError(DioException e) {
    final inner = e.error;
    if (inner is AuthException) return const AuthFailure();
    if (inner is NetworkException) return const NetworkFailure();
    if (inner is ServerException) return ServerFailure(inner.message, statusCode: inner.statusCode);
    return ServerFailure(e.message ?? 'Erreur réseau');
  }
}
