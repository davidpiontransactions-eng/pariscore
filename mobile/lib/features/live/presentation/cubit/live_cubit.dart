import 'dart:async';

import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../football/domain/entities/match.dart';
import '../../data/datasources/live_sse_datasource.dart';

part 'live_state.dart';

class LiveCubit extends Cubit<LiveState> {
  final LiveSseDataSource _sse;
  StreamSubscription<List<Match>>? _sub;

  LiveCubit(this._sse) : super(const LiveInitial());

  void connect() {
    emit(const LiveConnecting());
    _sub = _sse.watchLiveMatches().listen(
          (matches) => emit(LiveConnected(matches)),
          onError: (e) =>
              emit(const LiveError('Connexion live perdue. Reconnexion...')),
    );
  }

  void disconnect() {
    _sub?.cancel();
    _sub = null;
  }

  @override
  Future<void> close() {
    disconnect();
    return super.close();
  }
}
