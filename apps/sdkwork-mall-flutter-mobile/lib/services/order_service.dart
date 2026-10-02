import '../bootstrap/commerce_transport.dart';
import '../utils/json.dart';

/// Order center domain: list, detail, pay, cancel, receipt.
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
}
