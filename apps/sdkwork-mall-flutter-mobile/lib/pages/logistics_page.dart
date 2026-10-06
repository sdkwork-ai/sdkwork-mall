import 'package:flutter/material.dart';

import '../services/commerce.dart';
import '../services/order_service.dart';
import '../utils/format.dart';
import 'widgets.dart';

/// 物流跟踪: 运单头 + 包裹 + 时间线轨迹（对齐 H5 `/buyer/logistics`）.
class SdkworkLogisticsPage extends StatefulWidget {
  const SdkworkLogisticsPage({super.key, this.orderId, this.shipmentId});

  final String? orderId;
  final String? shipmentId;

  @override
  State<SdkworkLogisticsPage> createState() => _SdkworkLogisticsPageState();
}

class _SdkworkLogisticsPageState extends State<SdkworkLogisticsPage> {
  List<ShipmentLogistics> _shipments = const <ShipmentLogistics>[];
  bool _loading = true;
  bool _missingOrder = false;
  String _error = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('物流跟踪')),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const SdkworkLoadingView(label: '加载物流...');
    }
    if (_missingOrder) {
      return const SdkworkEmptyView(message: '缺少订单参数，请从订单列表进入。');
    }
    if (_error.isNotEmpty) {
      return SdkworkErrorView(message: _error, onRetry: _load);
    }
    if (_shipments.isEmpty) {
      return const SdkworkEmptyView(message: '商家尚未发货，发货后可在此查看物流轨迹。');
    }
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Center(
          child: TextButton(
            onPressed: () => Navigator.of(context).maybePop(),
            child: const Text('返回订单列表'),
          ),
        ),
        for (final shipment in _shipments) _buildShipmentCard(shipment),
      ],
    );
  }

  Widget _buildShipmentCard(ShipmentLogistics shipment) {
    final header = <String>[
      if (shipment.carrier.isNotEmpty) shipment.carrier,
      if (shipment.statusLabel.isNotEmpty) shipment.statusLabel,
    ].join(' · ');
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              shipment.shipmentNo.isNotEmpty ? '运单号：${shipment.shipmentNo}' : shipment.shipmentId,
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
            if (header.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(header, style: Theme.of(context).textTheme.bodySmall),
              ),
            if (shipment.packages.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  '包裹：${shipment.packages.join('、')}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
            if (shipment.trackingEvents.isEmpty)
              const Padding(
                padding: EdgeInsets.only(top: 12),
                child: SdkworkEmptyView(message: '暂无轨迹'),
              )
            else
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Column(
                  children: <Widget>[
                    for (var index = 0; index < shipment.trackingEvents.length; index += 1)
                      _buildTimelineTile(shipment.trackingEvents[index], index == 0),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildTimelineTile(ShipmentTrackingEvent event, bool latest) {
    final color = latest ? const Color(0xFFE93B3D) : const Color(0xFFD1D5DB);
    final meta = <String>[
      if (event.status.isNotEmpty) event.status,
      if (event.occurredAt.isNotEmpty) formatTime(event.occurredAt),
    ].join(' · ');
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 24,
            child: Column(
              children: [
                Container(
                  width: 10,
                  height: 10,
                  margin: const EdgeInsets.only(top: 6),
                  decoration: BoxDecoration(
                    color: color,
                    shape: BoxShape.circle,
                    boxShadow: latest
                        ? <BoxShadow>[
                            BoxShadow(
                              color: const Color(0xFFE93B3D).withAlpha(31),
                              blurRadius: 0,
                              spreadRadius: 4,
                            ),
                          ]
                        : null,
                  ),
                ),
                Expanded(
                  child: Center(
                    child: Container(width: 1.5, color: const Color(0xFFE5E7EB)),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    event.description,
                    style: TextStyle(
                      fontWeight: latest ? FontWeight.w700 : FontWeight.w400,
                      fontSize: 14,
                    ),
                  ),
                  if (meta.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(meta, style: Theme.of(context).textTheme.bodySmall),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = '';
      _missingOrder = false;
    });
    try {
      final shipments = await MallCommerce.instance.orders.getOrderLogistics(
        orderId: widget.orderId,
        shipmentId: widget.shipmentId,
      );
      if (!mounted) {
        return;
      }
      setState(() {
        _shipments = shipments;
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
}
