import 'package:flutter/material.dart';

import '../bootstrap/session.dart';
import '../services/commerce.dart';
import '../src/i18n/runtime.dart';
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
      appBar: AppBar(title: Text(SdkworkI18n.t('accountPages.giftCards.title'))),
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
                  Text(
                    SdkworkI18n.t('accountPages.giftCards.featureTitle'),
                    style: theme.textTheme.titleSmall,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    SdkworkI18n.t('accountPages.giftCards.requirement'),
                    style: theme.textTheme.bodySmall,
                  ),
                  const SizedBox(height: 6),
                  Text(
                    SdkworkI18n.t('accountPages.giftCards.placeholder'),
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
                  Text(
                    SdkworkI18n.t('accountPages.giftCards.assetsTitle'),
                    style: theme.textTheme.titleSmall,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    SdkworkI18n.t('accountPages.giftCards.empty'),
                    style: theme.textTheme.bodySmall,
                  ),
                  const SizedBox(height: 12),
                  FilledButton.tonal(
                    onPressed: () => Navigator.of(context).pushNamed('/wallet'),
                    child: Text(SdkworkI18n.t('accountPages.giftCards.wallet')),
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
        appBar: AppBar(title: Text(SdkworkI18n.t('accountPages.profile.title'))),
        body: SdkworkLoginRequired(
          message: SdkworkI18n.t('accountPages.profile.loginRequired'),
        ),
      );
    }
    return Scaffold(
      appBar: AppBar(title: Text(SdkworkI18n.t('accountPages.profile.title'))),
      body: _loading
          ? SdkworkLoadingView(label: SdkworkI18n.t('accountPages.profile.loading'))
          : ListView(
              padding: const EdgeInsets.only(bottom: 24),
              children: <Widget>[
                if (_degraded)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                    child: Text(
                      SdkworkI18n.t('accountPages.profile.degraded'),
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
                    title: Text(SdkworkI18n.t('accountPages.profile.securityTitle')),
                    subtitle: Text(SdkworkI18n.t('accountPages.profile.securitySubtitle')),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.of(context).pushNamed('/security'),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(
                    SdkworkI18n.t('accountPages.profile.iamNote'),
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
        appBar: AppBar(title: Text(SdkworkI18n.t('accountPages.security.title'))),
        body: SdkworkLoginRequired(
          message: SdkworkI18n.t('accountPages.security.loginRequired'),
        ),
      );
    }
    return Scaffold(
      appBar: AppBar(title: Text(SdkworkI18n.t('accountPages.security.title'))),
      body: _loading
          ? SdkworkLoadingView(label: SdkworkI18n.t('accountPages.security.loading'))
          : ListView(
              padding: const EdgeInsets.only(bottom: 24),
              children: <Widget>[
                SdkworkSectionHeader(
                  title: SdkworkI18n.t('accountPages.security.loginInfoTitle'),
                ),
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
                SdkworkSectionHeader(
                  title: SdkworkI18n.t('accountPages.security.settingsTitle'),
                ),
                Card(
                  margin: const EdgeInsets.symmetric(horizontal: 12),
                  child: Column(
                    children: <Widget>[
                      ListTile(
                        leading: const Icon(Icons.password),
                        title: Text(SdkworkI18n.t('accountPages.security.changePassword')),
                        subtitle: Text(
                          SdkworkI18n.t('accountPages.security.changePasswordSubtitle'),
                        ),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => Navigator.of(context).pushNamed('/login'),
                      ),
                      ListTile(
                        leading: const Icon(Icons.phone_iphone),
                        title: Text(SdkworkI18n.t('accountPages.security.bindPhone')),
                        subtitle: Text(
                          SdkworkI18n.t('accountPages.security.bindPhoneSubtitle'),
                        ),
                      ),
                      ListTile(
                        leading: const Icon(Icons.shield_outlined),
                        title: Text(SdkworkI18n.t('accountPages.security.loginProtection')),
                        subtitle: Text(
                          SdkworkI18n.t('accountPages.security.loginProtectionSubtitle'),
                        ),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: <Widget>[
                      Text(
                        SdkworkI18n.t('accountPages.security.iamNote'),
                        textAlign: TextAlign.center,
                        style: theme.textTheme.bodySmall,
                      ),
                      const SizedBox(height: 12),
                      FilledButton.tonal(
                        onPressed: () =>
                            Navigator.of(context).pushNamed('/login'),
                        child: Text(SdkworkI18n.t('accountPages.security.relogin')),
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
  const SdkworkLoginRequired({super.key, required this.message, this.actionLabel});

  final String message;
  final String? actionLabel;

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
              child: Text(actionLabel ?? SdkworkI18n.t('accountPages.loginNow')),
            ),
          ],
        ),
      ),
    );
  }
}