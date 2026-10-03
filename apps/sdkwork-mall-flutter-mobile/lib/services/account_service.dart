import '../bootstrap/commerce_transport.dart';
import '../utils/json.dart';

/// 账户资产域：钱包、积分、会员。
///
/// 线上契约（app-api，信封由 transport 统一解包）：单条读返回 `data.item`，
/// 列表读返回 `data.items` + `data.pageInfo`；分页参数遵循
/// `page` / `page_size`（PAGINATION_SPEC），默认页大小 20。
class AccountService {
  AccountService(this._client);

  final SdkworkMallFlutterCommerceClient _client;

  static const _pageSize = 20;

  Future<({num? cashBalanceCny, num? pointsBalance})> getWalletOverview() async {
    final results = await Future.wait(<Future<Map<String, dynamic>>>[
      _safe('/wallet/accounts/cash'),
      _safe('/wallet/accounts/points'),
    ]);
    return (
      cashBalanceCny: asNum(results[0], ['balanceCny', 'balance', 'availableAmount']),
      pointsBalance: asNum(results[1], ['balance', 'pointsBalance', 'availablePoints']),
    );
  }

  Future<List<Map<String, dynamic>>> listCashLedger() async {
    final payload = await _safe(
      '/wallet/ledger_entries/cash',
      query: <String, String>{'page': '1', 'page_size': '$_pageSize'},
    );
    return asList(payload['items']);
  }

  Future<({num? balance, List<Map<String, dynamic>> lots, List<Map<String, dynamic>> ledger})>
      getPointsSummary() async {
    final results = await Future.wait(<Future<Map<String, dynamic>>>[
      _safe('/wallet/points/summary'),
      _safe(
        '/wallet/points/lots',
        query: <String, String>{'page': '1', 'page_size': '$_pageSize'},
      ),
      _safe(
        '/wallet/ledger_entries/points',
        query: <String, String>{'page': '1', 'page_size': '$_pageSize'},
      ),
    ]);
    return (
      balance: asNum(results[0], ['balance', 'availablePoints', 'totalPoints']),
      lots: asList(results[1]['items']),
      ledger: asList(results[2]['items']),
    );
  }

  Future<Map<String, dynamic>?> getMembershipStatus() async {
    final status = await _safe('/memberships/current/status');
    if (asString(status, <String>['levelName', 'level', 'status', 'statusName']).isEmpty) {
      return null;
    }
    return status;
  }

  Future<List<Map<String, dynamic>>> listMembershipPlans() async {
    final payload = await _safe(
      '/memberships/plans',
      query: <String, String>{'page': '1', 'page_size': '$_pageSize'},
    );
    return asList(payload['items']);
  }

  /// 资产读取为展示型增强：失败时返回空对象，由页面呈现空态。
  Future<Map<String, dynamic>> _safe(
    String path, {
    Map<String, String>? query,
  }) async {
    try {
      return await _client.request(path, query: query);
    } on SdkworkApiException {
      return const <String, dynamic>{};
    }
  }
}
