import 'package:flutter/material.dart';

import '../bootstrap/session.dart';
import '../services/commerce.dart';
import '../services/favorites_service.dart';
import '../utils/format.dart';
import '../utils/json.dart';

/// 商品详情: 画廊轮播 / SKU 选择 / 数量 / 加购 / 立即购买 / 收藏.
class SdkworkProductPage extends StatefulWidget {
  const SdkworkProductPage({super.key, required this.productId});

  final String productId;

  @override
  State<SdkworkProductPage> createState() => _SdkworkProductPageState();
}

class _SdkworkProductPageState extends State<SdkworkProductPage> {
  Map<String, dynamic>? _detail;
  List<Map<String, dynamic>> _skus = const [];
  List<Map<String, dynamic>> _specs = const [];
  List<String> _images = const [];
  String _selectedSkuId = '';
  int _quantity = 1;
  int? _maxQuantity;
  bool _favorite = false;
  bool _loading = true;
  bool _busy = false;
  String _error = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Scaffold(
        appBar: AppBar(),
        body: const Center(child: CircularProgressIndicator()),
      );
    }
    if (_detail == null) {
      return Scaffold(
        appBar: AppBar(),
        body: Center(child: Text(_error.isEmpty ? '商品不存在或已下架' : _error)),
      );
    }
    final detail = _detail!;
    final selectedSku = _skus.where((sku) => '${sku['id']}' == _selectedSkuId).firstOrNull;
    final priceText = formatCny(
      asNum(selectedSku ?? const <String, dynamic>{}, ['priceCny', 'price']) ??
          asNum(detail, ['priceCny', 'price', 'salePrice']),
    );
    final soldOut = _maxQuantity != null && _maxQuantity! <= 0;

    return Scaffold(
      appBar: AppBar(title: const Text('商品详情')),
      bottomNavigationBar: BottomAppBar(
        child: Row(
          children: [
            IconButton(
              tooltip: _favorite ? '取消收藏' : '收藏',
              onPressed: _toggleFavorite,
              icon: Icon(
                _favorite ? Icons.favorite : Icons.favorite_outline,
                color: _favorite ? const Color(0xFFE93B3D) : null,
              ),
            ),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _busy || soldOut ? null : () => _openSkuSheet(false),
                icon: const Icon(Icons.shopping_cart_outlined),
                label: const Text('加入购物车'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: FilledButton(
                onPressed: _busy || soldOut ? null : () => _openSkuSheet(true),
                child: Text(soldOut ? '暂时售罄' : '立即购买'),
              ),
            ),
          ],
        ),
      ),
      body: ListView(
        children: [
          SizedBox(
            height: 320,
            child: _images.isEmpty
                ? const ColoredBox(
                    color: Color(0xFFF3F4F6),
                    child: Center(child: Icon(Icons.image_outlined, size: 48)),
                  )
                : PageView.builder(
                    itemCount: _images.length,
                    itemBuilder: (context, index) => Image.network(
                      _images[index],
                      fit: BoxFit.cover,
                      errorBuilder: (context, error, stackTrace) =>
                          const Center(child: Icon(Icons.broken_image_outlined)),
                    ),
                  ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  priceText,
                  style: TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.w800,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                ),
                const SizedBox(height: 8),
                Text('${detail['title']}', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                Text(
                  <String>[
                    if (detail['sales'] != null) '已售 ${detail['sales']}',
                    if (_maxQuantity != null) '库存 $_maxQuantity',
                    if (soldOut) '暂时售罄',
                  ].join(' · '),
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
          if (_skus.isNotEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('选择规格', style: Theme.of(context).textTheme.titleSmall),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: _skus
                        .map(
                          (sku) => ChoiceChip(
                            label: Text('${sku['title']}'),
                            selected: '${sku['id']}' == _selectedSkuId,
                            onSelected: (_) => _selectSku('${sku['id']}'),
                          ),
                        )
                        .toList(),
                  ),
                ],
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Text('购买数量', style: Theme.of(context).textTheme.titleSmall),
                const Spacer(),
                IconButton(
                  onPressed: _quantity <= 1 ? null : () => setState(() => _quantity -= 1),
                  icon: const Icon(Icons.remove_circle_outline),
                ),
                Text('$_quantity'),
                IconButton(
                  onPressed:
                      (_maxQuantity != null && _quantity >= _maxQuantity!)
                          ? null
                          : () => setState(() {
                                _quantity += 1;
                                if (_maxQuantity != null && _quantity > _maxQuantity!) {
                                  _quantity = _maxQuantity!;
                                }
                              }),
                  icon: const Icon(Icons.add_circle_outline),
                ),
              ],
            ),
          ),
          if (_specs.isNotEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('规格参数', style: Theme.of(context).textTheme.titleSmall),
                  const SizedBox(height: 8),
                  ..._specs.map(
                    (spec) => Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          SizedBox(
                            width: 96,
                            child: Text(
                              '${spec['name']}',
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ),
                          Expanded(child: Text('${spec['value']}')),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          if ('${detail['description']}'.isNotEmpty)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('商品介绍', style: Theme.of(context).textTheme.titleSmall),
                  const SizedBox(height: 8),
                  Text('${detail['description']}'),
                ],
              ),
            ),
          const SizedBox(height: 24),
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
      final detail = await MallCommerce.instance.catalog.getProductDetail(widget.productId);
      if (!mounted) {
        return;
      }
      if (detail == null) {
        setState(() {
          _loading = false;
          _error = '商品不存在或已下架';
        });
        return;
      }
      final images = <String>[
        if (detail['imageUrl'] != null) '${detail['imageUrl']}',
        ...((detail['images'] ?? const <dynamic>[]) as List).map((entry) => '$entry'),
      ];
      final skus = (detail['skus'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .toList();
      final specs = (detail['specs'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .toList();
      final totalStock = skus.fold<int>(0, (sum, sku) => sum + ((asNum(sku, ['stock', 'quantity']) ?? 0).toInt()));
      final firstStock = skus.isNotEmpty ? asNum(skus.first, ['stock', 'quantity'])?.toInt() : null;
      // PDP 访问即记录足迹（本机，上限 50 条，与 H5/小程序一致）。
      await SdkworkFavoritesStore.recordFootprint(
        id: '${detail['id'] ?? widget.productId}',
        title: '${detail['title'] ?? '商品'}',
        imageUrl: '${detail['imageUrl'] ?? ''}',
      );
      final favorite = await SdkworkFavoritesStore.isFavorite(
        '${detail['id'] ?? widget.productId}',
      );
      if (!mounted) {
        return;
      }
      setState(() {
        _detail = detail;
        _images = images.toSet().toList();
        _skus = skus;
        _specs = specs;
        _selectedSkuId = skus.isNotEmpty ? '${skus.first['id']}' : '';
        _maxQuantity = firstStock ?? (totalStock > 0 ? totalStock : null);
        _favorite = favorite;
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

  void _selectSku(String skuId) {
    final sku = _skus.where((entry) => '${entry['id']}' == skuId).firstOrNull;
    setState(() {
      _selectedSkuId = skuId;
      _quantity = 1;
      final stock = sku == null ? null : asNum(sku, ['stock', 'quantity'])?.toInt();
      _maxQuantity = stock ?? _maxQuantity;
    });
  }

  Future<void> _toggleFavorite() async {
    final detail = _detail;
    if (detail == null) {
      return;
    }
    final favorited = await SdkworkFavoritesStore.toggleFavorite(
      SdkworkFavoriteItem(
        id: '${detail['id'] ?? widget.productId}',
        title: '${detail['title'] ?? '商品'}',
        imageUrl: '${detail['imageUrl'] ?? ''}',
        priceCny: asNum(detail, <String>['priceCny', 'price', 'salePrice']),
      ),
    );
    if (!mounted) {
      return;
    }
    setState(() => _favorite = favorited);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(favorited ? '已加入收藏' : '已取消收藏'),
        duration: const Duration(seconds: 1),
      ),
    );
  }

  void _openSkuSheet(bool buyNow) {
    showModalBottomSheet<void>(
      context: context,
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('已选 $_quantity 件', style: Theme.of(sheetContext).textTheme.titleMedium),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () {
                  Navigator.of(sheetContext).pop();
                  _confirm(buyNow);
                },
                child: Text(buyNow ? '立即购买' : '加入购物车'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _confirm(bool buyNow) async {
    if (!SdkworkSession.instance.isLoggedIn) {
      Navigator.of(context).pushNamed('/login');
      return;
    }
    final sku = _skus.where((entry) => '${entry['id']}' == _selectedSkuId).firstOrNull;
    if (sku == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('请选择规格')));
      return;
    }
    setState(() => _busy = true);
    try {
      await MallCommerce.instance.cart.addToCart(
        spuId: widget.productId,
        skuId: '${sku['id']}',
        quantity: _quantity,
      );
      if (!mounted) {
        return;
      }
      if (buyNow) {
        // 立即购买：商品已入购物车，直接进入结算（整单结算当前购物车）。
        Navigator.of(context).pushNamed('/checkout');
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('已加入购物车')),
        );
      }
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
