import 'dart:async';

import 'package:flutter/material.dart';

import '../services/commerce.dart';
import '../utils/format.dart';
import '../utils/json.dart';
import 'widgets.dart';

/// 首页: banner 轮播 / 快捷入口 / 分类宫格 / 限时秒杀 / 热卖推荐.
class SdkworkHomePage extends StatefulWidget {
  const SdkworkHomePage({super.key, this.onSwitchTab});

  /// Switches the shell bottom tab (e.g. 分类逛 -> 分类 tab).
  final void Function(int tabIndex)? onSwitchTab;

  @override
  State<SdkworkHomePage> createState() => _SdkworkHomePageState();
}

class _SdkworkHomePageState extends State<SdkworkHomePage> {
  static const _banners = <Map<String, String>>[
    {'title': '品质生活，一站购齐', 'subtitle': '平台自营与品牌商家'},
    {'title': '新品首发', 'subtitle': '每周上新'},
    {'title': '领券中心', 'subtitle': '领券下单更划算'},
    {'title': '会员专区', 'subtitle': '专属价与积分回馈'},
  ];

  List<Map<String, dynamic>> _categories = const [];
  List<Map<String, dynamic>> _hotProducts = const [];
  Map<String, dynamic>? _seckillOffer;
  Duration _remaining = Duration.zero;
  Timer? _countdownTimer;
  bool _loading = true;
  String _error = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: () => _load(),
      child: _loading && _hotProducts.isEmpty
          ? const SdkworkLoadingView()
          : _error.isNotEmpty && _hotProducts.isEmpty
              ? SdkworkErrorView(message: _error, onRetry: () => _load())
              : ListView(
                  children: [
                    const _HomeBannerCarousel(),
                    _buildQuickEntries(),
                    if (_categories.isNotEmpty) _buildCategoryGrid(),
                    if (_seckillOffer != null) _buildSeckillFloor(),
                    const SdkworkSectionHeader(title: '热卖推荐'),
                    if (_hotProducts.isEmpty)
                      const SdkworkEmptyView(message: '暂无推荐商品')
                    else
                      GridView.count(
                        crossAxisCount: 2,
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        mainAxisSpacing: 4,
                        crossAxisSpacing: 4,
                        childAspectRatio: 0.72,
                        padding: const EdgeInsets.symmetric(horizontal: 8),
                        children: _hotProducts
                            .map(
                              (product) => SdkworkProductCard(
                                product: product,
                                onTap: () => openSdkworkProduct(
                                  context,
                                  '${product['id']}',
                                ),
                              ),
                            )
                            .toList(),
                      ),
                    const SizedBox(height: 24),
                  ],
                ),
    );
  }

  Widget _buildQuickEntries() => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: <Map<String, dynamic>>[
            {'label': '分类逛', 'tab': 1},
            {'label': '热卖', 'sort': 'sales'},
            {'label': '新品', 'sort': 'newest'},
            {'label': '领券', 'route': '/coupons'},
            {'label': '订单', 'route': '/orders'},
          ]
              .map(
                (entry) => TextButton(
                  onPressed: () => _openEntry(entry),
                  child: Text('${entry['label']}'),
                ),
              )
              .toList(),
        ),
      );

  Widget _buildCategoryGrid() => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8),
        child: Card(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Wrap(
              spacing: 10,
              runSpacing: 10,
              children: _categories
                  .take(9)
                  .map(
                    (category) => ActionChip(
                      label: Text('${category['name']}'),
                      onPressed: () => Navigator.of(context).pushNamed(
                        '/search',
                        arguments: {'categoryId': '${category['id']}'},
                      ),
                    ),
                  )
                  .toList(),
            ),
          ),
        ),
      );

  Widget _buildSeckillFloor() {
    final offer = _seckillOffer!;
    String pad(int value) => value.toString().padLeft(2, '0');
    final text =
        '${pad(_remaining.inHours)}:${pad(_remaining.inMinutes % 60)}:${pad(_remaining.inSeconds % 60)}';
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8),
      child: Card(
        color: const Color(0xFFFFF1F0),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              const Text(
                '限时秒杀',
                style: TextStyle(
                  color: Color(0xFFE93B3D),
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(width: 10),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0xFFE93B3D),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  text,
                  style: const TextStyle(color: Colors.white, fontSize: 12),
                ),
              ),
              const Spacer(),
              Text(
                '${offer['discountText'] ?? offer['highlight'] ?? '进行中'}',
                style: const TextStyle(color: Color(0xFFE93B3D), fontSize: 12),
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
    final commerce = MallCommerce.instance;
    final results = await Future.wait(<Future<Object?>>[
      commerce.catalog.listCategories().then<Object?>((value) => value).catchError((_) => <Map<String, dynamic>>[]),
      commerce.catalog
          .listProducts(sort: 'sales')
          .then<Object?>((value) => value.items)
          .catchError((_) => <Map<String, dynamic>>[]),
      commerce.promotions.listOffers().then<Object?>((value) => value).catchError((_) => <Map<String, dynamic>>[]),
    ]);
    if (!mounted) {
      return;
    }
    final offers = results[2]! as List<Map<String, dynamic>>;
    Map<String, dynamic>? flashOffer;
    for (final offer in offers) {
      final title = '${offer['title']}';
      if (title.contains('秒杀') || title.contains('闪购')) {
        flashOffer = offer;
        break;
      }
    }
    flashOffer ??= offers.isNotEmpty ? offers.first : null;

    setState(() {
      _categories = results[0]! as List<Map<String, dynamic>>;
      _hotProducts = (results[1]! as List<Map<String, dynamic>>)
          .take(6)
          .map((product) {
            final item = Map<String, dynamic>.of(product);
            item['priceText'] = formatCny(asNum(product, ['priceCny', 'price', 'salePrice']));
            return item;
          })
          .toList();
      _seckillOffer = flashOffer;
      _loading = false;
    });
    _startCountdown();
  }

  void _startCountdown() {
    _countdownTimer?.cancel();
    final endAt = '$_seckillOffer'.isNotEmpty
        ? (_seckillOffer?['endAt']?.toString() ?? '')
        : '';
    final end = DateTime.tryParse(endAt);
    if (end == null) {
      setState(() => _remaining = Duration.zero);
      return;
    }
    void tick() {
      if (!mounted) {
        return;
      }
      setState(() {
        _remaining = end.isAfter(DateTime.now())
            ? end.difference(DateTime.now())
            : Duration.zero;
      });
    }

    tick();
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) => tick());
  }  void _openEntry(Map<String, dynamic> entry) {
    if (entry.containsKey('tab')) {
      widget.onSwitchTab?.call(entry['tab'] as int);
      return;
    }
    if (entry.containsKey('sort')) {
      Navigator.of(context).pushNamed(
        '/search',
        arguments: <String, String>{'sort': '${entry['sort']}'},
      );
      return;
    }
    Navigator.of(context).pushNamed('${entry['route']}');
  }
}

class _HomeBannerCarousel extends StatefulWidget {
  const _HomeBannerCarousel();

  @override
  State<_HomeBannerCarousel> createState() => _HomeBannerCarouselState();
}

class _HomeBannerCarouselState extends State<_HomeBannerCarousel> {
  final PageController _controller = PageController();
  Timer? _autoAdvanceTimer;
  int _page = 0;

  @override
  void initState() {
    super.initState();
    _autoAdvanceTimer = Timer.periodic(const Duration(seconds: 4), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      _page = (_page + 1) % _SdkworkHomePageState._banners.length;
      if (_controller.hasClients) {
        _controller.animateToPage(
          _page,
          duration: const Duration(milliseconds: 400),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  void dispose() {
    _autoAdvanceTimer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(12),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: SizedBox(
          height: 120,
          child: PageView.builder(
            controller: _controller,
            itemCount: _SdkworkHomePageState._banners.length,
            itemBuilder: (context, index) {
              final banner = _SdkworkHomePageState._banners[index];
              return Container(
                padding: const EdgeInsets.all(20),
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: <Color>[Color(0xFFE93B3D), Color(0xFFF97316)],
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      '${banner['title']}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 22,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '${banner['subtitle']}',
                      style: const TextStyle(color: Colors.white70),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}
