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
}
