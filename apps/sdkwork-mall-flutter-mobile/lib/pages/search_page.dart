import 'package:flutter/material.dart';

import '../services/commerce.dart';
import '../utils/format.dart';
import '../utils/json.dart';
import 'widgets.dart';

/// 搜索: 关键词 / 热搜 / 历史 / 排序 / 分页.
class SdkworkSearchPage extends StatefulWidget {
  const SdkworkSearchPage({super.key});

  @override
  State<SdkworkSearchPage> createState() => _SdkworkSearchPageState();
}

class _SdkworkSearchPageState extends State<SdkworkSearchPage> {
  static const _hotKeywords = <String>['手机', '笔记本', '大米', '人体工学椅', '新品', '旗舰'];
  static const _sorts = <Map<String, String>>[
    {'code': '', 'label': '综合'},
    {'code': 'sales', 'label': '销量'},
    {'code': 'price_asc', 'label': '价格↑'},
    {'code': 'price_desc', 'label': '价格↓'},
  ];

  final TextEditingController _keyword = TextEditingController();
  List<String> _history = const [];
  List<String> _categoryNames = const [];
  Map<String, String> _categoryIds = const {};
  String? _activeCategoryId;
  String _activeSort = '';
  List<Map<String, dynamic>> _products = const [];
  int _page = 1;
  int _total = 0;
  bool _loading = true;
  bool _loadingMore = false;
  String _error = '';

  bool _bootstrapped = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_bootstrapped) {
      return;
    }
    _bootstrapped = true;
    final arguments = ModalRoute.of(context)?.settings.arguments;
    if (arguments is Map) {
      _keyword.text = '${arguments['q'] ?? ''}';
      _activeSort = '${arguments['sort'] ?? ''}';
      final categoryId = '${arguments['categoryId'] ?? ''}';
      _activeCategoryId = categoryId.isEmpty ? null : categoryId;
    }
    _loadCategories();
    _loadProducts(reset: true);
  }

  @override
  void dispose() {
    _keyword.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: TextField(
          controller: _keyword,
          textInputAction: TextInputAction.search,
          decoration: const InputDecoration(
            hintText: '搜索商品 / 品牌 / 店铺',
            border: InputBorder.none,
          ),
          onSubmitted: (_) => _search(),
        ),
        actions: [
          TextButton(onPressed: _search, child: const Text('搜索')),
        ],
      ),
      body: _loading && _products.isEmpty
          ? const SdkworkLoadingView()
          : NotificationListener<ScrollNotification>(
              onNotification: (notification) {
                if (notification is ScrollEndNotification &&
                    notification.metrics.extentAfter < 200) {
                  _loadMore();
                }
                return false;
              },
              child: ListView(
                children: [
                  _buildChips('热搜', _hotKeywords, (keyword) {
                    _keyword.text = keyword;
                    _search();
                  }),
                  if (_history.isNotEmpty)
                    _buildChipsWithClear('搜索历史', _history, (keyword) {
                      _keyword.text = keyword;
                      _search();
                    }),
                  if (_categoryNames.isNotEmpty)
                    _buildCategoryChips(),
                  SizedBox(
                    height: 44,
                    child: Row(
                      children: _sorts
                          .map(
                            (sort) => Padding(
                              padding: const EdgeInsets.only(left: 8),
                              child: ChoiceChip(
                                label: Text('${sort['label']}'),
                                selected: _activeSort == sort['code'],
                                onSelected: (_) {
                                  setState(() => _activeSort = '${sort['code']}');
                                  _loadProducts(reset: true);
                                },
                              ),
                            ),
                          )
                          .toList(),
                    ),
                  ),
                  if (_error.isNotEmpty) SdkworkErrorView(message: _error, onRetry: () => _loadProducts(reset: true)),
                  if (_products.isEmpty && !_loading)
                    const SdkworkEmptyView(message: '暂无匹配商品'),
                  GridView.count(
                    crossAxisCount: 2,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    mainAxisSpacing: 4,
                    crossAxisSpacing: 4,
                    childAspectRatio: 0.72,
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    children: _products
                        .map(
                          (product) => SdkworkProductCard(
                            product: product,
                            onTap: () => openSdkworkProduct(context, '${product['id']}'),
                          ),
                        )
                        .toList(),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: Center(
                      child: Text(
                        _products.isEmpty
                            ? ''
                            : _products.length >= _total
                                ? '已展示全部 $_total 件'
                                : '上拉加载更多（${_products.length}/$_total）',
                        style: Theme.of(context).textTheme.labelSmall,
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildChips(String title, List<String> values, ValueChanged<String> onTap) => Padding(
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: values
                  .map(
                    (value) => ActionChip(
                      label: Text(value),
                      onPressed: () => onTap(value),
                    ),
                  )
                  .toList(),
            ),
          ],
        ),
      );

  Widget _buildChipsWithClear(
    String title,
    List<String> values,
    ValueChanged<String> onTap,
  ) => Stack(
        children: [
          _buildChips(title, values, onTap),
          Positioned(
            right: 12,
            top: 8,
            child: TextButton(
              onPressed: _clearHistory,
              child: const Text('清空'),
            ),
          ),
        ],
      );

  Widget _buildCategoryChips() => Padding(
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
        child: Wrap(
          spacing: 8,
          runSpacing: 8,
          children: List<Widget>.generate(_categoryNames.length, (index) {
            final categoryId = _categoryIds[_categoryNames[index]];
            return ChoiceChip(
              label: Text(_categoryNames[index]),
              selected: _activeCategoryId == categoryId,
              onSelected: (_) {
                setState(() {
                  _activeCategoryId =
                      _activeCategoryId == categoryId ? null : categoryId;
                });
                _loadProducts(reset: true);
              },
            );
          }),
        ),
      );

  void _clearHistory() {
    setState(() => _history = const []);
  }

  void _search() {
    final keyword = _keyword.text.trim();
    if (keyword.isNotEmpty && !_history.contains(keyword)) {
      setState(() {
        _history = <String>[keyword, ..._history].take(10).toList();
      });
    }
    setState(() => _activeCategoryId = null);
    _loadProducts(reset: true);
  }

  Future<void> _loadCategories() async {
    try {
      final categories = await MallCommerce.instance.catalog.listCategories();
      setState(() {
        _categoryNames = categories
            .where((category) => '${category['parentId'] ?? ''}'.isEmpty)
            .take(12)
            .map((category) => '${category['name']}')
            .toList();
        _categoryIds = <String, String>{
          for (final category in categories) '${category['name']}': '${category['id']}',
        };
      });
    } catch (_) {
      // 分类栏为可选增强。
    }
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
        categoryId: _activeCategoryId,
        keyword: _activeCategoryId == null ? (_keyword.text.trim().isEmpty ? null : _keyword.text.trim()) : null,
        sort: _activeSort.isEmpty ? null : _activeSort,
        page: nextPage,
      );
      setState(() {
        _products = reset
            ? result.items
                .map((product) => Map<String, dynamic>.of(product)..['priceText'] = formatCny(asNum(product, ['priceCny', 'price', 'salePrice'])))
                .toList()
            : <Map<String, dynamic>>[
                ..._products,
                ...result.items.map(
                  (product) => Map<String, dynamic>.of(product)
                    ..['priceText'] = formatCny(asNum(product, ['priceCny', 'price', 'salePrice'])),
                ),
              ];
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

  void _loadMore() {
    _loadProducts();
  }
}
