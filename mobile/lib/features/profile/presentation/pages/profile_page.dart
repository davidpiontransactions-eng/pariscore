import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/routing/app_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../auth/presentation/cubit/auth_cubit.dart';

class ProfilePage extends StatelessWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Profil', style: AppTextStyles.headlineLarge)),
      body: BlocBuilder<AuthCubit, AuthState>(
        builder: (context, state) {
          return switch (state) {
            AuthAuthenticated(:final user) => _LoggedInView(user: user),
            _ => _LoggedOutView(),
          };
        },
      ),
    );
  }
}

class _LoggedInView extends StatelessWidget {
  final dynamic user;

  const _LoggedInView({required this.user});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Avatar + email
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: AppColors.bg2,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.border),
          ),
          child: Row(
            children: [
              CircleAvatar(
                radius: 28,
                backgroundColor: AppColors.green.withOpacity(0.15),
                child: Text(
                  (user.email as String).substring(0, 1).toUpperCase(),
                  style: AppTextStyles.displayMedium.copyWith(color: AppColors.green),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(user.email as String, style: AppTextStyles.labelLarge),
                    const SizedBox(height: 4),
                    _StatusBadge(isPremium: user.isPremium as bool),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),

        // Menu items
        _MenuItem(
          icon: Icons.receipt_long_outlined,
          label: 'Mes paris',
          onTap: () => context.go('/bets'),
        ),
        _MenuItem(
          icon: Icons.notifications_outlined,
          label: 'Alertes',
          onTap: () {},
        ),
        _MenuItem(
          icon: Icons.open_in_new_outlined,
          label: 'Ouvrir pariscore.fr',
          onTap: () {},
          trailing: const Icon(Icons.open_in_new, size: 16, color: AppColors.text3),
        ),
        const SizedBox(height: 16),
        const Divider(color: AppColors.border),
        const SizedBox(height: 8),

        // Logout
        _MenuItem(
          icon: Icons.logout,
          label: 'Se déconnecter',
          color: AppColors.red,
          onTap: () {
            context.read<AuthCubit>().logout();
          },
        ),
      ],
    );
  }
}

class _LoggedOutView extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.account_circle_outlined, size: 64, color: AppColors.text3),
          const SizedBox(height: 16),
          Text('Non connecté', style: AppTextStyles.headlineMedium),
          const SizedBox(height: 8),
          Text(
            'Connectez-vous pour accéder à votre historique de paris et aux analyses premium.',
            style: AppTextStyles.bodyMedium.copyWith(color: AppColors.text2),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 32),
          ElevatedButton(
            onPressed: () => context.push(AppRouter.login),
            child: const Text('Se connecter'),
          ),
        ],
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  final bool isPremium;

  const _StatusBadge({required this.isPremium});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: isPremium
            ? AppColors.amber.withOpacity(0.15)
            : AppColors.bg3,
        borderRadius: BorderRadius.circular(5),
        border: Border.all(
          color: isPremium
              ? AppColors.amber.withOpacity(0.5)
              : AppColors.border,
        ),
      ),
      child: Text(
        isPremium ? '⭐ PRO' : 'FREE',
        style: AppTextStyles.monoBadge.copyWith(
          color: isPremium ? AppColors.amber : AppColors.text3,
        ),
      ),
    );
  }
}

class _MenuItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Color? color;
  final Widget? trailing;

  const _MenuItem({
    required this.icon,
    required this.label,
    required this.onTap,
    this.color,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    final c = color ?? AppColors.text;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 14),
        child: Row(
          children: [
            Icon(icon, size: 20, color: c),
            const SizedBox(width: 14),
            Expanded(
                child: Text(label, style: AppTextStyles.bodyMedium.copyWith(color: c))),
            trailing ??
                const Icon(Icons.chevron_right, size: 18, color: AppColors.text3),
          ],
        ),
      ),
    );
  }
}
