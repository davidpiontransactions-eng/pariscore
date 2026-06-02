import '../../../../core/constants/api_constants.dart';
import '../../../../core/network/api_client.dart';
import '../models/wc_models.dart';

abstract class WcRemoteDataSource {
  Future<WcOverviewModel> getOverview();
  Future<List<dynamic>> getSchedule({String? phase});
}

class WcRemoteDataSourceImpl implements WcRemoteDataSource {
  final ApiClient _client;

  const WcRemoteDataSourceImpl(this._client);

  @override
  Future<WcOverviewModel> getOverview() async {
    final res = await _client.get<dynamic>(ApiConstants.wcOverview);
    return WcOverviewModel.fromJson(res.data as Map<String, dynamic>);
  }

  @override
  Future<List<dynamic>> getSchedule({String? phase}) async {
    final res = await _client.get<dynamic>(
      ApiConstants.wcSchedule,
      query: {if (phase != null) 'phase': phase},
    );
    final data = res.data;
    if (data is Map) {
      return (data['matches'] as List<dynamic>?) ?? [];
    }
    return data as List<dynamic>? ?? [];
  }
}
