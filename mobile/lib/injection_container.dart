import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:get_it/get_it.dart';

import 'core/network/api_client.dart';
import 'features/ai_scout/data/datasources/scout_remote_datasource.dart';
import 'features/bets/data/datasources/bets_remote_datasource.dart';
import 'features/bets/data/repositories/bets_repository_impl.dart';
import 'features/bets/domain/repositories/bets_repository.dart';
import 'features/bets/presentation/cubit/bets_cubit.dart';
import 'features/ai_scout/data/repositories/scout_repository_impl.dart';
import 'features/ai_scout/domain/repositories/scout_repository.dart';
import 'features/ai_scout/domain/usecases/get_top_picks_usecase.dart';
import 'features/ai_scout/presentation/cubit/scout_cubit.dart';
import 'features/auth/data/datasources/auth_remote_datasource.dart';
import 'features/auth/data/repositories/auth_repository_impl.dart';
import 'features/auth/domain/repositories/auth_repository.dart';
import 'features/auth/domain/usecases/login_usecase.dart';
import 'features/auth/presentation/cubit/auth_cubit.dart';
import 'features/football/data/datasources/ai_analysis_datasource.dart';
import 'features/football/data/datasources/football_remote_datasource.dart';
import 'features/football/data/repositories/match_repository_impl.dart';
import 'features/football/domain/repositories/match_repository.dart';
import 'features/football/domain/usecases/get_matches_usecase.dart';
import 'features/football/presentation/cubit/ai_analysis_cubit.dart';
import 'features/football/presentation/cubit/matches_cubit.dart';
import 'features/live/data/datasources/live_sse_datasource.dart';
import 'features/live/presentation/cubit/live_cubit.dart';
import 'features/tennis/data/datasources/tennis_remote_datasource.dart';
import 'features/tennis/data/repositories/tennis_repository_impl.dart';
import 'features/tennis/domain/repositories/tennis_repository.dart';
import 'features/tennis/domain/usecases/get_tennis_matches_usecase.dart';
import 'features/tennis/presentation/cubit/tennis_cubit.dart';
import 'features/worldcup/data/datasources/wc_remote_datasource.dart';
import 'features/worldcup/data/repositories/wc_repository_impl.dart';
import 'features/worldcup/domain/repositories/wc_repository.dart';
import 'features/worldcup/presentation/cubit/wc_cubit.dart';

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
  sl.registerLazySingleton<AiAnalysisDataSource>(
    () => AiAnalysisDataSourceImpl(sl()),
  );
  sl.registerFactory(() => AiAnalysisCubit(sl()));

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

  // ─── Bets ──────────────────────────────────────────────
  sl.registerLazySingleton<BetsRemoteDataSource>(
    () => BetsRemoteDataSourceImpl(sl()),
  );
  sl.registerLazySingleton<BetsRepository>(
    () => BetsRepositoryImpl(sl()),
  );
  sl.registerFactory(() => BetsCubit(sl()));

  // ─── AI Scout ──────────────────────────────────────────
  sl.registerLazySingleton<ScoutRemoteDataSource>(
    () => ScoutRemoteDataSourceImpl(sl()),
  );
  sl.registerLazySingleton<ScoutRepository>(
    () => ScoutRepositoryImpl(sl()),
  );
  sl.registerLazySingleton(() => GetTopPicksUseCase(sl()));
  sl.registerFactory(() => ScoutCubit(sl()));

  // ─── World Cup 2026 ────────────────────────────────────
  sl.registerLazySingleton<WcRemoteDataSource>(
    () => WcRemoteDataSourceImpl(sl()),
  );
  sl.registerLazySingleton<WcRepository>(
    () => WcRepositoryImpl(sl()),
  );
  sl.registerFactory(() => WcCubit(sl()));
}
