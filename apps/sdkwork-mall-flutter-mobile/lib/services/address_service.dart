import '../bootstrap/commerce_transport.dart';
import '../utils/json.dart';

/// Address book domain.
class AddressService {
  AddressService(this._client);

  final SdkworkMallFlutterCommerceClient _client;

  Future<List<Map<String, dynamic>>> listAddresses() async {
    final payload = await _client.request(
      '/addresses',
      query: const {'page': '1', 'page_size': '20'},
    );
    return asList(payload['items']);
  }

  Future<void> createAddress({
    required String addressLine,
    required String receiverName,
    required String receiverPhone,
  }) async {
    await _client.request(
      '/addresses',
      method: 'POST',
      body: <String, dynamic>{
        'addressLine': addressLine,
        'receiverName': receiverName,
        'receiverPhone': receiverPhone,
      },
    );
  }

  Future<void> updateAddress(
    String addressId, {
    required String addressLine,
    required String receiverName,
    required String receiverPhone,
  }) async {
    await _client.request(
      '/addresses/$addressId',
      method: 'PUT',
      body: <String, dynamic>{
        'addressLine': addressLine,
        'receiverName': receiverName,
        'receiverPhone': receiverPhone,
      },
    );
  }

  Future<void> deleteAddress(String addressId) =>
      _client.request('/addresses/$addressId', method: 'DELETE');

  Future<void> setDefaultAddress(String addressId) => _client.request(
        '/addresses/default_selection',
        method: 'POST',
        body: <String, dynamic>{'addressId': addressId},
      );
}
