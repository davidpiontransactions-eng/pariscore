import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/scout_pick.dart';
import '../../domain/usecases/get_top_picks_usecase.dart';

part 'scout_state.dart';

class ScoutCubit extends Cubit<ScoutState> {
  final GetTopPicksUseCase _useCase;

  ScoutCubit(this._useCase) : super(const ScoutInitial());

  Future<void> load() async {
    emit(const ScoutLoading());
    final result = await _useCase();
    result.fold(
      (failure) => emit(ScoutError(failure.message)),
      (picks) => emit(ScoutLoaded(picks)),
    );
  }
}
