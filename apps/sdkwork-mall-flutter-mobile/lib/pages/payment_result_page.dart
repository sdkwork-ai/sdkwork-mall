import 'dart:async';

import 'package:flutter/material.dart';

import '../services/commerce.dart';

/// 支付结果: 轮询支付成功状态.
class SdkworkPaymentResultPage extends StatefulWidget {
  const SdkworkPaymentResultPage({super.key, required this.arguments});

  final Map<String, String> arguments;

  @override
  State<SdkworkPaymentResultPage> createState() =>
      _SdkworkPaymentResultPageState();
}

class _SdkworkPaymentResultPageState extends State<SdkworkPaymentResultPage> {
  String _status = 'pending';
  bool _loading = true;
  Timer? _pollTimer;

  String get _orderId => widget.arguments['orderId'] ?? '';

  @override
  void initState() {
    super.initState();
    _poll();
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final paid = _status == 'success';
    final failed = _status == 'failed';
    final color = paid
        ? const Color(0xFF16A34A)
        : failed
            ? const Color(0xFFDC2626)
            : const Color(0xFFD97706);
    final background = paid
        ? const Color(0xFFF0FDF4)
        : failed
            ? const Color(0xFFFEF2F2)
            : const Color(0xFFFFFBEB);
    return Scaffold(
      appBar: AppBar(title: const Text('支付结果')),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Container(
            padding: const EdgeInsets.all(32),
            decoration: BoxDecoration(
              color: background,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Column(
              children: [
                Text(
                  paid ? '支付成功' : failed ? '支付失败' : '支付处理中',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                    color: color,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  paid
                      ? '商家将尽快为您发货。'
                      : failed
                          ? '支付未成功，可重新支付。'
                          : '支付正在处理，请稍候...',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: 8),
                if (_orderId.isNotEmpty) Text('订单号：$_orderId'),
                if (widget.arguments['paymentId']?.isNotEmpty ?? false)
                  Text('支付单号：${widget.arguments['paymentId']}'),
                if (_loading) const Padding(
                  padding: EdgeInsets.only(top: 12),
                  child: CircularProgressIndicator(),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          FilledButton(
            onPressed: () => Navigator.of(context).pushReplacementNamed('/orders'),
            child: const Text('查看订单'),
          ),
          const SizedBox(height: 12),
          OutlinedButton(
            onPressed: () => Navigator.of(context).popUntil((route) => route.isFirst),
            child: const Text('继续购物'),
          ),
        ],
      ),
    );
  }

  Future<void> _poll() async {
    if (_orderId.isEmpty) {
      setState(() => _loading = false);
      return;
    }
    final info = await MallCommerce.instance.orders.getPaymentSuccess(_orderId);
    if (!mounted) {
      return;
    }
    if (info != null &&
        (info['paid'] == true ||
            '${info['status'] ?? ''}'.toUpperCase() == 'PAID' ||
            '${info['status'] ?? ''}'.toUpperCase() == 'COMPLETED')) {
      setState(() {
        _status = 'success';
        _loading = false;
      });
      return;
    }
    setState(() => _loading = false);
    _pollTimer = Timer(const Duration(seconds: 3), _poll);
  }
}
