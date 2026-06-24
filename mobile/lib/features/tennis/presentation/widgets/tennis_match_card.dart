import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../domain/entities/tennis_match.dart';

/// Carte Tennis Premium — Design Trading Dark
class TennisMatchCard extends StatelessWidget {
  const TennisMatchCard({super.key, required this.match, this.onTap});

  final TennisMatch match;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: const Color(0xFF131722),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.white.withOpacity(0.05)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.3),
              blurRadius: 24,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        margin: const EdgeInsets.only(bottom: 16),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _CardHeader(match: match),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
              child: Column(
                children: [
                  _PlayerRow(
                    player: match.player1,
                    sets: match.sets.map((s) => s.p1Games).toList(),
                    isServing: match.servingPlayer == 1,
                    isWinner: match.isTight
                        ? null
                        : (match.dominanceRatioP1 ?? 0) >
                            (match.dominanceRatioP2 ?? 0),
                  ),
                  const SizedBox(height: 8),
                  _PlayerRow(
                    player: match.player2,
                    sets: match.sets.map((s) => s.p2Games).toList(),
                    isServing: match.servingPlayer == 2,
                    isWinner: match.isTight
                        ? null
                        : (match.dominanceRatioP2 ?? 0) >
                            (match.dominanceRatioP1 ?? 0),
                  ),
                  if (match.dominanceRatioP1 != null ||
                      match.dominanceRatioP2 != null) ...[
                    const SizedBox(height: 12),
                    _DominancePanel(match: match),
                  ],
                  if (match.odds != null && match.odds!.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    _OddsPanel(odds: match.odds!, isTight: match.isTight),
                  ],
                  if (match.edge?.edge != null && match.odds == null) ...[
                    const SizedBox(height: 12),
                    _EdgeRow(edge: match.edge!),
                  ],
                  if (match.betfairWom != null && match.odds == null) ...[
                    const SizedBox(height: 12),
                    _WomBar(wom: match.betfairWom!),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CardHeader extends StatelessWidget {
  const _CardHeader({required this.match});
  final TennisMatch match;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFF1c2030),
        border:
            Border(bottom: BorderSide(color: Colors.white.withOpacity(0.05))),
      ),
      child: Row(
        children: [
          if (match.isLive)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xFF00e676).withOpacity(0.10),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _PulsingDot(),
                  const SizedBox(width: 6),
                  Text(
                    'Live',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      fontFamily: 'DM Mono',
                      letterSpacing: 0.5,
                      color: const Color(0xFF00e676),
                    ),
                  ),
                ],
              ),
            )
          else
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.05),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                match.status.toUpperCase(),
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  fontFamily: 'DM Mono',
                  letterSpacing: 0.8,
                  color: AppColors.text3,
                ),
              ),
            ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              '${match.tournament} · ${match.tour}',
              style: AppTextStyles.monoSmall
                  .copyWith(color: AppColors.text2, fontSize: 11),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          const SizedBox(width: 8),
          _SurfaceChip(surface: match.surface),
          const SizedBox(width: 8),
          if (match.intensity != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: _intensityColor(match.intensity!).withOpacity(0.10),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                match.intensity!.toUpperCase(),
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  fontFamily: 'DM Mono',
                  letterSpacing: 0.5,
                  color: _intensityColor(match.intensity!),
                ),
              ),
            ),
          if (match.pressure != null) ...[
            const SizedBox(width: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: Colors.black.withOpacity(0.3),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('PRESSURE:',
                      style: TextStyle(
                          fontSize: 9,
                          fontFamily: 'DM Mono',
                          color: AppColors.text3,
                          fontWeight: FontWeight.w500)),
                  const SizedBox(width: 4),
                  Text('${match.pressure}',
                      style: TextStyle(
                          fontSize: 10,
                          fontFamily: 'DM Mono',
                          fontWeight: FontWeight.w700,
                          color: _pressureColor(match.pressure!))),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Color _intensityColor(String intensity) {
    switch (intensity.toLowerCase()) {
      case 'serré':
        return const Color(0xFFff5252);
      case 'tendu':
        return const Color(0xFFffa726);
      case 'déséquilibré':
        return const Color(0xFF00e676);
      default:
        return AppColors.text3;
    }
  }

  Color _pressureColor(int pressure) {
    if (pressure >= 80) return const Color(0xFFff5252);
    if (pressure >= 60) return const Color(0xFFffa726);
    return const Color(0xFF00e676);
  }
}

class _PulsingDot extends StatefulWidget {
  @override
  State<_PulsingDot> createState() => _PulsingDotState();
}

class _PulsingDotState extends State<_PulsingDot>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _opacity;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 1200))
      ..repeat(reverse: true);
    _opacity = Tween(begin: 1.0, end: 0.2).animate(_controller);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _opacity,
      builder: (_, __) => Container(
        width: 7,
        height: 7,
        decoration: BoxDecoration(
          color: const Color(0xFF00e676).withOpacity(_opacity.value),
          shape: BoxShape.circle,
        ),
      ),
    );
  }
}

class _SurfaceChip extends StatelessWidget {
  const _SurfaceChip({required this.surface});
  final String surface;

  Color get _color => switch (surface.toLowerCase()) {
        'clay' || 'terre battue' => const Color(0xFFE07B54),
        'grass' || 'gazon' => const Color(0xFF00e676),
        'hard' || 'dur' => const Color(0xFF29B6F6),
        _ => AppColors.text3,
      };

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: _color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: _color.withOpacity(0.3), width: 0.5),
      ),
      child: Text(
        surface.toUpperCase(),
        style: TextStyle(
            fontSize: 9,
            fontWeight: FontWeight.w600,
            fontFamily: 'DM Mono',
            letterSpacing: 0.5,
            color: _color),
      ),
    );
  }
}

class _PlayerRow extends StatelessWidget {
  const _PlayerRow(
      {required this.player,
      required this.sets,
      required this.isServing,
      this.isWinner});
  final TennisPlayer player;
  final List<int> sets;
  final bool isServing;
  final bool? isWinner;

  @override
  Widget build(BuildContext context) {
    final highlight = isWinner == true;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.black.withOpacity(0.15),
        borderRadius: BorderRadius.circular(8),
        border: highlight
            ? Border.all(color: const Color(0xFF00e676).withOpacity(0.15))
            : null,
      ),
      child: Row(
        children: [
          _PlayerAvatar(player: player),
          const SizedBox(width: 12),
          if (isServing)
            Container(
                width: 6,
                height: 6,
                margin: const EdgeInsets.only(right: 6),
                decoration: const BoxDecoration(
                    color: Color(0xFF00e676), shape: BoxShape.circle))
          else
            const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(player.name,
                    style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color:
                            highlight ? const Color(0xFF00e676) : Colors.white,
                        height: 1.2),
                    overflow: TextOverflow.ellipsis),
                if (player.rank != null)
                  Text('RK ${player.rank}',
                      style: TextStyle(
                          fontSize: 11,
                          fontFamily: 'DM Mono',
                          color: AppColors.text3)),
              ],
            ),
          ),
          ...sets.map((g) => Container(
              width: 26,
              alignment: Alignment.center,
              child: Text('$g',
                  style: TextStyle(
                      fontSize: 15,
                      fontFamily: 'DM Mono',
                      fontWeight: FontWeight.w700,
                      color: Colors.white)))),
          const SizedBox(width: 12),
          if (player.eloRating != null)
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('ELO ${player.eloRating!.round()}',
                    style: TextStyle(
                        fontSize: 11,
                        fontFamily: 'DM Mono',
                        color: AppColors.text2)),
                if (player.eloDelta != null && player.eloDelta! != 0)
                  Text('${player.eloDelta! >= 0 ? '+' : ''}${player.eloDelta}',
                      style: TextStyle(
                          fontSize: 10,
                          fontFamily: 'DM Mono',
                          fontWeight: FontWeight.w600,
                          color: player.eloDelta! > 0
                              ? const Color(0xFF00e676)
                              : const Color(0xFFff5252))),
              ],
            ),
        ],
      ),
    );
  }
}

class _PlayerAvatar extends StatelessWidget {
  const _PlayerAvatar({required this.player});
  final TennisPlayer player;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        color: const Color(0xFF1c2030),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withOpacity(0.08)),
      ),
      clipBehavior: Clip.antiAlias,
      child: (player.photoUrl != null && player.photoUrl!.isNotEmpty)
          ? CachedNetworkImage(
              imageUrl: player.photoUrl!,
              fit: BoxFit.cover,
              placeholder: (_, __) => const SizedBox(),
              errorWidget: (_, __, ___) => _buildFallback(),
            )
          : _buildFallback(),
    );
  }

  Widget _buildFallback() {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [const Color(0xFF1c2030), const Color(0xFF0b0e17)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      alignment: Alignment.center,
      child: Text(player.initials,
          style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w800,
              color: AppColors.text2)),
    );
  }
}

class _DominancePanel extends StatelessWidget {
  const _DominancePanel({required this.match});
  final TennisMatch match;

  @override
  Widget build(BuildContext context) {
    final p1 = match.dominanceRatioP1;
    final p2 = match.dominanceRatioP2;
    final tight = match.isTight;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.black.withOpacity(0.2),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
            color: tight
                ? const Color(0xFFff5252).withOpacity(0.2)
                : const Color(0xFF00e676).withOpacity(0.15)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(tight ? Icons.balance : Icons.trending_up,
                  size: 14,
                  color: tight
                      ? const Color(0xFFff5252)
                      : const Color(0xFF00e676)),
              const SizedBox(width: 6),
              Text('DOMINANCE RATIO (DR)',
                  style: TextStyle(
                      fontSize: 11,
                      fontFamily: 'DM Mono',
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                      letterSpacing: 0.3)),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: tight
                      ? const Color(0xFFff5252).withOpacity(0.1)
                      : const Color(0xFF00e676).withOpacity(0.1),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(tight ? 'ÉGALITÉ' : 'DOMINATION',
                    style: TextStyle(
                        fontSize: 9,
                        fontFamily: 'DM Mono',
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.5,
                        color: tight
                            ? const Color(0xFFff5252)
                            : const Color(0xFF00e676))),
              ),
            ],
          ),
          const SizedBox(height: 10),
          if (p1 != null && p2 != null) ...[
            ClipRRect(
              borderRadius: BorderRadius.circular(3),
              child: SizedBox(
                height: 6,
                child: Row(
                  children: [
                    Expanded(
                        flex: (p1 * 50).round().clamp(1, 99),
                        child: Container(
                            color: tight
                                ? const Color(0xFFff5252).withOpacity(0.4)
                                : p1 > p2
                                    ? const Color(0xFF00e676)
                                    : AppColors.text3)),
                    const SizedBox(width: 2),
                    Expanded(
                        flex: (p2 * 50).round().clamp(1, 99),
                        child: Container(
                            color: tight
                                ? const Color(0xFFff5252).withOpacity(0.4)
                                : p2 > p1
                                    ? const Color(0xFF00e676)
                                    : AppColors.text3)),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 8),
          ],
          Row(
            children: [
              Expanded(
                  child: Row(children: [
                Text(match.player1.name.split(' ').last,
                    style: TextStyle(
                        fontSize: 10,
                        fontFamily: 'DM Mono',
                        color: AppColors.text3)),
                const SizedBox(width: 4),
                Text(p1?.toStringAsFixed(2) ?? '--',
                    style: TextStyle(
                        fontSize: 13,
                        fontFamily: 'DM Mono',
                        fontWeight: FontWeight.w700,
                        color: const Color(0xFFffa726))),
              ])),
              Expanded(
                  child:
                      Row(mainAxisAlignment: MainAxisAlignment.end, children: [
                Text(p2?.toStringAsFixed(2) ?? '--',
                    style: TextStyle(
                        fontSize: 13,
                        fontFamily: 'DM Mono',
                        fontWeight: FontWeight.w700,
                        color: const Color(0xFFffa726))),
                const SizedBox(width: 4),
                Text(match.player2.name.split(' ').last,
                    style: TextStyle(
                        fontSize: 10,
                        fontFamily: 'DM Mono',
                        color: const Color(0xFF00e676))),
              ])),
            ],
          ),
          if (match.tradingAdvice.isNotEmpty) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.only(top: 8),
              decoration: BoxDecoration(
                  border: Border(
                      top: BorderSide(color: Colors.white.withOpacity(0.03)))),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(tight ? Icons.info_outline : Icons.lightbulb_outline,
                      size: 13,
                      color: tight ? AppColors.text3 : const Color(0xFFffa726)),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      tight
                          ? 'Les deux joueuses sont au même niveau (DR ${p1?.toStringAsFixed(2)}). Pas d\'opportunité claire — observez le prochain jeu clé.'
                          : '${p1! > p2! ? match.player1.name.split(' ').last : match.player2.name.split(' ').last} domine le match. Opportunité de trading détectée.',
                      style: TextStyle(
                          fontSize: 11,
                          fontStyle: FontStyle.italic,
                          color: tight ? AppColors.text3 : Colors.white,
                          height: 1.4),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _OddsPanel extends StatelessWidget {
  const _OddsPanel({required this.odds, this.isTight = false});
  final List<TennisOdds> odds;
  final bool isTight;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        ...odds.map((odd) => Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: _OddsRow(odd: odd, isTight: isTight))),
        if (isTight)
          Container(
            margin: const EdgeInsets.only(top: 4),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: const Color(0xFFff5252).withOpacity(0.06),
              borderRadius: BorderRadius.circular(6),
              border:
                  Border.all(color: const Color(0xFFff5252).withOpacity(0.15)),
            ),
            child: Row(
              children: [
                Icon(Icons.warning_amber_rounded,
                    size: 14, color: const Color(0xFFffa726)),
                const SizedBox(width: 6),
                Expanded(
                    child: Text(
                        'Match serré — cotes indicatives. Aucune opportunité claire pour le moment.',
                        style: TextStyle(
                            fontSize: 10,
                            color: AppColors.text2,
                            height: 1.3))),
              ],
            ),
          ),
      ],
    );
  }
}

class _OddsRow extends StatelessWidget {
  const _OddsRow({required this.odd, required this.isTight});
  final TennisOdds odd;
  final bool isTight;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFF1c2030),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.white.withOpacity(0.04)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
                color: Colors.black.withOpacity(0.3),
                borderRadius: BorderRadius.circular(4)),
            child: Text(odd.label,
                style: TextStyle(
                    fontSize: 12,
                    fontFamily: 'DM Mono',
                    fontWeight: FontWeight.w700,
                    color: Colors.white)),
          ),
          const Spacer(),
          Text(odd.probabilityDisplay,
              style: TextStyle(
                  fontSize: 15,
                  fontFamily: 'DM Mono',
                  fontWeight: FontWeight.w800,
                  color: odd.probability >= 80
                      ? const Color(0xFF00e676)
                      : odd.probability >= 65
                          ? const Color(0xFFffa726)
                          : AppColors.text3)),
          const SizedBox(width: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: isTight
                  ? AppColors.text3.withOpacity(0.15)
                  : const Color(0xFF00e676).withOpacity(0.10),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(odd.coteDisplay,
                style: TextStyle(
                    fontSize: 13,
                    fontFamily: 'DM Mono',
                    fontWeight: FontWeight.w700,
                    color:
                        isTight ? AppColors.text3 : const Color(0xFF00e676))),
          ),
          const SizedBox(width: 8),
          Icon(
              isTight
                  ? Icons.remove_red_eye_outlined
                  : Icons.add_circle_outline,
              size: 18,
              color: isTight
                  ? AppColors.text3.withOpacity(0.3)
                  : const Color(0xFF00e676)),
        ],
      ),
    );
  }
}

class _EdgeRow extends StatelessWidget {
  const _EdgeRow({required this.edge});
  final TennisEdge edge;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.black.withOpacity(0.15),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.white.withOpacity(0.04)),
      ),
      child: Row(
        children: [
          if (edge.p1WinProb != null)
            Text(
                '${(edge.p1WinProb! * 100).toStringAsFixed(0)}% / ${((1 - edge.p1WinProb!) * 100).toStringAsFixed(0)}%',
                style: AppTextStyles.monoSmall),
          const Spacer(),
          if (edge.edge != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.blue.withOpacity(0.12),
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: AppColors.blue.withOpacity(0.35)),
              ),
              child: Text('+${edge.edge!.toStringAsFixed(1)}%',
                  style: AppTextStyles.monoBadge.copyWith(
                      color: AppColors.blue, fontWeight: FontWeight.w500)),
            ),
        ],
      ),
    );
  }
}

class _WomBar extends StatelessWidget {
  const _WomBar({required this.wom});
  final WomData wom;

  @override
  Widget build(BuildContext context) {
    final total = wom.p1 + wom.p2;
    final p1Frac = total > 0 ? wom.p1 / total : 0.5;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.black.withOpacity(0.15),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.white.withOpacity(0.04)),
      ),
      child: Column(
        children: [
          Row(children: [
            Text('P1 ${wom.p1.toStringAsFixed(1)}%',
                style: AppTextStyles.monoBadge.copyWith(color: AppColors.blue)),
            const Spacer(),
            Text('WOM',
                style:
                    AppTextStyles.monoBadge.copyWith(color: AppColors.text3)),
            const Spacer(),
            Text('P2 ${wom.p2.toStringAsFixed(1)}%',
                style:
                    AppTextStyles.monoBadge.copyWith(color: AppColors.amber)),
          ]),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(3),
            child: Row(children: [
              Expanded(
                  flex: (p1Frac * 100).round().clamp(1, 99),
                  child: Container(height: 6, color: AppColors.blue)),
              Expanded(
                  flex: ((1 - p1Frac) * 100).round().clamp(1, 99),
                  child: Container(height: 6, color: AppColors.amber)),
            ]),
          ),
        ],
      ),
    );
  }
}
