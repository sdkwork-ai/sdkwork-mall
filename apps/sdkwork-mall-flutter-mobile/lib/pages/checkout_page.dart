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
  final TextEditingController _invoiceTitle = TextEditingController();
  final TextEditingController _invoiceTaxNumber = TextEditingController();
  final TextEditingController _invoiceEmail = TextEditingController();
  bool _needInvoice = false;
  String _invoiceTitleType = 'personal';
  String _deliveryMethod = 'standard';
  final TextEditingController _giftCardCode = TextEditingController();
  String _giftCardApplied = '';
  String _giftCardError = '';

  /// 配送方式；运费由服务端按选择计入报价。
  static const List<Map<String, String>> _deliveryMethods = [
    {'code': 'standard', 'label': '普通配送', 'description': '3-5 天送达 · 免费'},
    {'code': 'express', 'label': '极速达', 'description': '次日送达 · ¥12.00'},
    {'code': 'sf', 'label': '顺丰速运', 'description': '当日达 · ¥22.00'},
  ];
  num? _payable;
  num? _originalAmount;
  num? _discountAmount;
  String _quoteError = '';
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
    _invoiceTitle.dispose();
    _invoiceTaxNumber.dispose();
    _invoiceEmail.dispose();
    _giftCardCode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('确认订单')),
      body: _loading
          ? const SdkworkLoadingView(label: '加载结算信息...')
          : _error.isNotEmpty
              ? SdkworkErrorView(message: _error, onRetry: _bootstrap)
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
                      '配送方式',
                      RadioGroup<String>(
                        groupValue: _deliveryMethod,
                        onChanged: (value) => setState(
                          () => _deliveryMethod = value ?? 'standard',
                        ),
                        child: Column(
                          children: [
                            for (final method in _deliveryMethods)
                              RadioListTile<String>(
                                value: method['code']!,
                                title: Text(method['label']!),
                                subtitle: Text(method['description']!),
                                contentPadding: EdgeInsets.zero,
                              ),
                          ],
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
                      '礼品卡',
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (_giftCardApplied.isNotEmpty)
                            Row(
                              children: [
                                Expanded(child: Text('已使用礼品卡 $_giftCardApplied')),
                                TextButton(
                                  onPressed: () => setState(() {
                                    _giftCardApplied = '';
                                    _giftCardCode.clear();
                                    _giftCardError = '';
                                  }),
                                  child: const Text('移除'),
                                ),
                              ],
                            )
                          else
                            Row(
                              children: [
                                Expanded(
                                  child: TextField(
                                    controller: _giftCardCode,
                                    decoration: const InputDecoration(
                                      hintText: '输入礼品卡卡号',
                                      border: OutlineInputBorder(),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                OutlinedButton(
                                  onPressed: _applyGiftCard,
                                  child: const Text('使用'),
                                ),
                              ],
                            ),
                          if (_giftCardError.isNotEmpty)
                            Padding(
                              padding: const EdgeInsets.only(top: 8),
                              child: Text(
                                _giftCardError,
                                style: TextStyle(
                                  color: Theme.of(context).colorScheme.error,
                                  fontSize: 12,
                                ),
                              ),
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
                    _buildSection(
                      '发票',
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          SwitchListTile(
                            title: const Text('需要开具发票'),
                            value: _needInvoice,
                            onChanged: (value) => setState(() => _needInvoice = value),
                            contentPadding: EdgeInsets.zero,
                          ),
                          if (_needInvoice) ...[
                            Row(
                              children: [
                                ChoiceChip(
                                  label: const Text('个人'),
                                  selected: _invoiceTitleType == 'personal',
                                  onSelected: (_) => setState(
                                    () => _invoiceTitleType = 'personal',
                                  ),
                                ),
                                const SizedBox(width: 8),
                                ChoiceChip(
                                  label: const Text('企业'),
                                  selected: _invoiceTitleType == 'company',
                                  onSelected: (_) => setState(
                                    () => _invoiceTitleType = 'company',
                                  ),
                                ),
                              ],
                            ),
                            TextField(
                              controller: _invoiceTitle,
                              decoration: const InputDecoration(
                                labelText: '发票抬头',
                                border: OutlineInputBorder(),
                              ),
                            ),
                            if (_invoiceTitleType == 'company') ...[
                              const SizedBox(height: 8),
                              TextField(
                                controller: _invoiceTaxNumber,
                                decoration: const InputDecoration(
                                  labelText: '税号',
                                  hintText: '15-20 位字母或数字',
                                  border: OutlineInputBorder(),
                                ),
                              ),
                            ],
                            const SizedBox(height: 8),
                            TextField(
                              controller: _invoiceEmail,
                              keyboardType: TextInputType.emailAddress,
                              decoration: const InputDecoration(
                                labelText: '接收邮箱（选填）',
                                hintText: '用于接收电子发票',
                                border: OutlineInputBorder(),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        children: [
                          if (_originalAmount != null)
                            Row(
                              children: [
                                const Text('商品金额'),
                                const Spacer(),
                                Text(formatCny(_originalAmount)),
                              ],
                            ),
                          if (_discountAmount != null && _discountAmount! > 0)
                            Row(
                              children: [
                                const Text('优惠'),
                                const Spacer(),
                                Text('-${formatCny(_discountAmount)}'),
                              ],
                            ),
                          Row(
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
                          if (_quoteError.isNotEmpty)
                            Padding(
                              padding: const EdgeInsets.only(top: 8),
                              child: SdkworkInlineError(
                                message: _quoteError,
                                onRetry: _bootstrap,
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
      num? original;
      num? discount;
      num? payable;
      String quoteError = '';
      try {
        final quote = await commerce.cart.createCheckoutQuote(
          cartItemIds: cartItemIds,
        );
        original = quote['originalAmountCny'] as num?;
        discount = quote['discountAmountCny'] as num?;
        payable = quote['payableAmountCny'] as num?;
      } catch (cause) {
        // 报价是应付金额的唯一权威来源: 失败必须可见并阻止提交,
        // 不能让买家在金额未知的情况下下单。
        quoteError = '$cause';
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
        _originalAmount = original;
        _discountAmount = discount;
        _quoteError = quoteError;
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

  void _applyGiftCard() {
    final code = _giftCardCode.text.trim();
    if (code.isEmpty) {
      setState(() => _giftCardError = '请输入礼品卡卡号');
      return;
    }
    if (code.length < 8) {
      setState(() => _giftCardError = '礼品卡卡号格式不正确');
      return;
    }
    setState(() {
      _giftCardApplied = code;
      _giftCardCode.clear();
      _giftCardError = '';
    });
  }

  Future<void> _submit() async {
    if (_selectedAddressId.isEmpty) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('请选择收货地址')));
      return;
    }
    if (_quoteError.isNotEmpty) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('应付金额未就绪，请重试')));
      return;
    }
    if (_needInvoice) {
      final title = _invoiceTitle.text.trim();
      if (title.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              _invoiceTitleType == 'company' ? '请填写发票抬头（公司名称）' : '请填写发票抬头（个人姓名）',
            ),
          ),
        );
        return;
      }
      if (_invoiceTitleType == 'company') {
        final taxNumber = _invoiceTaxNumber.text.trim();
        if (taxNumber.isEmpty) {
          ScaffoldMessenger.of(context)
              .showSnackBar(const SnackBar(content: Text('请填写企业税号')));
          return;
        }
        if (!RegExp(r'^[A-Z0-9]{15,20}$').hasMatch(taxNumber)) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('税号格式不正确（15-20 位字母或数字）')),
          );
          return;
        }
      }
    }
    setState(() => _busy = true);
    try {
      final orderId = await MallCommerce.instance.cart.submitOrder(
        addressId: _selectedAddressId,
        cartItemIds: _cartItemIds,
        couponId: _selectedCouponId.isEmpty ? null : _selectedCouponId,
        buyerRemark: _remark.text.trim().isEmpty ? null : _remark.text.trim(),
        deliveryMethod: _deliveryMethod,
        giftCardCode: _giftCardApplied.isEmpty ? null : _giftCardApplied,
        invoiceForm: _needInvoice
            ? <String, dynamic>{
                'titleType': _invoiceTitleType,
                'title': _invoiceTitle.text.trim(),
                if (_invoiceTitleType == 'company')
                  'taxNumber': _invoiceTaxNumber.text.trim(),
                if (_invoiceEmail.text.trim().isNotEmpty)
                  'email': _invoiceEmail.text.trim(),
              }
            : null,
        needInvoice: _needInvoice,
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
