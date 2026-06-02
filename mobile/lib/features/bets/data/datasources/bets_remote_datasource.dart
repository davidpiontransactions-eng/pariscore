import '../../../../core/constants/api_constants.dart';
import '../../../../core/network/api_client.dart';
import '../models/bet_model.dart';

abstract class BetsRemoteDataSource {
  Future<({List<BetModel> bets, int total})> getBets({
    int limit,
    int offset,
  });
  Future<BetModel> createBet(Map<String, dynamic> payload);
  Future<BankrollSummaryModel> getBankrollSummary();
}

class BetsRemoteDataSourceImpl implements BetsRemoteDataSource {
  final ApiClient _client;

  const BetsRemoteDataSourceImpl(this._client);

  @override
  Future<({List<BetModel> bets, int total})> getBets({
    int limit = 50,
    int offset = 0,
  }) async {
    final res = await _client.get<Map<String, dynamic>>(
      ApiConstants.bets,
      query: {'limit': limit, 'offset': offset},
    );
    final data = res.data as Map<String, dynamic>;
    final list = (data['bets'] as List<dynamic>? ?? [])
        .map((e) => BetModel.fromJson(e as Map<String, dynamic>))
        .toList();
    return (bets: list, total: data['total'] as int? ?? list.length);
  }

  @override
  Future<BetModel> createBet(Map<String, dynamic> payload) async {
    final res = await _client.post<Map<String, dynamic>>(
      ApiConstants.bets,
      data: payload,
    );
    return BetModel.fromJson(res.data as Map<String, dynamic>);
  }

  @override
  Future<BankrollSummaryModel> getBankrollSummary() async {
    final res = await _client.get<Map<String, dynamic>>(
      ApiConstants.bankrollSummary,
    );
    return BankrollSummaryModel.fromJson(
        res.data as Map<String, dynamic>);
  }
}
