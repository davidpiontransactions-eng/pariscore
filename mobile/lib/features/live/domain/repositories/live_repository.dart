import '../../../football/domain/entities/match.dart';

abstract class LiveRepository {
  Stream<List<Match>> watchLiveMatches();
}
