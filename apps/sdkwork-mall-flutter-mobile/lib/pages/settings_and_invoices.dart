import 'dart:async';

import 'package:flutter/material.dart';

import '../bootstrap/environment.dart';
import '../bootstrap/session.dart';
import '../services/commerce.dart';
import '../services/favorites_service.dart';
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
  static const _titleTypeLabels = <String>['个人', '企业'];
  static const _titleTypeValues = <String>['personal', 'company'];
  static const _statusTexts = <String, String>{
    'pending': '待开具',
    'issued': '已开具',
    'cancelled': '已作废',
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
        _message = '请先登录后管理发票';
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
      setState(() => _message = '请填写发票抬头');
      return;
    }
    final titleType = _titleTypeValues[_titleTypeIndex];
    if (titleType == 'company' && _taxNumber.text.trim().isEmpty) {
      setState(() => _message = '企业抬头需要填写税号');
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
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('开票申请已提交')));
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
      appBar: AppBar(title: const Text('发票')),
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
                  SdkworkSectionHeader(title: '申请开票'),
                  Card(
                    margin: EdgeInsets.zero,
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: <Widget>[
                          SegmentedButton<int>(
                            segments: _titleTypeLabels
                                .map(
                                  (label) => ButtonSegment<int>(
                                    value: _titleTypeLabels.indexOf(label),
                                    label: Text(label),
                                  ),
                                )
                                .toList(),
                            selected: <int>{_titleTypeIndex},
                            onSelectionChanged: (selection) => setState(
                              () => _titleTypeIndex = selection.first,
                            ),
                          ),
                          const SizedBox(height: 12),
                          TextField(
                            controller: _title,
                            decoration: const InputDecoration(
                              labelText: '发票抬头',
                              hintText: '个人或企业名称',
                              border: OutlineInputBorder(),
                            ),
                          ),
                          if (_titleTypeIndex == 1) ...<Widget>[
                            const SizedBox(height: 12),
                            TextField(
                              controller: _taxNumber,
                              decoration: const InputDecoration(
                                labelText: '税号',
                                border: OutlineInputBorder(),
                              ),
                            ),
                          ],
                          const SizedBox(height: 12),
                          TextField(
                            controller: _email,
                            keyboardType: TextInputType.emailAddress,
                            decoration: const InputDecoration(
                              labelText: '接收邮箱（选填）',
                              border: OutlineInputBorder(),
                            ),
                          ),
                          const SizedBox(height: 12),
                          TextField(
                            controller: _orderId,
                            decoration: const InputDecoration(
                              labelText: '关联订单号（选填）',
                              border: OutlineInputBorder(),
                            ),
                          ),
                          const SizedBox(height: 16),
                          FilledButton(
                            onPressed: _busy ? null : _submit,
                            child: Text(_busy ? '提交中...' : '提交开票申请'),
                          ),
                        ],
                      ),
                    ),
                  ),
                  SdkworkSectionHeader(title: '我的发票'),
                  if (_invoices.isEmpty)
                    const SdkworkEmptyView(message: '暂无发票')
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
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        title: Text(
          asString(row, <String>['title', 'invoiceTitle', 'header'], fallback: '发票'),
        ),
        subtitle: amount != null ? Text(formatCny(amount)) : null,
        trailing: Text(
          _statusTexts[status.toLowerCase()] ?? status,
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
      onConfirm();
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('已完成')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final environment = SdkworkMallFlutterEnvironment.fromDefineValues();
    return Scaffold(
      appBar: AppBar(title: const Text('设置')),
      body: ListView(
        children: <Widget>[
          const SdkworkSectionHeader(title: '本地数据'),
          Card(
            margin: EdgeInsets.zero,
            child: Column(
              children: <Widget>[
                ListTile(
                  leading: const Icon(Icons.history_outlined),
                  title: const Text('清空浏览足迹'),
                  subtitle: const Text('移除本机保存的浏览记录'),
                  onTap: () => _confirm(
                    context,
                    title: '清空浏览足迹',
                    content: '确定清空全部浏览记录？',
                    onConfirm: () =>
                        unawaited(SdkworkFavoritesStore.clearFootprint()),
                  ),
                ),
                ListTile(
                  leading: const Icon(Icons.favorite_outline),
                  title: const Text('清空收藏'),
                  subtitle: const Text('移除本机保存的全部收藏'),
                  onTap: () => _confirm(
                    context,
                    title: '清空收藏',
                    content: '确定移除全部收藏？',
                    onConfirm: () =>
                        unawaited(SdkworkFavoritesStore.clearFavorites()),
                  ),
                ),
              ],
            ),
          ),
          const SdkworkSectionHeader(title: '账号'),
          Card(
            margin: EdgeInsets.zero,
            child: ListenableBuilder(
              listenable: SdkworkSession.instance,
              builder: (context, _) => ListTile(
                leading: const Icon(Icons.person_outline),
                title: Text(
                  SdkworkSession.instance.isLoggedIn ? '退出登录' : '登录',
                ),
                subtitle: Text(
                  SdkworkSession.instance.isLoggedIn ? '清除本机会话凭证' : '登录后同步订单与售后',
                ),
                onTap: SdkworkSession.instance.isLoggedIn
                    ? () => _confirm(
                          context,
                          title: '退出登录',
                          content: '确定退出当前账号？',
                          onConfirm: () => SdkworkSession.instance.signOut(),
                        )
                    : () => Navigator.of(context).pushNamed('/login'),
              ),
            ),
          ),
          const SdkworkSectionHeader(title: '关于'),
          Card(
            margin: EdgeInsets.zero,
            child: Column(
              children: <Widget>[
                const ListTile(
                  leading: Icon(Icons.info_outline),
                  title: Text('SDKWork Mall'),
                  subtitle: Text('Flutter 移动商城'),
                ),
                ListTile(
                  leading: const Icon(Icons.dns_outlined),
                  title: const Text('环境'),
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
