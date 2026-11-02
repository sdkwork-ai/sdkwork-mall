import 'package:flutter/material.dart';

import '../bootstrap/session.dart';
import '../services/commerce.dart';
import 'widgets.dart';

/// 礼品卡与红包：commerce gift-cards 合约前的预留入口。
///
/// 与 PC / H5 / 小程序保持同一份说明与回退路径（我的钱包），
/// 避免各端出现「只有某个端有入口」的能力漂移。
class SdkworkGiftCardsPage extends StatelessWidget {
  const SdkworkGiftCardsPage({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('礼品卡与红包')),
      body: ListView(
        padding: const EdgeInsets.only(bottom: 24),
        children: <Widget>[
          Card(
            margin: const EdgeInsets.all(12),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text('功能说明', style: theme.textTheme.titleSmall),
                  const SizedBox(height: 8),
                  Text(
                    '礼品卡购买、赠送、兑换与红包领取需 commerce gift-cards API。',
                    style: theme.textTheme.bodySmall,
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '当前版本仅预留入口；合约落地后在此接入余额、领取记录与兑换流程。',
                    style: theme.textTheme.bodySmall,
                  ),
                ],
              ),
            ),
          ),
          Card(
            margin: const EdgeInsets.symmetric(horizontal: 12),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  Text('可用资产', style: theme.textTheme.titleSmall),
                  const SizedBox(height: 8),
                  Text(
                    '暂无礼品卡与红包，兑换记录将在合约上线后同步。',
                    style: theme.textTheme.bodySmall,
                  ),
                  const SizedBox(height: 12),
                  FilledButton.tonal(
                    onPressed: () => Navigator.of(context).pushNamed('/wallet'),
                    child: const Text('查看我的钱包'),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// 个人资料：当前账户摘要（与 PC / H5 / 小程序同一契约字段）。
class SdkworkProfilePage extends StatefulWidget {
  const SdkworkProfilePage({super.key});

  @override
  State<SdkworkProfilePage> createState() => _SdkworkProfilePageState();
}

class _SdkworkProfilePageState extends State<SdkworkProfilePage> {
  List<({String label, String value})> _rows =
      const <({String label, String value})>[];
  bool _loading = true;
  bool _degraded = false;

  @override
  void initState() {
    super.initState();
    if (SdkworkSession.instance.isLoggedIn) {
      _reload();
    } else {
      _loading = false;
    }
  }

  Future<void> _reload() async {
    try {
      final rows = await MallCommerce.instance.profile.getProfileRows(
        sessionUserId: SdkworkSession.instance.userId,
      );
      if (!mounted) {
        return;
      }
      setState(() {
        _rows = rows;
        _degraded = false;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() {
        _degraded = true;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    if (!SdkworkSession.instance.isLoggedIn) {
      return Scaffold(
        appBar: AppBar(title: const Text('个人资料')),
        body: const SdkworkLoginRequired(message: '登录后查看个人资料'),
      );
    }
    return Scaffold(
      appBar: AppBar(title: const Text('个人资料')),
      body: _loading
          ? const SdkworkLoadingView(label: '加载个人资料...')
          : ListView(
              padding: const EdgeInsets.only(bottom: 24),
              children: <Widget>[
                if (_degraded)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                    child: Text(
                      '账户摘要暂不可用，已展示本地会话身份。',
                      style: theme.textTheme.bodySmall,
                    ),
                  ),
                Card(
                  margin:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  child: Column(
                    children: _rows
                        .map(
                          (row) => ListTile(
                            dense: true,
                            title: Text(row.label),
                            trailing: ConstrainedBox(
                              constraints: const BoxConstraints(maxWidth: 220),
                              child: Text(
                                row.value,
                                textAlign: TextAlign.right,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ),
                        )
                        .toList(),
                  ),
                ),
                Card(
                  margin:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                  child: ListTile(
                    leading: const Icon(Icons.lock_outline),
                    title: const Text('账户与安全'),
                    subtitle: const Text('登录密码、绑定手机与设备管理'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.of(context).pushNamed('/security'),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(
                    '头像与实名认证等扩展资料由 IAM 账户中心提供。',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodySmall,
                  ),
                ),
              ],
            ),
    );
  }
}

/// 账户与安全：会话身份 + IAM 认证入口。
class SdkworkSecurityPage extends StatefulWidget {
  const SdkworkSecurityPage({super.key});

  @override
  State<SdkworkSecurityPage> createState() => _SdkworkSecurityPageState();
}

class _SdkworkSecurityPageState extends State<SdkworkSecurityPage> {
  List<({String label, String value})> _rows =
      const <({String label, String value})>[];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    if (SdkworkSession.instance.isLoggedIn) {
      _reload();
    } else {
      _loading = false;
    }
  }

  Future<void> _reload() async {
    final rows = await MallCommerce.instance.profile.getSecurityRows(
      sessionUserId: SdkworkSession.instance.userId,
    );
    if (!mounted) {
      return;
    }
    setState(() {
      _rows = rows;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    if (!SdkworkSession.instance.isLoggedIn) {
      return Scaffold(
        appBar: AppBar(title: const Text('账户与安全')),
        body: const SdkworkLoginRequired(message: '登录后查看账户与安全信息'),
      );
    }
    return Scaffold(
      appBar: AppBar(title: const Text('账户与安全')),
      body: _loading
          ? const SdkworkLoadingView(label: '加载账户信息...')
          : ListView(
              padding: const EdgeInsets.only(bottom: 24),
              children: <Widget>[
                const SdkworkSectionHeader(title: '登录信息'),
                Card(
                  margin: const EdgeInsets.symmetric(horizontal: 12),
                  child: Column(
                    children: _rows
                        .map(
                          (row) => ListTile(
                            dense: true,
                            title: Text(row.label),
                            trailing: Text(row.value),
                          ),
                        )
                        .toList(),
                  ),
                ),
                const SdkworkSectionHeader(title: '安全设置'),
                Card(
                  margin: const EdgeInsets.symmetric(horizontal: 12),
                  child: Column(
                    children: <Widget>[
                      ListTile(
                        leading: const Icon(Icons.password),
                        title: const Text('修改密码'),
                        subtitle: const Text('前往登录页重新认证'),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => Navigator.of(context).pushNamed('/login'),
                      ),
                      const ListTile(
                        leading: Icon(Icons.phone_iphone),
                        title: Text('绑定手机'),
                        subtitle: Text('由 IAM 认证路由提供'),
                      ),
                      const ListTile(
                        leading: Icon(Icons.shield_outlined),
                        title: Text('登录保护'),
                        subtitle: Text('遵循平台安全策略'),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: <Widget>[
                      Text(
                        '设备管理与二次验证由 IAM 账户中心统一受理；发现异常登录请立即修改密码。',
                        textAlign: TextAlign.center,
                        style: theme.textTheme.bodySmall,
                      ),
                      const SizedBox(height: 12),
                      FilledButton.tonal(
                        onPressed: () =>
                            Navigator.of(context).pushNamed('/login'),
                        child: const Text('重新登录'),
                      ),
                    ],
                  ),
                ),
              ],
            ),
    );
  }
}

/// 未登录占位：账户类页面统一给出登录提示与入口，而不是展示空字段。
class SdkworkLoginRequired extends StatelessWidget {
  const SdkworkLoginRequired({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            const Icon(Icons.lock_outline, size: 40),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () => Navigator.of(context).pushNamed('/login'),
              child: const Text('立即登录'),
            ),
          ],
        ),
      ),
    );
  }
}