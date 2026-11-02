import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:sdkwork_mall_flutter_mobile/shell/mobile_shell.dart';

import 'support/i18n_fixture.dart';

void main() {
  setUpAll(installTestI18n);

  testWidgets('mobile shell pumps the four-tab storefront', (tester) async {
    await tester.pumpWidget(const SdkworkMallFlutterMobileShell());
    expect(find.text('首页'), findsWidgets);
    expect(find.text('分类'), findsWidgets);
    expect(find.text('购物车'), findsWidgets);
    expect(find.text('我的'), findsWidgets);
  });

  testWidgets('bottom tabs pair outline and filled glyphs', (tester) async {
    await tester.pumpWidget(const SdkworkMallFlutterMobileShell());

    final bar = tester.widget<BottomNavigationBar>(
      find.byType(BottomNavigationBar),
    );
    expect(bar.items, hasLength(4));
    expect((bar.items[0].icon as Icon).icon, Icons.home_outlined);
    expect((bar.items[0].activeIcon as Icon).icon, Icons.home);
    expect((bar.items[1].icon as Icon).icon, Icons.category_outlined);
    expect((bar.items[1].activeIcon as Icon).icon, Icons.category);
    expect(find.byIcon(Icons.shopping_cart_outlined), findsWidgets);
    expect((bar.items[2].activeIcon as Icon).icon, Icons.shopping_cart);
    expect((bar.items[3].icon as Icon).icon, Icons.person_outline);
    expect((bar.items[3].activeIcon as Icon).icon, Icons.person);
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

  testWidgets('buyer hub renders an icon for every order shortcut', (
    tester,
  ) async {
    await tester.pumpWidget(const SdkworkMallFlutterMobileShell());
    await tester.tap(find.text('我的'));
    await tester.pump(const Duration(milliseconds: 300));
    // 每个状态入口都有独立图标（全部/待付款/待发货/待收货/已完成）。
    expect(find.byIcon(Icons.receipt_long_outlined), findsWidgets);
    expect(find.byIcon(Icons.account_balance_wallet_outlined), findsWidgets);
    expect(find.byIcon(Icons.inventory_2_outlined), findsOneWidget);
    expect(find.byIcon(Icons.local_shipping_outlined), findsOneWidget);
    expect(find.byIcon(Icons.check_circle_outline), findsOneWidget);
  });
}
