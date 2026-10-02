import '../bootstrap/commerce_transport.dart';
import '../bootstrap/environment.dart';
import 'address_service.dart';
import 'cart_service.dart';
import 'catalog_service.dart';
import 'order_service.dart';
import 'promotion_service.dart';

/// Composition root for the Flutter commerce building blocks.
///
/// Each domain is an independently constructed service over the single
/// transport seam; pages depend on the domain service they need (never on the
/// whole graph), which keeps the modules freely combinable.
class MallCommerce {
  MallCommerce._(this.client)
      : catalog = CatalogService(client),
        cart = CartService(client),
        orders = OrderService(client),
        addresses = AddressService(client),
        promotions = PromotionService(client);

  static MallCommerce? _instance;

  final SdkworkMallFlutterCommerceClient client;
  final CatalogService catalog;
  final CartService cart;
  final OrderService orders;
  final AddressService addresses;
  final PromotionService promotions;

  static MallCommerce get instance {
    _instance ??= MallCommerce._(
      SdkworkMallFlutterCommerceClient(
        appApiBaseUrl: SdkworkMallFlutterEnvironment.fromDefineValues()
            .commerceAppApiBaseUrl,
      ),
    );
    return _instance!;
  }

  /// Installs an explicit composition root (used by the app entry to bind the
  /// dart-define environment; tests may install fakes).
  static void initInstanceForTesting(SdkworkMallFlutterEnvironment environment) {
    _instance ??= MallCommerce._(
      SdkworkMallFlutterCommerceClient(
        appApiBaseUrl: environment.commerceAppApiBaseUrl,
      ),
    );
  }
}
