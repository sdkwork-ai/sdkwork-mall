import 'package:flutter/foundation.dart';

/// In-memory buyer session for the Flutter root.
///
/// The IAM Dart family is pending (see docs/decisions.md), so the session
/// holds the platform-issued bearer token only; the login page seeds it.
/// Persistence plugs in here (secure storage) once the identity contract
/// lands.
class SdkworkSession extends ChangeNotifier {
  SdkworkSession._();

  static final SdkworkSession instance = SdkworkSession._();

  String _token = '';

  String get token => _token;

  bool get isLoggedIn => _token.isNotEmpty;

  void signIn(String token) {
    _token = token.trim();
    notifyListeners();
  }

  void signOut() {
    _token = '';
    notifyListeners();
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
