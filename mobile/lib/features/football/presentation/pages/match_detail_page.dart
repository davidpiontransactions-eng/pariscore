import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/utils/extensions.dart';
import '../../../../injection_container.dart';
import '../../domain/entities/match.dart';
import '../cubit/ai_analysis_cubit.dart';

class MatchDetailPage extends StatelessWidget {
  final Match match;

  const MatchDetailPage({super.key, required this.match});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<AiAnalysisCubit>(),
      child: _MatchDetailView(match: match),
    );
  }
}

class _MatchDetailView extends StatelessWidget {
  final Match match;

  const _MatchDetailView({required this.match});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 18),
          onPressed: () => context.pop(),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(match.league,
                style: AppTextStyles.monoSmall.copyWith(color: AppColors.text3)),
            Text(
              '${match.homeTeam} vs ${match.awayTeam}',
              style: AppTextStyles.labelLarge,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
        titleSpacing: 0,
        actions: [
          if (match.isLive)
            Padding(
              padding: const EdgeInsets.only(right: 16),
              child: _LiveChip(minute: match.liveScore?.minute),
            )
          else
            Padding(
              padding: const EdgeInsets.only(right: 16),
              child: Text(
                match.commenceTime.hhmm,
                style: AppTextStyles.monoMedium,
              ),
            ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          // Live score
          if (match.liveScore != null) _LiveScoreCard(score: match.liveScore!),

          // AI analysis (Gemini)
          _AiAnalysisCard(match: match),

          // Value bet banner
          if (match.hasValueBet && match.bestEdge != null)
            _ValueBetBanner(edge: match.bestEdge!),

          // Odds row
          if (match.odds != null) ...[
            const SizedBox(height: 12),
            _OddsCard(match: match),
          ],

          // Poisson grid
          if (match.poisson != null) ...[
            const SizedBox(height: 16),
            _SectionHeader(title: 'Probabilités Poisson', icon: Icons.functions),
            const SizedBox(height: 8),
            _PoissonGrid(poisson: match.poisson!),
          ],

          // Expected Goals
          if (match.xg != null) ...[
            const SizedBox(height: 16),
            _SectionHeader(title: 'Expected Goals', icon: Icons.sports_soccer),
            const SizedBox(height: 8),
            _XgBar(xg: match.xg!),
          ],

          // Team stats
          if (match.stats != null) ...[
            const SizedBox(height: 16),
            _SectionHeader(
              title: 'Statistiques',
              subtitle: match.stats!.isReal ? '● LIVE' : '◌ SIM',
              subtitleColor: match.stats!.isReal ? AppColors.green : AppColors.text3,
              icon: Icons.bar_chart,
            ),
            const SizedBox(height: 8),
            _StatsTable(
              homeTeam: match.homeTeam,
              awayTeam: match.awayTeam,
              stats: match.stats!,
            ),
          ],

          // Betfair WOM
          if (match.betfairWomBacking != null) ...[
            const SizedBox(height: 16),
            _SectionHeader(title: 'Betfair WOM', icon: Icons.swap_horiz),
            const SizedBox(height: 8),
            _BetfairWomBar(
              backing: match.betfairWomBacking!,
              laying: match.betfairWomLaying ?? (100 - match.betfairWomBacking!),
              homeTeam: match.homeTeam,
              awayTeam: match.awayTeam,
            ),
          ],
        ],
      ),
    );
  }
}

// ─── AI analysis card ────────────────────────────────────────────────────────

class _AiAnalysisCard extends StatelessWidget {
  final Match match;

  const _AiAnalysisCard({required this.match});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 12),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppColors.green.withOpacity(0.06),
            AppColors.blue.withOpacity(0.05),
          ],
        ),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.green.withOpacity(0.2)),
      ),
      child: BlocBuilder<AiAnalysisCubit, AiAnalysisState>(
        builder: (context, state) {
          return Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.psychology_outlined,
                        color: AppColors.green, size: 20),
                    const SizedBox(width: 8),
                    Text('Analyse IA',
                        style: AppTextStyles.labelLarge
                            .copyWith(color: AppColors.green)),
                    const Spacer(),
                    if (state is AiAnalysisInitial)
                      TextButton(
                        onPressed: () =>
                            context.read<AiAnalysisCubit>().analyze(match),
                        style: TextButton.styleFrom(
                          minimumSize: const Size(0, 32),
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                        ),
                        child: Text('Analyser',
                            style: AppTextStyles.labelMedium
                                .copyWith(color: AppColors.green)),
                      ),
                  ],
                ),
                switch (state) {
                  AiAnalysisInitial() => Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(
                        'Demandez une analyse Gemini de ce match.',
                        style: AppTextStyles.bodySmall,
                      ),
                    ),
                  AiAnalysisLoading() => Padding(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      child: Row(
                        children: [
                          const SizedBox(
                            height: 16,
                            width: 16,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: AppColors.green),
                          ),
                          const SizedBox(width: 10),
                          Text('Gemini analyse…',
                              style: AppTextStyles.bodySmall),
                        ],
                      ),
                    ),
                  AiAnalysisLoaded(:final text) => Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Text(
                        text,
                        style: AppTextStyles.bodyMedium
                            .copyWith(height: 1.6),
                      ),
                    ),
                  AiAnalysisError(:final message) => Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Row(
                        children: [
                          Text(message, style: AppTextStyles.bodySmall),
                          const Spacer(),
                          TextButton(
                            onPressed: () => context
                                .read<AiAnalysisCubit>()
                                .analyze(match),
                            child: const Text('Réessayer'),
                          ),
                        ],
                      ),
                    ),
                  _ => const SizedBox.shrink(),
                },
              ],
            ),
          );
        },
      ),
    );
  }
}

// ─── Live chip ──────────────────────────────────────────────────────────────

class _LiveChip extends StatefulWidget {
  final int? minute;
  const _LiveChip({this.minute});

  @override
  State<_LiveChip> createState() => _LiveChipState();
}

class _LiveChipState extends State<_LiveChip>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _anim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 800))
      ..repeat(reverse: true);
    _anim = Tween<double>(begin: 0.4, end: 1.0).animate(_ctrl);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: AppColors.green.withOpacity(0.12),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: AppColors.green.withOpacity(0.4)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          FadeTransition(
            opacity: _anim,
            child: Container(
              width: 6,
              height: 6,
              decoration: const BoxDecoration(
                  color: AppColors.green, shape: BoxShape.circle),
            ),
          ),
          const SizedBox(width: 5),
          Text(
            widget.minute != null ? '${widget.minute}\'' : 'LIVE',
            style: AppTextStyles.monoBadge.copyWith(color: AppColors.green),
          ),
        ],
      ),
    );
  }
}

// ─── Live score card ────────────────────────────────────────────────────────

class _LiveScoreCard extends StatelessWidget {
  final LiveScore score;
  const _LiveScoreCard({required this.score});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 4),
      padding: const EdgeInsets.symmetric(vertical: 20),
      decoration: BoxDecoration(
        color: AppColors.bg2,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.green.withOpacity(0.3)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            '${score.homeScore}',
            style: AppTextStyles.displayLarge.copyWith(color: AppColors.green),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Text(
              score.period ?? (score.minute != null ? '${score.minute}\'' : '–'),
              style: AppTextStyles.monoMedium.copyWith(color: AppColors.text3),
            ),
          ),
          Text(
            '${score.awayScore}',
            style: AppTextStyles.displayLarge.copyWith(color: AppColors.text2),
          ),
        ],
      ),
    );
  }
}

// ─── Value bet banner ────────────────────────────────────────────────────────

class _ValueBetBanner extends StatelessWidget {
  final MatchEdge edge;
  const _ValueBetBanner({required this.edge});

  @override
  Widget build(BuildContext context) {
    final val = edge.edge ?? 0;
    return Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.green.withOpacity(0.08),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.green.withOpacity(0.35)),
      ),
      child: Row(
        children: [
          const Icon(Icons.trending_up, color: AppColors.green, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('VALUE BET',
                    style: AppTextStyles.monoBadge
                        .copyWith(color: AppColors.green, letterSpacing: 1)),
                const SizedBox(height: 2),
                Text(
                  '${edge.label ?? ''} @ ${edge.odds?.odds2 ?? '?'} via ${edge.bookmaker ?? '?'}',
                  style: AppTextStyles.bodyMedium,
                ),
              ],
            ),
          ),
          Text(
            '+${val.edge1}%',
            style: AppTextStyles.monoLarge.copyWith(
                color: AppColors.green, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}

// ─── Odds card ───────────────────────────────────────────────────────────────

class _OddsCard extends StatelessWidget {
  final Match match;
  const _OddsCard({required this.match});

  @override
  Widget build(BuildContext context) {
    final odds = match.odds!;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.bg2,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          _OddsCell(
              label: match.homeTeam,
              value: odds.home?.odds2 ?? '–',
              isHighlighted: match.bestEdge?.label?.toLowerCase().contains('dom') == true),
          _OddsCell(
              label: 'Nul',
              value: odds.draw?.odds2 ?? '–',
              isHighlighted: match.bestEdge?.label?.toLowerCase().contains('nul') == true),
          _OddsCell(
              label: match.awayTeam,
              value: odds.away?.odds2 ?? '–',
              isHighlighted: match.bestEdge?.label?.toLowerCase().contains('ext') == true),
        ],
      ),
    );
  }
}

class _OddsCell extends StatelessWidget {
  final String label;
  final String value;
  final bool isHighlighted;

  const _OddsCell({
    required this.label,
    required this.value,
    required this.isHighlighted,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(label,
              style: AppTextStyles.bodySmall,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: isHighlighted
                  ? AppColors.green.withOpacity(0.12)
                  : AppColors.bg3,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(
                color: isHighlighted
                    ? AppColors.green.withOpacity(0.4)
                    : AppColors.border,
              ),
            ),
            child: Text(
              value,
              style: AppTextStyles.monoLarge.copyWith(
                color: isHighlighted ? AppColors.green : AppColors.text,
                fontWeight: FontWeight.w700,
              ),
              textAlign: TextAlign.center,
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Section header ──────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  final String title;
  final String? subtitle;
  final Color? subtitleColor;
  final IconData icon;

  const _SectionHeader({
    required this.title,
    required this.icon,
    this.subtitle,
    this.subtitleColor,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 14, color: AppColors.text3),
        const SizedBox(width: 6),
        Text(title,
            style: AppTextStyles.labelMedium.copyWith(color: AppColors.text2)),
        if (subtitle != null) ...[
          const SizedBox(width: 8),
          Text(subtitle!,
              style: AppTextStyles.monoBadge
                  .copyWith(color: subtitleColor ?? AppColors.text3)),
        ],
      ],
    );
  }
}

// ─── Poisson grid ────────────────────────────────────────────────────────────

class _PoissonGrid extends StatelessWidget {
  final MatchPoisson poisson;
  const _PoissonGrid({required this.poisson});

  @override
  Widget build(BuildContext context) {
    final cells = [
      if (poisson.homeWin != null) _PCell('1', poisson.homeWin!),
      if (poisson.draw != null) _PCell('X', poisson.draw!),
      if (poisson.awayWin != null) _PCell('2', poisson.awayWin!),
      if (poisson.over05 != null) _PCell('O 0.5', poisson.over05!),
      if (poisson.over15 != null) _PCell('O 1.5', poisson.over15!),
      if (poisson.over25 != null) _PCell('O 2.5', poisson.over25!),
      if (poisson.over35 != null) _PCell('O 3.5', poisson.over35!),
      if (poisson.btts != null) _PCell('BTTS', poisson.btts!),
    ];

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 4,
        mainAxisSpacing: 8,
        crossAxisSpacing: 8,
        childAspectRatio: 1.1,
      ),
      itemCount: cells.length,
      itemBuilder: (_, i) => _PoissonCell(cell: cells[i]),
    );
  }
}

class _PCell {
  final String label;
  final int value;
  const _PCell(this.label, this.value);
}

class _PoissonCell extends StatelessWidget {
  final _PCell cell;
  const _PoissonCell({required this.cell});

  @override
  Widget build(BuildContext context) {
    final color = AppColors.poissonColor(cell.value);
    return Container(
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withOpacity(0.25)),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            '${cell.value}%',
            style: AppTextStyles.monoLarge.copyWith(
              color: color,
              fontWeight: FontWeight.w700,
              fontSize: 20,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            cell.label,
            style: AppTextStyles.monoBadge.copyWith(color: AppColors.text3),
          ),
        ],
      ),
    );
  }
}

// ─── xG bar ──────────────────────────────────────────────────────────────────

class _XgBar extends StatelessWidget {
  final ExpectedGoals xg;
  const _XgBar({required this.xg});

  @override
  Widget build(BuildContext context) {
    final total = xg.home + xg.away;
    final homeFrac = total > 0 ? xg.home / total : 0.5;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.bg2,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(xg.home.toStringAsFixed(2),
                  style: AppTextStyles.monoLarge.copyWith(
                      color: AppColors.green, fontWeight: FontWeight.w700)),
              Text('xG',
                  style:
                      AppTextStyles.monoBadge.copyWith(color: AppColors.text3)),
              Text(xg.away.toStringAsFixed(2),
                  style: AppTextStyles.monoLarge.copyWith(
                      color: AppColors.text2, fontWeight: FontWeight.w700)),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: TweenAnimationBuilder<double>(
              tween: Tween(begin: 0.5, end: homeFrac),
              duration: const Duration(milliseconds: 800),
              curve: Curves.easeOutCubic,
              builder: (_, v, __) => Row(
                children: [
                  Expanded(
                    flex: (v * 100).round(),
                    child: Container(height: 8, color: AppColors.green),
                  ),
                  Expanded(
                    flex: ((1 - v) * 100).round(),
                    child: Container(height: 8, color: AppColors.bg4),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Stats table ─────────────────────────────────────────────────────────────

class _StatsTable extends StatelessWidget {
  final String homeTeam;
  final String awayTeam;
  final MatchStats stats;

  const _StatsTable({
    required this.homeTeam,
    required this.awayTeam,
    required this.stats,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.bg2,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          _StatsHeaderRow(homeTeam: homeTeam, awayTeam: awayTeam),
          const Divider(color: AppColors.border, height: 1),
          _StatsRow(label: 'PPG', home: stats.home.ppg.edge1, away: stats.away.ppg.edge1),
          _StatsRow(
              label: 'Victoires',
              home: '${stats.home.wins.toStringAsFixed(0)}%',
              away: '${stats.away.wins.toStringAsFixed(0)}%'),
          _StatsRow(
              label: 'Nuls',
              home: '${stats.home.draws.toStringAsFixed(0)}%',
              away: '${stats.away.draws.toStringAsFixed(0)}%'),
          _StatsRow(
              label: 'Buts/m',
              home: stats.home.avgScored.edge1,
              away: stats.away.avgScored.edge1),
          _StatsRow(
              label: 'Encaissés/m',
              home: stats.home.avgConceded.edge1,
              away: stats.away.avgConceded.edge1),
        ],
      ),
    );
  }
}

class _StatsHeaderRow extends StatelessWidget {
  final String homeTeam;
  final String awayTeam;

  const _StatsHeaderRow({required this.homeTeam, required this.awayTeam});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: [
          Expanded(
            child: Text(homeTeam,
                style: AppTextStyles.labelMedium,
                overflow: TextOverflow.ellipsis),
          ),
          SizedBox(
            width: 80,
            child: Text('Stat',
                style: AppTextStyles.monoBadge
                    .copyWith(color: AppColors.text3),
                textAlign: TextAlign.center),
          ),
          Expanded(
            child: Text(awayTeam,
                style: AppTextStyles.labelMedium,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.end),
          ),
        ],
      ),
    );
  }
}

class _StatsRow extends StatelessWidget {
  final String label;
  final String home;
  final String away;

  const _StatsRow(
      {required this.label, required this.home, required this.away});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(home,
                style:
                    AppTextStyles.monoMedium.copyWith(color: AppColors.text)),
          ),
          SizedBox(
            width: 80,
            child: Text(label,
                style: AppTextStyles.monoBadge
                    .copyWith(color: AppColors.text3),
                textAlign: TextAlign.center),
          ),
          Expanded(
            child: Text(away,
                style: AppTextStyles.monoMedium
                    .copyWith(color: AppColors.text2),
                textAlign: TextAlign.end),
          ),
        ],
      ),
    );
  }
}

// ─── Betfair WOM bar ─────────────────────────────────────────────────────────

class _BetfairWomBar extends StatelessWidget {
  final double backing;
  final double laying;
  final String homeTeam;
  final String awayTeam;

  const _BetfairWomBar({
    required this.backing,
    required this.laying,
    required this.homeTeam,
    required this.awayTeam,
  });

  @override
  Widget build(BuildContext context) {
    final total = backing + laying;
    final backFrac = total > 0 ? backing / total : 0.5;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.bg2,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('BACK',
                      style: AppTextStyles.monoBadge
                          .copyWith(color: AppColors.blue)),
                  Text('${backing.toStringAsFixed(1)}%',
                      style: AppTextStyles.monoLarge.copyWith(
                          color: AppColors.blue,
                          fontWeight: FontWeight.w700)),
                ],
              ),
              Text('WOM',
                  style:
                      AppTextStyles.monoBadge.copyWith(color: AppColors.text3)),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text('LAY',
                      style: AppTextStyles.monoBadge
                          .copyWith(color: AppColors.amber)),
                  Text('${laying.toStringAsFixed(1)}%',
                      style: AppTextStyles.monoLarge.copyWith(
                          color: AppColors.amber,
                          fontWeight: FontWeight.w700)),
                ],
              ),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: TweenAnimationBuilder<double>(
              tween: Tween(begin: 0.5, end: backFrac),
              duration: const Duration(milliseconds: 700),
              curve: Curves.easeOutCubic,
              builder: (_, v, __) => Row(
                children: [
                  Expanded(
                    flex: (v * 100).round().clamp(1, 99),
                    child: Container(height: 10, color: AppColors.blue),
                  ),
                  Expanded(
                    flex: ((1 - v) * 100).round().clamp(1, 99),
                    child: Container(height: 10, color: AppColors.amber),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
