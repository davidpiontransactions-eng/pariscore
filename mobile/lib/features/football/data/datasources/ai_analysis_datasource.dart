import '../../../../core/constants/api_constants.dart';
import '../../../../core/network/api_client.dart';
import '../../domain/entities/match.dart';

/// Calls the secure /api/v1/gemini proxy to analyse a match.
/// Server enforces JSON response mime + caches by `_match_key`.
abstract class AiAnalysisDataSource {
  Future<String> analyzeMatch(Match match);
}

class AiAnalysisDataSourceImpl implements AiAnalysisDataSource {
  final ApiClient _client;

  const AiAnalysisDataSourceImpl(this._client);

  @override
  Future<String> analyzeMatch(Match match) async {
    final prompt = _buildPrompt(match);
    final res = await _client.post<Map<String, dynamic>>(
      ApiConstants.gemini,
      data: {
        '_match_key': 'mobile_${match.id}',
        'contents': [
          {
            'parts': [
              {'text': prompt},
            ],
          },
        ],
      },
    );
    return _extractText(res.data as Map<String, dynamic>);
  }

  String _buildPrompt(Match m) {
    final p = m.poisson;
    final xg = m.xg;
    final edge = m.bestEdge;
    final buf = StringBuffer()
      ..writeln(
          'Analyse ce match de football pour un parieur. Réponds en JSON avec '
          'une clé "analyse" (string, 3-4 phrases en français) donnant ton avis '
          'sur le meilleur pari value.')
      ..writeln('')
      ..writeln('Match: ${m.homeTeam} vs ${m.awayTeam} (${m.league})');
    if (m.odds != null) {
      buf.writeln(
          'Cotes: 1=${m.odds!.home ?? '?'} N=${m.odds!.draw ?? '?'} 2=${m.odds!.away ?? '?'}');
    }
    if (p != null) {
      buf.writeln(
          'Poisson: 1=${p.homeWin}% N=${p.draw}% 2=${p.awayWin}% | O2.5=${p.over25}% BTTS=${p.btts}%');
    }
    if (xg != null) {
      buf.writeln('xG attendu: ${m.homeTeam} ${xg.home} - ${xg.away} ${m.awayTeam}');
    }
    if (edge?.edge != null) {
      buf.writeln(
          'Value détectée: ${edge!.label} @ ${edge.odds} (+${edge.edge}% edge)');
    }
    return buf.toString();
  }

  String _extractText(Map<String, dynamic> data) {
    // Cache hit returns raw cached object; live returns Gemini structure
    try {
      // Gemini candidates structure
      final candidates = data['candidates'] as List<dynamic>?;
      if (candidates != null && candidates.isNotEmpty) {
        final content = candidates.first['content'] as Map<String, dynamic>?;
        final parts = content?['parts'] as List<dynamic>?;
        final text = parts?.first['text'] as String? ?? '';
        return _parseAnalyse(text);
      }
      // Cached structure may already be flat
      if (data['analyse'] != null) return data['analyse'].toString();
      if (data['analysis'] != null) return data['analysis'].toString();
    } catch (_) {}
    return 'Analyse indisponible pour ce match.';
  }

  String _parseAnalyse(String text) {
    // Gemini returns JSON text { "analyse": "..." }
    final match = RegExp(r'"analyse"\s*:\s*"([^"]+(?:\\.[^"]*)*)"')
        .firstMatch(text);
    if (match != null) {
      return match.group(1)!.replaceAll(r'\"', '"').replaceAll(r'\n', '\n');
    }
    // Fallback: strip JSON braces
    return text.replaceAll(RegExp(r'[{}"]'), '').trim();
  }
}
