import 'package:flutter/material.dart';

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
  const SdkworkPartnerPage({super.key});

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

  PartnerProgram? _program;
  List<PartnerApplication> _applications = const <PartnerApplication>[];
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
      setState(() {
        _formOpen = false;
      });
      await _load();
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
              if (_formOpen) _applyForm(theme),
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
            onPressed: () => setState(() {
              _formOpen = true;
              _issues = const <String>[];
            }),
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
    return _card(
      theme,
      children: <Widget>[
        Text(SdkworkI18n.t('partner.center.title'), style: theme.textTheme.titleSmall),
        const SizedBox(height: 6),
        Text(
          SdkworkI18n.t('partner.center.notConfigured'),
          style: theme.textTheme.bodySmall,
        ),
      ],
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
        Row(
          children: <Widget>[
            Expanded(
              child: Text(SdkworkI18n.t('partner.apply.title'), style: theme.textTheme.titleSmall),
            ),
            TextButton(
              onPressed: () => setState(() {
                _formOpen = false;
              }),
              child: Text(SdkworkI18n.t('partner.actions.close')),
            ),
          ],
        ),
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

  String _moneyText(String value) {
    final parsed = double.tryParse(value);
    return parsed == null ? '—' : formatCny(parsed);
  }
}
