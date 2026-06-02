import 'dart:convert';

import '../../../../core/constants/api_constants.dart';
import '../../../../core/network/api_client.dart';
import '../../../football/data/models/match_model.dart';

abstract class LiveSseDataSource {
  Stream<List<MatchModel>> watchLiveMatches();
}

class LiveSseDataSourceImpl implements LiveSseDataSource {
  final ApiClient _client;

  const LiveSseDataSourceImpl(this._client);

  @override
  Stream<List<MatchModel>> watchLiveMatches() {
    return _client.sse(ApiConstants.liveSse).map((raw) {
      try {
        final decoded = jsonDecode(raw);
        if (decoded is Map && decoded['matches'] is List) {
          return (decoded['matches'] as List)
              .map((e) => MatchModel.fromJson(e as Map<String, dynamic>))
              .toList();
        }
        return <MatchModel>[];
      } catch (_) {
        return <MatchModel>[];
      }
    });
  }
}
