import 'package:flutter_test/flutter_test.dart';
import 'package:sdkwork_mall_flutter_mobile/services/messages_service.dart';
import 'package:sdkwork_mall_flutter_mobile/services/order_service.dart';

void main() {
  group('parseShipmentLogistics', () {
    test('composes shipment header, packages, and newest-first tracking', () {
      final logistics = parseShipmentLogistics(
        shipmentId: 'ship-1',
        shipment: <String, dynamic>{
          'shipmentNo': 'SF100001',
          'carrierName': 'SDKWork 次日达',
          'statusName': '运输中',
        },
        packages: <Map<String, dynamic>>[
          <String, dynamic>{'packageId': 'pkg-1', 'packageName': '标准包裹'},
        ],
        trackingRows: <Map<String, dynamic>>[
          <String, dynamic>{
            'description': '包裹已发出',
            'occurredAt': '2026-10-06T08:00:00Z',
            'statusName': '已发货',
          },
          <String, dynamic>{
            'description': '派送中,请保持电话畅通',
            'occurredAt': '2026-10-06T10:00:00Z',
            'statusName': '派送中',
          },
        ],
      );
      expect(logistics.shipmentId, 'ship-1');
      expect(logistics.shipmentNo, 'SF100001');
      expect(logistics.carrier, 'SDKWork 次日达');
      expect(logistics.packages, <String>['标准包裹']);
      expect(logistics.trackingEvents.first.description, '派送中,请保持电话畅通');
      expect(logistics.trackingEvents.last.description, '包裹已发出');
    });

    test('falls back to defaults when payload fields are missing', () {
      final logistics = parseShipmentLogistics(
        shipmentId: 'ship-2',
        shipment: <String, dynamic>{},
        packages: const <Map<String, dynamic>>[],
        trackingRows: const <Map<String, dynamic>>[],
      );
      expect(logistics.shipmentNo, isEmpty);
      expect(logistics.packages, isEmpty);
      expect(logistics.trackingEvents, isEmpty);
    });
  });

  group('composeMessageRows', () {
    test('merges order and after-sales rows newest first', () {
      final rows = composeMessageRows(
        orders: <Map<String, dynamic>>[
          <String, dynamic>{
            'orderId': 'o-1',
            'subject': '测试订单',
            'totalAmount': 129.9,
            'status': 'PENDING_RECEIPT',
            'createdAt': '2026-10-06T09:00:00Z',
          },
        ],
        afterSalesRequests: <Map<String, dynamic>>[
          <String, dynamic>{
            'id': 'as-1',
            'orderId': 'o-1',
            'description': '商品与描述不符',
            'createdAt': '2026-10-06T10:00:00Z',
          },
        ],
      );
      expect(rows, hasLength(2));
      expect(rows.first.type, 'after-sales');
      expect(rows.first.title, '售后更新：o-1');
      expect(rows.last.type, 'order');
      expect(rows.last.title, '订单更新：测试订单');
      expect(rows.last.summary, contains('¥129.90'));
    });

    test('keeps the surviving half when one source is empty', () {
      final rows = composeMessageRows(
        orders: <Map<String, dynamic>>[
          <String, dynamic>{'orderId': 'o-9', 'subject': '另一个订单'},
        ],
        afterSalesRequests: const <Map<String, dynamic>>[],
      );
      expect(rows, hasLength(1));
      expect(rows.first.id, 'order-o-9');
    });
  });
}
