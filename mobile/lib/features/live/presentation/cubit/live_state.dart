part of 'live_cubit.dart';

abstract class LiveState extends Equatable {
  const LiveState();

  @override
  List<Object?> get props => [];
}

class LiveInitial extends LiveState {
  const LiveInitial();
}

class LiveConnecting extends LiveState {
  const LiveConnecting();
}

class LiveConnected extends LiveState {
  final List<Match> matches;

  const LiveConnected(this.matches);

  @override
  List<Object> get props => [matches];
}

class LiveError extends LiveState {
  final String message;

  const LiveError(this.message);

  @override
  List<Object> get props => [message];
}
