import 'package:dartz/dartz.dart';

import '../../../../core/errors/failures.dart';
import '../entities/match.dart';

abstract class MatchRepository {
  Future<Either<Failure, List<Match>>> getMatches({
    String? league,
    String? day,
  });
  Future<Either<Failure, Match>> getMatchDetail(String id);
}
