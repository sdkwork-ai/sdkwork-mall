import 'package:flutter_test/flutter_test.dart';
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
}
