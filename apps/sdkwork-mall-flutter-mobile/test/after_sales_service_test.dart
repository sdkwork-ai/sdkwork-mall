import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sdkwork_mall_flutter_mobile/bootstrap/session.dart';
import 'package:sdkwork_mall_flutter_mobile/services/after_sales_service.dart';

void main() {
  group('buildCreateAfterSalesBody', () {
    test('emits the wire-contract fields', () {
      final body = buildCreateAfterSalesBody(
        orderId: 'ORDER-1',
        afterSalesType: 'refund',
        reasonCode: 'quality-issue',
        description: '  屏幕划痕  ',
        requestedAmountCny: 88.5,
        items: const [
          AfterSalesItemInput(
            orderItemId: 'oi-1',
            requestedQuantity: 2,
            refundAmountCny: 44.25,
          ),
        ],
      );

      expect(body, <String, dynamic>{
        'orderId': 'ORDER-1',
        'afterSalesType': 'refund',
        'reasonCode': 'quality-issue',
        'description': '屏幕划痕',
        'requestedAmount': '88.50',
        'currencyCode': 'CNY',
        'items': <Map<String, dynamic>>[
          <String, dynamic>{
            'orderItemId': 'oi-1',
            'requestedQuantity': 2,
            'refundAmount': '44.25',
          },
        ],
      });
    });

    test('omits optional description and keeps exchange items refund-free', () {
      final body = buildCreateAfterSalesBody(
        orderId: 'ORDER-1',
        afterSalesType: 'exchange',
        reasonCode: 'other',
        requestedAmountCny: 1,
        items: const [
          AfterSalesItemInput(orderItemId: 'oi-1', requestedQuantity: 1),
        ],
      );

      expect(body.containsKey('description'), isFalse);
      expect(
        (body['items'] as List<Map<String, dynamic>>).first
            .containsKey('refundAmount'),
        isFalse,
      );
    });

    test('rejects empty item lists', () {
      expect(
        () => buildCreateAfterSalesBody(
          orderId: 'ORDER-1',
          afterSalesType: 'refund',
          reasonCode: 'other',
          requestedAmountCny: 1,
          items: const [],
        ),
        throwsException,
      );
    });
  });

  group('SdkworkSession', () {
    test('starts signed out and accepts a legacy token sign-in', () async {
      SharedPreferences.setMockInitialValues(<String, Object>{});
      final session = SdkworkSession.instance;
      await session.signOut();
      expect(session.isLoggedIn, isFalse);
      await session.signIn('dev-token');
      expect(session.isLoggedIn, isTrue);
      expect(session.token, 'dev-token');
      await session.signOut();
      expect(session.isLoggedIn, isFalse);
    });
  });
}
