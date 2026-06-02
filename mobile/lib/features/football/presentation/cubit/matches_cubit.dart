import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/match.dart';
import '../../domain/usecases/get_matches_usecase.dart';

part 'matches_state.dart';

class MatchesCubit extends Cubit<MatchesState> {
  final GetMatchesUseCase _getMatches;

  MatchesCubit(this._getMatches) : super(const MatchesInitial());

  Future<void> loadMatches({String? league}) async {
    emit(const MatchesLoading());
    final result = await _getMatches(MatchesParams(league: league));
    result.fold(
      (failure) => emit(MatchesError(failure.message)),
      (matches) => emit(MatchesLoaded(matches, activeLeague: league)),
    );
  }

  Future<void> filterByLeague(String? league) => loadMatches(league: league);
}
