import 'package:flutter/material.dart';

import '../services/commerce.dart';
import '../src/i18n/runtime.dart';
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
      appBar: AppBar(title: Text(SdkworkI18n.t('orderDetail.title'))),
      body: _loading
          ? SdkworkLoadingView(label: SdkworkI18n.t('orderDetail.loading'))
          : _detail == null
              ? SdkworkErrorView(
                  message: _error.isEmpty
                      ? SdkworkI18n.t('orderDetail.notFound')
                      : _error,
                  onRetry: _load,
                )
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
                          Text(
                            '${_detail!['subject'] ?? SdkworkI18n.t('orderDetail.subjectFallback')}',
                          ),
                        ],
                      ),
                    ),
                    SdkworkSectionHeader(
                      title: SdkworkI18n.t('orderDetail.itemsTitle'),
                    ),
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
                          '${asMap(item['spu'])['title'] ?? item['title'] ?? SdkworkI18n.t('orderDetail.itemFallback')}',
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
                    SdkworkSectionHeader(
                      title: SdkworkI18n.t('orderDetail.infoTitle'),
                    ),
                    _buildMetaRow(
                      SdkworkI18n.t('orderDetail.orderNo'),
                      '${_detail!['orderId'] ?? _detail!['id'] ?? widget.orderId}',
                    ),
                    _buildMetaRow(
                      SdkworkI18n.t('orderDetail.createdAt'),
                      formatTime('${_detail!['createdAt'] ?? ''}'),
                    ),
                    _buildMetaRow(
                      SdkworkI18n.t('orderDetail.totalAmount'),
                      formatCny(asNum(_detail!, ['totalAmount', 'totalAmountCny'])),
                    ),
                    _buildMetaRow(
                      SdkworkI18n.t('orderDetail.paidAmount'),
                      asNum(_detail!, ['paidAmount', 'paidAmountCny']) != null
                          ? formatCny(asNum(_detail!, ['paidAmount', 'paidAmountCny']))
                          : SdkworkI18n.t('orderDetail.unpaid'),
                    ),
                    if ('${_detail!['paymentMethod'] ?? ''}'.isNotEmpty)
                      _buildMetaRow(
                        SdkworkI18n.t('orderDetail.paymentMethod'),
                        '${_detail!['paymentMethod']}',
                      ),
                    const SizedBox(height: 16),
                  ],
                ),
      bottomNavigationBar: _detail == null ? null : SafeArea(child: _buildActions()),
    );
  }

  bool get _hasShipments => asList(_detail?['shipmentIds']).isNotEmpty;

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
              child: FilledButton(
                onPressed: _pay,
                child: Text(SdkworkI18n.t('orderDetail.actions.pay')),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: OutlinedButton(
                onPressed: _cancel,
                child: Text(SdkworkI18n.t('orderDetail.actions.cancel')),
              ),
            ),
          ] else if (status == 'PENDING_RECEIPT') ...[
            Expanded(
              child: FilledButton(
                onPressed: _confirmReceipt,
                child: Text(SdkworkI18n.t('orderDetail.actions.confirmReceipt')),
              ),
            ),
          ] else ...[
            if (status == 'PAID' ||
                status == 'PENDING_RECEIPT' ||
                status == 'COMPLETED') ...[
              Expanded(
                child: OutlinedButton(
                  onPressed: _openAfterSales,
                  child: Text(SdkworkI18n.t('orderDetail.actions.afterSales')),
                ),
              ),
              const SizedBox(width: 12),
            ],
            if (_hasShipments &&
                (status == 'PAID' ||
                    status == 'PENDING_RECEIPT' ||
                    status == 'COMPLETED')) ...[
              Expanded(
                child: OutlinedButton(
                  onPressed: _openLogistics,
                  child: Text(SdkworkI18n.t('orderDetail.actions.logistics')),
                ),
              ),
              const SizedBox(width: 12),
            ],
            Expanded(
              child: OutlinedButton(
                onPressed: () => Navigator.of(context).maybePop(),
                child: Text(SdkworkI18n.t('orderDetail.actions.back')),
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
    // The cashier owns the real channel handoff, so every pay entry funnels
    // through the same page.
    if (!mounted) {
      return;
    }
    Navigator.of(context).pushNamed('/cashier', arguments: widget.orderId);
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

  void _openAfterSales() {
    Navigator.of(context).pushNamed('/after-sales', arguments: widget.orderId);
  }

  void _openLogistics() {
    Navigator.of(context).pushNamed('/logistics', arguments: widget.orderId);
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
