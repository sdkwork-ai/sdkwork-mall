import '../bootstrap/commerce_transport.dart';
import '../utils/json.dart';

/// One order line to include in the after-sales create payload.
class AfterSalesItemInput {
  const AfterSalesItemInput({
    required this.orderItemId,
    required this.requestedQuantity,
    this.refundAmountCny,
  });

  final String orderItemId;
  final int requestedQuantity;
  final num? refundAmountCny;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'orderItemId': orderItemId,
        'requestedQuantity': requestedQuantity,
        if (refundAmountCny != null) 'refundAmount': refundAmountCny!.toStringAsFixed(2),
      };
}

/// One drive-backed evidence item riding the free-form evidenceSnapshot.
class AfterSalesEvidenceItem {
  const AfterSalesEvidenceItem({
    required this.reference,
    this.fileName,
    this.fileSize,
    this.fileType,
  });

  /// Backend-addressable `drive://spaces/.../nodes/...` reference.
  final String reference;
  final String? fileName;
  final int? fileSize;
  final String? fileType;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'reference': reference,
        if (fileName != null) 'fileName': fileName,
        if (fileSize != null) 'fileSize': fileSize,
        if (fileType != null) 'fileType': fileType,
      };
}

/// Builds the wire-contract create body (`CreateAfterSalesRequest`):
/// orderId, afterSalesType, reasonCode, requestedAmount (decimal string),
/// currencyCode, and at least one order item. Pure so the contract shape is
/// unit-testable without transport.
Map<String, dynamic> buildCreateAfterSalesBody({
  required String orderId,
  required String afterSalesType,
  required String reasonCode,
  String? description,
  List<AfterSalesEvidenceItem> evidenceSnapshot = const <AfterSalesEvidenceItem>[],
  required num requestedAmountCny,
  required List<AfterSalesItemInput> items,
}) {
  if (items.isEmpty) {
    throw const SdkworkApiException('订单没有可售后的商品行');
  }
  return <String, dynamic>{
    'orderId': orderId,
    'afterSalesType': afterSalesType,
    'reasonCode': reasonCode,
    if (description != null && description.trim().isNotEmpty) 'description': description.trim(),
    if (evidenceSnapshot.isNotEmpty)
      'evidenceSnapshot': evidenceSnapshot.map((item) => item.toJson()).toList(),
    'requestedAmount': requestedAmountCny.toStringAsFixed(2),
    'currencyCode': 'CNY',
    'items': items.map((item) => item.toJson()).toList(),
  };
}

/// After-sales domain: request list, contract create, revoke.
class AfterSalesService {
  AfterSalesService(this._client);

  final SdkworkMallFlutterCommerceClient _client;

  Future<List<Map<String, dynamic>>> listRequests({int page = 1, int pageSize = 50}) async {
    final payload = await _client.request(
      '/after_sales/requests',
      query: <String, String>{'page': '$page', 'page_size': '$pageSize'},
    );
    return asList(payload['items']);
  }

  Future<Map<String, dynamic>> createRequest({
    required String orderId,
    required String afterSalesType,
    required String reasonCode,
    String? description,
    List<AfterSalesEvidenceItem> evidenceSnapshot = const <AfterSalesEvidenceItem>[],
    required num requestedAmountCny,
    required List<AfterSalesItemInput> items,
  }) {
    final body = buildCreateAfterSalesBody(
      orderId: orderId,
      afterSalesType: afterSalesType,
      reasonCode: reasonCode,
      description: description,
      evidenceSnapshot: evidenceSnapshot,
      requestedAmountCny: requestedAmountCny,
      items: items,
    );
    return _client.request('/after_sales/requests', method: 'POST', body: body);
  }

  Future<Map<String, dynamic>> cancelRequest(String requestId) => _client.request(
        '/after_sales/requests/$requestId',
        method: 'PATCH',
        body: <String, dynamic>{'status': 'CANCELLED'},
      );
}
