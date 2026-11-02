import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:sdkwork_mall_flutter_mobile/pages/buyer_account_pages.dart';
import 'package:sdkwork_mall_flutter_mobile/pages/help_page.dart';

import 'support/i18n_fixture.dart';

void main() {
  setUpAll(installTestI18n);

  testWidgets('help centre renders the shared self-service sections', (
    tester,
  ) async {
    await tester.pumpWidget(const MaterialApp(home: SdkworkHelpPage()));

    expect(find.text('帮助中心'), findsOneWidget);
    expect(find.text('订单与物流'), findsOneWidget);
    expect(find.text('售后服务'), findsOneWidget);

    // Lower sections are lazily built by the ListView: scroll them into view.
    await tester.scrollUntilVisible(find.text('快捷入口'), 320);
    expect(find.text('快捷入口'), findsOneWidget);
    expect(find.text('账户安全'), findsWidgets);
    expect(find.text('发票与资产'), findsWidgets);
  });

  testWidgets('gift cards page keeps the reserved entry and wallet fallback', (
    tester,
  ) async {
    await tester.pumpWidget(const MaterialApp(home: SdkworkGiftCardsPage()));

    expect(find.text('礼品卡与红包'), findsWidgets);
    expect(
      find.text('礼品卡购买、赠送、兑换与红包领取需 commerce gift-cards API。'),
      findsOneWidget,
    );
    expect(find.text('查看我的钱包'), findsOneWidget);
  });
}
