/// Canonical capability route identity for the Flutter root.
///
/// Every named route that represents a commerce capability carries the same
/// route id as the PC, H5 and mini-program roots
/// (APP_CLIENT_ARCHITECTURE_ALIGNMENT_SPEC section 7). Tab destinations are
/// shell surfaces rather than named routes and are intentionally absent.
///
/// The parity contract (specs/mall-capability-parity.json) and
/// tests/contract/verify-mall-capability-parity.test.mjs keep this table and
/// buildSdkworkMallRoutes() in sync.
class SdkworkMallCapabilityRoute {
  const SdkworkMallCapabilityRoute({required this.routeId, required this.path});

  /// Canonical route id shared with the other client roots.
  final String routeId;

  /// Physical named route registered in buildSdkworkMallRoutes().
  final String path;
}

const List<SdkworkMallCapabilityRoute> sdkworkMallCapabilityRoutes =
    <SdkworkMallCapabilityRoute>[
  SdkworkMallCapabilityRoute(routeId: 'storefront.mall.search', path: '/search'),
  SdkworkMallCapabilityRoute(routeId: 'storefront.mall.product-detail', path: '/product'),
  SdkworkMallCapabilityRoute(routeId: 'storefront.mall.shop', path: '/shop'),
  SdkworkMallCapabilityRoute(routeId: 'storefront.mall.activity-list', path: '/activity'),
  SdkworkMallCapabilityRoute(routeId: 'storefront.mall.activity-detail', path: '/activity-detail'),
  SdkworkMallCapabilityRoute(routeId: 'storefront.mall.checkout', path: '/checkout'),
  SdkworkMallCapabilityRoute(routeId: 'storefront.mall.payment-cashier', path: '/cashier'),
  SdkworkMallCapabilityRoute(routeId: 'storefront.mall.payment-result', path: '/payment-result'),
  SdkworkMallCapabilityRoute(routeId: 'storefront.mall.help', path: '/help'),
  SdkworkMallCapabilityRoute(routeId: 'buyer.mall.orders', path: '/orders'),
  SdkworkMallCapabilityRoute(routeId: 'buyer.mall.orders.detail', path: '/order-detail'),
  SdkworkMallCapabilityRoute(routeId: 'buyer.mall.orders.logistics', path: '/logistics'),
  SdkworkMallCapabilityRoute(routeId: 'buyer.mall.addresses', path: '/address'),
  SdkworkMallCapabilityRoute(routeId: 'buyer.mall.after-sales', path: '/after-sales'),
  SdkworkMallCapabilityRoute(routeId: 'buyer.mall.coupons', path: '/coupons'),
  SdkworkMallCapabilityRoute(routeId: 'buyer.mall.favorites', path: '/favorites'),
  SdkworkMallCapabilityRoute(routeId: 'buyer.mall.footprint', path: '/footprint'),
  SdkworkMallCapabilityRoute(routeId: 'buyer.mall.messages', path: '/messages'),
  SdkworkMallCapabilityRoute(routeId: 'buyer.mall.reviews', path: '/reviews'),
  SdkworkMallCapabilityRoute(routeId: 'buyer.mall.gift-cards', path: '/gift-cards'),
  SdkworkMallCapabilityRoute(routeId: 'buyer.mall.profile', path: '/profile'),
  SdkworkMallCapabilityRoute(routeId: 'buyer.mall.security', path: '/security'),
  SdkworkMallCapabilityRoute(routeId: 'buyer.mall.wallet', path: '/wallet'),
  SdkworkMallCapabilityRoute(routeId: 'buyer.mall.points', path: '/points'),
  SdkworkMallCapabilityRoute(routeId: 'buyer.mall.membership', path: '/membership'),
  SdkworkMallCapabilityRoute(routeId: 'buyer.mall.invoices', path: '/invoices'),
  SdkworkMallCapabilityRoute(routeId: 'buyer.mall.im.chats', path: '/chats'),
  SdkworkMallCapabilityRoute(routeId: 'buyer.mall.im.chat', path: '/chat'),
  SdkworkMallCapabilityRoute(routeId: 'buyer.mall.im.notices', path: '/notices'),
  SdkworkMallCapabilityRoute(routeId: 'buyer.mall.settings', path: '/settings'),
  SdkworkMallCapabilityRoute(routeId: 'account.mall.login', path: '/login'),
];

/// Route id -> physical path lookup for deep-link adapters.
Map<String, String> sdkworkMallCapabilityPaths() {
  return <String, String>{
    for (final SdkworkMallCapabilityRoute route in sdkworkMallCapabilityRoutes)
      route.routeId: route.path,
  };
}

/// Fails in debug when a capability route has no widget builder, so a renamed
/// page cannot silently orphan a capability.
void assertSdkworkMallCapabilityRoutes(Iterable<String> registeredPaths) {
  assert(() {
    final Set<String> registered = registeredPaths.toSet();
    final List<String> missing = sdkworkMallCapabilityRoutes
        .where((SdkworkMallCapabilityRoute route) => !registered.contains(route.path))
        .map((SdkworkMallCapabilityRoute route) =>
            '${route.routeId} (${route.path})')
        .toList();
    if (missing.isNotEmpty) {
      throw StateError(
        'Capability routes without a registered builder: ${missing.join(", ")}',
      );
    }
    return true;
  }());
}
