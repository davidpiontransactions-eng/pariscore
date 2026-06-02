import 'package:equatable/equatable.dart';

class User extends Equatable {
  final String id;
  final String email;
  final String? username;
  final bool isPremium;
  final DateTime? premiumUntil;

  const User({
    required this.id,
    required this.email,
    this.username,
    required this.isPremium,
    this.premiumUntil,
  });

  @override
  List<Object?> get props => [id, email, username, isPremium, premiumUntil];
}
