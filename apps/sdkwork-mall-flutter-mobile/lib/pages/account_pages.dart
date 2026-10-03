import 'package:flutter/material.dart';

import '../bootstrap/session.dart';
import '../services/commerce.dart';
import '../utils/format.dart';
import '../utils/json.dart';
import 'widgets.dart';

/// 钱包：现金/积分余额 + 现金流水。
class SdkworkWalletPage extends StatefulWidget {
  const SdkworkWalletPage({super.key});

  @override
  State<SdkworkWalletPage> createState() => _SdkworkWalletPageState();
}

class _SdkworkWalletPageState extends State<SdkworkWalletPage> {
  bool _loading = true;
  String _error = '';
  num? _cashBalanceCny;
  num? _pointsBalance;
  List<Map<String, dynamic>> _ledger = const <Map<String, dynamic>>[];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (!SdkworkSession.instance.isLoggedIn) {
      if (!mounted) {
        return;
      }
      setState(() {
        _loading = false;
        _error = '请先登录后查看钱包';
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      final account = MallCommerce.instance.account;
      final results = await Future.wait(<Future<Object?>>[
        account.getWalletOverview(),
        account.listCashLedger(),
      ]);
      final overview = results[0] as ({num? cashBalanceCny, num? pointsBalance});
      final ledger = results[1] as List<Map<String, dynamic>>;
      if (!mounted) {
        return;
      }
      setState(() {
        _cashBalanceCny = overview.cashBalanceCny;
        _pointsBalance = overview.pointsBalance;
        _ledger = ledger;
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
      appBar: AppBar(title: const Text('钱包')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(12),
                children: <Widget>[
                  Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(16),
                      gradient: LinearGradient(
                        colors: <Color>[
                          Theme.of(context).colorScheme.primary,
                          Theme.of(context).colorScheme.tertiary,
                        ],
                      ),
                    ),
                    child: Row(
                      children: <Widget>[
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: <Widget>[
                              const Text(
                                '现金余额',
                                style: TextStyle(color: Colors.white70),
                              ),
                              Text(
                                _cashBalanceCny != null
                                    ? formatCny(_cashBalanceCny)
                                    : '--',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 26,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: <Widget>[
                              const Text(
                                '积分',
                                style: TextStyle(color: Colors.white70),
                              ),
                              Text(
                                _pointsBalance != null
                                    ? formatCny(_pointsBalance)
                                    : '--',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 26,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (_error.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.all(12),
                      child: Text(
                        _error,
                        style: const TextStyle(color: Colors.redAccent),
                      ),
                    ),
                  SdkworkSectionHeader(title: '现金流水'),
                  if (_ledger.isEmpty)
                    const SdkworkEmptyView(message: '暂无流水记录')
                  else
                    ..._ledger.map(_buildLedgerRow),
                  const Padding(
                    padding: EdgeInsets.all(16),
                    child: Text(
                      '充值与提现将在支付渠道接入后开放。',
                      style: TextStyle(color: Colors.black38, fontSize: 12),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildLedgerRow(Map<String, dynamic> row) {
    final amount = asNum(row, <String>['amountCny', 'amount', 'changeAmount']);
    final occurredAt = asString(
      row,
      <String>['occurredAt', 'createdAt', 'entryTime'],
    );
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        title: Text(
          asString(
            row,
            <String>['summary', 'title', 'remark', 'reason', 'type'],
            fallback: '钱包变动',
          ),
        ),
        subtitle: occurredAt.isEmpty ? null : Text(formatTime(occurredAt)),
        trailing: amount != null
            ? Text(
                formatCny(amount),
                style: const TextStyle(fontWeight: FontWeight.w700),
              )
            : null,
      ),
    );
  }
}

/// 我的积分：余额 + 分批 + 明细。
class SdkworkPointsPage extends StatefulWidget {
  const SdkworkPointsPage({super.key});

  @override
  State<SdkworkPointsPage> createState() => _SdkworkPointsPageState();
}

class _SdkworkPointsPageState extends State<SdkworkPointsPage> {
  bool _loading = true;
  String _error = '';
  num? _balance;
  List<Map<String, dynamic>> _lots = const <Map<String, dynamic>>[];
  List<Map<String, dynamic>> _ledger = const <Map<String, dynamic>>[];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (!SdkworkSession.instance.isLoggedIn) {
      if (!mounted) {
        return;
      }
      setState(() {
        _loading = false;
        _error = '请先登录后查看积分';
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      final summary = await MallCommerce.instance.account.getPointsSummary();
      if (!mounted) {
        return;
      }
      setState(() {
        _balance = summary.balance;
        _lots = summary.lots;
        _ledger = summary.ledger;
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
      appBar: AppBar(title: const Text('我的积分')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(12),
                children: <Widget>[
                  Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(16),
                      gradient: const LinearGradient(
                        colors: <Color>[Color(0xFFF5A623), Color(0xFFF06B3E)],
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        const Text(
                          '积分余额',
                          style: TextStyle(color: Colors.white70),
                        ),
                        Text(
                          _balance != null ? formatCny(_balance) : '--',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 28,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (_error.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.all(12),
                      child: Text(
                        _error,
                        style: const TextStyle(color: Colors.redAccent),
                      ),
                    ),
                  if (_lots.isNotEmpty) ...<Widget>[
                    SdkworkSectionHeader(title: '积分分批'),
                    ..._lots.map(_buildLotRow),
                  ],
                  SdkworkSectionHeader(title: '积分明细'),
                  if (_ledger.isEmpty)
                    const SdkworkEmptyView(message: '暂无积分记录')
                  else
                    ..._ledger.map(_buildLedgerRow),
                ],
              ),
            ),
    );
  }

  Widget _buildLotRow(Map<String, dynamic> row) {
    final points = asNum(row, <String>['points', 'availablePoints', 'remainingPoints']);
    final expiresAt = asString(row, <String>['expiresAt', 'expireTime', 'expiredAt']);
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        title: Text(
          points != null ? formatCny(points) : '--',
          style: const TextStyle(
            color: Color(0xFFF5A623),
            fontWeight: FontWeight.w800,
          ),
        ),
        trailing: expiresAt.isEmpty ? null : Text('${formatTime(expiresAt)} 过期'),
      ),
    );
  }

  Widget _buildLedgerRow(Map<String, dynamic> row) {
    final points = asNum(row, <String>['points', 'amountCny', 'amount', 'changeAmount']);
    final occurredAt = asString(row, <String>['occurredAt', 'createdAt', 'entryTime']);
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        title: Text(
          asString(
            row,
            <String>['summary', 'title', 'remark', 'reason', 'type'],
            fallback: '积分变动',
          ),
        ),
        subtitle: occurredAt.isEmpty ? null : Text(formatTime(occurredAt)),
        trailing: points != null
            ? Text(
                formatCny(points),
                style: const TextStyle(fontWeight: FontWeight.w700),
              )
            : null,
      ),
    );
  }
}

/// 会员中心：当前等级 + 可选方案。
class SdkworkMembershipPage extends StatefulWidget {
  const SdkworkMembershipPage({super.key});

  @override
  State<SdkworkMembershipPage> createState() => _SdkworkMembershipPageState();
}

class _SdkworkMembershipPageState extends State<SdkworkMembershipPage> {
  bool _loading = true;
  String _error = '';
  Map<String, dynamic>? _status;
  List<Map<String, dynamic>> _plans = const <Map<String, dynamic>>[];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (!SdkworkSession.instance.isLoggedIn) {
      if (!mounted) {
        return;
      }
      setState(() {
        _loading = false;
        _error = '请先登录后查看会员信息';
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      final account = MallCommerce.instance.account;
      final results = await Future.wait(<Future<Object?>>[
        account.getMembershipStatus(),
        account.listMembershipPlans(),
      ]);
      final status = results[0] as Map<String, dynamic>?;
      final plans = results[1] as List<Map<String, dynamic>>;
      if (!mounted) {
        return;
      }
      setState(() {
        _status = status;
        _plans = plans;
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
    final levelName = asString(
          _status ?? const <String, dynamic>{},
          <String>['levelName', 'level'],
          fallback: '普通会员',
        ),
        statusName = asString(
      _status ?? const <String, dynamic>{},
      <String>['status', 'statusName'],
      fallback: 'active',
    );
    return Scaffold(
      appBar: AppBar(title: const Text('会员中心')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(12),
              children: <Widget>[
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    gradient: const LinearGradient(
                      colors: <Color>[Color(0xFF2B2B33), Color(0xFF4B3F4E)],
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      const Text(
                        '当前等级',
                        style: TextStyle(color: Colors.white70),
                      ),
                      Text(
                        levelName,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 26,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '状态：$statusName',
                        style: const TextStyle(color: Colors.white70),
                      ),
                    ],
                  ),
                ),
                if (_error.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.all(12),
                    child: Text(
                      _error,
                      style: const TextStyle(color: Colors.redAccent),
                    ),
                  ),
                SdkworkSectionHeader(title: '会员方案'),
                if (_plans.isEmpty)
                  const SdkworkEmptyView(message: '暂无可选方案')
                else
                  ..._plans.map(
                    (plan) => Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      child: ListTile(
                        title: Text(
                          asString(
                            plan,
                            <String>['title', 'name', 'levelName'],
                            fallback: '会员方案',
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
    );
  }
}
