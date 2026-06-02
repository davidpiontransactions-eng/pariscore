import 'package:dartz/dartz.dart';

import '../../../../core/errors/failures.dart';
import '../entities/scout_pick.dart';
import '../repositories/scout_repository.dart';

class GetTopPicksUseCase {
  final ScoutRepository _repository;

  const GetTopPicksUseCase(this._repository);

  Future<Either<Failure, List<ScoutPick>>> call() => _repository.getTopPicks();
}
