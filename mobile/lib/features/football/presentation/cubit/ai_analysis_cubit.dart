import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../data/datasources/ai_analysis_datasource.dart';
import '../../domain/entities/match.dart';

part 'ai_analysis_state.dart';

class AiAnalysisCubit extends Cubit<AiAnalysisState> {
  final AiAnalysisDataSource _dataSource;

  AiAnalysisCubit(this._dataSource) : super(const AiAnalysisInitial());

  Future<void> analyze(Match match) async {
    emit(const AiAnalysisLoading());
    try {
      final text = await _dataSource.analyzeMatch(match);
      emit(AiAnalysisLoaded(text));
    } catch (e) {
      emit(const AiAnalysisError('Analyse IA indisponible'));
    }
  }
}
