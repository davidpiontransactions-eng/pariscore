part of 'matches_cubit.dart';

abstract class MatchesState extends Equatable {
  const MatchesState();

  @override
  List<Object?> get props => [];
}

class MatchesInitial extends MatchesState {
  const MatchesInitial();
}

class MatchesLoading extends MatchesState {
  const MatchesLoading();
}

class MatchesLoaded extends MatchesState {
  final List<Match> matches;
  final String? activeLeague;

  const MatchesLoaded(this.matches, {this.activeLeague});

  List<Match> get valueBets => matches.where((m) => m.hasValueBet).toList();

  @override
  List<Object?> get props => [matches, activeLeague];
}

class MatchesError extends MatchesState {
  final String message;

  const MatchesError(this.message);

  @override
  List<Object> get props => [message];
}
