import 'package:dartz/dartz.dart';

import '../../../../core/errors/failures.dart';
import '../entities/bet.dart';
import '../entities/daily_tracker.dart';

abstract class BetsRepository {
  Future<Either<Failure, List<Bet>>> getBets({int limit, int offset});
  Future<Either<Failure, Bet>> createBet(Map<String, dynamic> payload);
  Future<Either<Failure, Bet>> settleBet(int betId, String status,
      {double? cashoutAmount});
  Future<Either<Failure, BankrollSummary>> getBankrollSummary();
  Future<Either<Failure, List<DailyTrackerEntry>>> getDailyTracker();
}
