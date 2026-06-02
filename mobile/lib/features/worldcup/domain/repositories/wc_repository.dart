import 'package:dartz/dartz.dart';

import '../../../../core/errors/failures.dart';
import '../entities/wc_entities.dart';

abstract class WcRepository {
  Future<Either<Failure, WcOverview>> getOverview();
}
