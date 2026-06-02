import 'package:dartz/dartz.dart';

import '../../../../core/errors/failures.dart';
import '../entities/tennis_match.dart';

abstract class TennisRepository {
  Future<Either<Failure, List<TennisMatch>>> getLiveMatches();
  Future<Either<Failure, List<TennisMatch>>> getUpcomingMatches();
}
