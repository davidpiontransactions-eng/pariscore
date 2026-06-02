import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/user.dart';
import '../../domain/repositories/auth_repository.dart';
import '../../domain/usecases/login_usecase.dart';

part 'auth_state.dart';

class AuthCubit extends Cubit<AuthState> {
  final LoginUseCase _loginUseCase;
  final AuthRepository _repository;

  AuthCubit({
    required LoginUseCase loginUseCase,
    required AuthRepository repository,
  })  : _loginUseCase = loginUseCase,
        _repository = repository,
        super(const AuthInitial());

  Future<void> checkAuthStatus() async {
    final isAuth = await _repository.isAuthenticated();
    if (!isAuth) {
      emit(const AuthUnauthenticated());
      return;
    }
    final result = await _repository.getCurrentUser();
    result.fold(
      (_) => emit(const AuthUnauthenticated()),
      (user) => emit(AuthAuthenticated(user)),
    );
  }

  Future<void> login(String email, String password) async {
    emit(const AuthLoading());
    final result = await _loginUseCase(
      LoginParams(email: email, password: password),
    );
    result.fold(
      (failure) => emit(AuthError(failure.message)),
      (user) => emit(AuthAuthenticated(user)),
    );
  }

  Future<void> logout() async {
    await _repository.logout();
    emit(const AuthUnauthenticated());
  }
}
