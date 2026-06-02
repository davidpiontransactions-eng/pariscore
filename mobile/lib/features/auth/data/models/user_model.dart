import '../../domain/entities/user.dart';

class UserModel extends User {
  const UserModel({
    required super.id,
    required super.email,
    super.username,
    required super.isPremium,
    super.premiumUntil,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) => UserModel(
        id: json['id']?.toString() ?? '',
        email: json['email'] as String? ?? '',
        username: json['username'] as String?,
        isPremium: json['is_premium'] == true ||
            json['subscription_status'] == 'active',
        premiumUntil: json['premium_until'] != null
            ? DateTime.tryParse(json['premium_until'].toString())
            : null,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'email': email,
        'username': username,
        'is_premium': isPremium,
        'premium_until': premiumUntil?.toIso8601String(),
      };
}
