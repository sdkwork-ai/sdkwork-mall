// Visual capture harness (dev tool, not a regression gate).
//
// Run with:
//   flutter test -DVISUAL_CAPTURE=true --update-goldens test/visual_capture_test.dart
//
// The test skips itself unless VISUAL_CAPTURE is set, so missing goldens
// never fail the normal suite. Captures the four shell tabs and key buyer
// pages as PNGs under test/goldens/, rendered with the system Microsoft
// YaHei font, for human visual review. Goldens are review artifacts: do not
// commit them.
//
// Known boundary: pages fire HTTP from initState inside the testWidgets
// FakeAsync zone, so socket completions bind to fake timers and live-gateway
// data does not land even inside tester.runAsync (the request future is
// already scheduled on the fake loop). Pages therefore render their empty /
// error states here; live-data visuals need `integration_test` on a real
// device or emulator (Windows desktop additionally requires Developer Mode
// for plugin symlinks). MaterialIcons and data:URL product images render as
// placeholder blocks in this harness for the same reason.
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:sdkwork_mall_flutter_mobile/bootstrap/environment.dart';
import 'package:sdkwork_mall_flutter_mobile/bootstrap/session.dart';
import 'package:sdkwork_mall_flutter_mobile/pages/after_sales_page.dart';
import 'package:sdkwork_mall_flutter_mobile/pages/buyer_page.dart';
import 'package:sdkwork_mall_flutter_mobile/pages/cart_page.dart';
import 'package:sdkwork_mall_flutter_mobile/pages/category_page.dart';
import 'package:sdkwork_mall_flutter_mobile/pages/home_page.dart';
import 'package:sdkwork_mall_flutter_mobile/pages/logistics_page.dart';
import 'package:sdkwork_mall_flutter_mobile/pages/orders_page.dart';
import 'package:sdkwork_mall_flutter_mobile/services/commerce.dart';

const _captureOn = bool.fromEnvironment('VISUAL_CAPTURE');

Future<void> main() async {
  testWidgets('visual capture of the flutter buyer surfaces', (tester) async {
    if (!_captureOn) {
      return; // Skipped in normal runs.
    }
    // Real CJK font so text is human-reviewable (not the test block font).
    final fontBytes = File('C:/Windows/Fonts/msyh.ttc').readAsBytesSync();
    final fontLoader = FontLoader('MSYH')
      ..addFont(Future.value(ByteData.view(Uint8List.fromList(fontBytes).buffer)));
    await fontLoader.load();

    SharedPreferences.setMockInitialValues(<String, Object>{});
    await SdkworkSession.instance.restore();
    MallCommerce.initInstanceForTesting(
      const SdkworkMallFlutterEnvironment(
        environment: 'development',
        deploymentProfile: 'standalone',
        profileId: 'sdkwork-mall-flutter-mobile',
        runtimeTarget: 'flutter-windows',
        commerceAppApiBaseUrl: 'http://127.0.0.1:3900/app/v3/api',
      ),
    );

    tester.view.devicePixelRatio = 2.0;
    tester.view.physicalSize = const Size(828, 1792);
    addTearDown(tester.view.reset);

    Future<void> pumpAndCapture(Widget child, String golden) async {
      // The whole pump-and-settle cycle runs inside runAsync: page initState
      // fires real HTTP from the FakeAsync zone, and only the real event
      // loop (runAsync) delivers socket data for those futures.
      await tester.runAsync(() async {
        await tester.pumpWidget(
          MaterialApp(
            debugShowCheckedModeBanner: false,
            theme: ThemeData(
              useMaterial3: true,
              fontFamily: 'MSYH',
              colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFFE93B3D)),
            ),
            home: Scaffold(body: child),
          ),
        );
        await Future<void>.delayed(const Duration(milliseconds: 2500));
      });
      await tester.pump(const Duration(milliseconds: 300));
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/$golden'),
      );
    }

    Directory('test/goldens').createSync(recursive: true);
    await pumpAndCapture(const SdkworkHomePage(), 'home.png');
    await pumpAndCapture(const SdkworkCategoryPage(), 'category.png');
    await pumpAndCapture(const SdkworkCartPage(), 'cart.png');
    await pumpAndCapture(const SdkworkBuyerPage(), 'buyer.png');
    await pumpAndCapture(const SdkworkOrdersPage(), 'orders.png');
    await pumpAndCapture(const SdkworkAfterSalesPage(), 'after-sales.png');
    await pumpAndCapture(const SdkworkLogisticsPage(orderId: 'order-1'), 'logistics.png');
  });
}
