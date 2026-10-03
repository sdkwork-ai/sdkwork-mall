import 'package:flutter/material.dart';

import '../services/commerce.dart';
import '../utils/format.dart';
import '../utils/json.dart';
import 'widgets.dart';

/// 分类: 左侧类目栏 + 右侧商品列表（JD 式两栏）.
class SdkworkCategoryPage extends StatefulWidget {
  const SdkworkCategoryPage({super.key});

  @override
  State<SdkworkCategoryPage> createState() => _SdkworkCategoryPageState();
}

class _SdkworkCategoryPageState extends State<SdkworkCategoryPage> {
  List<Map<String, dynamic>> _categories = const [];
  String _activeCategoryId = '';
  List<Map<String, dynamic>> _products = const [];
  int _page = 1;
  int _total = 0;
  bool _loading = true;
  bool _loadingMore = false;
  String _error = '';

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading && _products.isEmpty) {
      return const SdkworkLoadingView();
    }
    if (_error.isNotEmpty && _products.isEmpty) {
      return SdkworkErrorView(message: _error, onRetry: _bootstrap);
    }
    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(
          width: 96,
          child: Material(
            color: Theme.of(context).colorScheme.surfaceContainerHighest,
            child: ListView.builder(
              itemCount: _categories.length,
              itemBuilder: (context, index) {
                final category = _categories[index];
                final active = '${category['id']}' == _activeCategoryId;
                return InkWell(
                  onTap: () => _selectCategory('${category['id']}'),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    decoration: BoxDecoration(
                      color: active ? Theme.of(context).scaffoldBackgroundColor : null,
                      border: Border(
                        left: BorderSide(
                          width: 3,
                          color: active
                              ? Theme.of(context).colorScheme.primary
                              : Colors.transparent,
                        ),
                      ),
                    ),
                    child: Text(
                      '${category['name']}',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: active ? FontWeight.w600 : FontWeight.w400,
                        color: active
                            ? Theme.of(context).colorScheme.primary
                            : Theme.of(context).colorScheme.onSurface,
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ),
        Expanded(
          child: NotificationListener<ScrollNotification>(
            onNotification: (notification) {
              if (notification is ScrollEndNotification &&
                  notification.metrics.extentAfter < 200) {
                _loadProducts();
              }
              return false;
            },
            child: RefreshIndicator(
              onRefresh: () => _loadProducts(reset: true),
              child: _products.isEmpty
                  ? ListView(children: const [SdkworkEmptyView(message: '该分类暂无商品')])
                  : ListView.builder(
                      itemCount: _products.length + 1,
                      itemBuilder: (context, index) {
                        if (index == _products.length) {
                          return Padding(
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            child: Center(
                              child: Text(
                                _loadingMore
                                    ? '加载更多...'
                                    : _products.length >= _total
                                        ? '已展示全部 $_total 件商品'
                                        : '上拉加载更多',
                                style: Theme.of(context).textTheme.labelSmall,
                              ),
                            ),
                          );
                        }
                        return _buildProductRow(_products[index]);
                      },
                    ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildProductRow(Map<String, dynamic> product) {
    final imageUrl = product['imageUrl']?.toString() ?? '';
    return Card(
      margin: const EdgeInsets.only(top: 8),
      child: InkWell(
        onTap: () => openSdkworkProduct(context, '${product['id']}'),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: SizedBox(
                  width: 90,
                  height: 90,
                  child: imageUrl.isEmpty
                      ? ColoredBox(
                          color: Theme.of(context)
                              .colorScheme
                              .surfaceContainerHighest,
                          child: const Center(child: Icon(Icons.image_outlined)),
                        )
                      : Image.network(
                          imageUrl,
                          fit: BoxFit.cover,
                          errorBuilder: (context, error, stackTrace) =>
                              const Center(child: Icon(Icons.broken_image_outlined)),
                        ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: SizedBox(
                  height: 90,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${product['title']}',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const Spacer(),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            formatCny(
                              asNum(product, ['priceCny', 'price', 'salePrice']),
                            ),
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.primary,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          if (product['sales'] != null)
                            Text(
                              '已售 ${product['sales']}',
                              style: Theme.of(context).textTheme.labelSmall,
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _bootstrap() async {
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      final categories = await MallCommerce.instance.catalog.listCategories();
      final roots = categories
          .where((category) => '${category['parentId'] ?? ''}'.isEmpty)
          .toList();
      setState(() {
        _categories = roots;
        _activeCategoryId = roots.isNotEmpty ? '${roots.first['id']}' : '';
      });
      await _loadProducts(reset: true);
    } catch (cause) {
      setState(() {
        _loading = false;
        _error = '$cause';
      });
    }
  }

  Future<void> _selectCategory(String categoryId) async {
    if (categoryId == _activeCategoryId) {
      return;
    }
    setState(() {
      _activeCategoryId = categoryId;
      _products = const [];
      _loading = true;
    });
    await _loadProducts(reset: true);
  }

  Future<void> _loadProducts({bool reset = false}) async {
    if (_loadingMore || (!reset && _products.length >= _total && _total > 0)) {
      return;
    }
    final nextPage = reset ? 1 : _page + 1;
    setState(() {
      if (reset) {
        _loading = true;
        _error = '';
      } else {
        _loadingMore = true;
      }
    });
    try {
      final result = await MallCommerce.instance.catalog.listProducts(
        categoryId: _activeCategoryId.isEmpty ? null : _activeCategoryId,
        page: nextPage,
      );
      setState(() {
        _products = reset
            ? result.items
            : <Map<String, dynamic>>[..._products, ...result.items];
        _page = nextPage;
        _total = result.total;
        _loading = false;
        _loadingMore = false;
      });
    } catch (cause) {
      setState(() {
        _loading = false;
        _loadingMore = false;
        _error = '$cause';
      });
    }
  }
}
