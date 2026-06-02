part of 'scout_cubit.dart';

abstract class ScoutState extends Equatable {
  const ScoutState();

  @override
  List<Object?> get props => [];
}

class ScoutInitial extends ScoutState {
  const ScoutInitial();
}

class ScoutLoading extends ScoutState {
  const ScoutLoading();
}

class ScoutLoaded extends ScoutState {
  final List<ScoutPick> picks;

  const ScoutLoaded(this.picks);

  @override
  List<Object> get props => [picks];
}

class ScoutError extends ScoutState {
  final String message;

  const ScoutError(this.message);

  @override
  List<Object> get props => [message];
}
