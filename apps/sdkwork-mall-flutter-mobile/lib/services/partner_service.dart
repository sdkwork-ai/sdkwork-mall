import '../bootstrap/commerce_transport.dart';

/// Distribution (分销) wire adapter for the Flutter root.
///
/// Contract: the partner capability's app API under the same app-api gateway
/// (`/app/v3/api/partner_join`). Single resources arrive as `{item}` and lists
/// as `{items, pageInfo}` because the transport unwraps the response envelope.
class PartnerBenefit {
  const PartnerBenefit({required this.code, required this.name, required this.value});

  final String code;
  final String name;
  final String value;

  factory PartnerBenefit.fromJson(Map<String, dynamic> json) {
    return PartnerBenefit(
      code: '${json['code'] ?? ''}',
      name: '${json['name'] ?? ''}',
      value: '${json['value'] ?? ''}',
    );
  }
}

class PartnerLevel {
  const PartnerLevel({
    required this.levelNo,
    required this.name,
    required this.joinFee,
    required this.customerRevenueRatio,
    required this.joinFeeCommissionRatio,
    required this.active,
    required this.benefits,
  });

  final int levelNo;
  final String name;
  final String joinFee;
  final String customerRevenueRatio;
  final String joinFeeCommissionRatio;
  final bool active;
  final List<PartnerBenefit> benefits;

  factory PartnerLevel.fromJson(Map<String, dynamic> json) {
    final rawBenefits = json['benefits'];
    return PartnerLevel(
      levelNo: _asInt(json['levelNo']) ?? 0,
      name: '${json['name'] ?? '—'}',
      joinFee: '${json['joinFee'] ?? '0'}',
      customerRevenueRatio: '${json['customerRevenueRatio'] ?? '0'}',
      joinFeeCommissionRatio: '${json['joinFeeCommissionRatio'] ?? '0'}',
      active: '${json['status'] ?? ''}' != 'DISABLED',
      benefits: rawBenefits is List
          ? rawBenefits
              .whereType<Map<String, dynamic>>()
              .map(PartnerBenefit.fromJson)
              .toList(growable: false)
          : const <PartnerBenefit>[],
    );
  }
}

class PartnerRules {
  const PartnerRules({
    required this.currency,
    required this.profitMarginRatio,
    required this.minWithdrawalAmount,
    required this.joinFeePolicy,
  });

  final String currency;
  final String profitMarginRatio;
  final String minWithdrawalAmount;
  final String joinFeePolicy;
}

class PartnerProgram {
  const PartnerProgram({required this.levels, required this.rules});

  final List<PartnerLevel> levels;
  final PartnerRules rules;
}

class PartnerApplication {
  const PartnerApplication({
    required this.id,
    required this.applicantType,
    required this.subjectName,
    required this.contactName,
    required this.contactPhone,
    required this.contactEmail,
    required this.targetLevelNo,
    required this.inviteCode,
    required this.status,
    required this.reviewComment,
    required this.createdAt,
  });

  final String id;
  final String applicantType;
  final String subjectName;
  final String contactName;
  final String contactPhone;
  final String contactEmail;
  final int targetLevelNo;
  final String inviteCode;
  final String status;
  final String reviewComment;
  final String createdAt;

  bool get canCancel => status == 'SUBMITTED';

  factory PartnerApplication.fromJson(Map<String, dynamic> json) {
    return PartnerApplication(
      id: '${json['id'] ?? ''}',
      applicantType: '${json['applicantType'] ?? 'INDIVIDUAL'}',
      subjectName: '${json['subjectName'] ?? ''}',
      contactName: '${json['contactName'] ?? ''}',
      contactPhone: '${json['contactPhone'] ?? ''}',
      contactEmail: '${json['contactEmail'] ?? ''}',
      targetLevelNo: _asInt(json['targetLevelNo']) ?? 1,
      inviteCode: '${json['inviteCode'] ?? ''}',
      status: '${json['status'] ?? 'SUBMITTED'}',
      reviewComment: '${json['reviewComment'] ?? ''}',
      createdAt: '${json['createdAt'] ?? ''}',
    );
  }
}

class PartnerInvitePreview {
  const PartnerInvitePreview({
    required this.code,
    required this.valid,
    required this.partnerName,
    required this.levelNo,
  });

  final String code;
  final bool valid;
  final String partnerName;
  final int? levelNo;
}

class PartnerApplicationDraft {
  const PartnerApplicationDraft({
    required this.applicantType,
    required this.subjectName,
    required this.contactName,
    required this.contactPhone,
    required this.contactEmail,
    required this.targetLevelNo,
    required this.inviteCode,
    required this.businessIntro,
  });

  final String applicantType;
  final String subjectName;
  final String contactName;
  final String contactPhone;
  final String contactEmail;
  final int targetLevelNo;
  final String inviteCode;
  final String businessIntro;
}

int? _asInt(Object? value) {
  if (value is num) {
    return value.toInt();
  }
  return int.tryParse('${value ?? ''}');
}

class PartnerService {
  PartnerService(this._client);

  final SdkworkMallFlutterCommerceClient _client;

  Future<PartnerProgram> retrieveProgram() async {
    final payload = await _client.request('/partner_join');
    final item = payload['item'];
    final data = item is Map<String, dynamic> ? item : <String, dynamic>{};
    final rules = data['rules'];
    final rawRules = rules is Map<String, dynamic> ? rules : <String, dynamic>{};
    final rawLevels = data['levels'];
    return PartnerProgram(
      levels: rawLevels is List
          ? rawLevels
              .whereType<Map<String, dynamic>>()
              .map(PartnerLevel.fromJson)
              .toList(growable: false)
          : const <PartnerLevel>[],
      rules: PartnerRules(
        currency: '${rawRules['currency'] ?? 'CNY'}',
        profitMarginRatio: '${rawRules['profitMarginRatio'] ?? '0'}',
        minWithdrawalAmount: '${rawRules['minWithdrawalAmount'] ?? '0'}',
        joinFeePolicy: '${rawRules['joinFeePolicy'] ?? ''}',
      ),
    );
  }

  Future<List<PartnerApplication>> listMyApplications({int page = 1, int pageSize = 20}) async {
    final payload = await _client.request(
      '/partner_join/applications/mine',
      query: <String, String>{'page': '$page', 'page_size': '$pageSize'},
    );
    final items = payload['items'];
    return items is List
        ? items
            .whereType<Map<String, dynamic>>()
            .map(PartnerApplication.fromJson)
            .toList(growable: false)
        : const <PartnerApplication>[];
  }

  Future<PartnerApplication> submitApplication(PartnerApplicationDraft draft) async {
    final payload = await _client.request(
      '/partner_join/applications',
      method: 'POST',
      body: <String, dynamic>{
        'applicantType': draft.applicantType,
        'subjectName': draft.subjectName,
        'contactName': draft.contactName,
        'contactPhone': draft.contactPhone,
        'contactEmail': draft.contactEmail,
        'targetLevelNo': draft.targetLevelNo,
        'inviteCode': draft.inviteCode,
        'businessIntro': draft.businessIntro,
      },
    );
    return PartnerApplication.fromJson(_item(payload));
  }

  Future<PartnerApplication> cancelApplication(String applicationId) async {
    final payload = await _client.request(
      '/partner_join/applications/${Uri.encodeComponent(applicationId)}/cancel',
      method: 'POST',
    );
    return PartnerApplication.fromJson(_item(payload));
  }

  Future<PartnerInvitePreview> validateInviteCode(String code) async {
    final payload = await _client.request(
      '/partner_join/invite_codes/${Uri.encodeComponent(code)}',
    );
    final item = _item(payload);
    return PartnerInvitePreview(
      code: '${item['code'] ?? code}',
      valid: item['valid'] == true,
      partnerName: '${item['partnerName'] ?? ''}',
      levelNo: _asInt(item['levelNo']),
    );
  }
}

Map<String, dynamic> _item(Map<String, dynamic> payload) {
  final item = payload['item'];
  return item is Map<String, dynamic> ? item : <String, dynamic>{};
}

/// Membership state derived from the newest-first application history.
String resolvePartnerMembershipState(List<PartnerApplication> applications) {
  if (applications.any((application) => application.status == 'APPROVED')) {
    return 'approved';
  }
  if (applications.any((application) => application.status == 'SUBMITTED')) {
    return 'pending';
  }
  if (applications.isEmpty) {
    return 'none';
  }
  final latest = applications.first.status;
  if (latest == 'REJECTED') {
    return 'rejected';
  }
  if (latest == 'CANCELLED') {
    return 'cancelled';
  }
  return 'none';
}

/// Same validation rules and issue-code vocabulary as the shared TS package.
List<String> validatePartnerDraft(PartnerApplicationDraft draft) {
  final issues = <String>[];
  if (draft.applicantType == 'ORGANIZATION' && draft.subjectName.trim().isEmpty) {
    issues.add('subjectNameRequired');
  }
  if (draft.contactName.trim().isEmpty) {
    issues.add('contactNameRequired');
  }
  if (!RegExp(r'^[+\d][\d\s()-]{4,24}$').hasMatch(draft.contactPhone.trim())) {
    issues.add('contactPhoneInvalid');
  }
  if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(draft.contactEmail.trim())) {
    issues.add('contactEmailInvalid');
  }
  if (draft.targetLevelNo < 1) {
    issues.add('targetLevelInvalid');
  }
  if (draft.inviteCode.trim().length > 64) {
    issues.add('inviteCodeTooLong');
  }
  return issues;
}
