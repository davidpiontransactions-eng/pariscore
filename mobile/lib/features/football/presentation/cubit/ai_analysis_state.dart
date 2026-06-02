part of 'ai_analysis_cubit.dart';

abstract class AiAnalysisState extends Equatable {
  const AiAnalysisState();

  @override
  List<Object?> get props => [];
}

class AiAnalysisInitial extends AiAnalysisState {
  const AiAnalysisInitial();
}

class AiAnalysisLoading extends AiAnalysisState {
  const AiAnalysisLoading();
}

class AiAnalysisLoaded extends AiAnalysisState {
  final String text;

  const AiAnalysisLoaded(this.text);

  @override
  List<Object> get props => [text];
}

class AiAnalysisError extends AiAnalysisState {
  final String message;

  const AiAnalysisError(this.message);

  @override
  List<Object> get props => [message];
}
