import 'dart:convert';
import 'dart:io';

import 'package:sdkwork_mall_flutter_mobile/src/i18n/runtime.dart';

/// Installs the authored zh-CN fragments into the runtime for widget tests.
///
/// Tests read the fragments from disk instead of the asset bundle so the suite
/// does not depend on `flutter test` asset resolution, while production loads
/// the same files through `rootBundle` in `main()`.
void installTestI18n() {
  final raw = File(
    'lib/src/i18n/zh-CN/support/help/messages.json',
  ).readAsStringSync();
  SdkworkI18n.installForTest(jsonDecode(raw) as Map<String, dynamic>);
}
