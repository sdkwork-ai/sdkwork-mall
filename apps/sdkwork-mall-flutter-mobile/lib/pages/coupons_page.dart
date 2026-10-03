import 'package:flutter/material.dart';

import '../services/commerce.dart';
import 'widgets.dart';

/// 领券中心: 可领取 / 兑换码 / 我的优惠券.
class SdkworkCouponsPage extends StatefulWidget {
  const SdkworkCouponsPage({super.key});

  @override
  State<SdkworkCouponsPage> createState() => _SdkworkCouponsPageState();
}

class _SdkworkCouponsPageState extends State<SdkworkCouponsPage> {
  List<Map<String, dynamic>> _claimable = const [];
  List<Map<String, dynamic>> _mine = const [];
  final TextEditingController _code = TextEditingController();
  bool _loading = true;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('领券中心')),
      body: _loading
          ? const SdkworkLoadingView(label: '加载优惠券...')
          : ListView(
              padding: const EdgeInsets.symmetric(vertical: 12),
              children: [
                if (_claimable.isNotEmpty) ...[
                  const SdkworkSectionHeader(title: '可领取'),
                  for (final offer in _claimable)
                    Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      child: ListTile(
                        title: Text('${offer['title']}'),
                        subtitle: '${offer['discountText'] ?? ''}'.isEmpty
                            ? null
                            : Text('${offer['discountText']}'),
                        trailing: FilledButton(
                          onPressed: _busy ? null : () => _claim('${offer['id']}'),
                          child: const Text('领取'),
                        ),
                      ),
                    ),
                ],
                const SdkworkSectionHeader(title: '兑换码'),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _code,
                        decoration: const InputDecoration(
                          hintText: '输入兑换码',
                          border: OutlineInputBorder(),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    OutlinedButton(
                      onPressed: _busy ? null : _redeem,
                      child: const Text('兑换'),
                    ),
                  ],
                ),
                const SdkworkSectionHeader(title: '我的优惠券'),
                if (_mine.isEmpty)
                  const SdkworkEmptyView(message: '暂无优惠券')
                else
                  for (final coupon in _mine)
                    Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      color: const Color(0xFFFFFBEB),
                      child: ListTile(
                        title: Text('${coupon['title']}'),
                        subtitle: '${coupon['validUntil'] ?? ''}'.isEmpty
                            ? null
                            : Text('有效期至 ${coupon['validUntil']}'),
                        trailing: coupon['discountAmountCny'] == null
                            ? null
                            : Text(
                                '¥${coupon['discountAmountCny']}',
                                style: TextStyle(
                                  color: Theme.of(context).colorScheme.primary,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                      ),
                    ),
              ],
            ),
    );
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final commerce = MallCommerce.instance;
    final offers = await commerce.promotions
        .listOffers()
        .catchError((_) => <Map<String, dynamic>>[]);
    final coupons = await commerce.cart
        .listUserCoupons()
        .catchError((_) => <Map<String, dynamic>>[]);
    if (!mounted) {
      return;
    }
    setState(() {
      _claimable = offers
          .where((offer) => offer['claimable'] == true)
          .toList();
      _mine = coupons;
      _loading = false;
    });
  }

  Future<void> _claim(String offerId) async {
    setState(() => _busy = true);
    try {
      await MallCommerce.instance.promotions.claimCoupon(offerId);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('领取成功')));
      }
      await _load();
    } catch (cause) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$cause')));
      }
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  Future<void> _redeem() async {
    final code = _code.text.trim();
    if (code.isEmpty) {
      return;
    }
    setState(() => _busy = true);
    try {
      await MallCommerce.instance.promotions.redeemCouponCode(code);
      _code.clear();
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('兑换成功')));
      }
      await _load();
    } catch (cause) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$cause')));
      }
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }
}
