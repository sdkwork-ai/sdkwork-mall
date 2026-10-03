import '../bootstrap/commerce_transport.dart';
import '../bootstrap/session.dart';
import '../utils/json.dart';

/// Authenticated session snapshot from the IAM login exchange.
class SdkworkLoginResult {
  SdkworkLoginResult({
    required this.authToken,
    required this.accessToken,
    required this.userId,
  });

  final String authToken;
  final String accessToken;
  final String userId;
}

/// IAM login/logout over the commerce transport seam.
///
/// The exchange posts the IAM session-create contract
/// (`POST /auth/sessions`): one principal field plus the password; the
/// response data carries the dual tokens and session context.
class AuthService {
  AuthService(this._client);

  final SdkworkMallFlutterCommerceClient _client;

  Future<SdkworkLoginResult> loginWithPassword({
    String username = '',
    String phone = '',
    String email = '',
    required String password,
  }) async {
    final body = <String, dynamic>{'password': password};
    if (username.isNotEmpty) {
      body['username'] = username;
    }
    if (phone.isNotEmpty) {
      body['phone'] = phone;
    }
    if (email.isNotEmpty) {
      body['email'] = email;
    }
    final data = await _client.request('/auth/sessions', method: 'POST', body: body);
    final authToken = asString(data, ['authToken', 'auth_token', 'token']);
    if (authToken.isEmpty) {
      throw const SdkworkApiException('登录响应缺少令牌，请稍后重试');
    }
    final context = asMap(data['context']);
    return SdkworkLoginResult(
      authToken: authToken,
      accessToken: asString(data, ['accessToken', 'access_token']),
      userId: asString(context, ['userId', 'user_id']),
    );
  }

  Future<void> logout() async {
    try {
      await _client.request('/auth/sessions/current', method: 'DELETE');
    } catch (_) {
      // The server session may already be gone; the local sign-out must
      // proceed regardless.
    }
    await SdkworkSession.instance.signOut();
  }
}
