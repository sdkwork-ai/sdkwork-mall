import 'dart:async';

import 'package:flutter/material.dart';

import '../bootstrap/session.dart';
import '../services/commerce.dart';
import '../utils/format.dart';
import '../utils/json.dart';
import 'widgets.dart';

/// 消息中心：通知入口 + 客服会话列表。
class SdkworkChatsPage extends StatefulWidget {
  const SdkworkChatsPage({super.key});

  @override
  State<SdkworkChatsPage> createState() => _SdkworkChatsPageState();
}

class _SdkworkChatsPageState extends State<SdkworkChatsPage> {
  List<Map<String, dynamic>> _conversations = const <Map<String, dynamic>>[];
  bool _loading = true;
  String _error = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      final conversations =
          await MallCommerce.instance.im.listChatConversations();
      if (!mounted) {
        return;
      }
      setState(() {
        _conversations = conversations;
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
      appBar: AppBar(title: const Text('消息中心')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(12),
              children: <Widget>[
                if (_error.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Text(_error, style: const TextStyle(color: Colors.redAccent)),
                  ),
                Card(
                  margin: EdgeInsets.zero,
                  child: ListTile(
                    leading: const Icon(Icons.notifications_outlined),
                    title: const Text('系统与交易通知'),
                    subtitle: const Text('订单、售后、物流提醒'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.of(context).pushNamed('/notices'),
                  ),
                ),
                SdkworkSectionHeader(title: '客服会话'),
                if (_conversations.isEmpty)
                  const SdkworkEmptyView(message: '暂无客服会话')
                else
                  ..._conversations.map(_buildConversationRow),
              ],
            ),
    );
  }

  Widget _buildConversationRow(Map<String, dynamic> row) {
    final lastMessageAt = asString(row, <String>['lastMessageAt']);
    final unread = (asNum(row, <String>['unread']) ?? 0).toInt();
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: const Color(0xFFFEE2E2),
          child: Text(
            asString(row, <String>['agentName'], fallback: '客').characters.first.toString(),
            style: const TextStyle(color: Color(0xFFE93B3D)),
          ),
        ),
        title: Text(asString(row, <String>['title'], fallback: '官方客服')),
        subtitle: Text(
          asString(row, <String>['lastMessage'], fallback: '开始对话'),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: <Widget>[
            if (lastMessageAt.isNotEmpty)
              Text(formatTime(lastMessageAt), style: Theme.of(context).textTheme.labelSmall),
            if (unread > 0) Badge(label: Text('$unread')),
          ],
        ),
        onTap: () => Navigator.of(context).pushNamed(
          '/chat',
          arguments: asString(row, <String>['id']),
        ),
      ),
    );
  }
}

/// 客服会话：消息流 + 文本输入，5 秒轮询保持新鲜。
class SdkworkChatPage extends StatefulWidget {
  const SdkworkChatPage({super.key, required this.conversationId});

  final String conversationId;

  @override
  State<SdkworkChatPage> createState() => _SdkworkChatPageState();
}

class _SdkworkChatPageState extends State<SdkworkChatPage> {
  static const _pollInterval = Duration(seconds: 5);

  List<Map<String, dynamic>> _messages = const <Map<String, dynamic>>[];
  String _error = '';
  bool _busy = false;
  final TextEditingController _draft = TextEditingController();
  final ScrollController _scroll = ScrollController();
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    if (!SdkworkSession.instance.isLoggedIn) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        Navigator.of(context).pushNamed('/login');
      });
      return;
    }
    _refresh();
    // 客服回复轮询：realtime CCP 接入前保持会话新鲜（与 H5 一致）。
    _pollTimer = Timer.periodic(_pollInterval, (_) => _refresh());
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _draft.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    try {
      final messages =
          await MallCommerce.instance.im.listChatMessages(widget.conversationId);
      if (!mounted) {
        return;
      }
      setState(() {
        _messages = messages;
        _error = '';
      });
      if (messages.isNotEmpty) {
        unawaited(
          MallCommerce.instance.im.markChatRead(widget.conversationId),
        );
        await WidgetsBinding.instance.endOfFrame;
        if (_scroll.hasClients && mounted) {
          _scroll.jumpTo(_scroll.position.maxScrollExtent);
        }
      }
    } catch (cause) {
      if (!mounted) {
        return;
      }
      setState(() => _error = '$cause');
    }
  }

  Future<void> _send() async {
    final content = _draft.text.trim();
    if (content.isEmpty || _busy) {
      return;
    }
    setState(() => _busy = true);
    try {
      await MallCommerce.instance.im.sendChatMessage(widget.conversationId, content);
      _draft.clear();
      await _refresh();
    } catch (cause) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('发送失败：$cause')));
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('客服会话')),
      body: Column(
        children: <Widget>[
          if (_error.isNotEmpty)
            Padding(
              padding: const EdgeInsets.all(8),
              child: Text(_error, style: const TextStyle(color: Colors.redAccent)),
            ),
          Expanded(
            child: _messages.isEmpty
                ? const SdkworkEmptyView(message: '发送消息，客服将尽快回复')
                : ListView.builder(
                    controller: _scroll,
                    padding: const EdgeInsets.all(12),
                    itemCount: _messages.length,
                    itemBuilder: (context, index) => _buildBubble(_messages[index]),
                  ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
              child: Row(
                children: <Widget>[
                  Expanded(
                    child: TextField(
                      controller: _draft,
                      onSubmitted: (_) => _send(),
                      decoration: const InputDecoration(
                        hintText: '输入消息...',
                        border: OutlineInputBorder(),
                        isDense: true,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  FilledButton(
                    onPressed: _busy ? null : _send,
                    child: const Text('发送'),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBubble(Map<String, dynamic> message) {
    final isUser = asString(message, <String>['role'], fallback: 'agent') == 'user';
    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.7,
        ),
        decoration: BoxDecoration(
          color: isUser ? const Color(0xFFE93B3D) : Colors.white,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(
          asString(message, <String>['content']),
          style: TextStyle(color: isUser ? Colors.white : Colors.black87),
        ),
      ),
    );
  }
}

/// 系统与交易通知：cursor 分页列表，点开拉详情并标记已读。
class SdkworkNoticesPage extends StatefulWidget {
  const SdkworkNoticesPage({super.key});

  @override
  State<SdkworkNoticesPage> createState() => _SdkworkNoticesPageState();
}

class _SdkworkNoticesPageState extends State<SdkworkNoticesPage> {
  List<Map<String, dynamic>> _notices = const <Map<String, dynamic>>[];
  bool _loading = true;
  String _error = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      final page = await MallCommerce.instance.im.listNotices();
      if (!mounted) {
        return;
      }
      setState(() {
        _notices = page.items;
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

  Future<void> _openNotice(int index) async {
    final notificationId =
        asString(_notices[index], <String>['notificationId']);
    if (notificationId.isEmpty) {
      return;
    }
    final detail =
        await MallCommerce.instance.im.retrieveNotice(notificationId);
    if (!mounted) {
      return;
    }
    setState(() {
      _notices = <Map<String, dynamic>>[
        ..._notices.take(index),
        <String, dynamic>{
          ..._notices[index],
          'status': 'read',
          if (detail != null && asString(detail, <String>['body']).isNotEmpty)
            'body': asString(detail, <String>['body']),
        },
        ..._notices.skip(index + 1),
      ];
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('消息通知')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: _error.isNotEmpty && _notices.isEmpty
                  ? ListView(
                      children: <Widget>[
                        SdkworkErrorView(message: _error, onRetry: () => _load()),
                      ],
                    )
                  : _notices.isEmpty
                      ? ListView(
                          children: const <Widget>[
                            SdkworkEmptyView(message: '暂无消息通知'),
                          ],
                        )
                      : ListView(
                          padding: const EdgeInsets.all(12),
                          children: List<Widget>.generate(
                            _notices.length,
                            (index) => _buildNoticeCard(index),
                          ),
                        ),
            ),
    );
  }

  Widget _buildNoticeCard(int index) {
    final notice = _notices[index];
    final read = asString(notice, <String>['status'], fallback: 'unread') == 'read';
    return Opacity(
      opacity: read ? 0.65 : 1,
      child: Card(
        margin: const EdgeInsets.only(bottom: 12),
        child: ListTile(
          title: Row(
            children: <Widget>[
              Expanded(
                child: Text(
                  asString(notice, <String>['title'], fallback: '消息通知'),
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
              if (!read)
                Container(
                  width: 8,
                  height: 8,
                  decoration: const BoxDecoration(
                    color: Color(0xFFE93B3D),
                    shape: BoxShape.circle,
                  ),
                ),
            ],
          ),
          subtitle: Text(asString(notice, <String>['body'])),
          onTap: () => _openNotice(index),
        ),
      ),
    );
  }
}
