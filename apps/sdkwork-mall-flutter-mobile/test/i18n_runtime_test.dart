import 'package:flutter_test/flutter_test.dart';
import 'package:sdkwork_mall_flutter_mobile/src/i18n/runtime.dart';

void main() {
  test('resolves nested keys and interpolates placeholders', () {
    SdkworkI18n.installForTest(<String, dynamic>{
      'order': <String, dynamic>{
        'summary': <String, dynamic>{'line': '{{count}} items · {{amount}}'},
      },
    });

    expect(SdkworkI18n.t('order.summary.line'), '{{count}} items · {{amount}}');
    expect(
      SdkworkI18n.t(
        'order.summary.line',
        params: <String, String>{'count': '2', 'amount': '¥89.00'},
      ),
      '2 items · ¥89.00',
    );
  });

  test('falls back to the key when a fragment is missing', () {
    SdkworkI18n.installForTest(<String, dynamic>{});

    expect(SdkworkI18n.t('missing.key'), 'missing.key');
    expect(SdkworkI18n.isLoaded, isTrue);
  });
}
