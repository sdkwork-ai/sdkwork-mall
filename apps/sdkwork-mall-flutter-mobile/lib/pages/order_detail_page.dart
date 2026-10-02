import 'package:flutter/material.dart';

import '../services/commerce.dart';
import '../utils/format.dart';
import '../utils/json.dart';
import 'widgets.dart';

/// 订单详情: 行项目 / 金额 / 操作.
class SdkworkOrderDetailPage extends StatefulWidget {
  const SdkworkOrderDetailPage({super.key, required this.orderId});

  final String orderId;

  @override
  State<SdkworkOrderDetailPage> createState() => _SdkworkOrderDetailPageState();
}

class _SdkworkOrderDetailPageState extends State<SdkworkOrderDetailPage> {
  Map<String, dynamic>? _detail;
  bool _loading = true;
  String _error = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('订单详情')),
      body: _loading
          ? const SdkworkLoadingView(label: '加载订单详情...')
          : _detail == null
              ? SdkworkEmptyView(message: _error.isEmpty ? '订单不存在' : _error)
              : ListView(
                  children: [
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(20),
                      color: Theme.of(context).colorScheme.primaryContainer,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            statusLabel('${_detail!['status']}'),
                            style: Theme.of(context).textTheme.headlineSmall,
                          ),
                          const SizedBox(height: 4),
                          Text('${_detail!['subject'] ?? '订单'}'),
                        ],
                      ),
                    ),
                    const SdkworkSectionHeader(title: '商品清单'),
                    for (final item in asList(_detail!['items']))
                      ListTile(
                        leading: ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: SizedBox(
                            width: 56,
                            height: 56,
                            child: '${item['imageUrl'] ?? ''}'.isEmpty
                                ? const ColoredBox(
                                    color: Color(0xFFF3F4F6),
                                    child: Icon(Icons.image_outlined),
                                  )
                                : Image.network(
                                    '${item['imageUrl']}',
                                    fit: BoxFit.cover,
                                    errorBuilder: (context, error, stackTrace) =>
                                        const Icon(Icons.broken_image_outlined),
                                  ),
                          ),
                        ),
                        title: Text(
                          '${asMap(item['spu'])['title'] ?? item['title'] ?? '商品'}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        subtitle: Text('x${asNum(item, ['quantity']) ?? 1}'),
                        trailing: Text(
                          formatCny(asNum(item, ['priceCny', 'unitPrice'])),
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.primary,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    const SdkworkSectionHeader(title: '订单信息'),
                    _buildMetaRow('订单号', '${_detail!['orderId'] ?? _detail!['id'] ?? widget.orderId}'),
                    _buildMetaRow('下单时间', formatTime('${_detail!['createdAt'] ?? ''}')),
                    _buildMetaRow('订单总额', formatCny(asNum(_detail!, ['totalAmount', 'totalAmountCny']))),
                    _buildMetaRow(
                      '实付金额',
                      asNum(_detail!, ['paidAmount', 'paidAmountCny']) != null
                          ? formatCny(asNum(_detail!, ['paidAmount', 'paidAmountCny']))
                          : '未支付',
                    ),
                    if ('${_detail!['paymentMethod'] ?? ''}'.isNotEmpty)
                      _buildMetaRow('支付方式', '${_detail!['paymentMethod']}'),
                    const SizedBox(height: 16),
                  ],
                ),
      bottomNavigationBar: _detail == null ? null : SafeArea(child: _buildActions()),
    );
  }

  Widget _buildMetaRow(String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 88,
              child: Text(label, style: Theme.of(context).textTheme.bodySmall),
            ),
            Expanded(child: Text(value)),
          ],
        ),
      );

  Widget _buildActions() {
    final status = '${_detail?['status'] ?? ''}'.toUpperCase();
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          if (status == 'PENDING_PAYMENT') ...[
            Expanded(
              child: FilledButton(onPressed: _pay, child: const Text('去支付')),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: OutlinedButton(onPressed: _cancel, child: const Text('取消订单')),
            ),
          ] else if (status == 'PENDING_RECEIPT') ...[
            Expanded(
              child: FilledButton(
                onPressed: _confirmReceipt,
                child: const Text('确认收货'),
              ),
            ),
          ] else ...[
            Expanded(
              child: OutlinedButton(
                onPressed: () => Navigator.of(context).maybePop(),
                child: const Text('返回列表'),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      final detail = await MallCommerce.instance.orders.getOrderDetail(widget.orderId);
      if (!mounted) {
        return;
      }
      setState(() {
        _detail = detail;
        _loading = false;
      });
    } catch (cause) {
      if (!mounted) {
        return;
      }
      setState(() {
        _loading = false;
        _error = '$cause';
      });
    }
  }

  Future<void> _pay() async {
    try {
      final paymentId = await MallCommerce.instance.orders
          .payOrder(widget.orderId, '${_detail?['paymentMethod'] ?? 'WECHAT'}');
      if (!mounted) {
        return;
      }
      Navigator.of(context).pushReplacementNamed(
        '/payment-result',
        arguments: <String, String>{
          'orderId': widget.orderId,
          'paymentId': paymentId,
        },
      );
    } catch (cause) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$cause')));
      }
    }
  }

  Future<void> _cancel() async {
    try {
      await MallCommerce.instance.orders.cancelOrder(widget.orderId);
      await _load();
    } catch (cause) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$cause')));
      }
    }
  }

  Future<void> _confirmReceipt() async {
    try {
      await MallCommerce.instance.orders.confirmReceipt(widget.orderId);
      await _load();
    } catch (cause) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$cause')));
      }
    }
  }
}
