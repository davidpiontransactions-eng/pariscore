import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/bet.dart';
import '../../domain/entities/daily_tracker.dart';
import '../../domain/repositories/bets_repository.dart';

part 'bets_state.dart';

class BetsCubit extends Cubit<BetsState> {
  final BetsRepository _repository;

  BetsCubit(this._repository) : super(const BetsInitial());

  Future<void> load() async {
    emit(const BetsLoading());
    final betsResult = await _repository.getBets();
    final summaryResult = await _repository.getBankrollSummary();
    final trackerResult = await _repository.getDailyTracker();

    betsResult.fold(
      (failure) => emit(BetsError(failure.message)),
      (bets) => emit(BetsLoaded(
        bets: bets,
        summary: summaryResult.fold((_) => null, (s) => s),
        tracker: trackerResult.fold((_) => [], (t) => t),
      )),
    );
  }

  Future<void> createBet(Map<String, dynamic> payload) async {
    final result = await _repository.createBet(payload);
    result.fold(
      (failure) => emit(BetsError(failure.message)),
      (_) => load(),
    );
  }

  Future<void> settleBet(int betId, String status,
      {double? cashoutAmount}) async {
    final result = await _repository.settleBet(betId, status,
        cashoutAmount: cashoutAmount);
    result.fold(
      (failure) => emit(BetsError(failure.message)),
      (_) => load(),
    );
  }
}
