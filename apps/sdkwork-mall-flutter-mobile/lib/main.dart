import 'dart:async';

import 'package:flutter/material.dart';

import 'bootstrap/environment.dart';
import 'bootstrap/session.dart';
import 'services/commerce.dart';
import 'shell/mobile_shell.dart';

Future<void> main() async {
  // A release build must not show a raw red/grey box when a widget fails to
  // build, and async failures outside the widget tree must stay observable
  // instead of being dropped by the zone.
  FlutterError.onError = (details) {
    FlutterError.presentError(details);
    debugPrint('[sdkwork-mall] flutter error: ${details.exceptionAsString()}');
  };
  ErrorWidget.builder = (details) => const SdkworkFatalErrorView();

  await runZonedGuarded<Future<void>>(
    () async {
      // The binding must be initialized inside the guarded zone and in the same
      // zone that later calls runApp, otherwise the framework reports a zone
      // mismatch every time the app starts.
      WidgetsFlutterBinding.ensureInitialized();
      await SdkworkSession.instance.restore();
      final environment = SdkworkMallFlutterEnvironment.fromDefineValues();
      debugPrint('sdkwork-mall-flutter-mobile runtime: $environment');
      // 构建组合根：传输层按环境注入 baseUrl，各领域服务独立装配。
      MallCommerce.initInstanceForTesting(environment);
      runApp(const SdkworkMallFlutterMobileShell());
    },
    (error, stack) {
      debugPrint('[sdkwork-mall] uncaught async error: $error\n$stack');
    },
  );
}

/// 构建期异常兜底页：替代框架默认的错误方块，保留品牌观感并给出重试指引。
class SdkworkFatalErrorView extends StatelessWidget {
  const SdkworkFatalErrorView({super.key});

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.ltr,
      child: Material(
        color: const Color(0xFFF7F8FA),
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: const [
                Icon(Icons.error_outline, color: Color(0xFFDC2626), size: 40),
                SizedBox(height: 12),
                Text(
                  '页面出现异常，请返回重试',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 15, color: Color(0xFF4B5563)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
