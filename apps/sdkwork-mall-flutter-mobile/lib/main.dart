import 'bootstrap/environment.dart';
import 'package:flutter/material.dart';

import 'services/commerce.dart';
import 'shell/mobile_shell.dart';

void main() {
  final environment = SdkworkMallFlutterEnvironment.fromDefineValues();
  debugPrint('sdkwork-mall-flutter-mobile runtime: $environment');
  // 构建组合根：传输层按环境注入 baseUrl，各领域服务独立装配。
  MallCommerce.initInstanceForTesting(environment);
  runApp(const SdkworkMallFlutterMobileShell());
}
