import '../../../../core/constants/api_constants.dart';
import '../../../../core/network/api_client.dart';
import '../models/bet_model.dart';
import '../models/daily_tracker_model.dart';

abstract class BetsRemoteDataSource {
  Future<({List<BetModel> bets, int total})> getBets({
    int limit,
    int offset,
  });
  Future<BetModel> createBet(Map<String, dynamic> payload);
  Future<BetModel> settleBet(int betId, String status, {double? cashoutAmount});
  Future<BankrollSummaryModel> getBankrollSummary();
  Future<List<DailyTrackerEntryModel>> getDailyTracker();
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
  Future<BetModel> settleBet(int betId, String status,
      {double? cashoutAmount}) async {
    final res = await _client.post<Map<String, dynamic>>(
      ApiConstants.betSettle(betId),
      data: {
        'status': status,
        if (cashoutAmount != null) 'cashout_amount': (cashoutAmount * 100).round(),
      },
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

  @override
  Future<List<DailyTrackerEntryModel>> getDailyTracker() async {
    final res = await _client.get<dynamic>(ApiConstants.bankrollDailyTracker);
    final list = res.data as List<dynamic>? ?? [];
    return list
        .map((e) => DailyTrackerEntryModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}
