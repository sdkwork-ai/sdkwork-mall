import 'package:flutter/material.dart';

import '../bootstrap/session.dart';
import '../services/commerce.dart';
import '../src/i18n/runtime.dart';
import 'widgets.dart';

/// 订单快捷入口：筛选值、文案 key、统计字段与图标.
class _OrderShortcut {
  const _OrderShortcut({
    required this.status,
    required this.labelKey,
    required this.statisticKey,
    required this.icon,
  });

  final String status;
  final String labelKey;
  final String statisticKey;
  final IconData icon;
}

/// 五个入口各用一个能区分状态的图标（钱包 / 包裹 / 货车 / 对勾）.
const List<_OrderShortcut> _orderShortcuts = <_OrderShortcut>[
  _OrderShortcut(
    status: '',
    labelKey: 'buyerHub.orders.all',
    statisticKey: 'totalOrders',
    icon: Icons.receipt_long_outlined,
  ),
  _OrderShortcut(
    status: 'PENDING_PAYMENT',
    labelKey: 'buyerHub.orders.pendingPayment',
    statisticKey: 'pendingPayment',
    icon: Icons.account_balance_wallet_outlined,
  ),
  _OrderShortcut(
    status: 'PENDING_SHIPMENT',
    labelKey: 'buyerHub.orders.pendingShipment',
    statisticKey: 'pendingShipment',
    icon: Icons.inventory_2_outlined,
  ),
  _OrderShortcut(
    status: 'PENDING_RECEIPT',
    labelKey: 'buyerHub.orders.pendingReceipt',
    statisticKey: 'pendingReceipt',
    icon: Icons.local_shipping_outlined,
  ),
  _OrderShortcut(
    status: 'COMPLETED',
    labelKey: 'buyerHub.orders.completed',
    statisticKey: 'completed',
    icon: Icons.check_circle_outline,
  ),
];

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
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: <Widget>[
                for (final shortcut in _orderShortcuts)
                  _SdkworkOrderShortcut(
                    icon: shortcut.icon,
                    label: SdkworkI18n.t(shortcut.labelKey),
                    count: _statisticCount(shortcut.statisticKey),
                    onTap: () => Navigator.of(context).pushNamed(
                      '/orders',
                      arguments: shortcut.status,
                    ),
                  ),
              ],
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

  /// 统计字段可能是数字或数字字符串；缺失/异常统一按 0 处理（不渲染角标）.
  int _statisticCount(String key) {
    final value = _statistics[key];
    if (value is num) {
      return value.toInt();
    }
    return int.tryParse('${value ?? ''}') ?? 0;
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

/// 单个订单快捷入口：状态图标 + 待办角标 + 文案.
class _SdkworkOrderShortcut extends StatelessWidget {
  const _SdkworkOrderShortcut({
    required this.icon,
    required this.label,
    required this.count,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final int count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: SizedBox(
        width: 64,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Column(
            children: <Widget>[
              _SdkworkOrderShortcutIcon(icon: icon, count: count),
              const SizedBox(height: 8),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context)
                    .textTheme
                    .labelMedium
                    ?.copyWith(color: const Color(0xFF374151)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// 状态图标；有数字时在右上角叠一个红色待办角标.
class _SdkworkOrderShortcutIcon extends StatelessWidget {
  const _SdkworkOrderShortcutIcon({required this.icon, required this.count});

  final IconData icon;
  final int count;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 28,
      height: 28,
      child: Stack(
        clipBehavior: Clip.none,
        children: <Widget>[
          Center(
            child: Icon(icon, size: 24, color: const Color(0xFF4B5563)),
          ),
          if (count > 0)
            Positioned(
              top: -6,
              right: -10,
              child: Container(
                height: 16,
                constraints: const BoxConstraints(minWidth: 16),
                padding: const EdgeInsets.symmetric(horizontal: 4),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: const Color(0xFFE93B3D),
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: Colors.white, width: 1.5),
                ),
                child: Text(
                  count > 99 ? '99+' : '$count',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    height: 1,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
