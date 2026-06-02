import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:get_it/get_it.dart';

import 'core/network/api_client.dart';
import 'features/auth/data/datasources/auth_remote_datasource.dart';
import 'features/auth/data/repositories/auth_repository_impl.dart';
import 'features/auth/domain/repositories/auth_repository.dart';
import 'features/auth/domain/usecases/login_usecase.dart';
import 'features/auth/presentation/cubit/auth_cubit.dart';
import 'features/football/data/datasources/football_remote_datasource.dart';
import 'features/football/data/repositories/match_repository_impl.dart';
import 'features/football/domain/repositories/match_repository.dart';
import 'features/football/domain/usecases/get_matches_usecase.dart';
import 'features/football/presentation/cubit/matches_cubit.dart';
import 'features/live/data/datasources/live_sse_datasource.dart';
import 'features/live/presentation/cubit/live_cubit.dart';
import 'features/tennis/data/datasources/tennis_remote_datasource.dart';
import 'features/tennis/data/repositories/tennis_repository_impl.dart';
import 'features/tennis/domain/repositories/tennis_repository.dart';
import 'features/tennis/domain/usecases/get_tennis_matches_usecase.dart';
import 'features/tennis/presentation/cubit/tennis_cubit.dart';

final sl = GetIt.instance;

Future<void> init() async {
  // ─── External ─────────────────────────────────────────
  sl.registerLazySingleton<FlutterSecureStorage>(
    () => const FlutterSecureStorage(
      aOptions: AndroidOptions(encryptedSharedPreferences: true),
    ),
  );

  // ─── Core ──────────────────────────────────────────────
  sl.registerLazySingleton<ApiClient>(() => ApiClient(sl()));

  // ─── Auth ──────────────────────────────────────────────
  sl.registerLazySingleton<AuthRemoteDataSource>(
    () => AuthRemoteDataSourceImpl(sl()),
  );
  sl.registerLazySingleton<AuthRepository>(
    () => AuthRepositoryImpl(sl(), sl()),
  );
  sl.registerLazySingleton(() => LoginUseCase(sl()));
  sl.registerFactory(
    () => AuthCubit(loginUseCase: sl(), repository: sl()),
  );

  // ─── Football ──────────────────────────────────────────
  sl.registerLazySingleton<FootballRemoteDataSource>(
    () => FootballRemoteDataSourceImpl(sl()),
  );
  sl.registerLazySingleton<MatchRepository>(
    () => MatchRepositoryImpl(sl()),
  );
  sl.registerLazySingleton(() => GetMatchesUseCase(sl()));
  sl.registerFactory(() => MatchesCubit(sl()));

  // ─── Tennis ────────────────────────────────────────────
  sl.registerLazySingleton<TennisRemoteDataSource>(
    () => TennisRemoteDataSourceImpl(sl()),
  );
  sl.registerLazySingleton<TennisRepository>(
    () => TennisRepositoryImpl(sl()),
  );
  sl.registerLazySingleton(() => GetTennisMatchesUseCase(sl()));
  sl.registerFactory(() => TennisCubit(sl()));

  // ─── Live ──────────────────────────────────────────────
  sl.registerLazySingleton<LiveSseDataSource>(
    () => LiveSseDataSourceImpl(sl()),
  );
  sl.registerFactory(() => LiveCubit(sl()));
}
