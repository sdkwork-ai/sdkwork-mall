import 'package:flutter/material.dart';

import '../services/commerce.dart';
import '../src/i18n/runtime.dart';
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
    {
      'code': 'standard',
      'labelKey': 'checkout.delivery.standard.label',
      'descriptionKey': 'checkout.delivery.standard.description',
    },
    {
      'code': 'express',
      'labelKey': 'checkout.delivery.express.label',
      'descriptionKey': 'checkout.delivery.express.description',
    },
    {
      'code': 'sf',
      'labelKey': 'checkout.delivery.sf.label',
      'descriptionKey': 'checkout.delivery.sf.description',
    },
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
      appBar: AppBar(title: Text(SdkworkI18n.t('checkout.title'))),
      body: _loading
          ? SdkworkLoadingView(label: SdkworkI18n.t('checkout.loading'))
          : _error.isNotEmpty
              ? SdkworkErrorView(message: _error, onRetry: _bootstrap)
              : ListView(
                  children: [
                    if (_itemCount > 0)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                        child: Text(
                          SdkworkI18n.t(
                            'checkout.selectedCount',
                            params: <String, String>{'count': '$_itemCount'},
                          ),
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ),
                    _buildSection(
                      SdkworkI18n.t('checkout.address.title'),
                      _addresses.isEmpty
                          ? Text(SdkworkI18n.t('checkout.address.empty'))
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
                      SdkworkI18n.t('checkout.delivery.title'),
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
                                title: Text(
                                  SdkworkI18n.t(method['labelKey']!),
                                ),
                                subtitle: Text(
                                  SdkworkI18n.t(method['descriptionKey']!),
                                ),
                                contentPadding: EdgeInsets.zero,
                              ),
                          ],
                        ),
                      ),
                    ),
                    _buildSection(
                      SdkworkI18n.t('checkout.coupon.title'),
                      Column(
                        children: [
                          RadioGroup<String>(
                            groupValue: _selectedCouponId,
                            onChanged: (value) =>
                                setState(() => _selectedCouponId = value ?? ''),
                            child: Column(
                              children: [
                                _buildCouponRow(
                                  '',
                                  SdkworkI18n.t('checkout.coupon.none'),
                                ),
                                for (final coupon in _coupons)
                                  _buildCouponRow(
                                    '${coupon['id']}',
                                    '${coupon['title']}'
                                    '${coupon['discountAmountCny'] != null ? ' ¥${coupon['discountAmountCny']}' : ''}'
                                    '${(asNum(coupon, ['minSpendCny']) ?? 0) > 0 ? SdkworkI18n.t('checkout.coupon.minSpend', params: <String, String>{'amount': '${coupon['minSpendCny']}'}) : SdkworkI18n.t('checkout.coupon.noThreshold')}',
                                  ),
                              ],
                            ),
                          ),
                          if (_coupons.isEmpty)
                            Text(SdkworkI18n.t('checkout.coupon.empty')),
                        ],
                      ),
                    ),
                    _buildSection(
                      SdkworkI18n.t('checkout.deduct.title'),
                      Column(
                        children: [
                          SwitchListTile(
                            title: Text(SdkworkI18n.t('checkout.deduct.wallet')),
                            value: _useWallet,
                            onChanged: (value) => setState(() => _useWallet = value),
                            contentPadding: EdgeInsets.zero,
                          ),
                          SwitchListTile(
                            title: Text(SdkworkI18n.t('checkout.deduct.points')),
                            value: _usePoints,
                            onChanged: (value) => setState(() => _usePoints = value),
                            contentPadding: EdgeInsets.zero,
                          ),
                        ],
                      ),
                    ),
                    _buildSection(
                      SdkworkI18n.t('checkout.giftCard.title'),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (_giftCardApplied.isNotEmpty)
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    SdkworkI18n.t(
                                      'checkout.giftCard.applied',
                                      params: <String, String>{
                                        'code': _giftCardApplied,
                                      },
                                    ),
                                  ),
                                ),
                                TextButton(
                                  onPressed: () => setState(() {
                                    _giftCardApplied = '';
                                    _giftCardCode.clear();
                                    _giftCardError = '';
                                  }),
                                  child: Text(
                                    SdkworkI18n.t('checkout.giftCard.remove'),
                                  ),
                                ),
                              ],
                            )
                          else
                            Row(
                              children: [
                                Expanded(
                                  child: TextField(
                                    controller: _giftCardCode,
                                    decoration: InputDecoration(
                                      hintText: SdkworkI18n.t(
                                        'checkout.giftCard.placeholder',
                                      ),
                                      border: const OutlineInputBorder(),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                OutlinedButton(
                                  onPressed: _applyGiftCard,
                                  child: Text(
                                    SdkworkI18n.t('checkout.giftCard.apply'),
                                  ),
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
                      SdkworkI18n.t('checkout.remark.title'),
                      TextField(
                        controller: _remark,
                        maxLength: 200,
                        decoration: InputDecoration(
                          hintText: SdkworkI18n.t('checkout.remark.placeholder'),
                          border: const OutlineInputBorder(),
                        ),
                      ),
                    ),
                    _buildSection(
                      SdkworkI18n.t('checkout.invoice.title'),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          SwitchListTile(
                            title: Text(SdkworkI18n.t('checkout.invoice.need')),
                            value: _needInvoice,
                            onChanged: (value) => setState(() => _needInvoice = value),
                            contentPadding: EdgeInsets.zero,
                          ),
                          if (_needInvoice) ...[
                            Row(
                              children: [
                                ChoiceChip(
                                  label: Text(
                                    SdkworkI18n.t('checkout.invoice.personal'),
                                  ),
                                  selected: _invoiceTitleType == 'personal',
                                  onSelected: (_) => setState(
                                    () => _invoiceTitleType = 'personal',
                                  ),
                                ),
                                const SizedBox(width: 8),
                                ChoiceChip(
                                  label: Text(
                                    SdkworkI18n.t('checkout.invoice.company'),
                                  ),
                                  selected: _invoiceTitleType == 'company',
                                  onSelected: (_) => setState(
                                    () => _invoiceTitleType = 'company',
                                  ),
                                ),
                              ],
                            ),
                            TextField(
                              controller: _invoiceTitle,
                              decoration: InputDecoration(
                                labelText: SdkworkI18n.t(
                                  'checkout.invoice.titleLabel',
                                ),
                                border: const OutlineInputBorder(),
                              ),
                            ),
                            if (_invoiceTitleType == 'company') ...[
                              const SizedBox(height: 8),
                              TextField(
                                controller: _invoiceTaxNumber,
                                decoration: InputDecoration(
                                  labelText: SdkworkI18n.t(
                                    'checkout.invoice.taxNumberLabel',
                                  ),
                                  hintText: SdkworkI18n.t(
                                    'checkout.invoice.taxHint',
                                  ),
                                  border: const OutlineInputBorder(),
                                ),
                              ),
                            ],
                            const SizedBox(height: 8),
                            TextField(
                              controller: _invoiceEmail,
                              keyboardType: TextInputType.emailAddress,
                              decoration: InputDecoration(
                                labelText: SdkworkI18n.t(
                                  'checkout.invoice.emailLabel',
                                ),
                                hintText: SdkworkI18n.t(
                                  'checkout.invoice.emailHint',
                                ),
                                border: const OutlineInputBorder(),
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
                                Text(SdkworkI18n.t('checkout.summary.goods')),
                                const Spacer(),
                                Text(formatCny(_originalAmount)),
                              ],
                            ),
                          if (_discountAmount != null && _discountAmount! > 0)
                            Row(
                              children: [
                                Text(SdkworkI18n.t('checkout.summary.discount')),
                                const Spacer(),
                                Text('-${formatCny(_discountAmount)}'),
                              ],
                            ),
                          Row(
                            children: [
                              Text(SdkworkI18n.t('checkout.summary.payable')),
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
            child: Text(
              _busy
                  ? SdkworkI18n.t('checkout.submitting')
                  : SdkworkI18n.t('checkout.submit'),
            ),
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
              TextSpan(
                text: '  ${SdkworkI18n.t('checkout.address.default')}',
                style: const TextStyle(color: Color(0xFFE93B3D), fontSize: 12),
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
      setState(() => _giftCardError = SdkworkI18n.t('checkout.giftCard.required'));
      return;
    }
    if (code.length < 8) {
      setState(() => _giftCardError = SdkworkI18n.t('checkout.giftCard.invalid'));
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
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(SdkworkI18n.t('checkout.errors.addressRequired'))),
      );
      return;
    }
    if (_quoteError.isNotEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(SdkworkI18n.t('checkout.errors.quoteNotReady'))),
      );
      return;
    }
    if (_needInvoice) {
      final title = _invoiceTitle.text.trim();
      if (title.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
                _invoiceTitleType == 'company'
                  ? SdkworkI18n.t('checkout.invoice.titleRequiredCompany')
                  : SdkworkI18n.t('checkout.invoice.titleRequiredPersonal'),
            ),
          ),
        );
        return;
      }
      if (_invoiceTitleType == 'company') {
        final taxNumber = _invoiceTaxNumber.text.trim();
        if (taxNumber.isEmpty) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(SdkworkI18n.t('checkout.invoice.taxRequired'))),
          );
          return;
        }
        if (!RegExp(r'^[A-Z0-9]{15,20}$').hasMatch(taxNumber)) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(SdkworkI18n.t('checkout.invoice.taxInvalid'))),
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
