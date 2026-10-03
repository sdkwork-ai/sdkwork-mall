import '../bootstrap/commerce_transport.dart';

/// 买家发票域（`/invoices` app-api 面）。
///
/// `GET /invoices/mine` 返回分页信封；创建接口字段契约与 H5/PC 一致
/// （`title`、`titleType`、`taxNumber`、`email`、`orderId`）。
class InvoiceService {
  InvoiceService(this._client);

  final SdkworkMallFlutterCommerceClient _client;

  Future<List<Map<String, dynamic>>> listInvoices() async {
    final payload = await _client.request(
      '/invoices/mine',
      query: <String, String>{'page': '1', 'page_size': '50'},
    );
    final items = payload['items'];
    return items is List
        ? items.whereType<Map<String, dynamic>>().toList()
        : const <Map<String, dynamic>>[];
  }

  Future<Map<String, dynamic>> createInvoice({
    required String title,
    required String titleType,
    String taxNumber = '',
    String email = '',
    String orderId = '',
  }) {
    return _client.request(
      '/invoices',
      method: 'POST',
      body: <String, dynamic>{
        'title': title,
        'titleType': titleType,
        if (taxNumber.isNotEmpty) 'taxNumber': taxNumber,
        if (email.isNotEmpty) 'email': email,
        if (orderId.isNotEmpty) 'orderId': orderId,
      },
    );
  }
}
