import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// 本地收藏与浏览足迹。
///
/// 与 H5/小程序行为一致：收藏与足迹暂存本机，账号级云同步等待收藏服务上线。
/// 存储键按页面独立命名，设置页可分别清空。
class SdkworkFavoriteItem {
  const SdkworkFavoriteItem({
    required this.id,
    required this.title,
    required this.imageUrl,
    required this.priceCny,
  });

  final String id;
  final String title;
  final String imageUrl;
  final num? priceCny;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'id': id,
        'title': title,
        'imageUrl': imageUrl,
        if (priceCny != null) 'priceCny': priceCny,
      };

  static SdkworkFavoriteItem fromJson(Map<String, dynamic> json) =>
      SdkworkFavoriteItem(
        id: '${json['id'] ?? ''}',
        title: '${json['title'] ?? '商品'}',
        imageUrl: '${json['imageUrl'] ?? ''}',
        priceCny: json['priceCny'] is num ? json['priceCny'] as num : null,
      );
}

class SdkworkFootprintItem {
  const SdkworkFootprintItem({
    required this.id,
    required this.title,
    required this.imageUrl,
    required this.viewedAt,
  });

  final String id;
  final String title;
  final String imageUrl;
  final DateTime viewedAt;
}

class SdkworkFavoritesStore {
  SdkworkFavoritesStore._();

  static const _favoritesKey = 'sdkwork.mall.favorites';
  static const _footprintKey = 'sdkwork.mall.footprint';
  static const _footprintLimit = 50;

  static Future<List<SdkworkFavoriteItem>> readFavorites() async =>
      _readFavorites(_favoritesKey);

  static Future<bool> isFavorite(String productId) async =>
      (await readFavorites()).any((item) => item.id == productId);

  /// 切换收藏状态，返回新的收藏状态（true = 已收藏）。
  static Future<bool> toggleFavorite(SdkworkFavoriteItem item) async {
    final favorites = await readFavorites();
    final exists = favorites.any((entry) => entry.id == item.id);
    final next = exists
        ? favorites.where((entry) => entry.id != item.id).toList()
        : <SdkworkFavoriteItem>[item, ...favorites];
    await _writeFavorites(next);
    return !exists;
  }

  static Future<void> removeFavorite(String productId) async {
    final favorites = await readFavorites();
    await _writeFavorites(
      favorites.where((entry) => entry.id != productId).toList(),
    );
  }

  static Future<void> clearFavorites() async {
    final preferences = await SharedPreferences.getInstance();
    await preferences.remove(_favoritesKey);
  }

  static Future<void> recordFootprint({
    required String id,
    required String title,
    required String imageUrl,
  }) async {
    if (id.isEmpty) {
      return;
    }
    final rest = (await readFootprint()).where((entry) => entry.id != id);
    final next = <SdkworkFootprintItem>[
      SdkworkFootprintItem(
        id: id,
        title: title,
        imageUrl: imageUrl,
        viewedAt: DateTime.now(),
      ),
      ...rest,
    ].take(_footprintLimit).toList();
    final preferences = await SharedPreferences.getInstance();
    await preferences.setString(
      _footprintKey,
      jsonEncode(
        next
            .map(
              (entry) => <String, dynamic>{
                'id': entry.id,
                'title': entry.title,
                'imageUrl': entry.imageUrl,
                'viewedAt': entry.viewedAt.toIso8601String(),
              },
            )
            .toList(),
      ),
    );
  }

  static Future<List<SdkworkFootprintItem>> readFootprint() async {
    final preferences = await SharedPreferences.getInstance();
    final raw = preferences.getString(_footprintKey);
    if (raw == null || raw.isEmpty) {
      return const <SdkworkFootprintItem>[];
    }
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! List) {
        return const <SdkworkFootprintItem>[];
      }
      return decoded
          .whereType<Map<String, dynamic>>()
          .where((entry) => entry['id'] != null)
          .map(
            (entry) => SdkworkFootprintItem(
              id: '${entry['id']}',
              title: '${entry['title'] ?? '商品'}',
              imageUrl: '${entry['imageUrl'] ?? ''}',
              viewedAt:
                  DateTime.tryParse('${entry['viewedAt']}') ?? DateTime.now(),
            ),
          )
          .toList();
    } on FormatException {
      return const <SdkworkFootprintItem>[];
    }
  }

  static Future<void> clearFootprint() async {
    final preferences = await SharedPreferences.getInstance();
    await preferences.remove(_footprintKey);
  }

  static Future<List<SdkworkFavoriteItem>> _readFavorites(String key) async {
    final preferences = await SharedPreferences.getInstance();
    final raw = preferences.getString(key);
    if (raw == null || raw.isEmpty) {
      return const <SdkworkFavoriteItem>[];
    }
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! List) {
        return const <SdkworkFavoriteItem>[];
      }
      return decoded
          .whereType<Map<String, dynamic>>()
          .map(SdkworkFavoriteItem.fromJson)
          .where((item) => item.id.isNotEmpty)
          .toList();
    } on FormatException {
      return const <SdkworkFavoriteItem>[];
    }
  }

  static Future<void> _writeFavorites(List<SdkworkFavoriteItem> items) async {
    final preferences = await SharedPreferences.getInstance();
    await preferences.setString(
      _favoritesKey,
      jsonEncode(items.map((entry) => entry.toJson()).toList()),
    );
  }
}
