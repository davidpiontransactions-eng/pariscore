import 'package:dartz/dartz.dart';
import 'package:dio/dio.dart';

import '../../../../core/errors/exceptions.dart';
import '../../../../core/errors/failures.dart';
import '../../domain/entities/scout_pick.dart';
import '../../domain/repositories/scout_repository.dart';
import '../datasources/scout_remote_datasource.dart';

class ScoutRepositoryImpl implements ScoutRepository {
  final ScoutRemoteDataSource _remote;

  const ScoutRepositoryImpl(this._remote);

  @override
  Future<Either<Failure, List<ScoutPick>>> getTopPicks() async {
    try {
      return Right(await _remote.getTopPicks());
    } on DioException catch (e) {
      final inner = e.error;
      if (inner is NetworkException) return const Left(NetworkFailure());
      if (inner is ServerException) return Left(ServerFailure(inner.message));
      return Left(ServerFailure(e.message ?? 'Erreur réseau'));
    } on NetworkException {
      return const Left(NetworkFailure());
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    }
  }
}
