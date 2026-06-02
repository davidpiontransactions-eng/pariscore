import 'package:dartz/dartz.dart';

import '../../../../core/errors/failures.dart';
import '../entities/tennis_match.dart';
import '../repositories/tennis_repository.dart';

class GetTennisMatchesUseCase {
  final TennisRepository _repository;

  const GetTennisMatchesUseCase(this._repository);

  Future<Either<Failure, List<TennisMatch>>> call() =>
      _repository.getLiveMatches();
}
