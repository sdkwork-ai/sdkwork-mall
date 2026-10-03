import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Buyer session for the Flutter root.
///
/// Speaks the IAM session contract: the login exchange returns dual tokens
/// (`authToken` for the Authorization header, `accessToken` for Access-Token)
/// plus the session context. Tokens persist through shared_preferences so a
/// cold start keeps the buyer signed in; native code2session swaps in behind
/// the same seam once the IAM Dart family lands (see docs/decisions.md).
class SdkworkSession extends ChangeNotifier {
  SdkworkSession._();

  static final SdkworkSession instance = SdkworkSession._();

  static const _keyAuthToken = 'sdkwork.mall.session.authToken';
  static const _keyAccessToken = 'sdkwork.mall.session.accessToken';
  static const _keyUserId = 'sdkwork.mall.session.userId';

  String _authToken = '';
  String _accessToken = '';
  String _userId = '';
  bool _hydrated = false;

  /// Bearer token for the Authorization header.
  String get token => _authToken;

  /// Access token for the Access-Token header (empty when absent).
  String get accessToken => _accessToken;

  String get userId => _userId;

  bool get isLoggedIn => _authToken.isNotEmpty;

  /// Restores the persisted session once at startup; safe to call again.
  Future<void> restore() async {
    if (_hydrated) {
      return;
    }
    _hydrated = true;
    try {
      final preferences = await SharedPreferences.getInstance();
      _authToken = preferences.getString(_keyAuthToken) ?? '';
      _accessToken = preferences.getString(_keyAccessToken) ?? '';
      _userId = preferences.getString(_keyUserId) ?? '';
      if (_authToken.isNotEmpty) {
        notifyListeners();
      }
    } catch (_) {
      // Storage unavailable: keep the in-memory session only.
    }
  }

  Future<void> signInWithTokens({
    required String authToken,
    String accessToken = '',
    String userId = '',
  }) async {
    _authToken = authToken.trim();
    _accessToken = accessToken.trim();
    _userId = userId.trim();
    notifyListeners();
    try {
      final preferences = await SharedPreferences.getInstance();
      await preferences.setString(_keyAuthToken, _authToken);
      if (_accessToken.isNotEmpty) {
        await preferences.setString(_keyAccessToken, _accessToken);
      }
      if (_userId.isNotEmpty) {
        await preferences.setString(_keyUserId, _userId);
      }
    } catch (_) {
      // Storage unavailable: the session stays in memory for this run.
    }
  }

  /// Legacy single-token entry kept for the dev token-paste fallback.
  Future<void> signIn(String token) => signInWithTokens(authToken: token);

  Future<void> signOut() async {
    _authToken = '';
    _accessToken = '';
    _userId = '';
    notifyListeners();
    try {
      final preferences = await SharedPreferences.getInstance();
      await preferences.remove(_keyAuthToken);
      await preferences.remove(_keyAccessToken);
      await preferences.remove(_keyUserId);
    } catch (_) {
      // ignore
    }
  }
}

/// Cart badge counter shared across pages (tab bar + product/cart pages).
class CartBadge extends ChangeNotifier {
  CartBadge._();

  static final CartBadge instance = CartBadge._();

  int _count = 0;

  int get count => _count;

  void setCount(int value) {
    _count = value < 0 ? 0 : value;
    notifyListeners();
  }

  void bump(int delta) {
    setCount(_count + delta);
  }
}
