import 'package:dartz/dartz.dart';

import '../../../../core/errors/failures.dart';
import '../entities/tennis_match.dart';
import '../repositories/tennis_repository.dart';

class GetTennisMatchesUseCase {
  const GetTennisMatchesUseCase(this._repository);

  final TennisRepository _repository;

  Future<Either<Failure, List<TennisMatch>>> call() =>
      _repository.getLiveMatches();
}
