import 'dart:async';

import 'package:flutter/material.dart';

import '../bootstrap/environment.dart';
import '../bootstrap/session.dart';
import '../services/commerce.dart';
import '../services/favorites_service.dart';
import '../src/i18n/runtime.dart';
import '../utils/format.dart';
import '../utils/json.dart';
import 'widgets.dart';

/// 发票：开票申请表单 + 我的发票列表（与 H5/小程序字段契约一致）。
class SdkworkInvoicesPage extends StatefulWidget {
  const SdkworkInvoicesPage({super.key});

  @override
  State<SdkworkInvoicesPage> createState() => _SdkworkInvoicesPageState();
}

class _SdkworkInvoicesPageState extends State<SdkworkInvoicesPage> {
  static const _titleTypeKeys = <String>[
    'invoices.titleTypePersonal',
    'invoices.titleTypeCompany',
  ];
  static const _titleTypeValues = <String>['personal', 'company'];
  static const _statusKeys = <String, String>{
    'pending': 'invoices.status.pending',
    'issued': 'invoices.status.issued',
    'cancelled': 'invoices.status.cancelled',
  };

  bool _loading = true;
  bool _busy = false;
  String _message = '';
  int _titleTypeIndex = 0;
  final TextEditingController _title = TextEditingController();
  final TextEditingController _taxNumber = TextEditingController();
  final TextEditingController _email = TextEditingController();
  final TextEditingController _orderId = TextEditingController();
  List<Map<String, dynamic>> _invoices = const <Map<String, dynamic>>[];

  @override
  void initState() {
    super.initState();
    if (SdkworkSession.instance.isLoggedIn) {
      _reload();
    } else {
      setState(() {
        _loading = false;
        _message = SdkworkI18n.t('invoices.loginRequired');
      });
    }
  }

  @override
  void dispose() {
    _title.dispose();
    _taxNumber.dispose();
    _email.dispose();
    _orderId.dispose();
    super.dispose();
  }

  Future<void> _reload() async {
    setState(() {
      _loading = true;
      _message = '';
    });
    try {
      final invoices = await MallCommerce.instance.invoices.listInvoices();
      if (!mounted) {
        return;
      }
      setState(() {
        _invoices = invoices;
        _loading = false;
      });
    } catch (cause) {
      if (!mounted) {
        return;
      }
      setState(() {
        _loading = false;
        _message = '$cause';
      });
    }
  }

  Future<void> _submit() async {
    final title = _title.text.trim();
    if (title.isEmpty) {
      setState(() => _message = SdkworkI18n.t('invoices.titleRequired'));
      return;
    }
    final titleType = _titleTypeValues[_titleTypeIndex];
    if (titleType == 'company' && _taxNumber.text.trim().isEmpty) {
      setState(() => _message = SdkworkI18n.t('invoices.taxRequired'));
      return;
    }
    setState(() {
      _busy = true;
      _message = '';
    });
    try {
      await MallCommerce.instance.invoices.createInvoice(
        title: title,
        titleType: titleType,
        taxNumber: titleType == 'company' ? _taxNumber.text.trim() : '',
        email: _email.text.trim(),
        orderId: _orderId.text.trim(),
      );
      _title.clear();
      _taxNumber.clear();
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(SdkworkI18n.t('invoices.submitted'))),
      );
      await _reload();
    } catch (cause) {
      if (!mounted) {
        return;
      }
      setState(() => _message = '$cause');
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(SdkworkI18n.t('invoices.title'))),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _reload,
              child: ListView(
                padding: const EdgeInsets.all(12),
                children: <Widget>[
                  if (_message.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Text(
                        _message,
                        style: const TextStyle(color: Colors.redAccent),
                      ),
                    ),
                  SdkworkSectionHeader(
                    title: SdkworkI18n.t('invoices.applySection'),
                  ),
                  Card(
                    margin: EdgeInsets.zero,
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: <Widget>[
                          SegmentedButton<int>(
                            segments: <ButtonSegment<int>>[
                              for (var index = 0;
                                  index < _titleTypeKeys.length;
                                  index += 1)
                                ButtonSegment<int>(
                                  value: index,
                                  label: Text(
                                    SdkworkI18n.t(_titleTypeKeys[index]),
                                  ),
                                ),
                            ],
                            selected: <int>{_titleTypeIndex},
                            onSelectionChanged: (selection) => setState(
                              () => _titleTypeIndex = selection.first,
                            ),
                          ),
                          const SizedBox(height: 12),
                          TextField(
                            controller: _title,
                            decoration: InputDecoration(
                              labelText: SdkworkI18n.t('invoices.titleLabel'),
                              hintText: SdkworkI18n.t('invoices.titleHint'),
                              border: const OutlineInputBorder(),
                            ),
                          ),
                          if (_titleTypeIndex == 1) ...<Widget>[
                            const SizedBox(height: 12),
                            TextField(
                              controller: _taxNumber,
                              decoration: InputDecoration(
                                labelText:
                                    SdkworkI18n.t('invoices.taxNumberLabel'),
                                border: const OutlineInputBorder(),
                              ),
                            ),
                          ],
                          const SizedBox(height: 12),
                          TextField(
                            controller: _email,
                            keyboardType: TextInputType.emailAddress,
                            decoration: InputDecoration(
                              labelText: SdkworkI18n.t('invoices.emailLabel'),
                              border: const OutlineInputBorder(),
                            ),
                          ),
                          const SizedBox(height: 12),
                          TextField(
                            controller: _orderId,
                            decoration: InputDecoration(
                              labelText: SdkworkI18n.t('invoices.orderIdLabel'),
                              border: const OutlineInputBorder(),
                            ),
                          ),
                          const SizedBox(height: 16),
                          FilledButton(
                            onPressed: _busy ? null : _submit,
                            child: Text(
                              _busy
                                  ? SdkworkI18n.t('invoices.submitting')
                                  : SdkworkI18n.t('invoices.submit'),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  SdkworkSectionHeader(
                    title: SdkworkI18n.t('invoices.listSection'),
                  ),
                  if (_invoices.isEmpty)
                    SdkworkEmptyView(message: SdkworkI18n.t('invoices.empty'))
                  else
                    ..._invoices.map(_buildInvoiceRow),
                ],
              ),
            ),
    );
  }

  Widget _buildInvoiceRow(Map<String, dynamic> row) {
    final amount = asNum(row, <String>['amountCny', 'amount', 'totalAmount']);
    final status = asString(row, <String>['status', 'statusName'], fallback: 'pending');
    final statusKey = _statusKeys[status.toLowerCase()];
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        title: Text(
          asString(
            row,
            <String>['title', 'invoiceTitle', 'header'],
            fallback: SdkworkI18n.t('invoices.fallbackTitle'),
          ),
        ),
        subtitle: amount != null ? Text(formatCny(amount)) : null,
        trailing: Text(
          statusKey == null ? status : SdkworkI18n.t(statusKey),
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ),
    );
  }
}

/// 设置：本地数据清理 / 会话 / 关于（环境信息）。
class SdkworkSettingsPage extends StatelessWidget {
  const SdkworkSettingsPage({super.key});

  Future<void> _confirm(
    BuildContext context, {
    required String title,
    required String content,
    required VoidCallback onConfirm,
  }) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(title),
        content: Text(content),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(SdkworkI18n.t('settings.cancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text(SdkworkI18n.t('settings.confirm')),
          ),
        ],
      ),
    );
    if (confirmed ?? false) {
      onConfirm();
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(SdkworkI18n.t('settings.done'))),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final environment = SdkworkMallFlutterEnvironment.fromDefineValues();
    return Scaffold(
      appBar: AppBar(title: Text(SdkworkI18n.t('settings.title'))),
      body: ListView(
        children: <Widget>[
          SdkworkSectionHeader(
            title: SdkworkI18n.t('settings.sections.localData'),
          ),
          Card(
            margin: EdgeInsets.zero,
            child: Column(
              children: <Widget>[
                ListTile(
                  leading: const Icon(Icons.history_outlined),
                  title: Text(SdkworkI18n.t('settings.clearFootprint')),
                  subtitle: Text(SdkworkI18n.t('settings.clearFootprintHint')),
                  onTap: () => _confirm(
                    context,
                    title: SdkworkI18n.t('settings.clearFootprint'),
                    content: SdkworkI18n.t('settings.clearFootprintConfirm'),
                    onConfirm: () =>
                        unawaited(SdkworkFavoritesStore.clearFootprint()),
                  ),
                ),
                ListTile(
                  leading: const Icon(Icons.favorite_outline),
                  title: Text(SdkworkI18n.t('settings.clearFavorites')),
                  subtitle: Text(SdkworkI18n.t('settings.clearFavoritesHint')),
                  onTap: () => _confirm(
                    context,
                    title: SdkworkI18n.t('settings.clearFavorites'),
                    content: SdkworkI18n.t('settings.clearFavoritesConfirm'),
                    onConfirm: () =>
                        unawaited(SdkworkFavoritesStore.clearFavorites()),
                  ),
                ),
              ],
            ),
          ),
          SdkworkSectionHeader(
            title: SdkworkI18n.t('settings.sections.account'),
          ),
          Card(
            margin: EdgeInsets.zero,
            child: ListenableBuilder(
              listenable: SdkworkSession.instance,
              builder: (context, _) => ListTile(
                leading: const Icon(Icons.person_outline),
                title: Text(
                  SdkworkSession.instance.isLoggedIn
                      ? SdkworkI18n.t('settings.logout')
                      : SdkworkI18n.t('settings.login'),
                ),
                subtitle: Text(
                  SdkworkSession.instance.isLoggedIn
                      ? SdkworkI18n.t('settings.logoutHint')
                      : SdkworkI18n.t('settings.loginHint'),
                ),
                onTap: SdkworkSession.instance.isLoggedIn
                    ? () => _confirm(
                          context,
                          title: SdkworkI18n.t('settings.logout'),
                          content: SdkworkI18n.t('settings.logoutConfirm'),
                          onConfirm: () => SdkworkSession.instance.signOut(),
                        )
                    : () => Navigator.of(context).pushNamed('/login'),
              ),
            ),
          ),
          SdkworkSectionHeader(
            title: SdkworkI18n.t('settings.sections.about'),
          ),
          Card(
            margin: EdgeInsets.zero,
            child: Column(
              children: <Widget>[
                ListTile(
                  leading: const Icon(Icons.info_outline),
                  title: Text(SdkworkI18n.t('settings.aboutName')),
                  subtitle: Text(SdkworkI18n.t('settings.aboutSubtitle')),
                ),
                ListTile(
                  leading: const Icon(Icons.dns_outlined),
                  title: Text(SdkworkI18n.t('settings.environment')),
                  subtitle: Text(
                    '${environment.environment} · ${environment.deploymentProfile}'
                    ' · ${environment.commerceAppApiBaseUrl}',
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}
