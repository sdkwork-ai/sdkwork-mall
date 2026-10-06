import '../bootstrap/commerce_transport.dart';
import '../utils/json.dart';

/// One composed shipment trace: shipment header + packages + tracking events.
class ShipmentLogistics {
  const ShipmentLogistics({
    required this.shipmentId,
    required this.shipmentNo,
    required this.carrier,
    required this.statusLabel,
    required this.packages,
    required this.trackingEvents,
  });

  final String shipmentId;
  final String shipmentNo;
  final String carrier;
  final String statusLabel;
  final List<String> packages;
  final List<ShipmentTrackingEvent> trackingEvents;
}

class ShipmentTrackingEvent {
  const ShipmentTrackingEvent({
    required this.description,
    required this.occurredAt,
    required this.status,
  });

  final String description;
  final String occurredAt;
  final String status;
}

/// Pure mapper from the shipment/packages/tracking payloads to the composed
/// view model, newest event first. Kept pure so the wire parsing is
/// unit-testable without transport.
ShipmentLogistics parseShipmentLogistics({
  required String shipmentId,
  required Map<String, dynamic> shipment,
  required List<Map<String, dynamic>> packages,
  required List<Map<String, dynamic>> trackingRows,
}) {
  final events = trackingRows
      .map((row) => ShipmentTrackingEvent(
            description: asString(row, ['description', 'content', 'detail', 'message'],
                fallback: '物流更新'),
            occurredAt: asString(row, ['occurredAt', 'eventTime', 'createdAt', 'time']),
            status: asString(row, ['statusName', 'status', 'eventType']),
          ))
      .toList()
    ..sort((left, right) => right.occurredAt.compareTo(left.occurredAt));
  return ShipmentLogistics(
    shipmentId: shipmentId,
    shipmentNo: asString(shipment, ['shipmentNo', 'shipmentNumber', 'trackingNumber', 'logisticsNo']),
    carrier: asString(shipment, ['carrierName', 'carrier', 'logisticsCompany']),
    statusLabel: asString(shipment, ['statusName', 'statusLabel']),
    packages: packages
        .asMap()
        .entries
        .map((entry) => asString(entry.value, ['packageName', 'name', 'title'],
            fallback: 'package-${entry.key + 1}'))
        .toList(),
    trackingEvents: events,
  );
}

/// Order center domain: list, detail, pay, cancel, receipt, logistics.
class OrderService {
  OrderService(this._client);

  final SdkworkMallFlutterCommerceClient _client;

  Future<List<Map<String, dynamic>>> listOrders({
    String status = '',
    int page = 1,
    int pageSize = 20,
  }) async {
    final payload = await _client.request(
      '/orders',
      query: {
        'page': '$page',
        'page_size': '$pageSize',
        'status': status,
      },
    );
    return asList(payload['content'] ?? payload['items']);
  }

  Future<Map<String, dynamic>> getOrderStatistics() =>
      _client.request('/orders/statistics');

  Future<Map<String, dynamic>> getOrderDetail(String orderId) =>
      _client.request('/orders/$orderId');

  Future<String> payOrder(String orderId, String paymentMethod) async {
    final payment = await _client.request(
      '/orders/$orderId/payments',
      method: 'POST',
      body: <String, dynamic>{'paymentMethod': paymentMethod},
    );
    return asString(payment, ['paymentId', 'id']);
  }

  Future<void> cancelOrder(String orderId) async {
    await _client.request(
      '/orders/$orderId/cancellations',
      method: 'POST',
      body: const <String, dynamic>{},
    );
  }

  Future<void> confirmReceipt(String orderId) async {
    await _client.request(
      '/orders/$orderId/receipt_confirmations',
      method: 'POST',
      body: const <String, dynamic>{},
    );
  }

  Future<Map<String, dynamic>?> getPaymentSuccess(String orderId) async {
    try {
      return await _client.request('/orders/$orderId/payment_success');
    } on SdkworkApiException {
      return null;
    }
  }

  /// Loads every shipment trace for an order (or one explicit shipment).
  /// Mirrors the H5 `/buyer/logistics` surface: the order detail supplies the
  /// shipment ids, then shipment/packages/tracking compose the view.
  Future<List<ShipmentLogistics>> getOrderLogistics({
    String? orderId,
    String? shipmentId,
  }) async {
    var ids = <String>[
      if (shipmentId != null && shipmentId.isNotEmpty) shipmentId,
    ];
    if (ids.isEmpty) {
      if (orderId == null || orderId.isEmpty) {
        throw const SdkworkApiException('缺少订单参数');
      }
      final detail = await getOrderDetail(orderId);
      ids = asList(detail['shipmentIds'])
          .map((entry) => '$entry')
          .where((entry) => entry.isNotEmpty)
          .take(5)
          .toList();
    }
    if (ids.isEmpty) {
      return const <ShipmentLogistics>[];
    }
    return Future.wait(ids.map(_getShipmentLogistics));
  }

  Future<ShipmentLogistics> _getShipmentLogistics(String shipmentId) async {
    final results = await Future.wait<Map<String, dynamic>>(<Future<Map<String, dynamic>>>[
      _client.request('/shipments/$shipmentId'),
      _client.request('/shipments/$shipmentId/packages',
          query: <String, String>{'page': '1', 'page_size': '20'}),
      _client.request('/shipments/$shipmentId/tracking_events',
          query: <String, String>{'page': '1', 'page_size': '50'}),
    ]);
    return parseShipmentLogistics(
      shipmentId: shipmentId,
      shipment: results[0],
      packages: asList(results[1]['content'] ?? results[1]['items']),
      trackingRows: asList(results[2]['content'] ?? results[2]['items']),
    );
  }
}
