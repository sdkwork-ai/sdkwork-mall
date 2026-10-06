import 'package:flutter/material.dart';

import '../services/commerce.dart';
import '../utils/format.dart';
import '../utils/json.dart';
import 'widgets.dart';

/// 订单中心: 状态页签 / 列表 / 操作（支付/取消/确认收货）.
class SdkworkOrdersPage extends StatefulWidget {
  const SdkworkOrdersPage({super.key});

  @override
  State<SdkworkOrdersPage> createState() => _SdkworkOrdersPageState();
}

class _SdkworkOrdersPageState extends State<SdkworkOrdersPage> {
  static const _tabs = <Map<String, String>>[
    {'code': '', 'label': '全部'},
    {'code': 'PENDING_PAYMENT', 'label': '待付款'},
    {'code': 'PENDING_SHIPMENT', 'label': '待发货'},
    {'code': 'PENDING_RECEIPT', 'label': '待收货'},
    {'code': 'COMPLETED', 'label': '已完成'},
  ];

  String _activeTab = '';
  List<Map<String, dynamic>> _orders = const [];
  bool _loading = true;
  String _error = '';

  @override
  void initState() {
    super.initState();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final arguments = ModalRoute.of(context)?.settings.arguments;
    if (arguments is String && arguments.isNotEmpty) {
      _activeTab = arguments;
    }
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('我的订单')),
      body: Column(
        children: [
          SizedBox(
            height: 48,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: _tabs
                  .map(
                    (tab) => Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: ChoiceChip(
                        label: Text('${tab['label']}'),
                        selected: _activeTab == tab['code'],
                        onSelected: (_) {
                          setState(() => _activeTab = '${tab['code']}');
                          _load();
                        },
                      ),
                    ),
                  )
                  .toList(),
            ),
          ),
          Expanded(
            child: _loading
                ? const SdkworkLoadingView(label: '加载订单...')
                : _error.isNotEmpty
                    ? SdkworkErrorView(message: _error, onRetry: _load)
                    : _orders.isEmpty
                        ? const SdkworkEmptyView(message: '暂无订单')
                        : RefreshIndicator(
                            onRefresh: _load,
                            child: ListView(
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              children: _orders.map(_buildOrderCard).toList(),
                            ),
                          ),
          ),
        ],
      ),
    );
  }

  Widget _buildOrderCard(Map<String, dynamic> order) {
    final orderId = '${order['orderId'] ?? order['id']}';
    final status = '${order['status'] ?? ''}'.toUpperCase();
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    '${order['subject'] ?? '订单'}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                ),
                Text(
                  statusLabel('${order['status']}'),
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.primary,
                    fontSize: 13,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  formatTime('${order['createdAt'] ?? ''}'),
                  style: Theme.of(context).textTheme.labelSmall,
                ),
                Text(
                  formatCny(asNum(order, ['totalAmount', 'totalAmountCny'])),
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.primary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton(
                  onPressed: () =>
                      Navigator.of(context).pushNamed('/order-detail', arguments: orderId),
                  child: const Text('订单详情'),
                ),
                if (status == 'PENDING_RECEIPT' || status == 'COMPLETED')
                  TextButton(
                    onPressed: () =>
                        Navigator.of(context).pushNamed('/logistics', arguments: orderId),
                    child: const Text('查看物流'),
                  ),
                if (status == 'PENDING_PAYMENT') ...[
                  FilledButton(
                    onPressed: () => _pay(orderId),
                    child: const Text('去支付'),
                  ),
                  const SizedBox(width: 8),
                  OutlinedButton(onPressed: () => _cancel(orderId), child: const Text('取消')),
                ],
                if (status == 'PENDING_RECEIPT')
                  FilledButton(
                    onPressed: () => _confirmReceipt(orderId),
                    child: const Text('确认收货'),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      final orders = await MallCommerce.instance.orders.listOrders(
        status: _activeTab,
      );
      if (!mounted) {
        return;
      }
      setState(() {
        _orders = orders;
        _loading = false;
      });
    } catch (cause) {
      if (!mounted) {
        return;
      }
      setState(() {
        _orders = const [];
        _loading = false;
        _error = '$cause';
      });
    }
  }

  Future<void> _pay(String orderId) async {
    try {
      final paymentId = await MallCommerce.instance.orders.payOrder(orderId, 'WECHAT');
      if (!mounted) {
        return;
      }
      Navigator.of(context).pushReplacementNamed(
        '/payment-result',
        arguments: <String, String>{
          'orderId': orderId,
          'paymentId': paymentId,
          'paymentMethod': 'WECHAT',
        },
      );
    } catch (cause) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$cause')));
      }
    }
  }

  Future<void> _cancel(String orderId) async {
    try {
      await MallCommerce.instance.orders.cancelOrder(orderId);
      await _load();
    } catch (cause) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$cause')));
      }
    }
  }

  Future<void> _confirmReceipt(String orderId) async {
    try {
      await MallCommerce.instance.orders.confirmReceipt(orderId);
      await _load();
    } catch (cause) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$cause')));
      }
    }
  }
}
