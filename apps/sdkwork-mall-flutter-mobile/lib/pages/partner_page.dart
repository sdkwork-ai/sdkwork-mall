import 'package:flutter/material.dart';

import '../bootstrap/commerce_transport.dart';
import '../services/commerce.dart';
import '../services/partner_service.dart';
import '../src/i18n/runtime.dart';
import '../utils/format.dart';
import 'widgets.dart';

/// 分销中心：加盟计划、申请、邀请码校验与团队收益。
///
/// 与 PC / H5 / 小程序共用同一套能力路由 id 与文案语义；数据经
/// `PartnerService` 走统一 transport，页面不直接构造 HTTP。
class SdkworkPartnerPage extends StatefulWidget {
  const SdkworkPartnerPage({super.key, this.inviteCode = ''});

  /// Invite code carried by a shared recruitment link.
  final String inviteCode;

  @override
  State<SdkworkPartnerPage> createState() => _SdkworkPartnerPageState();
}

class _SdkworkPartnerPageState extends State<SdkworkPartnerPage> {
  final TextEditingController _inviteController = TextEditingController();
  final TextEditingController _subjectName = TextEditingController();
  final TextEditingController _contactName = TextEditingController();
  final TextEditingController _contactPhone = TextEditingController();
  final TextEditingController _contactEmail = TextEditingController();
  final TextEditingController _inviteCode = TextEditingController();
  final TextEditingController _businessIntro = TextEditingController();
  final TextEditingController _withdrawAmount = TextEditingController();
  final TextEditingController _withdrawRemark = TextEditingController();

  PartnerProgram? _program;
  PartnerCenter? _center;
  List<PartnerApplication> _applications = const <PartnerApplication>[];
  List<PartnerTeamMember> _team = const <PartnerTeamMember>[];
  List<PartnerCommissionRecord> _commissions = const <PartnerCommissionRecord>[];
  List<PartnerWithdrawal> _withdrawals = const <PartnerWithdrawal>[];
  int _teamPage = 1;
  int _teamTotal = 0;
  int _commissionPage = 1;
  int _commissionTotal = 0;
  int _withdrawalPage = 1;
  int _withdrawalTotal = 0;
  bool _teamLoading = false;
  bool _commissionLoading = false;
  bool _withdrawalLoading = false;
  bool _withdrawing = false;
  bool _withdrawSuccess = false;
  String _withdrawError = '';
  String _membershipState = 'none';
  String _error = '';
  bool _loading = true;
  bool _formOpen = false;
  bool _submitting = false;
  bool _validatingInvite = false;
  String _inviteResultTitle = '';
  String _inviteResultDetail = '';
  bool _inviteValid = false;
  String _applicantType = 'INDIVIDUAL';
  int _targetLevelNo = 1;
  List<String> _issues = const <String>[];

  @override
  void initState() {
    super.initState();
    if (widget.inviteCode.trim().isNotEmpty) {
      _inviteCode.text = widget.inviteCode.trim();
    }
    _load();
  }

  @override
  void dispose() {
    _inviteController.dispose();
    _subjectName.dispose();
    _contactName.dispose();
    _contactPhone.dispose();
    _contactEmail.dispose();
    _inviteCode.dispose();
    _businessIntro.dispose();
    _withdrawAmount.dispose();
    _withdrawRemark.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _error = '';
      _loading = true;
    });
    try {
      final service = MallCommerce.instance.partner;
      final results = await Future.wait<Object>(<Future<Object>>[
        service.retrieveProgram(),
        service.listMyApplications(),
      ]);
      final program = results[0] as PartnerProgram;
      final applications = results[1] as List<PartnerApplication>;
      final activeLevels = program.levels.where((level) => level.active).toList(growable: false);
      if (!mounted) {
        return;
      }
      setState(() {
        _program = program;
        _applications = applications;
        _membershipState = resolvePartnerMembershipState(applications);
        _targetLevelNo = _targetLevelNo >= 1
            ? _targetLevelNo
            : (activeLevels.isEmpty ? 1 : activeLevels.first.levelNo);
        _loading = false;
      });
      await _loadCenter();
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _error = '$error';
        _loading = false;
      });
    }
  }

  Future<void> _loadCenter() async {
    try {
      final center = await MallCommerce.instance.partner.retrieveCenter();
      if (!mounted) {
        return;
      }
      setState(() {
        _center = center;
      });
      await Future.wait<void>(<Future<void>>[
        _loadTeam(1),
        _loadCommissions(1),
        _loadWithdrawals(1),
      ]);
    } catch (error) {
      if (!mounted) {
        return;
      }
      final notEnrolled = error is SdkworkApiException && error.statusCode == 404;
      setState(() {
        _center = null;
        if (!notEnrolled) {
          _error = '$error';
        }
      });
    }
  }

  Future<void> _loadTeam(int page) async {
    setState(() {
      _teamLoading = true;
    });
    try {
      final result = await MallCommerce.instance.partner.listTeam(page: page);
      if (!mounted) {
        return;
      }
      setState(() {
        _team = result.items;
        _teamPage = result.page;
        _teamTotal = result.total;
        _teamLoading = false;
      });
    } catch (error) {
      if (mounted) {
        setState(() {
          _teamLoading = false;
          _error = '$error';
        });
      }
    }
  }

  Future<void> _loadCommissions(int page) async {
    setState(() {
      _commissionLoading = true;
    });
    try {
      final result = await MallCommerce.instance.partner.listCommissions(page: page);
      if (!mounted) {
        return;
      }
      setState(() {
        _commissions = result.items;
        _commissionPage = result.page;
        _commissionTotal = result.total;
        _commissionLoading = false;
      });
    } catch (error) {
      if (mounted) {
        setState(() {
          _commissionLoading = false;
          _error = '$error';
        });
      }
    }
  }

  Future<void> _loadWithdrawals(int page) async {
    setState(() {
      _withdrawalLoading = true;
    });
    try {
      final result = await MallCommerce.instance.partner.listWithdrawals(page: page);
      if (!mounted) {
        return;
      }
      setState(() {
        _withdrawals = result.items;
        _withdrawalPage = result.page;
        _withdrawalTotal = result.total;
        _withdrawalLoading = false;
      });
    } catch (error) {
      if (mounted) {
        setState(() {
          _withdrawalLoading = false;
          _withdrawError = '$error';
        });
      }
    }
  }

  Future<void> _submitWithdrawal() async {
    final center = _center;
    final amountText = _withdrawAmount.text.trim();
    final parsed = double.tryParse(amountText);
    if (center == null || amountText.isEmpty || parsed == null || parsed <= 0) {
      setState(() {
        _withdrawError = SdkworkI18n.t('partner.withdrawals.invalidAmount');
      });
      return;
    }
    if (parsed > (double.tryParse(center.availableBalance) ?? 0)) {
      setState(() {
        _withdrawError = SdkworkI18n.t('partner.withdrawals.exceedsBalance');
      });
      return;
    }
    if (parsed < (double.tryParse(center.minWithdrawalAmount) ?? 0)) {
      setState(() {
        _withdrawError = SdkworkI18n.t('partner.withdrawals.belowMin');
      });
      return;
    }
    setState(() {
      _withdrawing = true;
      _withdrawError = '';
      _withdrawSuccess = false;
    });
    try {
      await MallCommerce.instance.partner.createWithdrawal(
        amountText,
        _withdrawRemark.text.trim(),
      );
      final refreshed = await MallCommerce.instance.partner.retrieveCenter();
      if (!mounted) {
        return;
      }
      setState(() {
        _center = refreshed;
        _withdrawAmount.clear();
        _withdrawRemark.clear();
        _withdrawSuccess = true;
      });
      await _loadWithdrawals(1);
    } catch (error) {
      if (mounted) {
        setState(() {
          _withdrawError = '$error';
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _withdrawing = false;
        });
      }
    }
  }

  Future<void> _validateInvite() async {
    final code = _inviteController.text.trim();
    if (code.isEmpty || _validatingInvite) {
      return;
    }
    setState(() {
      _validatingInvite = true;
      _inviteResultTitle = '';
      _inviteResultDetail = '';
    });
    try {
      final preview = await MallCommerce.instance.partner.validateInviteCode(code);
      if (!mounted) {
        return;
      }
      setState(() {
        _inviteValid = preview.valid;
        _inviteResultTitle = SdkworkI18n.t(
          preview.valid ? 'partner.invite.valid' : 'partner.invite.invalid',
        );
        _inviteResultDetail = preview.valid
            ? '${SdkworkI18n.t('partner.invite.inviter')}: ${preview.partnerName.isEmpty ? '—' : preview.partnerName}'
                '${preview.levelNo == null ? '' : ' · ${SdkworkI18n.t('partner.invite.level')} ${preview.levelNo}'}'
            : '';
      });
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _inviteValid = false;
        _inviteResultTitle = '$error';
        _inviteResultDetail = '';
      });
    } finally {
      if (mounted) {
        setState(() {
          _validatingInvite = false;
        });
      }
    }
  }

  Future<void> _openApplyForm() async {
    if (_formOpen || _program == null) {
      return;
    }
    setState(() {
      _formOpen = true;
      _issues = const <String>[];
    });
    final applyTitle = SdkworkI18n.t('partner.apply.title');
    final submitted = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => Dialog.fullscreen(
        child: Scaffold(
          appBar: AppBar(
            title: Text(applyTitle),
          ),
          body: SingleChildScrollView(
            padding: const EdgeInsets.all(12),
            child: _applyForm(Theme.of(dialogContext)),
          ),
        ),
      ),
    );
    if (!mounted) {
      return;
    }
    setState(() {
      _formOpen = false;
    });
    if (submitted == true) {
      await _load();
    }
  }

  void _closeApplyForm([bool submitted = false]) {
    final navigator = Navigator.of(context);
    if (navigator.canPop()) {
      navigator.pop(submitted);
    } else if (mounted) {
      setState(() {
        _formOpen = false;
      });
    }
  }

  Future<void> _submit() async {
    if (_submitting) {
      return;
    }
    final draft = PartnerApplicationDraft(
      applicantType: _applicantType,
      subjectName: _subjectName.text,
      contactName: _contactName.text,
      contactPhone: _contactPhone.text,
      contactEmail: _contactEmail.text,
      targetLevelNo: _targetLevelNo,
      inviteCode: _inviteCode.text,
      businessIntro: _businessIntro.text,
    );
    final issues = validatePartnerDraft(draft);
    if (issues.isNotEmpty) {
      setState(() {
        _issues = issues
            .map((code) => SdkworkI18n.t('partner.issues.$code'))
            .toList(growable: false);
      });
      return;
    }
    setState(() {
      _issues = const <String>[];
      _submitting = true;
    });
    try {
      await MallCommerce.instance.partner.submitApplication(draft);
      if (!mounted) {
        return;
      }
      _closeApplyForm(true);
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _issues = <String>['$error'];
      });
    } finally {
      if (mounted) {
        setState(() {
          _submitting = false;
        });
      }
    }
  }

  Future<void> _cancel(String applicationId) async {
    try {
      await MallCommerce.instance.partner.cancelApplication(applicationId);
      await _load();
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _error = '$error';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(SdkworkI18n.t('partner.page.title'))),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.only(bottom: 24),
          children: <Widget>[
            if (_loading)
              const Padding(
                padding: EdgeInsets.all(24),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_error.isNotEmpty)
              _card(
                theme,
                children: <Widget>[
                  SdkworkInlineError(message: _error, onRetry: _load),
                  const SizedBox(height: 12),
                  FilledButton(
                    onPressed: _load,
                    child: Text(SdkworkI18n.t('partner.page.retry')),
                  ),
                ],
              )
            else ...<Widget>[
              _statusCard(theme),
              _centerCard(theme),
              _inviteCard(theme),
              if (_center != null) _teamCard(theme),
              if (_center != null) _commissionCard(theme),
              if (_center != null) _withdrawalCard(theme),
              _programCard(theme),
              _applicationsCard(theme),
            ],
          ],
        ),
      ),
    );
  }

  Widget _card(ThemeData theme, {required List<Widget> children}) {
    return Card(
      margin: const EdgeInsets.fromLTRB(12, 6, 12, 6),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: children,
        ),
      ),
    );
  }

  Widget _statusCard(ThemeData theme) {
    return _card(
      theme,
      children: <Widget>[
        Text(
          SdkworkI18n.t('partner.page.eyebrow').toUpperCase(),
          style: theme.textTheme.labelSmall,
        ),
        const SizedBox(height: 4),
        Text(
          SdkworkI18n.t('partner.status.$_membershipState.title'),
          style: theme.textTheme.titleLarge,
        ),
        const SizedBox(height: 4),
        Text(
          SdkworkI18n.t('partner.status.$_membershipState.description'),
          style: theme.textTheme.bodySmall,
        ),
        if (_program != null) ...<Widget>[
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 4,
            children: _summaryChips(_program!).map((String text) {
              return Chip(label: Text(text), visualDensity: VisualDensity.compact);
            }).toList(growable: false),
          ),
        ],
        if (_membershipState != 'pending') ...<Widget>[
          const SizedBox(height: 12),
          FilledButton(
            onPressed: _openApplyForm,
            child: Text(
              SdkworkI18n.t(
                _membershipState == 'approved'
                    ? 'partner.actions.reapply'
                    : 'partner.actions.apply',
              ),
            ),
          ),
        ],
      ],
    );
  }

  List<String> _summaryChips(PartnerProgram program) {
    final active = program.levels.where((level) => level.active).toList(growable: false);
    if (active.isEmpty) {
      return const <String>[];
    }
    final maxRatio = active
        .map((level) => double.tryParse(level.customerRevenueRatio) ?? 0)
        .reduce((left, right) => left > right ? left : right);
    final minFee = active
        .map((level) => double.tryParse(level.joinFee) ?? 0)
        .reduce((left, right) => left < right ? left : right);
    return <String>[
      '${SdkworkI18n.t('partner.program.level')} ${active.length}',
      '${SdkworkI18n.t('partner.program.customerRevenue')} ${_percentText(maxRatio.toString())}',
      '${SdkworkI18n.t('partner.program.joinFee')} ${formatCny(minFee)}',
    ];
  }

  Widget _centerCard(ThemeData theme) {
    final center = _center;
    if (center == null) {
      return _card(
        theme,
        children: <Widget>[
          Text(SdkworkI18n.t('partner.center.title'), style: theme.textTheme.titleSmall),
          const SizedBox(height: 6),
          Text(
            SdkworkI18n.t('partner.center.notEnrolled'),
            style: theme.textTheme.bodySmall,
          ),
        ],
      );
    }
    return _card(
      theme,
      children: <Widget>[
        Text(SdkworkI18n.t('partner.center.title'), style: theme.textTheme.titleSmall),
        const SizedBox(height: 6),
        Wrap(
          spacing: 12,
          runSpacing: 4,
          children: <Widget>[
            Text('${SdkworkI18n.t('partner.center.team')} ${center.teamSize}',
                style: theme.textTheme.bodySmall),
            Text('${SdkworkI18n.t('partner.center.directTeam')} ${center.directTeamSize}',
                style: theme.textTheme.bodySmall),
            Text('${SdkworkI18n.t('partner.center.customers')} ${center.customerCount}',
                style: theme.textTheme.bodySmall),
          ],
        ),
        const SizedBox(height: 6),
        Text(
          '${SdkworkI18n.t('partner.center.inviteCode')}: ${center.inviteCode.isEmpty ? '—' : center.inviteCode}',
          style: theme.textTheme.bodySmall,
        ),
      ],
    );
  }

  Widget _teamCard(ThemeData theme) {
    final center = _center!;
    return _card(
      theme,
      children: <Widget>[
        Text(SdkworkI18n.t('partner.team.title'), style: theme.textTheme.titleSmall),
        if (_team.isEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(SdkworkI18n.t('partner.team.empty'), style: theme.textTheme.bodySmall),
          ),
        ..._team.map((PartnerTeamMember member) {
          return Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(member.name.isEmpty ? member.partnerId : member.name,
                    style: theme.textTheme.bodyLarge),
                Text(
                  '${member.levelName.isEmpty ? member.levelNo : member.levelName}'
                  ' · ${SdkworkI18n.t('partner.team.depth')} ${member.depth}'
                  ' · ${SdkworkI18n.t('partner.team.customerCount')} ${member.customerCount}',
                  style: theme.textTheme.bodySmall,
                ),
                Text(
                  '${SdkworkI18n.t('partner.team.totalCommission')} ${_moneyText(member.totalCommission, center.currency)}'
                  ' · ${SdkworkI18n.t('partner.team.availableBalance')} ${_moneyText(member.availableBalance, center.currency)}',
                  style: theme.textTheme.bodySmall,
                ),
              ],
            ),
          );
        }),
        _pager(
          theme: theme,
          page: _teamPage,
          total: _teamTotal,
          loading: _teamLoading,
          onPrevious: () => _loadTeam(_teamPage - 1),
          onNext: () => _loadTeam(_teamPage + 1),
        ),
      ],
    );
  }

  Widget _commissionCard(ThemeData theme) {
    final center = _center!;
    return _card(
      theme,
      children: <Widget>[
        Text(SdkworkI18n.t('partner.commissions.title'), style: theme.textTheme.titleSmall),
        if (_commissions.isEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(SdkworkI18n.t('partner.commissions.empty'),
                style: theme.textTheme.bodySmall),
          ),
        ..._commissions.map((PartnerCommissionRecord record) {
          return Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(_moneyText(record.amount, center.currency), style: theme.textTheme.bodyLarge),
                Text(
                  '${record.sourceType}${record.sourceRef.isEmpty ? '' : ' · ${record.sourceRef}'}',
                  style: theme.textTheme.bodySmall,
                ),
                Text(
                  '${SdkworkI18n.t('partner.commissions.baseAmount')} ${_moneyText(record.baseAmount, center.currency)}'
                  ' · ${SdkworkI18n.t('partner.commissions.ratio')} ${_percentText(record.ratio)}'
                  ' · ${SdkworkI18n.t('partner.commissions.levelOffset')} ${record.levelOffset}',
                  style: theme.textTheme.bodySmall,
                ),
                Text(formatTime(record.computedAt), style: theme.textTheme.bodySmall),
              ],
            ),
          );
        }),
        _pager(
          theme: theme,
          page: _commissionPage,
          total: _commissionTotal,
          loading: _commissionLoading,
          onPrevious: () => _loadCommissions(_commissionPage - 1),
          onNext: () => _loadCommissions(_commissionPage + 1),
        ),
      ],
    );
  }

  Widget _withdrawalCard(ThemeData theme) {
    final center = _center!;
    return _card(
      theme,
      children: <Widget>[
        Text(SdkworkI18n.t('partner.withdrawals.title'), style: theme.textTheme.titleSmall),
        const SizedBox(height: 6),
        Wrap(
          spacing: 12,
          runSpacing: 4,
          children: <Widget>[
            Text(
              '${SdkworkI18n.t('partner.withdrawals.available')} ${_moneyText(center.availableBalance, center.currency)}',
              style: theme.textTheme.bodySmall,
            ),
            Text(
              '${SdkworkI18n.t('partner.withdrawals.pending')} ${_moneyText(center.frozenBalance, center.currency)}',
              style: theme.textTheme.bodySmall,
            ),
            Text(
              '${SdkworkI18n.t('partner.withdrawals.totalEarned')} ${_moneyText(center.totalCommission, center.currency)}',
              style: theme.textTheme.bodySmall,
            ),
            Text(
              '${SdkworkI18n.t('partner.withdrawals.withdrawn')} ${_moneyText(center.withdrawnAmount, center.currency)}',
              style: theme.textTheme.bodySmall,
            ),
          ],
        ),
        const SizedBox(height: 10),
        Text(
          SdkworkI18n.t('partner.withdrawals.minWithdrawal', params: <String, String>{
            'value': _moneyText(center.minWithdrawalAmount, center.currency),
          }),
          style: theme.textTheme.bodySmall,
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _withdrawAmount,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: InputDecoration(
            labelText: SdkworkI18n.t('partner.withdrawals.amount'),
            hintText: SdkworkI18n.t('partner.withdrawals.amountPlaceholder'),
            border: const OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _withdrawRemark,
          decoration: InputDecoration(
            labelText: SdkworkI18n.t('partner.withdrawals.remark'),
            border: const OutlineInputBorder(),
          ),
        ),
        if (_withdrawError.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              _withdrawError,
              style: theme.textTheme.bodySmall?.copyWith(color: Colors.red.shade700),
            ),
          ),
        if (_withdrawSuccess)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              SdkworkI18n.t('partner.withdrawals.success'),
              style: theme.textTheme.bodySmall?.copyWith(color: Colors.green.shade700),
            ),
          ),
        const SizedBox(height: 8),
        FilledButton(
          onPressed: _withdrawing ? null : _submitWithdrawal,
          child: Text(
            _withdrawing
                ? SdkworkI18n.t('partner.actions.submitting')
                : SdkworkI18n.t('partner.withdrawals.submit'),
          ),
        ),
        if (_withdrawals.isEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(SdkworkI18n.t('partner.withdrawals.empty'),
                style: theme.textTheme.bodySmall),
          ),
        ..._withdrawals.map((PartnerWithdrawal withdrawal) {
          return Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Row(
                  children: <Widget>[
                    Expanded(
                      child: Text(_moneyText(withdrawal.amount, center.currency),
                          style: theme.textTheme.bodyLarge),
                    ),
                    Text(
                      SdkworkI18n.t(
                        'partner.withdrawalStatusLabel.${withdrawal.status.toUpperCase()}',
                      ),
                      style: theme.textTheme.bodySmall,
                    ),
                  ],
                ),
                if (withdrawal.reviewRemark.isNotEmpty)
                  Text(withdrawal.reviewRemark, style: theme.textTheme.bodySmall),
                Text(formatTime(withdrawal.createdAt), style: theme.textTheme.bodySmall),
              ],
            ),
          );
        }),
        _pager(
          theme: theme,
          page: _withdrawalPage,
          total: _withdrawalTotal,
          loading: _withdrawalLoading,
          onPrevious: () => _loadWithdrawals(_withdrawalPage - 1),
          onNext: () => _loadWithdrawals(_withdrawalPage + 1),
        ),
      ],
    );
  }

  Widget _pager({
    required ThemeData theme,
    required int page,
    required int total,
    required bool loading,
    required VoidCallback onPrevious,
    required VoidCallback onNext,
  }) {
    if (total <= 0) {
      return const SizedBox.shrink();
    }
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.end,
        children: <Widget>[
          TextButton(
            onPressed: page <= 1 || loading ? null : onPrevious,
            child: const Text('‹'),
          ),
          Text('$page', style: theme.textTheme.bodySmall),
          TextButton(
            onPressed: page * 10 >= total || loading ? null : onNext,
            child: const Text('›'),
          ),
        ],
      ),
    );
  }

  Widget _inviteCard(ThemeData theme) {
    return _card(
      theme,
      children: <Widget>[
        Text(SdkworkI18n.t('partner.invite.title'), style: theme.textTheme.titleSmall),
        const SizedBox(height: 6),
        Text(
          SdkworkI18n.t('partner.invite.description'),
          style: theme.textTheme.bodySmall,
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _inviteController,
          decoration: InputDecoration(
            labelText: SdkworkI18n.t('partner.invite.placeholder'),
            border: const OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 8),
        OutlinedButton(
          onPressed: _validatingInvite ? null : _validateInvite,
          child: Text(
            _validatingInvite
                ? SdkworkI18n.t('partner.page.loading')
                : SdkworkI18n.t('partner.actions.validate'),
          ),
        ),
        if (_inviteResultTitle.isNotEmpty) ...<Widget>[
          const SizedBox(height: 8),
          Text(
            _inviteResultTitle,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: _inviteValid ? Colors.green.shade700 : Colors.red.shade700,
              fontWeight: FontWeight.w600,
            ),
          ),
          if (_inviteResultDetail.isNotEmpty)
            Text(_inviteResultDetail, style: theme.textTheme.bodySmall),
        ],
      ],
    );
  }

  Widget _applyForm(ThemeData theme) {
    final activeLevels = (_program?.levels ?? const <PartnerLevel>[])
        .where((level) => level.active)
        .toList(growable: false);
    return _card(
      theme,
      children: <Widget>[
        Text(
          SdkworkI18n.t('partner.apply.description'),
          style: theme.textTheme.bodySmall,
        ),
        const SizedBox(height: 10),
        DropdownButtonFormField<String>(
          initialValue: _applicantType,
          decoration: InputDecoration(
            labelText: SdkworkI18n.t('partner.apply.applicantType'),
            border: const OutlineInputBorder(),
          ),
          items: <DropdownMenuItem<String>>[
            DropdownMenuItem<String>(
              value: 'INDIVIDUAL',
              child: Text(SdkworkI18n.t('partner.apply.individual')),
            ),
            DropdownMenuItem<String>(
              value: 'ORGANIZATION',
              child: Text(SdkworkI18n.t('partner.apply.organization')),
            ),
          ],
          onChanged: (String? value) {
            if (value != null) {
              setState(() {
                _applicantType = value;
              });
            }
          },
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _subjectName,
          decoration: InputDecoration(
            labelText: SdkworkI18n.t('partner.apply.subjectName'),
            border: const OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _contactName,
          decoration: InputDecoration(
            labelText: SdkworkI18n.t('partner.apply.contactName'),
            border: const OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _contactPhone,
          keyboardType: TextInputType.phone,
          decoration: InputDecoration(
            labelText: SdkworkI18n.t('partner.apply.contactPhone'),
            border: const OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _contactEmail,
          keyboardType: TextInputType.emailAddress,
          decoration: InputDecoration(
            labelText: SdkworkI18n.t('partner.apply.contactEmail'),
            border: const OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 10),
        DropdownButtonFormField<int>(
          initialValue: _targetLevelNo,
          decoration: InputDecoration(
            labelText: SdkworkI18n.t('partner.apply.targetLevel'),
            border: const OutlineInputBorder(),
          ),
          items: activeLevels.map((PartnerLevel level) {
            return DropdownMenuItem<int>(
              value: level.levelNo,
              child: Text('${level.name} · ${SdkworkI18n.t('partner.program.level')} ${level.levelNo}'),
            );
          }).toList(growable: false),
          onChanged: (int? value) {
            if (value != null) {
              setState(() {
                _targetLevelNo = value;
              });
            }
          },
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _inviteCode,
          decoration: InputDecoration(
            labelText: SdkworkI18n.t('partner.apply.inviteCode'),
            border: const OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _businessIntro,
          maxLines: 3,
          decoration: InputDecoration(
            labelText: SdkworkI18n.t('partner.apply.businessIntro'),
            border: const OutlineInputBorder(),
          ),
        ),
        if (_issues.isNotEmpty) ...<Widget>[
          const SizedBox(height: 8),
          ..._issues.map((String issue) {
            return Text(
              issue,
              style: theme.textTheme.bodySmall?.copyWith(color: Colors.red.shade700),
            );
          }),
        ],
        const SizedBox(height: 10),
        FilledButton(
          onPressed: _submitting ? null : _submit,
          child: Text(
            SdkworkI18n.t(
              _submitting ? 'partner.actions.submitting' : 'partner.actions.submit',
            ),
          ),
        ),
      ],
    );
  }

  Widget _programCard(ThemeData theme) {
    final levels = _program?.levels ?? const <PartnerLevel>[];
    return _card(
      theme,
      children: <Widget>[
        Text(SdkworkI18n.t('partner.program.title'), style: theme.textTheme.titleSmall),
        const SizedBox(height: 6),
        Text(
          SdkworkI18n.t('partner.program.description'),
          style: theme.textTheme.bodySmall,
        ),
        if (levels.isEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              SdkworkI18n.t('partner.program.empty'),
              style: theme.textTheme.bodySmall,
            ),
          ),
        ...levels.map((PartnerLevel level) {
          return Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text('${level.name} · ${level.levelNo}', style: theme.textTheme.bodyLarge),
                Text(
                  '${SdkworkI18n.t('partner.program.joinFee')} ${_moneyText(level.joinFee)}'
                  ' · ${SdkworkI18n.t('partner.program.customerRevenue')} ${_percentText(level.customerRevenueRatio)}'
                  ' · ${SdkworkI18n.t('partner.program.joinFeeCommission')} ${_percentText(level.joinFeeCommissionRatio)}',
                  style: theme.textTheme.bodySmall,
                ),
                ...level.benefits.map((PartnerBenefit benefit) {
                  return Text(
                    '· ${benefit.name}${benefit.value.isEmpty ? '' : ' · ${benefit.value}'}',
                    style: theme.textTheme.bodySmall,
                  );
                }),
              ],
            ),
          );
        }),
      ],
    );
  }

  Widget _applicationsCard(ThemeData theme) {
    return _card(
      theme,
      children: <Widget>[
        Text(
          SdkworkI18n.t('partner.applications.title'),
          style: theme.textTheme.titleSmall,
        ),
        if (_applications.isEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              SdkworkI18n.t('partner.applications.empty'),
              style: theme.textTheme.bodySmall,
            ),
          ),
        ..._applications.map((PartnerApplication application) {
          return Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Row(
                  children: <Widget>[
                    Expanded(
                      child: Text(
                        application.subjectName.isEmpty
                            ? application.contactName
                            : application.subjectName,
                        style: theme.textTheme.bodyLarge,
                      ),
                    ),
                    Text(
                      SdkworkI18n.t('partner.statusLabel.${application.status}'),
                      style: theme.textTheme.bodySmall,
                    ),
                  ],
                ),
                Text(
                  '${SdkworkI18n.t('partner.applications.targetLevel')} ${application.targetLevelNo}'
                  ' · ${SdkworkI18n.t('partner.applications.submittedAt')} ${formatTime(application.createdAt)}',
                  style: theme.textTheme.bodySmall,
                ),
                if (application.reviewComment.isNotEmpty)
                  Text(
                    '${SdkworkI18n.t('partner.applications.reviewComment')}: ${application.reviewComment}',
                    style: theme.textTheme.bodySmall,
                  ),
                if (application.canCancel)
                  Align(
                    alignment: Alignment.centerRight,
                    child: TextButton(
                      onPressed: () => _cancel(application.id),
                      child: Text(SdkworkI18n.t('partner.actions.cancelApplication')),
                    ),
                  ),
              ],
            ),
          );
        }),
      ],
    );
  }

  String _percentText(String value) {
    final parsed = double.tryParse(value);
    return parsed == null ? '—' : '${parsed.toStringAsFixed(parsed.truncateToDouble() == parsed ? 0 : 2)}%';
  }

  String _moneyText(String value, [String currency = 'CNY']) {
    final parsed = double.tryParse(value);
    if (parsed == null) {
      return '—';
    }
    return currency == 'CNY'
        ? formatCny(parsed)
        : '$currency ${parsed.toStringAsFixed(2)}';
  }
}
