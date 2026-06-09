import '../../../../core/constants/api_constants.dart';
import '../../../../core/network/api_client.dart';
import '../models/tennis_match_model.dart';

abstract class TennisRemoteDataSource {
  Future<List<TennisMatchModel>> getLiveMatches();
  Future<List<TennisMatchModel>> getUpcomingMatches();
}

class TennisRemoteDataSourceImpl implements TennisRemoteDataSource {
  const TennisRemoteDataSourceImpl(this._client);

  final ApiClient _client;

  @override
  Future<List<TennisMatchModel>> getLiveMatches() async {
    final res = await _client.get<dynamic>(ApiConstants.tennisLive);
    final data = res.data;
    final list = data is List
        ? data
        : (data as Map<String, dynamic>?)?['matches'] as List<dynamic>? ?? [];
    return list
        .map((e) => TennisMatchModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<List<TennisMatchModel>> getUpcomingMatches() async {
    final res = await _client.get<dynamic>(
      ApiConstants.tennisLive,
      query: {'status': 'upcoming'},
    );
    final data = res.data;
    final list = data is List
        ? data
        : (data as Map<String, dynamic>?)?['matches'] as List<dynamic>? ?? [];
    return list
        .map((e) => TennisMatchModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}
