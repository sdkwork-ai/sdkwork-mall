import 'package:flutter/material.dart';

import '../services/commerce.dart';
import '../utils/format.dart';
import '../utils/json.dart';
import 'widgets.dart';

/// 确认订单: 地址 / 优惠券 / 抵扣 / 提交.
class SdkworkCheckoutPage extends StatefulWidget {
  const SdkworkCheckoutPage({super.key});

  @override
  State<SdkworkCheckoutPage> createState() => _SdkworkCheckoutPageState();
}

class _SdkworkCheckoutPageState extends State<SdkworkCheckoutPage> {
  List<Map<String, dynamic>> _addresses = const [];
  List<Map<String, dynamic>> _coupons = const [];
  String _selectedAddressId = '';
  String _selectedCouponId = '';
  bool _useWallet = false;
  bool _usePoints = false;
  final TextEditingController _remark = TextEditingController();
  num? _payable;
  int _itemCount = 0;
  bool _loading = true;
  bool _busy = false;
  String _error = '';

  List<String> get _cartItemIds {
    final arguments = ModalRoute.of(context)?.settings.arguments;
    if (arguments is String && arguments.isNotEmpty) {
      return arguments.split(',').where((id) => id.isNotEmpty).toList();
    }
    return const <String>[];
  }

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  @override
  void dispose() {
    _remark.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('确认订单')),
      body: _loading
          ? const SdkworkLoadingView(label: '加载结算信息...')
          : _error.isNotEmpty
              ? SdkworkErrorView(message: _error)
              : ListView(
                  children: [
                    if (_itemCount > 0)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                        child: Text(
                          '已选择 $_itemCount 件购物车商品参与结算',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ),
                    _buildSection(
                      '收货地址',
                      _addresses.isEmpty
                          ? const Text('请先在「我的」中添加收货地址')
                          : RadioGroup<String>(
                              groupValue: _selectedAddressId,
                              onChanged: (value) =>
                                  setState(() => _selectedAddressId = value ?? ''),
                              child: Column(
                                children: _addresses
                                    .map(_buildAddressRow)
                                    .toList(),
                              ),
                            ),
                    ),
                    _buildSection(
                      '优惠券',
                      Column(
                        children: [
                          RadioGroup<String>(
                            groupValue: _selectedCouponId,
                            onChanged: (value) =>
                                setState(() => _selectedCouponId = value ?? ''),
                            child: Column(
                              children: [
                                _buildCouponRow('', '不使用优惠券'),
                                for (final coupon in _coupons)
                                  _buildCouponRow(
                                    '${coupon['id']}',
                                    '${coupon['title']}'
                                    '${coupon['discountAmountCny'] != null ? ' ¥${coupon['discountAmountCny']}' : ''}'
                                    '${(asNum(coupon, ['minSpendCny']) ?? 0) > 0 ? '（满 ¥${coupon['minSpendCny']} 可用）' : '（无门槛）'}',
                                  ),
                              ],
                            ),
                          ),
                          if (_coupons.isEmpty)
                            const Text('暂无可用优惠券，可到领券中心领取。'),
                        ],
                      ),
                    ),
                    _buildSection(
                      '抵扣',
                      Column(
                        children: [
                          SwitchListTile(
                            title: const Text('钱包余额抵扣'),
                            value: _useWallet,
                            onChanged: (value) => setState(() => _useWallet = value),
                            contentPadding: EdgeInsets.zero,
                          ),
                          SwitchListTile(
                            title: const Text('积分抵扣'),
                            value: _usePoints,
                            onChanged: (value) => setState(() => _usePoints = value),
                            contentPadding: EdgeInsets.zero,
                          ),
                        ],
                      ),
                    ),
                    _buildSection(
                      '买家留言',
                      TextField(
                        controller: _remark,
                        maxLength: 200,
                        decoration: const InputDecoration(
                          hintText: '选填，给商家留言',
                          border: OutlineInputBorder(),
                        ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: Row(
                        children: [
                          const Text('应付'),
                          const Spacer(),
                          Text(
                            _payable != null ? formatCny(_payable) : '--',
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.primary,
                              fontWeight: FontWeight.w800,
                              fontSize: 20,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: FilledButton(
            onPressed: _busy ? null : _submit,
            child: Text(_busy ? '提交中...' : '提交订单'),
          ),
        ),
      ),
    );
  }

  Widget _buildSection(String title, Widget child) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: 8),
            child,
          ],
        ),
      );

  Widget _buildAddressRow(Map<String, dynamic> address) {
    final addressId = '${address['id']}';
    return RadioListTile<String>(
      value: addressId,
      title: Text.rich(
        TextSpan(
          text: '${address['receiverName']} ${address['receiverPhone']}',
          children: [
            if (address['isDefault'] == true)
              const TextSpan(
                text: '  默认',
                style: TextStyle(color: Color(0xFFE93B3D), fontSize: 12),
              ),
          ],
        ),
        style: const TextStyle(fontSize: 14),
      ),
      subtitle: Text('${address['addressLine']}'),
      contentPadding: EdgeInsets.zero,
    );
  }

  Widget _buildCouponRow(String couponId, String label) => RadioListTile<String>(
        value: couponId,
        title: Text(label, style: const TextStyle(fontSize: 14)),
        contentPadding: EdgeInsets.zero,
        dense: true,
      );

  Future<void> _bootstrap() async {
    setState(() {
      _loading = true;
      _error = '';
    });
    final commerce = MallCommerce.instance;
    try {
      final cartItemIds = _cartItemIds;
      _itemCount = cartItemIds.length;
      final addresses = await commerce.addresses
          .listAddresses()
          .catchError((_) => <Map<String, dynamic>>[]);
      final coupons = await commerce.cart
          .listUserCoupons()
          .catchError((_) => <Map<String, dynamic>>[]);
      num? payable;
      try {
        final quote = await commerce.cart.createCheckoutQuote(
          cartItemIds: cartItemIds,
        );
        payable = quote['payableAmountCny'] as num?;
      } catch (_) {
        // 报价失败不阻塞结算，提交时再校验。
      }
      if (!mounted) {
        return;
      }
      final fallback = addresses.isNotEmpty
          ? addresses.firstWhere(
              (address) => address['isDefault'] == true,
              orElse: () => addresses.first,
            )
          : null;
      setState(() {
        _addresses = addresses;
        _coupons = coupons;
        _payable = payable;
        _selectedAddressId = fallback == null ? '' : '${fallback['id']}';
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

  Future<void> _submit() async {
    if (_selectedAddressId.isEmpty) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('请选择收货地址')));
      return;
    }
    setState(() => _busy = true);
    try {
      final orderId = await MallCommerce.instance.cart.submitOrder(
        addressId: _selectedAddressId,
        cartItemIds: _cartItemIds,
        couponId: _selectedCouponId.isEmpty ? null : _selectedCouponId,
        buyerRemark: _remark.text.trim().isEmpty ? null : _remark.text.trim(),
        useWallet: _useWallet,
        usePoints: _usePoints,
      );
      if (!mounted) {
        return;
      }
      Navigator.of(context)
          .pushReplacementNamed('/cashier', arguments: orderId);
    } catch (cause) {
      if (!mounted) {
        return;
      }
      setState(() => _busy = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$cause')));
    }
  }
}
