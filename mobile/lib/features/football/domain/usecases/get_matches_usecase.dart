import 'package:dartz/dartz.dart';
import 'package:equatable/equatable.dart';

import '../../../../core/errors/failures.dart';
import '../entities/match.dart';
import '../repositories/match_repository.dart';

class GetMatchesUseCase {
  final MatchRepository _repository;

  const GetMatchesUseCase(this._repository);

  Future<Either<Failure, List<Match>>> call(MatchesParams params) =>
      _repository.getMatches(league: params.league, day: params.day);
}

class MatchesParams extends Equatable {
  final String? league;
  final String? day;

  const MatchesParams({this.league, this.day});

  @override
  List<Object?> get props => [league, day];
}
