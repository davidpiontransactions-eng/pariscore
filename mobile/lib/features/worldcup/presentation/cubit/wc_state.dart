part of 'wc_cubit.dart';

abstract class WcState extends Equatable {
  const WcState();

  @override
  List<Object?> get props => [];
}

class WcInitial extends WcState {
  const WcInitial();
}

class WcLoading extends WcState {
  const WcLoading();
}

class WcLoaded extends WcState {
  final WcOverview overview;

  const WcLoaded(this.overview);

  @override
  List<Object> get props => [overview];
}

class WcError extends WcState {
  final String message;

  const WcError(this.message);

  @override
  List<Object> get props => [message];
}
