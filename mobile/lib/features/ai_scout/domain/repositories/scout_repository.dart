import 'package:dartz/dartz.dart';

import '../../../../core/errors/failures.dart';
import '../entities/scout_pick.dart';

abstract class ScoutRepository {
  Future<Either<Failure, List<ScoutPick>>> getTopPicks();
}
