part of 'bets_cubit.dart';

abstract class BetsState extends Equatable {
  const BetsState();

  @override
  List<Object?> get props => [];
}

class BetsInitial extends BetsState {
  const BetsInitial();
}

class BetsLoading extends BetsState {
  const BetsLoading();
}

class BetsLoaded extends BetsState {
  final List<Bet> bets;
  final BankrollSummary? summary;

  const BetsLoaded({required this.bets, this.summary});

  List<Bet> get pending => bets.where((b) => !b.isSettled).toList();
  List<Bet> get settled => bets.where((b) => b.isSettled).toList();

  @override
  List<Object?> get props => [bets, summary];
}

class BetsError extends BetsState {
  final String message;

  const BetsError(this.message);

  @override
  List<Object> get props => [message];
}
