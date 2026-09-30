import 'package:flutter/material.dart';

/// Bottom-tab mobile shell: 首页 / 分类 / 购物车 / 我的.
class SdkworkMallFlutterMobileShell extends StatelessWidget {
  const SdkworkMallFlutterMobileShell({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SDKWork 商城',
      theme: ThemeData(colorSchemeSeed: const Color(0xFF2563EB), useMaterial3: true),
      home: DefaultTabController(
        length: 4,
        child: Scaffold(
          appBar: AppBar(title: const Text('SDKWork 商城')),
          body: const TabBarView(
            children: [
              _PendingSurface(title: '首页', note: '等待生成的 Dart 商城 SDK 家族落地'),
              _PendingSurface(title: '分类', note: '等待生成的 Dart 商城 SDK 家族落地'),
              _PendingSurface(title: '购物车', note: '等待生成的 Dart 商城 SDK 家族落地'),
              _PendingSurface(title: '我的', note: '等待生成的 Dart 商城 SDK 家族落地'),
            ],
          ),
          bottomNavigationBar: const TabBar(
            tabs: [
              Tab(icon: Icon(Icons.home_outlined), text: '首页'),
              Tab(icon: Icon(Icons.grid_view_outlined), text: '分类'),
              Tab(icon: Icon(Icons.shopping_cart_outlined), text: '购物车'),
              Tab(icon: Icon(Icons.person_outline), text: '我的'),
            ],
          ),
        ),
      ),
    );
  }
}

class _PendingSurface extends StatelessWidget {
  const _PendingSurface({required this.title, required this.note});

  final String title;
  final String note;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            Text(note, textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
      ),
    );
  }
}
