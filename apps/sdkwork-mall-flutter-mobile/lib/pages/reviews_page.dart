import 'package:flutter/material.dart';

import '../bootstrap/session.dart';
import '../services/commerce.dart';
import 'buyer_account_pages.dart';
import 'widgets.dart';

/// 我的评价：已完成订单为当前可评价范围（T1 评价合约落地前）。
class SdkworkReviewsPage extends StatefulWidget {
  const SdkworkReviewsPage({super.key});

  @override
  State<SdkworkReviewsPage> createState() => _SdkworkReviewsPageState();
}

class _SdkworkReviewsPageState extends State<SdkworkReviewsPage> {
  List<({String id, String subject, String amountText})> _orders =
      const <({String id, String subject, String amountText})>[];
  bool _loading = true;
  String _error = '';

  @override
  void initState() {
    super.initState();
    if (SdkworkSession.instance.isLoggedIn) {
      _reload();
    } else {
      _loading = false;
    }
  }

  Future<void> _reload() async {
    try {
      final orders = await MallCommerce.instance.reviews.listPendingReviewOrders();
      if (!mounted) {
        return;
      }
      setState(() {
        _orders = orders;
        _error = '';
        _loading = false;
      });
    } catch (cause) {
      if (!mounted) {
        return;
      }
      setState(() {
        _error = cause.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('我的评价')),
      body: _buildBody(context),
    );
  }

  Widget _buildBody(BuildContext context) {
    if (!SdkworkSession.instance.isLoggedIn) {
      return const SdkworkLoginRequired(message: '登录后查看我的评价');
    }
    if (_loading) {
      return const SdkworkLoadingView(label: '加载评价...');
    }
    if (_error.isNotEmpty) {
      return SdkworkErrorView(message: _error, onRetry: _reload);
    }
    if (_orders.isEmpty) {
      return const SdkworkEmptyView(message: '已完成订单可在这里提交评价');
    }
    return RefreshIndicator(
      onRefresh: _reload,
      child: ListView(
        padding: const EdgeInsets.only(bottom: 24),
        children: <Widget>[
          SdkworkSectionHeader(title: '待评价（${_orders.length}）'),
          ..._orders.map(
            (order) => Card(
              margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              child: ListTile(
                title: Text(
                  order.subject,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                subtitle: Text('订单号 ${order.id}'),
                trailing: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: <Widget>[
                    if (order.amountText.isNotEmpty)
                      Text(
                        order.amountText,
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.primary,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    const SizedBox(height: 4),
                    Text('查看订单', style: Theme.of(context).textTheme.labelSmall),
                  ],
                ),
                onTap: () => Navigator.of(context)
                    .pushNamed('/order-detail', arguments: order.id),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Text(
              '商品晒单与媒体上传需等待 T1 商品评价 API 合约落地。',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ),
        ],
      ),
    );
  }
}
