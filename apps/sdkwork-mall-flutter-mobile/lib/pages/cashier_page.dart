import 'package:flutter/material.dart';

import '../services/commerce.dart';
import 'widgets.dart';

/// 收银台: 选择支付渠道并发起支付.
class SdkworkCashierPage extends StatefulWidget {
  const SdkworkCashierPage({super.key, required this.orderId});

  final String orderId;

  @override
  State<SdkworkCashierPage> createState() => _SdkworkCashierPageState();
}

class _SdkworkCashierPageState extends State<SdkworkCashierPage> {
  List<Map<String, dynamic>> _methods = const [];
  String _selectedCode = '';
  bool _loading = true;
  bool _paying = false;
  String _error = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('收银台')),
      body: _loading
          ? const SdkworkLoadingView(label: '加载收银台...')
          : ListView(
              children: [
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text('订单号：${widget.orderId}'),
                ),
                if (_error.isNotEmpty) SdkworkErrorView(message: _error),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Text('选择支付方式', style: Theme.of(context).textTheme.titleSmall),
                ),
                RadioGroup<String>(
                  groupValue: _selectedCode,
                  onChanged: (value) => setState(() => _selectedCode = value ?? ''),
                  child: Column(
                    children: [
                      for (final method in _methods)
                        RadioListTile<String>(
                          value: '${method['code']}',
                          title: Text('${method['label']}'),
                        ),
                    ],
                  ),
                ),
                if (_methods.isEmpty)
                  const Padding(
                    padding: EdgeInsets.all(16),
                    child: Text('暂无可用支付渠道，请稍后重试。'),
                  ),
              ],
            ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              FilledButton(
                onPressed: _paying || _selectedCode.isEmpty ? null : _pay,
                child: Text(_paying ? '支付中...' : '立即支付'),
              ),
              TextButton(
                onPressed: () => Navigator.of(context).pushReplacementNamed(
                  '/orders',
                  arguments: 'PENDING_PAYMENT',
                ),
                child: const Text('稍后支付'),
              ),
            ],
          ),
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
      final methods = await MallCommerce.instance.cart.listPaymentMethods();
      if (!mounted) {
        return;
      }
      setState(() {
        _methods = methods;
        _selectedCode = methods.isNotEmpty ? '${methods.first['code']}' : '';
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
    setState(() => _paying = true);
    try {
      final paymentId = await MallCommerce.instance.cart
          .payOrder(widget.orderId, _selectedCode);
      if (!mounted) {
        return;
      }
      // 真实渠道接入后此处调用渠道 SDK 拉起收银台；模拟渠道直接轮询结果。
      Navigator.of(context).pushReplacementNamed(
        '/payment-result',
        arguments: <String, String>{
          'orderId': widget.orderId,
          'paymentId': paymentId,
          'paymentMethod': _selectedCode,
        },
      );
    } catch (cause) {
      if (!mounted) {
        return;
      }
      setState(() => _paying = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$cause')));
    }
  }
}
