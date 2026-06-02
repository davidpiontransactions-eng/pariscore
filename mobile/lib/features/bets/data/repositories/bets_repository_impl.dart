import 'package:dartz/dartz.dart';
import 'package:dio/dio.dart';

import '../../../../core/errors/exceptions.dart';
import '../../../../core/errors/failures.dart';
import '../../domain/entities/bet.dart';
import '../../domain/entities/daily_tracker.dart';
import '../../domain/repositories/bets_repository.dart';
import '../datasources/bets_remote_datasource.dart';

class BetsRepositoryImpl implements BetsRepository {
  final BetsRemoteDataSource _remote;

  const BetsRepositoryImpl(this._remote);

  @override
  Future<Either<Failure, List<Bet>>> getBets({
    int limit = 50,
    int offset = 0,
  }) async {
    try {
      final r = await _remote.getBets(limit: limit, offset: offset);
      return Right(r.bets);
    } on DioException catch (e) {
      return Left(_map(e));
    } on NetworkException {
      return const Left(NetworkFailure());
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    }
  }

  @override
  Future<Either<Failure, Bet>> createBet(Map<String, dynamic> payload) async {
    try {
      return Right(await _remote.createBet(payload));
    } on DioException catch (e) {
      return Left(_map(e));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    }
  }

  @override
  Future<Either<Failure, Bet>> settleBet(int betId, String status,
      {double? cashoutAmount}) async {
    try {
      return Right(
          await _remote.settleBet(betId, status, cashoutAmount: cashoutAmount));
    } on DioException catch (e) {
      return Left(_map(e));
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    }
  }

  @override
  Future<Either<Failure, BankrollSummary>> getBankrollSummary() async {
    try {
      return Right(await _remote.getBankrollSummary());
    } on DioException catch (e) {
      return Left(_map(e));
    } on NetworkException {
      return const Left(NetworkFailure());
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    }
  }

  @override
  Future<Either<Failure, List<DailyTrackerEntry>>> getDailyTracker() async {
    try {
      return Right(await _remote.getDailyTracker());
    } on DioException catch (e) {
      return Left(_map(e));
    } on NetworkException {
      return const Left(NetworkFailure());
    } on ServerException catch (e) {
      return Left(ServerFailure(e.message));
    }
  }

  Failure _map(DioException e) {
    final inner = e.error;
    if (inner is AuthException) return const AuthFailure();
    if (inner is NetworkException) return const NetworkFailure();
    if (inner is ServerException) return ServerFailure(inner.message);
    return ServerFailure(e.message ?? 'Erreur réseau');
  }
}
