import 'package:flutter/material.dart';

import '../bootstrap/session.dart';
import '../pages/account_pages.dart';
import '../pages/after_sales_page.dart';
import '../pages/address_page.dart';
import '../pages/buyer_page.dart';
import '../pages/cart_page.dart';
import '../pages/cashier_page.dart';
import '../pages/category_page.dart';
import '../pages/chat_pages.dart';
import '../pages/checkout_page.dart';
import '../pages/coupons_page.dart';
import '../pages/favorites_page.dart';
import '../pages/home_page.dart';
import '../pages/login_page.dart';
import '../pages/logistics_page.dart';
import '../pages/marketing_pages.dart';
import '../pages/messages_page.dart';
import '../pages/order_detail_page.dart';
import '../pages/orders_page.dart';
import '../pages/payment_result_page.dart';
import '../pages/product_page.dart';
import '../pages/search_page.dart';
import '../pages/settings_and_invoices.dart';

/// Application routes for the commerce flow.
Map<String, WidgetBuilder> buildSdkworkMallRoutes() => <String, WidgetBuilder>{
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
    };

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
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFFE93B3D)),
        useMaterial3: true,
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
