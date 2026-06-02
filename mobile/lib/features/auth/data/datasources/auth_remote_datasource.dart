import '../../../../core/constants/api_constants.dart';
import '../../../../core/errors/exceptions.dart';
import '../../../../core/network/api_client.dart';
import '../models/user_model.dart';

abstract class AuthRemoteDataSource {
  Future<({UserModel user, String token})> login(
      String email, String password);
  Future<({UserModel user, String token})> register(
      String email, String password);
  Future<UserModel> getCurrentUser();
}

class AuthRemoteDataSourceImpl implements AuthRemoteDataSource {
  final ApiClient _client;

  const AuthRemoteDataSourceImpl(this._client);

  @override
  Future<({UserModel user, String token})> login(
      String email, String password) async {
    final res = await _client.post(
      ApiConstants.login,
      data: {'email': email, 'password': password},
    );
    final data = res.data as Map<String, dynamic>;
    if (data['token'] == null) {
      throw const ServerException('Token manquant dans la réponse');
    }
    return (
      user: UserModel.fromJson(
          (data['user'] ?? data) as Map<String, dynamic>),
      token: data['token'] as String,
    );
  }

  @override
  Future<({UserModel user, String token})> register(
      String email, String password) async {
    final res = await _client.post(
      ApiConstants.register,
      data: {'email': email, 'password': password},
    );
    final data = res.data as Map<String, dynamic>;
    return (
      user: UserModel.fromJson(
          (data['user'] ?? data) as Map<String, dynamic>),
      token: data['token'] as String,
    );
  }

  @override
  Future<UserModel> getCurrentUser() async {
    final res = await _client.get(ApiConstants.me);
    return UserModel.fromJson(res.data as Map<String, dynamic>);
  }
}
