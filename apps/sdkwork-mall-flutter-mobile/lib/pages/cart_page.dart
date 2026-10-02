import 'package:flutter/material.dart';

import '../bootstrap/session.dart';
import '../services/commerce.dart';
import '../utils/format.dart';
import '../utils/json.dart';

/// 购物车: 店铺分组 / 勾选 / 数量 / 合计 / 去结算.
class SdkworkCartPage extends StatefulWidget {
  const SdkworkCartPage({super.key});

  @override
  State<SdkworkCartPage> createState() => _SdkworkCartPageState();
}

class _CartGroup {
  _CartGroup(this.shopId, this.shopName);

  final String shopId;
  final String shopName;
  final List<Map<String, dynamic>> items = <Map<String, dynamic>>[];
}

class _SdkworkCartPageState extends State<SdkworkCartPage> {
  List<_CartGroup> _groups = const [];
  Set<String> _selected = <String>{};
  bool _loading = true;
  String _error = '';

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  @override
  Widget build(BuildContext context) {
    if (!SdkworkSession.instance.isLoggedIn) {
      return _buildLoginRequired();
    }
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error.isNotEmpty) {
      return Center(child: Text(_error));
    }
    if (_groups.isEmpty) {
      return const Center(child: Text('购物车还是空的'));
    }

    var selectedTotal = 0.0;
    var selectedCount = 0;
    for (final group in _groups) {
      for (final item in group.items) {
        if (_selected.contains('${item['id']}')) {
          selectedTotal += (asNum(item, ['unitPrice', 'priceCny']) ?? 0) * ((asNum(item, ['quantity']) ?? 1).toInt());
          selectedCount += 1;
        }
      }
    }
    final allIds = _groups.expand((group) => group.items.map((item) => '${item['id']}')).toSet();
    final allSelected = allIds.isNotEmpty && allIds.every(_selected.contains);

    return Column(
      children: [
        Expanded(
          child: RefreshIndicator(
            onRefresh: _refresh,
            child: ListView(
              children: [
                CheckboxListTile(
                  value: allSelected,
                  title: const Text('全选'),
                  onChanged: (value) => setState(() {
                    _selected = value == true ? Set<String>.of(allIds) : <String>{};
                  }),
                ),
                for (final group in _groups) _buildGroup(group),
                const SizedBox(height: 16),
              ],
            ),
          ),
        ),
        SafeArea(
          child: Container(
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.surface,
              border: Border(top: BorderSide(color: Theme.of(context).dividerColor)),
            ),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Row(
              children: [
                Text(
                  '合计：',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                Text(
                  formatCny(selectedTotal),
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.primary,
                    fontWeight: FontWeight.w800,
                    fontSize: 18,
                  ),
                ),
                const Spacer(),
                FilledButton(
                  onPressed: selectedCount == 0 ? null : _goCheckout,
                  child: Text('去结算($selectedCount)'),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildLoginRequired() => Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text('登录后同步购物车'),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: () => Navigator.of(context).pushNamed('/login'),
              child: const Text('去登录'),
            ),
          ],
        ),
      );

  Widget _buildGroup(_CartGroup group) {
    final groupIds = group.items.map((item) => '${item['id']}').toSet();
    final groupSelected = groupIds.every(_selected.contains);
    return Card(
      margin: const EdgeInsets.fromLTRB(12, 8, 12, 0),
      child: Column(
        children: [
          CheckboxListTile(
            value: groupSelected,
            title: Text(group.shopName, style: const TextStyle(fontWeight: FontWeight.w600)),
            onChanged: (value) => setState(() {
              _selected = value == true
                  ? <String>{..._selected, ...groupIds}
                  : <String>{..._selected.where((id) => !groupIds.contains(id))};
            }),
          ),
          for (final item in group.items) _buildItemRow(item),
        ],
      ),
    );
  }

  Widget _buildItemRow(Map<String, dynamic> item) {
    final itemId = '${item['id']}';
    final quantity = (asNum(item, ['quantity']) ?? 1).toInt();
    final imageUrl = '${item['imageUrl'] ?? ''}';
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 0, 8, 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Checkbox(
            value: _selected.contains(itemId),
            onChanged: (value) => setState(() {
              if (value == true) {
                _selected = <String>{..._selected, itemId};
              } else {
                _selected.remove(itemId);
                _selected = Set<String>.of(_selected);
              }
            }),
          ),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: SizedBox(
              width: 72,
              height: 72,
              child: imageUrl.isEmpty
                  ? const ColoredBox(
                      color: Color(0xFFF3F4F6),
                      child: Center(child: Icon(Icons.image_outlined)),
                    )
                  : Image.network(
                      imageUrl,
                      fit: BoxFit.cover,
                      errorBuilder: (context, error, stackTrace) =>
                          const Center(child: Icon(Icons.broken_image_outlined)),
                    ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${item['title']}', maxLines: 2, overflow: TextOverflow.ellipsis),
                if ('${item['skuName'] ?? ''}'.isNotEmpty)
                  Text(
                    '${item['skuName']}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      formatCny(asNum(item, ['unitPrice', 'priceCny'])),
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.primary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Row(
                      children: [
                        IconButton(
                          visualDensity: VisualDensity.compact,
                          onPressed: quantity <= 1
                              ? null
                              : () => _changeQuantity(itemId, quantity - 1),
                          icon: const Icon(Icons.remove_circle_outline),
                        ),
                        Text('$quantity'),
                        IconButton(
                          visualDensity: VisualDensity.compact,
                          onPressed: () => _changeQuantity(itemId, quantity + 1),
                          icon: const Icon(Icons.add_circle_outline),
                        ),
                        IconButton(
                          visualDensity: VisualDensity.compact,
                          onPressed: () => _removeItem(itemId),
                          icon: const Icon(Icons.delete_outline),
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _refresh() async {
    if (!SdkworkSession.instance.isLoggedIn) {
      setState(() => _loading = false);
      return;
    }
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      final items = await MallCommerce.instance.cart.getCartItems();
      final groups = <_CartGroup>[];
      final byShop = <String, _CartGroup>{};
      for (final item in items) {
        final shop = asMap(item['shop']);
        final spu = asMap(item['spu']);
        final resolvedShopId = asString(item, ['shopId'], fallback: '') .isNotEmpty
            ? asString(item, ['shopId'])
            : asString(shop, ['id'], fallback: asString(spu, ['shopId'], fallback: 'shop-default'));
        final shopName = asString(item, ['shopName'],
            fallback: asString(shop, ['name'], fallback: asString(spu, ['shopName'], fallback: 'SDKWork 精选')));
        final group = byShop.putIfAbsent(resolvedShopId, () => _CartGroup(resolvedShopId, shopName));
        group.items.add(item);
      }
      groups.addAll(byShop.values);
      if (!mounted) {
        return;
      }
      setState(() {
        _groups = groups;
        _selected = _selected
            .where((id) => groups.any((group) => group.items.any((item) => '${item['id']}' == id)))
            .toSet();
        if (_selected.isEmpty) {
          _selected = groups
              .expand((group) => group.items.map((item) => '${item['id']}'))
              .toSet();
        }
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

  Future<void> _changeQuantity(String itemId, int quantity) async {
    if (quantity < 1) {
      return;
    }
    try {
      await MallCommerce.instance.cart.updateCartItem(itemId, quantity);
      await _refresh();
    } catch (cause) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$cause')));
      }
    }
  }

  Future<void> _removeItem(String itemId) async {
    try {
      await MallCommerce.instance.cart.removeCartItem(itemId);
      _selected.remove(itemId);
      await _refresh();
    } catch (cause) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$cause')));
      }
    }
  }

  void _goCheckout() {
    Navigator.of(context).pushNamed(
      '/checkout',
      arguments: _selected.join(','),
    );
  }
}
