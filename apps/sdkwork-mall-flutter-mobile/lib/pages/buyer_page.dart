import 'package:flutter/material.dart';

import '../bootstrap/session.dart';
import '../services/commerce.dart';
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
                  _loggedIn ? '客' : '?',
                  style: const TextStyle(fontSize: 22, color: Colors.white),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _loggedIn ? 'SDKWork 用户' : '未登录',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    _loggedIn
                        ? const Text('欢迎回来', style: TextStyle(color: Colors.white70))
                        : TextButton(
                            style: TextButton.styleFrom(
                              foregroundColor: Colors.white,
                              side: const BorderSide(color: Colors.white54),
                            ),
                            onPressed: () =>
                                Navigator.of(context).pushNamed('/login'),
                            child: const Text('点击登录'),
                          ),
                  ],
                ),
              ),
              if (_loggedIn)
                TextButton(
                  onPressed: _logout,
                  child: const Text('退出', style: TextStyle(color: Colors.white)),
                ),
            ],
          ),
        ),
        const SdkworkSectionHeader(title: '我的订单'),
        Card(
          margin: EdgeInsets.zero,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: <Map<String, String>>[
                {'status': '', 'label': '全部订单', 'key': 'totalOrders'},
                {'status': 'PENDING_PAYMENT', 'label': '待付款', 'key': 'pendingPayment'},
                {'status': 'PENDING_SHIPMENT', 'label': '待发货', 'key': 'pendingShipment'},
                {'status': 'PENDING_RECEIPT', 'label': '待收货', 'key': 'pendingReceipt'},
                {'status': 'COMPLETED', 'label': '已完成', 'key': 'completed'},
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
                              '${entry['label']}',
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
        const SdkworkSectionHeader(title: '常用服务'),
        Card(
          margin: EdgeInsets.zero,
          child: Column(
            children: <ListTile>[
              ListTile(
                leading: const Icon(Icons.favorite_outline),
                title: const Text('我的收藏'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => Navigator.of(context).pushNamed('/favorites'),
              ),
              ListTile(
                leading: const Icon(Icons.history_outlined),
                title: const Text('浏览足迹'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => Navigator.of(context).pushNamed('/footprint'),
              ),
              ListTile(
                leading: const Icon(Icons.location_on_outlined),
                title: const Text('地址管理'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => Navigator.of(context).pushNamed('/address'),
              ),
              ListTile(
                leading: const Icon(Icons.local_offer_outlined),
                title: const Text('领券中心'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => Navigator.of(context).pushNamed('/coupons'),
              ),
              ListTile(
                leading: const Icon(Icons.receipt_long_outlined),
                title: const Text('我的订单'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => Navigator.of(context).pushNamed('/orders'),
              ),
              ListTile(
                leading: const Icon(Icons.support_agent_outlined),
                title: const Text('售后中心'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => Navigator.of(context).pushNamed('/after-sales'),
              ),
              ListTile(
                leading: const Icon(Icons.chat_bubble_outline),
                title: const Text('消息中心'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => Navigator.of(context).pushNamed('/chats'),
              ),
            ],
          ),
        ),
        const SdkworkSectionHeader(title: '我的资产'),
        Card(
          margin: EdgeInsets.zero,
          child: Column(
            children: <ListTile>[
              ListTile(
                leading: const Icon(Icons.account_balance_wallet_outlined),
                title: const Text('钱包'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => Navigator.of(context).pushNamed('/wallet'),
              ),
              ListTile(
                leading: const Icon(Icons.stars_outlined),
                title: const Text('我的积分'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => Navigator.of(context).pushNamed('/points'),
              ),
              ListTile(
                leading: const Icon(Icons.workspace_premium_outlined),
                title: const Text('会员中心'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => Navigator.of(context).pushNamed('/membership'),
              ),
              ListTile(
                leading: const Icon(Icons.receipt_outlined),
                title: const Text('发票'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => Navigator.of(context).pushNamed('/invoices'),
              ),
            ],
          ),
        ),
        const SdkworkSectionHeader(title: '其他'),
        Card(
          margin: EdgeInsets.zero,
          child: ListTile(
            leading: const Icon(Icons.settings_outlined),
            title: const Text('设置'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.of(context).pushNamed('/settings'),
          ),
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
        title: const Text('退出登录'),
        content: const Text('确定退出当前账号？'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () {
              SdkworkSession.instance.signOut();
              Navigator.of(dialogContext).pop();
            },
            child: const Text('确定'),
          ),
        ],
      ),
    );
  }
}
