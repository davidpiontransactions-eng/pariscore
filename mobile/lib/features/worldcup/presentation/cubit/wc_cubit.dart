import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/wc_entities.dart';
import '../../domain/repositories/wc_repository.dart';

part 'wc_state.dart';

class WcCubit extends Cubit<WcState> {
  final WcRepository _repository;

  WcCubit(this._repository) : super(const WcInitial());

  Future<void> load() async {
    emit(const WcLoading());
    final result = await _repository.getOverview();
    result.fold(
      (failure) => emit(WcError(failure.message)),
      (overview) => emit(WcLoaded(overview)),
    );
  }
}
