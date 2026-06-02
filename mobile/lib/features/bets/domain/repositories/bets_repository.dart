import 'package:dartz/dartz.dart';

import '../../../../core/errors/failures.dart';
import '../entities/bet.dart';

abstract class BetsRepository {
  Future<Either<Failure, List<Bet>>> getBets({int limit, int offset});
  Future<Either<Failure, Bet>> createBet(Map<String, dynamic> payload);
  Future<Either<Failure, BankrollSummary>> getBankrollSummary();
}
