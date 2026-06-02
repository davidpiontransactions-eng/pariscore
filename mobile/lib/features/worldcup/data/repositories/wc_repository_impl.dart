import 'package:dartz/dartz.dart';
import 'package:dio/dio.dart';

import '../../../../core/errors/exceptions.dart';
import '../../../../core/errors/failures.dart';
import '../../domain/entities/wc_entities.dart';
import '../../domain/repositories/wc_repository.dart';
import '../datasources/wc_remote_datasource.dart';

class WcRepositoryImpl implements WcRepository {
  final WcRemoteDataSource _remote;

  const WcRepositoryImpl(this._remote);

  @override
  Future<Either<Failure, WcOverview>> getOverview() async {
    try {
      return Right(await _remote.getOverview());
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
