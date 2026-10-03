import '../bootstrap/commerce_transport.dart';
import '../utils/json.dart';

/// 营销面：店铺与促销活动。
///
/// 线上契约：`GET /shops/{shopId}`（店铺详情）、`GET /catalog/spus` 按
/// `shop_id` 过滤（店铺商品）、`GET /promotions/offers?status=active`
/// （活动列表）、`GET /promotions/offers/{offerId}`（活动详情）。
class MarketingService {
  MarketingService(this._client);

  final SdkworkMallFlutterCommerceClient _client;

  Future<Map<String, dynamic>?> retrieveShop(String shopId) async {
    final results = await Future.wait(<Future<Map<String, dynamic>>>[
      _safe('/shops/$shopId'),
      _safe(
        '/catalog/spus',
        query: <String, String>{'page': '1', 'page_size': '20', 'shop_id': shopId},
      ),
    ]);
    final shop = results[0];
    if (asString(shop, <String>['id', 'shopId']).isEmpty) {
      return null;
    }
    return <String, dynamic>{
      ...shop,
      'products': asList(results[1]['items']),
    };
  }

  Future<List<Map<String, dynamic>>> listActivities() async {
    final payload = await _client.request(
      '/promotions/offers',
      query: <String, String>{
        'status': 'active',
        'page': '1',
        'page_size': '20',
      },
    );
    return asList(payload['items']);
  }

  Future<Map<String, dynamic>?> retrieveActivity(String offerId) async {
    try {
      return await _client.request('/promotions/offers/$offerId');
    } on SdkworkApiException {
      return null;
    }
  }

  Future<Map<String, dynamic>> _safe(
    String path, {
    Map<String, String>? query,
  }) async {
    try {
      return await _client.request(path, query: query);
    } on SdkworkApiException {
      return const <String, dynamic>{};
    }
  }
}
