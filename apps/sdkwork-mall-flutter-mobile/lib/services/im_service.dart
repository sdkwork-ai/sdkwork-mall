import '../bootstrap/commerce_transport.dart';
import '../utils/json.dart';

/// 消息域：客服会话聊天 + 系统通知。
///
/// - 聊天走联盟网关约定 `/im/chat/*`（与 H5 同 host、同信封）；
/// - 通知走生成 SDK 的 app-api 面 `GET /notifications`（cursor 分页）。
/// 新鲜度由聊天页 5 秒轮询保证，realtime CCP 接入后替换（与 H5 决策一致）。
class ImService {
  ImService(this._client);

  final SdkworkMallFlutterCommerceClient _client;

  Future<List<Map<String, dynamic>>> listChatConversations() async {
    final payload = await _client.request('/im/chat/conversations');
    return asList(payload['items']);
  }

  Future<List<Map<String, dynamic>>> listChatMessages(
    String conversationId,
  ) async {
    final payload = await _client.request(
      '/im/chat/conversations/$conversationId/messages',
    );
    return asList(payload['items']);
  }

  Future<void> sendChatMessage(String conversationId, String content) async {
    await _client.request(
      '/im/chat/conversations/$conversationId/messages',
      method: 'POST',
      body: <String, dynamic>{'content': content},
    );
  }

  Future<void> markChatRead(String conversationId) async {
    await _client.request(
      '/im/chat/conversations/$conversationId/read',
      method: 'POST',
      body: const <String, dynamic>{},
    );
  }

  Future<({List<Map<String, dynamic>> items, String nextCursor})> listNotices({
    String cursor = '',
  }) async {
    final payload = await _client.request(
      '/notifications',
      query: <String, String>{
        'page_size': '20',
        if (cursor.isNotEmpty) 'cursor': cursor,
      },
    );
    final pageInfo = asMap(payload['pageInfo']);
    return (
      items: asList(payload['items']),
      nextCursor: asString(pageInfo, <String>['nextCursor']),
    );
  }

  Future<Map<String, dynamic>?> retrieveNotice(String notificationId) async {
    try {
      return await _client.request('/notifications/$notificationId');
    } on SdkworkApiException {
      return null;
    }
  }
}
