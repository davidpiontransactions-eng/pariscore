import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/tennis_match.dart';
import '../../domain/usecases/get_tennis_matches_usecase.dart';

part 'tennis_state.dart';

class TennisCubit extends Cubit<TennisState> {
  final GetTennisMatchesUseCase _getMatches;

  TennisCubit(this._getMatches) : super(const TennisInitial());

  Future<void> loadMatches() async {
    emit(const TennisLoading());
    final result = await _getMatches();
    result.fold(
      (failure) => emit(TennisError(failure.message)),
      (matches) => emit(TennisLoaded(matches)),
    );
  }
}
