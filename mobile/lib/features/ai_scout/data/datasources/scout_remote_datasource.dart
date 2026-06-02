import '../../../../core/constants/api_constants.dart';
import '../../../../core/network/api_client.dart';
import '../models/scout_pick_model.dart';

abstract class ScoutRemoteDataSource {
  Future<List<ScoutPickModel>> getTopPicks();
}

class ScoutRemoteDataSourceImpl implements ScoutRemoteDataSource {
  final ApiClient _client;

  const ScoutRemoteDataSourceImpl(this._client);

  @override
  Future<List<ScoutPickModel>> getTopPicks() async {
    final res = await _client.get<dynamic>(ApiConstants.aiScout);
    final data = res.data;

    // /api/v1/ai-scout returns { picks: [...], raw: "...", cached: bool }
    // or a string of markdown, or structured picks
    if (data is Map) {
      final picks = data['picks'] as List<dynamic>?;
      if (picks != null) {
        return picks
            .map((e) => ScoutPickModel.fromJson(e as Map<String, dynamic>))
            .toList();
      }
      // Fallback: parse raw text response as single pick
      final raw = data['analysis'] as String? ?? data['raw'] as String? ?? '';
      return _parseRawText(raw);
    }
    if (data is String) return _parseRawText(data);
    return [];
  }

  List<ScoutPickModel> _parseRawText(String raw) {
    if (raw.isEmpty) return [];
    // Parse Gemini markdown sections
    final picks = <ScoutPickModel>[];
    final sections = raw.split(RegExp(r'\n(?=🎯|💎|🎲)'));
    for (final section in sections) {
      if (section.contains('🎯')) {
        picks.add(ScoutPickModel(
            type: 'combined',
            label: 'Combiné du jour',
            analysis: section.replaceAll('🎯', '').trim()));
      } else if (section.contains('💎')) {
        picks.add(ScoutPickModel(
            type: 'confident',
            label: 'Grosse confiance',
            analysis: section.replaceAll('💎', '').trim()));
      } else if (section.contains('🎲')) {
        picks.add(ScoutPickModel(
            type: 'outsider',
            label: 'Outsider',
            analysis: section.replaceAll('🎲', '').trim()));
      }
    }
    if (picks.isEmpty && raw.isNotEmpty) {
      picks.add(ScoutPickModel(
          type: 'combined', label: 'Analyse IA', analysis: raw.trim()));
    }
    return picks;
  }
}
