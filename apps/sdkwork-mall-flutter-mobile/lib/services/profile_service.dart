import '../bootstrap/commerce_transport.dart';
import '../utils/json.dart';

/// 买家资料与账户安全域。
///
/// 线上契约（app-api）：当前账户摘要读
/// `GET /accounts/current/summary`（`accounts.current.summary.retrieve`），
/// 与 PC / H5 / 小程序使用同一接口；账户摘要不可用时由本地 IAM 会话身份兜底，
/// 保证「个人资料」「账户与安全」两页始终可渲染。
class ProfileService {
  ProfileService(this._client);

  final SdkworkMallFlutterCommerceClient _client;

  /// 账户摘要字段；失败时返回空表，由页面呈现占位。
  Future<Map<String, dynamic>> getProfile() async {
    try {
      return await _client.request('/accounts/current/summary');
    } on SdkworkApiException {
      return const <String, dynamic>{};
    }
  }

  /// 资料行（标签 + 展示值），四个客户端字段顺序一致。
  Future<List<({String label, String value})>> getProfileRows({
    String sessionUserId = '',
    String sessionDisplayName = '',
  }) async {
    final payload = await getProfile();
    String pick(List<String> keys) => asString(payload, keys);
    String orDash(String value) => value.isEmpty ? '-' : value;
    final displayName = pick(<String>[
      'displayName',
      'nickname',
      'name',
    ]);
    // Cross-client identity fallback: H5 renders 用户<last4> / SDKWork 用户,
    // the mini program renders the IAM user id — Flutter keeps the same shape
    // so the same buyer reads as one identity on every client.
    final fallbackName = sessionDisplayName.isNotEmpty
        ? sessionDisplayName
        : (sessionUserId.isEmpty
            ? ''
            : '用户${sessionUserId.length > 4 ? sessionUserId.substring(sessionUserId.length - 4) : sessionUserId}');
    return <({String label, String value})>[
      (
        label: '昵称',
        value: orDash(displayName.isNotEmpty ? displayName : fallbackName),
      ),
      (label: '邮箱', value: orDash(pick(<String>['email']))),
      (label: '手机号', value: orDash(pick(<String>['phone', 'mobile', 'phoneNumber']))),
      (
        label: '会员等级',
        value: orDash(
          pick(<String>['membershipLevel', 'levelName', 'level']),
        ),
      ),
    ];
  }

  /// 账户安全页的登录信息行。
  Future<List<({String label, String value})>> getSecurityRows({
    String sessionUserId = '',
    String sessionDisplayName = '',
  }) async {
    final rows = await getProfileRows(
      sessionUserId: sessionUserId,
      sessionDisplayName: sessionDisplayName,
    );
    final accountLabel = rows.first.value;
    return <({String label, String value})>[
      (label: '当前登录', value: accountLabel),
      (label: '用户 ID', value: sessionUserId.isEmpty ? '-' : sessionUserId),
    ];
  }
}
