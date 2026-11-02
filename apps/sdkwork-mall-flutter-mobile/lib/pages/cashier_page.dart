import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../services/commerce.dart';
import '../src/i18n/runtime.dart';
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
      appBar: AppBar(title: Text(SdkworkI18n.t('cashier.title'))),
      body: _loading
          ? SdkworkLoadingView(label: SdkworkI18n.t('cashier.loading'))
          : ListView(
              children: [
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(
                    SdkworkI18n.t(
                      'cashier.orderNo',
                      params: <String, String>{'id': widget.orderId},
                    ),
                  ),
                ),
                if (_error.isNotEmpty) SdkworkErrorView(message: _error, onRetry: _load),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Text(
                    SdkworkI18n.t('cashier.methodsTitle'),
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
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
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Text(SdkworkI18n.t('cashier.methodsEmpty')),
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
                child: Text(
                  _paying
                      ? SdkworkI18n.t('cashier.paying')
                      : SdkworkI18n.t('cashier.pay'),
                ),
              ),
              TextButton(
                onPressed: () => Navigator.of(context).pushReplacementNamed(
                  '/orders',
                  arguments: 'PENDING_PAYMENT',
                ),
                child: Text(SdkworkI18n.t('cashier.later')),
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
      final payment = await MallCommerce.instance.cart
          .payOrder(widget.orderId, _selectedCode);
      if (payment.paymentUrl.isNotEmpty && mounted) {
        // Flutter cannot host the channel SDK, so the buyer finishes the
        // charge in a browser: show the link and copy it on request.
        await _showCashierLink(payment.paymentUrl);
      }
      if (!mounted) {
        return;
      }
      Navigator.of(context).pushReplacementNamed(
        '/payment-result',
        arguments: <String, String>{
          'orderId': widget.orderId,
          'paymentId': payment.paymentId,
          'paymentMethod': _selectedCode,
        },
      );
    } catch (cause) {
      if (!mounted) {
        return;
      }
      setState(() => _paying = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(SdkworkI18n.t('cashier.errors.payFailed'))),
      );
    }
  }

  Future<void> _showCashierLink(String paymentUrl) async {
    await showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(SdkworkI18n.t('cashier.linkTitle')),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(SdkworkI18n.t('cashier.linkHint')),
            const SizedBox(height: 12),
            SelectableText(paymentUrl),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () async {
              await Clipboard.setData(ClipboardData(text: paymentUrl));
              if (!dialogContext.mounted) {
                return;
              }
              ScaffoldMessenger.of(dialogContext).showSnackBar(
                SnackBar(content: Text(SdkworkI18n.t('cashier.copied'))),
              );
            },
            child: Text(SdkworkI18n.t('cashier.copy')),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: Text(SdkworkI18n.t('cashier.pay')),
          ),
        ],
      ),
    );
  }
}
