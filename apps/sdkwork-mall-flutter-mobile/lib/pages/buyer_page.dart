import 'package:flutter/material.dart';

import '../bootstrap/session.dart';
import '../services/commerce.dart';
import '../src/i18n/runtime.dart';
import 'widgets.dart';

/// 我的: 会话用户 / 订单入口统计 / 常用服务 / 退出登录.
class SdkworkBuyerPage extends StatefulWidget {
  const SdkworkBuyerPage({super.key});

  @override
  State<SdkworkBuyerPage> createState() => _SdkworkBuyerPageState();
}

class _SdkworkBuyerPageState extends State<SdkworkBuyerPage> {
  Map<String, dynamic> _statistics = const {};
  bool _loggedIn = false;

  @override
  void initState() {
    super.initState();
    _loggedIn = SdkworkSession.instance.isLoggedIn;
    SdkworkSession.instance.addListener(_onSessionChanged);
    if (_loggedIn) {
      _loadStatistics();
    }
  }

  @override
  void dispose() {
    SdkworkSession.instance.removeListener(_onSessionChanged);
    super.dispose();
  }

  void _onSessionChanged() {
    if (!mounted) {
      return;
    }
    setState(() => _loggedIn = SdkworkSession.instance.isLoggedIn);
    if (_loggedIn) {
      _loadStatistics();
    }
  }

  ListTile _menuTile(IconData icon, String labelKey, String route) {
    return ListTile(
      leading: Icon(icon),
      title: Text(SdkworkI18n.t(labelKey)),
      trailing: const Icon(Icons.chevron_right),
      onTap: () => Navigator.of(context).pushNamed(route),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      children: [
        Container(
          padding: const EdgeInsets.fromLTRB(24, 48, 24, 32),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: <Color>[
                Theme.of(context).colorScheme.primary,
                Theme.of(context).colorScheme.tertiary,
              ],
            ),
          ),
          child: Row(
            children: [
              CircleAvatar(
                radius: 28,
                backgroundColor: Colors.white24,
                child: Text(
                  _loggedIn ? SdkworkI18n.t('buyerHub.avatarInitial') : '?',
                  style: const TextStyle(fontSize: 22, color: Colors.white),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _loggedIn
                          ? SdkworkI18n.t('buyerHub.memberName')
                          : SdkworkI18n.t('buyerHub.guestName'),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    _loggedIn
                        ? Text(
                            SdkworkI18n.t('buyerHub.greeting'),
                            style: const TextStyle(color: Colors.white70),
                          )
                        : TextButton(
                            style: TextButton.styleFrom(
                              foregroundColor: Colors.white,
                              side: const BorderSide(color: Colors.white54),
                            ),
                            onPressed: () =>
                                Navigator.of(context).pushNamed('/login'),
                            child: Text(SdkworkI18n.t('buyerHub.login')),
                          ),
                  ],
                ),
              ),
              if (_loggedIn)
                TextButton(
                  onPressed: _logout,
                  child: Text(
                    SdkworkI18n.t('buyerHub.logoutShort'),
                    style: const TextStyle(color: Colors.white),
                  ),
                ),
            ],
          ),
        ),
        SdkworkSectionHeader(title: SdkworkI18n.t('buyerHub.sections.orders')),
        Card(
          margin: EdgeInsets.zero,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: <Map<String, String>>[
                {'status': '', 'labelKey': 'buyerHub.orders.all', 'key': 'totalOrders'},
                {'status': 'PENDING_PAYMENT', 'labelKey': 'buyerHub.orders.pendingPayment', 'key': 'pendingPayment'},
                {'status': 'PENDING_SHIPMENT', 'labelKey': 'buyerHub.orders.pendingShipment', 'key': 'pendingShipment'},
                {'status': 'PENDING_RECEIPT', 'labelKey': 'buyerHub.orders.pendingReceipt', 'key': 'pendingReceipt'},
                {'status': 'COMPLETED', 'labelKey': 'buyerHub.orders.completed', 'key': 'completed'},
              ]
                  .map(
                    (entry) => InkWell(
                      onTap: () => Navigator.of(context).pushNamed(
                        '/orders',
                        arguments: entry['status'],
                      ),
                      child: SizedBox(
                        width: 68,
                        child: Column(
                          children: [
                            Text(
                              '${_statistics[entry['key']] ?? ''}',
                              style: const TextStyle(
                                fontWeight: FontWeight.w700,
                                fontSize: 16,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              SdkworkI18n.t(entry['labelKey'] ?? ''),
                              style: Theme.of(context).textTheme.labelSmall,
                            ),
                          ],
                        ),
                      ),
                    ),
                  )
                  .toList(),
            ),
          ),
        ),
        SdkworkSectionHeader(title: SdkworkI18n.t('buyerHub.sections.services')),
        Card(
          margin: EdgeInsets.zero,
          child: Column(
            children: <ListTile>[
              _menuTile(Icons.favorite_outline, 'buyerHub.services.favorites', '/favorites'),
              _menuTile(Icons.history_outlined, 'buyerHub.services.footprint', '/footprint'),
              _menuTile(Icons.location_on_outlined, 'buyerHub.services.addresses', '/address'),
              _menuTile(Icons.local_offer_outlined, 'buyerHub.services.coupons', '/coupons'),
              _menuTile(Icons.receipt_long_outlined, 'buyerHub.services.orders', '/orders'),
              _menuTile(Icons.support_agent_outlined, 'buyerHub.services.afterSales', '/after-sales'),
              _menuTile(Icons.notifications_outlined, 'buyerHub.services.messages', '/messages'),
              _menuTile(Icons.chat_bubble_outline, 'buyerHub.services.chats', '/chats'),
            ],
          ),
        ),
        SdkworkSectionHeader(title: SdkworkI18n.t('buyerHub.sections.assets')),
        Card(
          margin: EdgeInsets.zero,
          child: Column(
            children: <ListTile>[
              _menuTile(Icons.account_balance_wallet_outlined, 'buyerHub.assets.wallet', '/wallet'),
              _menuTile(Icons.stars_outlined, 'buyerHub.assets.points', '/points'),
              _menuTile(Icons.workspace_premium_outlined, 'buyerHub.assets.membership', '/membership'),
              _menuTile(Icons.receipt_outlined, 'buyerHub.assets.invoices', '/invoices'),
            ],
          ),
        ),
        SdkworkSectionHeader(title: SdkworkI18n.t('buyerHub.sections.account')),
        Card(
          margin: EdgeInsets.zero,
          child: Column(
            children: <ListTile>[
              _menuTile(Icons.person_outline, 'buyerHub.account.profile', '/profile'),
              _menuTile(Icons.rate_review_outlined, 'buyerHub.account.reviews', '/reviews'),
              _menuTile(Icons.card_giftcard_outlined, 'buyerHub.account.giftCards', '/gift-cards'),
              _menuTile(Icons.lock_outline, 'buyerHub.account.security', '/security'),
              _menuTile(Icons.help_outline, 'buyerHub.account.help', '/help'),
            ],
          ),
        ),
        SdkworkSectionHeader(title: SdkworkI18n.t('buyerHub.sections.others')),
        Card(
          margin: EdgeInsets.zero,
          child: _menuTile(Icons.settings_outlined, 'buyerHub.others.settings', '/settings'),
        ),
        const SizedBox(height: 24),
      ],
    );
  }

  Future<void> _loadStatistics() async {
    try {
      final statistics = await MallCommerce.instance.orders.getOrderStatistics();
      if (!mounted) {
        return;
      }
      setState(() => _statistics = statistics);
    } catch (_) {
      // 统计为增强信息，失败时保持空态。
    }
  }

  void _logout() {
    showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(SdkworkI18n.t('buyerHub.logout.title')),
        content: Text(SdkworkI18n.t('buyerHub.logout.confirm')),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: Text(SdkworkI18n.t('buyerHub.logout.cancel')),
          ),
          FilledButton(
            onPressed: () {
              SdkworkSession.instance.signOut();
              Navigator.of(dialogContext).pop();
            },
            child: Text(SdkworkI18n.t('buyerHub.logout.confirmAction')),
          ),
        ],
      ),
    );
  }
}
