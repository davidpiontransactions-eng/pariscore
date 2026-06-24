import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/tennis_match.dart';
import '../../domain/usecases/get_tennis_matches_usecase.dart';

part 'tennis_state.dart';

class TennisCubit extends Cubit<TennisState> {
  TennisCubit(this._getMatches) : super(const TennisInitial());

  final GetTennisMatchesUseCase _getMatches;

  Future<void> loadMatches() async {
    emit(const TennisLoading());
    final result = await _getMatches();
    result.fold(
      (failure) => emit(TennisError(failure.message)),
      (matches) => emit(TennisLoaded(matches)),
    );
  }

  void loadMockData() {
    emit(TennisLoaded(_mockMatches));
  }
}

const _mockMatches = <TennisMatch>[
  // 1 — Match SERRÉ (DR 1.00 vs 1.00) → "observer avant de miser"
  TennisMatch(
    id: 'mock-tight-01',
    tour: 'Finale',
    tournament: 'Roland Garros',
    surface: 'Terre battue',
    player1: TennisPlayer(
      name: 'Iga Swiatek',
      country: 'POL',
      eloRating: 2105,
      rank: 1,
      photoUrl: 'https://wta-tennis.com/images/players/swiatek.jpg',
      eloDelta: 0,
    ),
    player2: TennisPlayer(
      name: 'Aryna Sabalenka',
      country: 'BLR',
      eloRating: 2085,
      rank: 2,
      photoUrl: 'https://wta-tennis.com/images/players/sabalenka.jpg',
      eloDelta: 0,
    ),
    sets: [
      TennisSet(p1Games: 2, p2Games: 3),
      TennisSet(p1Games: 4, p2Games: 2)
    ],
    status: 'En cours',
    isLive: true,
    servingPlayer: 1,
    dominanceRatioP1: 1.00,
    dominanceRatioP2: 1.00,
    pressure: 88,
    intensity: 'serré',
    odds: [
      TennisOdds(label: 'S. 12.5', probability: 92, cote: 1.08),
      TennisOdds(label: 'O 10.5', probability: 78, cote: 1.35),
      TennisOdds(label: 'S. 1er set', probability: 85, cote: 1.18),
    ],
  ),
  // 2 — Domination P1 (DR 1.35 vs 0.65) → "opportunité"
  TennisMatch(
    id: 'mock-domination-02',
    tour: '1er tour',
    tournament: 'Australian Open',
    surface: 'Dur',
    player1: TennisPlayer(
      name: 'Iga Swiatek',
      country: 'POL',
      eloRating: 2105,
      rank: 1,
      eloDelta: 42,
    ),
    player2: TennisPlayer(
      name: 'Timea Babos',
      country: 'HUN',
      eloRating: 1355,
      rank: 145,
      eloDelta: -42,
    ),
    sets: [TennisSet(p1Games: 3, p2Games: 4)],
    status: 'En cours',
    isLive: true,
    servingPlayer: 2,
    dominanceRatioP1: 1.35,
    dominanceRatioP2: 0.65,
    pressure: 72,
    intensity: 'déséquilibré',
    odds: [
      TennisOdds(label: 'S. set', probability: 88, cote: 1.12),
      TennisOdds(label: 'O 9.5', probability: 65, cote: 1.75),
    ],
  ),
  // 3 — Équilibré / Tendu (DR 1.10 vs 0.90)
  TennisMatch(
    id: 'mock-balanced-03',
    tour: 'Demi-finale',
    tournament: 'Wimbledon',
    surface: 'Gazon',
    player1: TennisPlayer(
      name: 'Elena Rybakina',
      country: 'KAZ',
      eloRating: 1895,
      rank: 4,
      eloDelta: 8,
    ),
    player2: TennisPlayer(
      name: 'Jessica Pegula',
      country: 'USA',
      eloRating: 1835,
      rank: 6,
      eloDelta: -8,
    ),
    sets: [TennisSet(p1Games: 2, p2Games: 1)],
    status: 'En cours',
    isLive: true,
    servingPlayer: 1,
    dominanceRatioP1: 1.10,
    dominanceRatioP2: 0.90,
    pressure: 65,
    intensity: 'tendu',
  ),
  // 4 — Legacy (DR null, fallback edge + WOM)
  TennisMatch(
    id: 'mock-legacy-04',
    tour: '1/4 finale',
    tournament: 'US Open',
    surface: 'Dur',
    player1: TennisPlayer(
      name: 'Coco Gauff',
      country: 'USA',
      eloRating: 1770,
      rank: 3,
    ),
    player2: TennisPlayer(
      name: 'Ons Jabeur',
      country: 'TUN',
      eloRating: 1645,
      rank: 10,
    ),
    sets: [TennisSet(p1Games: 3, p2Games: 3)],
    status: 'À venir',
    isLive: false,
    edge: TennisEdge(
        p1WinProb: 0.62,
        p2WinProb: 0.38,
        edge: 3.2,
        recommendation: 'Valeur P1'),
    betfairWom: WomData(p1: 55.2, p2: 44.8, totalMatched: 124500),
  ),
  // 5 — Haute pression + odds complètes (DR 1.25 vs 0.75, pressure 92)
  TennisMatch(
    id: 'mock-highpressure-05',
    tour: 'Finale',
    tournament: 'Roland Garros',
    surface: 'Terre battue',
    player1: TennisPlayer(
      name: 'Carlos Alcaraz',
      country: 'ESP',
      eloRating: 2210,
      rank: 2,
      photoUrl: 'https://atp-tour.com/images/alcaraz.jpg',
      eloDelta: 25,
    ),
    player2: TennisPlayer(
      name: 'Jannik Sinner',
      country: 'ITA',
      eloRating: 2105,
      rank: 4,
      photoUrl: 'https://atp-tour.com/images/sinner.jpg',
      eloDelta: -25,
    ),
    sets: [TennisSet(p1Games: 2, p2Games: 1)],
    status: 'En cours',
    isLive: true,
    servingPlayer: 2,
    dominanceRatioP1: 1.25,
    dominanceRatioP2: 0.75,
    pressure: 92,
    intensity: 'tendu',
    odds: [
      TennisOdds(label: 'S. set', probability: 82, cote: 1.22),
      TennisOdds(label: 'O 11.5', probability: 58, cote: 2.10),
      TennisOdds(label: 'BTTS', probability: 45, cote: 2.85),
    ],
  ),
];
