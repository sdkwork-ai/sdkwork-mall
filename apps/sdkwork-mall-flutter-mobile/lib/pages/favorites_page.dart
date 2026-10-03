import 'package:flutter/material.dart';

import '../services/favorites_service.dart';
import '../utils/format.dart';
import 'widgets.dart';

/// 我的收藏：本机收藏列表，可取消收藏、跳转商品详情。
class SdkworkFavoritesPage extends StatefulWidget {
  const SdkworkFavoritesPage({super.key});

  @override
  State<SdkworkFavoritesPage> createState() => _SdkworkFavoritesPageState();
}

class _SdkworkFavoritesPageState extends State<SdkworkFavoritesPage> {
  List<SdkworkFavoriteItem> _favorites = const <SdkworkFavoriteItem>[];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _reload();
  }

  Future<void> _reload() async {
    final favorites = await SdkworkFavoritesStore.readFavorites();
    if (!mounted) {
      return;
    }
    setState(() {
      _favorites = favorites;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('我的收藏')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _favorites.isEmpty
              ? const SdkworkEmptyView(message: '还没有收藏的商品')
              : RefreshIndicator(
                  onRefresh: _reload,
                  child: ListView(
                    children: <Widget>[
                      SdkworkSectionHeader(title: '共 ${_favorites.length} 件收藏'),
                      ..._favorites.map(_buildRow),
                      const Padding(
                        padding: EdgeInsets.all(16),
                        child: Text(
                          '收藏暂存本机，登录账号云同步将在收藏服务上线后开放。',
                          style: TextStyle(color: Colors.black38, fontSize: 12),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ],
                  ),
                ),
    );
  }

  Widget _buildRow(SdkworkFavoriteItem item) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      child: ListTile(
        leading: ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: SizedBox(
            width: 56,
            height: 56,
            child: item.imageUrl.isEmpty
                ? const ColoredBox(
                    color: Color(0xFFF3F4F6),
                    child: Icon(Icons.image_outlined),
                  )
                : Image.network(
                    item.imageUrl,
                    fit: BoxFit.cover,
                    errorBuilder: (context, error, stackTrace) => const ColoredBox(
                      color: Color(0xFFF3F4F6),
                      child: Icon(Icons.broken_image_outlined),
                    ),
                  ),
          ),
        ),
        title: Text(
          item.title,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
        subtitle: item.priceCny != null
            ? Text(
                formatCny(item.priceCny),
                style: TextStyle(
                  color: Theme.of(context).colorScheme.primary,
                  fontWeight: FontWeight.w700,
                ),
              )
            : const Text('询价'),
        trailing: TextButton(
          onPressed: () async {
            await SdkworkFavoritesStore.removeFavorite(item.id);
            await _reload();
            if (mounted) {
              ScaffoldMessenger.of(context)
                  .showSnackBar(const SnackBar(content: Text('已取消收藏')));
            }
          },
          child: const Text('取消收藏'),
        ),
        onTap: () => Navigator.of(context)
            .pushNamed('/product', arguments: item.id)
            .then((_) => _reload()),
      ),
    );
  }
}

/// 浏览足迹：PDP 访问时记录，最多保留 50 条，可整表清空。
class SdkworkFootprintPage extends StatefulWidget {
  const SdkworkFootprintPage({super.key});

  @override
  State<SdkworkFootprintPage> createState() => _SdkworkFootprintPageState();
}

class _SdkworkFootprintPageState extends State<SdkworkFootprintPage> {
  List<SdkworkFootprintItem> _records = const <SdkworkFootprintItem>[];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _reload();
  }

  Future<void> _reload() async {
    final records = await SdkworkFavoritesStore.readFootprint();
    if (!mounted) {
      return;
    }
    setState(() {
      _records = records;
      _loading = false;
    });
  }

  Future<void> _clearAll() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('清空足迹'),
        content: const Text('确定清空全部浏览记录？'),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('确定'),
          ),
        ],
      ),
    );
    if (confirmed ?? false) {
      await SdkworkFavoritesStore.clearFootprint();
      await _reload();
    }
  }

  String _formatViewedAt(DateTime at) {
    String pad(int value) => value.toString().padLeft(2, '0');
    return '浏览于 '
        '${at.year}-${pad(at.month)}-${pad(at.day)} '
        '${pad(at.hour)}:${pad(at.minute)}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('浏览足迹'),
        actions: <Widget>[
          if (_records.isNotEmpty)
            TextButton(
              onPressed: _clearAll,
              child: const Text('清空'),
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _records.isEmpty
              ? const SdkworkEmptyView(message: '还没有浏览记录')
              : ListView(
                  children: _records
                      .map(
                        (item) => Card(
                          margin: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 4,
                          ),
                          child: ListTile(
                            leading: ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: SizedBox(
                                width: 56,
                                height: 56,
                                child: item.imageUrl.isEmpty
                                    ? const ColoredBox(
                                        color: Color(0xFFF3F4F6),
                                        child: Icon(Icons.image_outlined),
                                      )
                                    : Image.network(
                                        item.imageUrl,
                                        fit: BoxFit.cover,
                                        errorBuilder:
                                            (context, error, stackTrace) =>
                                                const ColoredBox(
                                          color: Color(0xFFF3F4F6),
                                          child:
                                              Icon(Icons.broken_image_outlined),
                                        ),
                                      ),
                              ),
                            ),
                            title: Text(
                              item.title,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                            subtitle: Text(_formatViewedAt(item.viewedAt)),
                            onTap: () => Navigator.of(context)
                                .pushNamed('/product', arguments: item.id)
                                .then((_) => _reload()),
                          ),
                        ),
                      )
                      .toList(),
                ),
    );
  }
}
