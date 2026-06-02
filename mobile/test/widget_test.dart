import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:pariscore_mobile/app.dart';
import 'package:pariscore_mobile/injection_container.dart' as di;

void main() {
  setUp(() async {
    await di.init();
  });

  testWidgets('App renders without crashing', (WidgetTester tester) async {
    await tester.pumpWidget(const PariScoreApp());
    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
