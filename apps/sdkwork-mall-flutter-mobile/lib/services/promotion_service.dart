import '../bootstrap/commerce_transport.dart';
import '../utils/json.dart';

/// Promotion domain: activity offers, coupon claims, redemption codes.
class PromotionService {
  PromotionService(this._client);

  final SdkworkMallFlutterCommerceClient _client;

  Future<List<Map<String, dynamic>>> listOffers() async {
    final payload = await _client.request(
      '/promotions/offers',
      query: const {'page': '1', 'page_size': '10', 'status': 'active'},
    );
    return asList(payload['items']);
  }

  Future<void> claimCoupon(String offerId) => _client.request(
        '/promotions/user_coupon_claims',
        method: 'POST',
        body: <String, dynamic>{'offerId': offerId},
      );

  Future<void> redeemCouponCode(String code) => _client.request(
        '/promotions/codes/redemptions',
        method: 'POST',
        body: <String, dynamic>{'code': code},
      );
}
