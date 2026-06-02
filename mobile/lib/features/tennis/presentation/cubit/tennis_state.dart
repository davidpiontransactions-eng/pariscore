part of 'tennis_cubit.dart';

abstract class TennisState extends Equatable {
  const TennisState();

  @override
  List<Object?> get props => [];
}

class TennisInitial extends TennisState {
  const TennisInitial();
}

class TennisLoading extends TennisState {
  const TennisLoading();
}

class TennisLoaded extends TennisState {
  final List<TennisMatch> matches;

  const TennisLoaded(this.matches);

  List<TennisMatch> get live =>
      matches.where((m) => m.isLive).toList();
  List<TennisMatch> get upcoming =>
      matches.where((m) => !m.isLive).toList();

  @override
  List<Object> get props => [matches];
}

class TennisError extends TennisState {
  final String message;

  const TennisError(this.message);

  @override
  List<Object> get props => [message];
}
