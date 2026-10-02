import '../bootstrap/commerce_transport.dart';
import '../utils/json.dart';

/// One page of server-side list results.
class SdkworkPageResult {
  const SdkworkPageResult({required this.items, required this.total});

  final List<Map<String, dynamic>> items;
  final int total;
}

/// Catalog domain: categories, product search, and product detail.
class CatalogService {
  CatalogService(this._client);

  final SdkworkMallFlutterCommerceClient _client;

  Future<List<Map<String, dynamic>>> listCategories() async {
    final payload = await _client.request(
      '/catalog/categories',
      query: const {'page': '1', 'page_size': '50', 'status': 'active'},
    );
    return asList(payload['items']);
  }

  Future<SdkworkPageResult> listProducts({
    String? categoryId,
    String? keyword,
    String? shopId,
    String? sort,
    int page = 1,
    int pageSize = 20,
  }) async {
    final payload = await _client.request(
      '/catalog/spus',
      query: {
        'category_id': categoryId ?? '',
        'q': keyword ?? '',
        'shop_id': shopId ?? '',
        'sort': sort ?? '',
        'page': '$page',
        'page_size': '$pageSize',
      },
    );
    final items = asList(payload['items']);
    final total = asNum(payload, ['total']) ?? items.length;
    final pageInfo = asMap(payload['pageInfo']);
    return SdkworkPageResult(
      items: items,
      total: asNum(pageInfo, ['total'])?.toInt() ?? total.toInt(),
    );
  }

  Future<Map<String, dynamic>?> getProductDetail(String productId) async {
    final record = await _client.request('/catalog/spus/$productId');
    if (record.isEmpty || asString(record, ['id']).isEmpty) {
      return null;
    }
    return record;
  }
}
