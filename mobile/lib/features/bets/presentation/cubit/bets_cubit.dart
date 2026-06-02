import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/bet.dart';
import '../../domain/repositories/bets_repository.dart';

part 'bets_state.dart';

class BetsCubit extends Cubit<BetsState> {
  final BetsRepository _repository;

  BetsCubit(this._repository) : super(const BetsInitial());

  Future<void> load() async {
    emit(const BetsLoading());
    final betsResult = await _repository.getBets();
    final summaryResult = await _repository.getBankrollSummary();

    betsResult.fold(
      (failure) => emit(BetsError(failure.message)),
      (bets) => summaryResult.fold(
        (_) => emit(BetsLoaded(bets: bets, summary: null)),
        (summary) => emit(BetsLoaded(bets: bets, summary: summary)),
      ),
    );
  }

  Future<void> createBet(Map<String, dynamic> payload) async {
    final result = await _repository.createBet(payload);
    result.fold(
      (failure) => emit(BetsError(failure.message)),
      (_) => load(), // reload after create
    );
  }
}
