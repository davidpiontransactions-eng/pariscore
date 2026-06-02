import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/extensions.dart';
import '../../domain/entities/match.dart';

class MatchCard extends StatelessWidget {
  final Match match;
  final VoidCallback? onTap;

  const MatchCard({super.key, required this.match, this.onTap});

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 250),
      curve: Curves.easeOut,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          splashColor: AppColors.green.withOpacity(0.05),
          highlightColor: AppColors.green.withOpacity(0.03),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.bg2,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: match.isLive
                    ? AppColors.green.withOpacity(0.35)
                    : AppColors.border,
                width: match.isLive ? 1.5 : 1,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _Header(match: match),
                const SizedBox(height: 12),
                _TeamsRow(match: match),
                if (match.poisson != null || match.bestEdge != null) ...[
                  const SizedBox(height: 12),
                  Divider(color: AppColors.border, height: 1),
                  const SizedBox(height: 12),
                  _StatsRow(match: match),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  final Match match;

  const _Header({required this.match});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            match.league,
            style: AppTextStyles.monoSmall.copyWith(color: AppColors.text3),
            overflow: TextOverflow.ellipsis,
          ),
        ),
        const SizedBox(width: 8),
        if (match.isLive)
          _LiveBadge(minute: match.liveScore?.minute)
        else
          Text(
            match.commenceTime.hhmm,
            style: AppTextStyles.monoSmall,
          ),
      ],
    );
  }
}

class _LiveBadge extends StatefulWidget {
  final int? minute;

  const _LiveBadge({this.minute});

  @override
  State<_LiveBadge> createState() => _LiveBadgeState();
}

class _LiveBadgeState extends State<_LiveBadge>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulse;
  late final Animation<double> _alpha;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat(reverse: true);
    _alpha = Tween<double>(begin: 0.4, end: 1.0).animate(_pulse);
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: AppColors.green.withOpacity(0.12),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(
            color: AppColors.green.withOpacity(0.4), width: 0.5),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          FadeTransition(
            opacity: _alpha,
            child: Container(
              width: 6,
              height: 6,
              decoration: const BoxDecoration(
                color: AppColors.green,
                shape: BoxShape.circle,
              ),
            ),
          ),
          const SizedBox(width: 4),
          Text(
            widget.minute != null ? '${widget.minute}\'' : 'LIVE',
            style: AppTextStyles.monoBadge.copyWith(color: AppColors.green),
          ),
        ],
      ),
    );
  }
}

class _TeamsRow extends StatelessWidget {
  final Match match;

  const _TeamsRow({required this.match});

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                match.homeTeam,
                style: AppTextStyles.labelLarge,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 4),
              Text(
                match.awayTeam,
                style: AppTextStyles.bodyMedium.copyWith(color: AppColors.text2),
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
        const SizedBox(width: 12),
        if (match.liveScore != null)
          _LiveScore(score: match.liveScore!)
        else if (match.odds != null)
          _OddsColumn(odds: match.odds!),
      ],
    );
  }
}

class _LiveScore extends StatelessWidget {
  final LiveScore score;

  const _LiveScore({required this.score});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Text(
          '${score.homeScore}',
          style: AppTextStyles.monoLarge.copyWith(fontWeight: FontWeight.w700),
        ),
        Text(
          '${score.awayScore}',
          style: AppTextStyles.monoLarge.copyWith(color: AppColors.text2),
        ),
      ],
    );
  }
}

class _OddsColumn extends StatelessWidget {
  final MatchOdds odds;

  const _OddsColumn({required this.odds});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        if (odds.home != null)
          Text(odds.home!.odds2, style: AppTextStyles.monoSmall),
        if (odds.draw != null)
          Text(odds.draw!.odds2,
              style: AppTextStyles.monoSmall.copyWith(color: AppColors.text2)),
        if (odds.away != null)
          Text(odds.away!.odds2,
              style: AppTextStyles.monoSmall.copyWith(color: AppColors.text2)),
      ],
    );
  }
}

class _StatsRow extends StatelessWidget {
  final Match match;

  const _StatsRow({required this.match});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        if (match.poisson?.over25 != null)
          _StatChip(
            label: 'O2.5',
            value: match.poisson!.over25!.pct,
            color: AppColors.poissonColor(match.poisson!.over25!),
          ),
        if (match.poisson?.btts != null) ...[
          const SizedBox(width: 6),
          _StatChip(
            label: 'BTTS',
            value: match.poisson!.btts!.pct,
            color: AppColors.poissonColor(match.poisson!.btts!),
          ),
        ],
        const Spacer(),
        if (match.bestEdge?.edge != null)
          _EdgeBadge(edge: match.bestEdge!),
      ],
    );
  }
}

class _StatChip extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _StatChip({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withOpacity(0.25), width: 0.5),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: AppTextStyles.monoBadge.copyWith(color: AppColors.text3),
          ),
          const SizedBox(width: 4),
          Text(
            value,
            style: AppTextStyles.monoBadge.copyWith(
              color: color,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

class _EdgeBadge extends StatelessWidget {
  final MatchEdge edge;

  const _EdgeBadge({required this.edge});

  @override
  Widget build(BuildContext context) {
    final val = edge.edge ?? 0;
    final color = AppColors.edgeColor(val);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withOpacity(0.35)),
      ),
      child: Text(
        '${edge.label ?? ''} +${val.edge1}%',
        style: AppTextStyles.monoBadge.copyWith(
          color: color,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }
}
