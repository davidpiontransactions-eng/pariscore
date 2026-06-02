import '../../../../core/constants/api_constants.dart';
import '../../../../core/network/api_client.dart';
import '../models/match_model.dart';

abstract class FootballRemoteDataSource {
  Future<List<MatchModel>> getMatches({String? league, String? day});
  Future<MatchModel> getMatchDetail(String id);
}

class FootballRemoteDataSourceImpl implements FootballRemoteDataSource {
  final ApiClient _client;

  const FootballRemoteDataSourceImpl(this._client);

  @override
  Future<List<MatchModel>> getMatches({
    String? league,
    String? day,
  }) async {
    final res = await _client.get<Map<String, dynamic>>(
      ApiConstants.matches,
      query: {
        if (league != null) 'league': league,
        if (day != null) 'day': day,
      },
    );
    final data = res.data as Map<String, dynamic>;
    final list = data['matches'] as List<dynamic>? ?? [];
    return list
        .map((e) => MatchModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<MatchModel> getMatchDetail(String id) async {
    final res = await _client.get<Map<String, dynamic>>(
      ApiConstants.matchDetails,
      query: {'id': id},
    );
    return MatchModel.fromJson(res.data as Map<String, dynamic>);
  }
}
