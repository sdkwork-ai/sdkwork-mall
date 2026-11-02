import 'package:flutter/material.dart';

import '../bootstrap/session.dart';
import '../pages/account_pages.dart';
import '../pages/after_sales_page.dart';
import '../pages/address_page.dart';
import '../pages/buyer_page.dart';
import '../pages/buyer_account_pages.dart';
import '../pages/cart_page.dart';
import '../pages/cashier_page.dart';
import '../pages/category_page.dart';
import '../pages/chat_pages.dart';
import '../pages/checkout_page.dart';
import '../pages/coupons_page.dart';
import '../pages/favorites_page.dart';
import '../pages/home_page.dart';
import '../pages/help_page.dart';
import '../pages/login_page.dart';
import '../pages/logistics_page.dart';
import '../pages/marketing_pages.dart';
import '../pages/messages_page.dart';
import '../pages/order_detail_page.dart';
import '../pages/orders_page.dart';
import '../pages/payment_result_page.dart';
import '../pages/product_page.dart';
import '../pages/reviews_page.dart';
import '../pages/search_page.dart';
import '../pages/settings_and_invoices.dart';
import '../routes/capability_routes.dart';

/// Application routes for the commerce flow.
///
/// The named-route table is validated against the capability route registry in
/// debug builds: a capability whose page builder disappears fails fast instead
/// of becoming an unreachable surface.
Map<String, WidgetBuilder> buildSdkworkMallRoutes() {
  final Map<String, WidgetBuilder> routes = <String, WidgetBuilder>{
      '/login': (context) => const SdkworkLoginPage(),
      '/search': (context) => const SdkworkSearchPage(),
      '/product': (context) => SdkworkProductPage(
            productId: '${_routeArguments(context)}',
          ),
      '/checkout': (context) => const SdkworkCheckoutPage(),
      '/cashier': (context) => SdkworkCashierPage(
            orderId: '${_routeArguments(context)}',
          ),
      '/payment-result': (context) => SdkworkPaymentResultPage(
            arguments: _routeArguments(context) as Map<String, String>,
          ),
      '/orders': (context) => const SdkworkOrdersPage(),
      '/order-detail': (context) => SdkworkOrderDetailPage(
            orderId: '${_routeArguments(context)}',
          ),
      '/logistics': (context) => SdkworkLogisticsPage(
            orderId: _routeArguments(context) == null
                ? null
                : '${_routeArguments(context)}',
          ),
      '/messages': (context) => const SdkworkMessagesPage(),
      '/address': (context) => const SdkworkAddressPage(),
      '/after-sales': (context) => SdkworkAfterSalesPage(
            orderId: _routeArguments(context) == null
                ? null
                : '${_routeArguments(context)}',
          ),
      '/coupons': (context) => const SdkworkCouponsPage(),
      '/favorites': (context) => const SdkworkFavoritesPage(),
      '/footprint': (context) => const SdkworkFootprintPage(),
      '/wallet': (context) => const SdkworkWalletPage(),
      '/points': (context) => const SdkworkPointsPage(),
      '/membership': (context) => const SdkworkMembershipPage(),
      '/invoices': (context) => const SdkworkInvoicesPage(),
      '/settings': (context) => const SdkworkSettingsPage(),
      '/shop': (context) => SdkworkShopPage(
            shopId: '${_routeArguments(context)}',
          ),
      '/activity': (context) => const SdkworkActivityListPage(),
      '/activity-detail': (context) => SdkworkActivityDetailPage(
            offerId: '${_routeArguments(context)}',
          ),
      '/chats': (context) => const SdkworkChatsPage(),
      '/chat': (context) => SdkworkChatPage(
            conversationId: '${_routeArguments(context)}',
          ),
      '/notices': (context) => const SdkworkNoticesPage(),
      '/help': (context) => const SdkworkHelpPage(),
      '/reviews': (context) => const SdkworkReviewsPage(),
      '/gift-cards': (context) => const SdkworkGiftCardsPage(),
      '/profile': (context) => const SdkworkProfilePage(),
      '/security': (context) => const SdkworkSecurityPage(),
    };

  assertSdkworkMallCapabilityRoutes(routes.keys);
  return routes;
}

Object? _routeArguments(BuildContext context) =>
    ModalRoute.of(context)?.settings.arguments;

/// Bottom-tab mobile shell: 首页 / 分类 / 购物车 / 我的.
class SdkworkMallFlutterMobileShell extends StatelessWidget {
  const SdkworkMallFlutterMobileShell({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SDKWork 商城',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFFE93B3D),
          surface: const Color(0xFFF5F6F8),
        ),
        useMaterial3: true,
        scaffoldBackgroundColor: const Color(0xFFF5F6F8),
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.white,
          surfaceTintColor: Colors.transparent,
          elevation: 0,
          scrolledUnderElevation: 0.5,
          centerTitle: false,
          titleTextStyle: TextStyle(
            color: Color(0xFF111827),
            fontSize: 17,
            fontWeight: FontWeight.w600,
          ),
        ),
        cardTheme: CardThemeData(
          color: Colors.white,
          elevation: 0,
          margin: EdgeInsets.zero,
          surfaceTintColor: Colors.transparent,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: const BorderSide(color: Color(0xFFECEEF2)),
          ),
        ),
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            minimumSize: const Size(0, 48),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
            ),
            textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
          ),
        ),
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            minimumSize: const Size(0, 48),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
            ),
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: const Color(0xFFFBFBFD),
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Color(0xFFECEEF2)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Color(0xFFECEEF2)),
          ),
        ),
        listTileTheme: const ListTileThemeData(
          iconColor: Color(0xFF6B7280),
        ),
        dividerTheme: const DividerThemeData(
          color: Color(0xFFECEEF2),
          thickness: 0.6,
          space: 1,
        ),
        chipTheme: ChipThemeData(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(999),
          ),
          side: const BorderSide(color: Color(0xFFECEEF2)),
        ),
        snackBarTheme: SnackBarThemeData(
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),
      onGenerateRoute: (settings) {
        final builder = buildSdkworkMallRoutes()[settings.name];
        if (builder == null) {
          return null;
        }
        return MaterialPageRoute<void>(builder: builder, settings: settings);
      },
      home: const SdkworkMallHomeTabs(),
    );
  }
}

class SdkworkMallHomeTabs extends StatefulWidget {
  const SdkworkMallHomeTabs({super.key});

  @override
  State<SdkworkMallHomeTabs> createState() => _SdkworkMallHomeTabsState();
}

class _SdkworkMallHomeTabsState extends State<SdkworkMallHomeTabs> {
  int _tabIndex = 0;

  static const _tabTitles = <String>['首页', '分类', '购物车', '我的'];

  @override
  Widget build(BuildContext context) {
    final pages = <Widget>[
      SdkworkHomePage(onSwitchTab: (tab) => setState(() => _tabIndex = tab)),
      const SdkworkCategoryPage(),
      const SdkworkCartPage(),
      const SdkworkBuyerPage(),
    ];

    return Scaffold(
      appBar: _tabIndex == 0 || _tabIndex == 1
          ? null
          : AppBar(title: Text(_tabTitles[_tabIndex])),
      body: IndexedStack(index: _tabIndex, children: pages),
      bottomNavigationBar: BottomNavigationBar(
        type: BottomNavigationBarType.fixed,
        selectedItemColor: const Color(0xFFE93B3D),
        currentIndex: _tabIndex,
        onTap: (index) => setState(() => _tabIndex = index),
        items: <BottomNavigationBarItem>[
          const BottomNavigationBarItem(
            icon: Icon(Icons.home_outlined),
            activeIcon: Icon(Icons.home),
            label: '首页',
          ),
          const BottomNavigationBarItem(
            icon: Icon(Icons.grid_view_outlined),
            activeIcon: Icon(Icons.grid_view),
            label: '分类',
          ),
          BottomNavigationBarItem(
            icon: ListenableBuilder(
              listenable: CartBadge.instance,
              builder: (context, _) => Badge(
                isLabelVisible: CartBadge.instance.count > 0,
                label: Text('${CartBadge.instance.count}'),
                child: const Icon(Icons.shopping_cart_outlined),
              ),
            ),
            activeIcon: const Icon(Icons.shopping_cart),
            label: '购物车',
          ),
          BottomNavigationBarItem(
            icon: ListenableBuilder(
              listenable: SdkworkSession.instance,
              builder: (context, _) => Icon(
                SdkworkSession.instance.isLoggedIn
                    ? Icons.person
                    : Icons.person_outline,
              ),
            ),
            label: '我的',
          ),
        ],
      ),
    );
  }
}
