import 'package:flutter_test/flutter_test.dart';

import 'package:sdkwork_mall_flutter_mobile/shell/mobile_shell.dart';

void main() {
  testWidgets('mobile shell pumps the four-tab storefront', (tester) async {
    await tester.pumpWidget(const SdkworkMallFlutterMobileShell());
    expect(find.text('首页'), findsWidgets);
    expect(find.text('分类'), findsWidgets);
    expect(find.text('购物车'), findsWidgets);
    expect(find.text('我的'), findsWidgets);
  });

  testWidgets('shell switches to the cart tab and shows the empty state', (
    tester,
  ) async {
    await tester.pumpWidget(const SdkworkMallFlutterMobileShell());
    await tester.tap(find.text('购物车'));
    // The home floor runs a banner timer + countdown, so settle with fixed
    // pumps instead of pumpAndSettle.
    await tester.pump(const Duration(milliseconds: 300));
    // 未登录时购物车提示登录。
    expect(find.text('登录后同步购物车'), findsOneWidget);
  });

  testWidgets('shell switches to the buyer tab and shows the login entry', (
    tester,
  ) async {
    await tester.pumpWidget(const SdkworkMallFlutterMobileShell());
    await tester.tap(find.text('我的'));
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('未登录'), findsOneWidget);
    expect(find.text('点击登录'), findsOneWidget);
    expect(find.text('常用服务'), findsOneWidget);
  });
}
