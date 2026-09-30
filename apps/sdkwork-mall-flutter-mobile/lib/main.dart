import 'bootstrap/environment.dart';
import 'shell/mobile_shell.dart';
import 'package:flutter/material.dart';

void main() {
  final environment = SdkworkMallFlutterEnvironment.fromDefineValues();
  if (environment.environment.isEmpty) {
    throw StateError('SDKWORK_ENVIRONMENT is required; pass --dart-define-from-file');
  }
  debugPrint('sdkwork-mall-flutter-mobile runtime: $environment');
  runApp(const SdkworkMallFlutterMobileShell());
}
