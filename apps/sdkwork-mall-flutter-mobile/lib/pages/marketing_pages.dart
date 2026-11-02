import 'package:flutter/material.dart';

import '../services/commerce.dart';
import '../src/i18n/runtime.dart';
import '../utils/format.dart';
import '../utils/json.dart';
import 'widgets.dart';

const _activityTypeKeys = <String, String>{
  'big-promo': 'marketing.activity.types.bigPromo',
  'brand-day': 'marketing.activity.types.brandDay',
  'category-venue': 'marketing.activity.types.categoryVenue',
  'flash-sale': 'marketing.activity.types.flashSale',
  'limited-rush': 'marketing.activity.types.limitedRush',
  'member-day': 'marketing.activity.types.memberDay',
  'new-launch': 'marketing.activity.types.newLaunch',
  'quantity-tier': 'marketing.activity.types.quantityTier',
};

String _activityTypeLabel(String type) {
  final key = _activityTypeKeys[type];
  return key == null
      ? SdkworkI18n.t('marketing.activity.fallback')
      : SdkworkI18n.t(key);
}

String _activityPhase(Map<String, dynamic> row) {
  final now = DateTime.now().millisecondsSinceEpoch;
  final startMs = DateTime.tryParse(
    asString(row, <String>['startAt', 'start_at', 'startTime']),
  )?.millisecondsSinceEpoch;
  final endMs = DateTime.tryParse(
    asString(row, <String>['endAt', 'end_at', 'endTime']),
  )?.millisecondsSinceEpoch;
  if (startMs != null && now < startMs) {
    return 'upcoming';
  }
  if (endMs != null && now >= endMs) {
    return 'ended';
  }
  return 'active';
}

/// 店铺页：店铺信息 + 在售商品。
class SdkworkShopPage extends StatefulWidget {
  const SdkworkShopPage({super.key, required this.shopId});

  final String shopId;

  @override
  State<SdkworkShopPage> createState() => _SdkworkShopPageState();
}

class _SdkworkShopPageState extends State<SdkworkShopPage> {
  Map<String, dynamic>? _shop;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final shop = await MallCommerce.instance.marketing.retrieveShop(widget.shopId);
    if (!mounted) {
      return;
    }
    setState(() {
      _shop = shop;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final shop = _shop;
    return Scaffold(
      appBar: AppBar(title: Text(SdkworkI18n.t('marketing.shop.title'))),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : shop == null
              ? SdkworkEmptyView(
                  message: SdkworkI18n.t('marketing.shop.notFound'),
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    children: <Widget>[
                      Container(
                        padding: const EdgeInsets.all(24),
                        color: Theme.of(context).colorScheme.surface,
                        child: Row(
                          children: <Widget>[
                            CircleAvatar(
                              radius: 28,
                              backgroundColor: Theme.of(context)
                                  .colorScheme
                                  .primaryContainer,
                              child: Text(
                                asString(shop, <String>['name', 'title', 'shopName'],
                                        fallback: SdkworkI18n.t('marketing.shop.avatarFallback'))
                                    .characters
                                    .first
                                    .toString(),
                              ),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: <Widget>[
                                  Text(
                                    asString(
                                      shop,
                                      <String>['name', 'title', 'shopName'],
                                      fallback: SdkworkI18n.t('marketing.shop.nameFallback'),
                                    ),
                                    style: Theme.of(context).textTheme.titleLarge,
                                  ),
                                  if (asNum(shop, <String>['rating', 'score']) != null)
                                    Text(
                                      SdkworkI18n.t(
                                        'marketing.shop.rating',
                                        params: <String, String>{
                                          'rating': formatCny(
                                            asNum(shop, <String>['rating', 'score']),
                                          ),
                                        },
                                      ),
                                    ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      SdkworkSectionHeader(
                        title: SdkworkI18n.t('marketing.shop.productsTitle'),
                      ),
                      if (asList(shop['products']).isEmpty)
                        SdkworkEmptyView(
                          message: SdkworkI18n.t('marketing.shop.productsEmpty'),
                        )
                      else
                        GridView.builder(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          gridDelegate:
                              const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 2,
                            mainAxisSpacing: 12,
                            crossAxisSpacing: 12,
                            childAspectRatio: 0.72,
                          ),
                          itemCount: asList(shop['products']).length,
                          itemBuilder: (context, index) =>
                              _buildProductCard(asList(shop['products'])[index]),
                        ),
                      const SizedBox(height: 24),
                    ],
                  ),
                ),
    );
  }

  Widget _buildProductCard(Map<String, dynamic> product) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => Navigator.of(context).pushNamed(
          '/product',
          arguments: asString(product, <String>['id', 'spuId']),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Expanded(
              child: asString(product, <String>['imageUrl', 'mainImage', 'image'])
                      .isEmpty
                  ? const ColoredBox(
                      color: Color(0xFFF3F4F6),
                      child: Icon(Icons.image_outlined, size: 40),
                    )
                  : Image.network(
                      asString(product, <String>['imageUrl', 'mainImage', 'image']),
                      fit: BoxFit.cover,
                      errorBuilder: (context, error, stackTrace) => const ColoredBox(
                        color: Color(0xFFF3F4F6),
                        child: Icon(Icons.broken_image_outlined, size: 40),
                      ),
                    ),
            ),
            Padding(
              padding: const EdgeInsets.all(8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    asString(
                      product,
                      <String>['title', 'name'],
                      fallback: SdkworkI18n.t('marketing.shop.productFallback'),
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    formatCny(asNum(product, <String>['priceCny', 'price', 'salePrice'])),
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.primary,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// 活动会场：进行中的营销活动列表。
class SdkworkActivityListPage extends StatefulWidget {
  const SdkworkActivityListPage({super.key});

  @override
  State<SdkworkActivityListPage> createState() =>
      _SdkworkActivityListPageState();
}

class _SdkworkActivityListPageState extends State<SdkworkActivityListPage> {
  List<Map<String, dynamic>> _activities = const <Map<String, dynamic>>[];
  bool _loading = true;
  String _error = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      final activities =
          await MallCommerce.instance.marketing.listActivities();
      if (!mounted) {
        return;
      }
      setState(() {
        _activities = activities;
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(SdkworkI18n.t('marketing.activity.title'))),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: _error.isNotEmpty && _activities.isEmpty
                  ? ListView(
                      children: <Widget>[
                        SdkworkErrorView(
                          message: _error,
                          onRetry: () => _load(),
                        ),
                      ],
                    )
                  : _activities.isEmpty
                      ? ListView(
                          children: <Widget>[
                            SdkworkEmptyView(
                              message: SdkworkI18n.t('marketing.activity.empty'),
                            ),
                          ],
                        )
                      : ListView(
                          padding: const EdgeInsets.all(12),
                          children: _activities
                              .map(_buildActivityCard)
                              .toList(),
                        ),
            ),
    );
  }

  Widget _buildActivityCard(Map<String, dynamic> row) {
    final type = asString(
      row,
      <String>['activityType', 'activity_type', 'type'],
      fallback: 'general',
    );
    final phase = _activityPhase(row);
    final phaseKey = <String, String>{
      'active': 'marketing.activity.phase.active',
      'ended': 'marketing.activity.phase.ended',
      'upcoming': 'marketing.activity.phase.upcoming',
    }[phase];
    final phaseText = phaseKey == null
        ? SdkworkI18n.t('marketing.activity.fallback')
        : SdkworkI18n.t(phaseKey);
    return Opacity(
      opacity: phase == 'ended' ? 0.55 : 1,
      child: Card(
        margin: const EdgeInsets.only(bottom: 12),
        child: ListTile(
          title: Text(
            '${_activityTypeLabel(type)} · '
            '${asString(row, <String>['title', 'name'], fallback: SdkworkI18n.t('marketing.activity.fallback'))}',
          ),
          subtitle: Text(
            asString(row, <String>['highlight', 'slogan']) != ''
                ? asString(row, <String>['highlight', 'slogan'])
                : asString(row, <String>['discountText', 'discount_text', 'discount']),
          ),
          trailing: Text(phaseText, style: Theme.of(context).textTheme.labelSmall),
          onTap: () => Navigator.of(context).pushNamed(
            '/activity-detail',
            arguments: asString(row, <String>['id', 'offerId', 'activityId']),
          ),
        ),
      ),
    );
  }
}

/// 活动详情。
class SdkworkActivityDetailPage extends StatefulWidget {
  const SdkworkActivityDetailPage({super.key, required this.offerId});

  final String offerId;

  @override
  State<SdkworkActivityDetailPage> createState() =>
      _SdkworkActivityDetailPageState();
}

class _SdkworkActivityDetailPageState extends State<SdkworkActivityDetailPage> {
  Map<String, dynamic>? _activity;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final activity =
        await MallCommerce.instance.marketing.retrieveActivity(widget.offerId);
    if (!mounted) {
      return;
    }
    setState(() {
      _activity = activity;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final activity = _activity;
    return Scaffold(
      appBar: AppBar(title: Text(SdkworkI18n.t('marketing.activity.detailTitle'))),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : activity == null
              ? SdkworkEmptyView(
                  message: SdkworkI18n.t('marketing.activity.notFound'),
                )
              : ListView(
                  padding: const EdgeInsets.all(12),
                  children: <Widget>[
                    Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(16),
                        gradient: const LinearGradient(
                          colors: <Color>[Color(0xFFE93B3D), Color(0xFFF06B3E)],
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text(
                            _activityTypeLabel(
                              asString(
                                activity,
                                <String>['activityType', 'activity_type', 'type'],
                                fallback: 'general',
                              ),
                            ),
                            style: const TextStyle(color: Colors.white70),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            asString(
                              activity,
                              <String>['title', 'name'],
                              fallback: SdkworkI18n.t('marketing.activity.fallback'),
                            ),
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 24,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          if (asString(activity, <String>['highlight', 'slogan']).isNotEmpty)
                            Padding(
                              padding: const EdgeInsets.only(top: 8),
                              child: Text(
                                asString(activity, <String>['highlight', 'slogan']),
                                style: const TextStyle(color: Colors.white70),
                              ),
                            ),
                        ],
                      ),
                    ),
                    if (asString(activity, <String>['description', 'summary']).isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            Text(
                              SdkworkI18n.t('marketing.activity.descriptionTitle'),
                              style: Theme.of(context).textTheme.titleSmall,
                            ),
                            const SizedBox(height: 8),
                            Text(
                              asString(activity, <String>['description', 'summary']),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
    );
  }
}
