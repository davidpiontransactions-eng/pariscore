import 'package:dartz/dartz.dart';
import 'package:dio/dio.dart';

import '../../../../core/errors/exceptions.dart';
import '../../../../core/errors/failures.dart';
import '../../domain/entities/match.dart';
import '../../domain/repositories/match_repository.dart';
import '../datasources/football_remote_datasource.dart';

class MatchRepositoryImpl implements MatchRepository {
  final FootballRemoteDataSource _remote;

  const MatchRepositoryImpl(this._remote);

  @override
  Future<Either<Failure, List<Match>>> getMatches({
    String? league,
    String? day,
  }) async {
    try {
      final matches = await _remote.getMatches(league: league, day: day);
      return Right(matches);
    } on DioException catch (e) {
      return Left(_mapDioError(e));
    } on NetworkException {
      return const Left(NetworkFailure());
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message, statusCode: e.statusCode));
    }
  }

  @override
  Future<Either<Failure, Match>> getMatchDetail(String id) async {
    try {
      return Right(await _remote.getMatchDetail(id));
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
    if (inner is ServerException) {
      return ServerFailure(inner.message, statusCode: inner.statusCode);
    }
    return ServerFailure(e.message ?? 'Erreur réseau');
  }
}
