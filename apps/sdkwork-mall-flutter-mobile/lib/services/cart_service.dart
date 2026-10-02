import '../bootstrap/commerce_transport.dart';
import '../utils/json.dart';

/// Cart + checkout + payment domain.
class CartService {
  CartService(this._client);

  final SdkworkMallFlutterCommerceClient _client;

  Future<List<Map<String, dynamic>>> getCartItems() async {
    final payload = await _client.request('/cart/current');
    return asList(payload['items']).map((item) {
      final sku = asMap(item['sku']);
      final spu = asMap(item['spu'] ?? sku['spu']);
      final shop = asMap(item['shop'] ?? spu['shop']);
      return <String, dynamic>{
        'id': asString(item, ['id']),
        'skuId': asString(item, ['skuId'], fallback: asString(sku, ['id'])),
        'spuId': asString(item, ['spuId'], fallback: asString(spu, ['id'])),
        'title': asString(spu, ['title', 'name'], fallback: asString(item, ['title'], fallback: '商品')),
        'skuName': asString(sku, ['title', 'name']),
        'imageUrl': asString(item, ['imageUrl'], fallback: asString(spu, ['imageUrl'], fallback: asString(sku, ['imageUrl']))),
        'unitPrice': asNum(item, ['unitPrice', 'priceCny']) ??
            asNum(sku, ['priceCny', 'price']) ??
            asNum(spu, ['priceCny', 'price']),
        'quantity': (asNum(item, ['quantity']) ?? 1).toInt(),
        'shopId': asString(item, ['shopId'], fallback: asString(shop, ['id'], fallback: asString(spu, ['shopId']))),
        'shopName': asString(item, ['shopName'], fallback: asString(shop, ['name'], fallback: asString(spu, ['shopName']))),
      };
    }).toList();
  }

  Future<void> addToCart({
    required String spuId,
    required String skuId,
    required int quantity,
  }) async {
    await _client.request(
      '/cart/items',
      method: 'POST',
      body: <String, dynamic>{
        'spuId': spuId,
        'skuId': skuId,
        'quantity': quantity,
      },
    );
  }

  Future<void> updateCartItem(String cartItemId, int quantity) async {
    await _client.request(
      '/cart/items/$cartItemId',
      method: 'PUT',
      body: <String, dynamic>{'quantity': quantity},
    );
  }

  Future<void> removeCartItem(String cartItemId) async {
    await _client.request('/cart/items/$cartItemId', method: 'DELETE');
  }

  Future<List<Map<String, dynamic>>> listPaymentMethods() async {
    final payload = await _client.request('/payments/methods');
    return asList(payload['items']);
  }

  Future<List<Map<String, dynamic>>> listUserCoupons() async {
    final payload = await _client.request(
      '/promotions/user_coupons',
      query: const {'page': '1', 'page_size': '50'},
    );
    final coupons = asList(payload['items']).where((item) {
      final status = asString(item, ['status', 'statusName'], fallback: 'AVAILABLE').toUpperCase();
      return status.isEmpty ||
          status == 'AVAILABLE' ||
          status == 'ACTIVE' ||
          status == 'UNUSED';
    }).toList();
    return coupons;
  }

  Future<Map<String, dynamic>> createCheckoutQuote({
    List<String>? cartItemIds,
  }) async {
    final session = await _client.request(
      '/checkout/sessions',
      method: 'POST',
      body: cartItemIds == null || cartItemIds.isEmpty
          ? <String, dynamic>{}
          : <String, dynamic>{'cartItemIds': cartItemIds},
    );
    final sessionId = asString(session, ['id', 'sessionId']);
    var quoteId = asString(session, ['quoteId', 'checkoutQuoteId']);
    if (quoteId.isEmpty && sessionId.isNotEmpty) {
      final quote = await _client.request(
        '/checkout/sessions/$sessionId/quotes',
        method: 'POST',
        body: const <String, dynamic>{},
      );
      quoteId = asString(quote, ['id', 'quoteId']);
    }
    return <String, dynamic>{
      'sessionId': sessionId,
      'quoteId': quoteId,
      'payableAmountCny': asNum(session, ['payableAmountCny', 'payableAmount']),
    };
  }

  Future<String> submitOrder({
    String? addressId,
    List<String>? cartItemIds,
    String? couponId,
    String? buyerRemark,
    bool useWallet = false,
    bool usePoints = false,
  }) async {
    final quote = await createCheckoutQuote(cartItemIds: cartItemIds);
    final sessionId = '${quote['sessionId']}';

    if (addressId != null && addressId.isNotEmpty) {
      await _client.request(
        '/addresses/default_selection',
        method: 'POST',
        body: <String, dynamic>{'addressId': addressId},
      );
    }

    final order = await _client.request(
      '/checkout/sessions/$sessionId/orders',
      method: 'POST',
      body: <String, dynamic>{
        'buyerRemark': buyerRemark,
        'quoteId': quote['quoteId'],
        if (cartItemIds != null && cartItemIds.isNotEmpty)
          'cartItemIds': cartItemIds,
      },
    );
    final orderId = asString(order, ['id', 'orderId']);
    if (orderId.isEmpty) {
      throw Exception('订单创建失败');
    }

    if (couponId != null && couponId.isNotEmpty) {
      await _client.request(
        '/promotions/discount_applications',
        method: 'POST',
        body: <String, dynamic>{'orderId': orderId, 'userCouponId': couponId},
      );
    }

    if (useWallet) {
      try {
        await _client.request(
          '/wallet/holds',
          method: 'POST',
          body: <String, dynamic>{'assetType': 'cash', 'orderId': orderId},
        );
      } on SdkworkApiException {
        // 钱包抵扣为可选增强，失败时订单全额支付。
      }
    }
    if (usePoints) {
      try {
        await _client.request(
          '/wallet/holds',
          method: 'POST',
          body: <String, dynamic>{'assetType': 'points', 'orderId': orderId},
        );
      } on SdkworkApiException {
        // 积分抵扣为可选增强，失败时订单全额支付。
      }
    }

    return orderId;
  }

  Future<String> payOrder(String orderId, String paymentMethod) async {
    final payment = await _client.request(
      '/orders/$orderId/payments',
      method: 'POST',
      body: <String, dynamic>{'paymentMethod': paymentMethod},
    );
    return asString(payment, ['paymentId', 'id']);
  }
}
