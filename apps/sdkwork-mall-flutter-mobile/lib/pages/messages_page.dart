import 'package:flutter/material.dart';

import '../services/commerce.dart';
import '../src/i18n/runtime.dart';
import '../utils/format.dart';
import '../utils/json.dart';
import 'widgets.dart';

/// 消息中心: 通知服务（`GET /notifications`）里的系统/交易/提醒消息.
class SdkworkMessagesPage extends StatefulWidget {
  const SdkworkMessagesPage({super.key});

  @override
  State<SdkworkMessagesPage> createState() => _SdkworkMessagesPageState();
}

class _SdkworkMessagesPageState extends State<SdkworkMessagesPage> {
  List<({String category, String id, String summary, String time, String title, bool unread})>
      _rows = const [];
  bool _loading = true;
  String _error = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(SdkworkI18n.t('messages.title'))),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return SdkworkLoadingView(label: SdkworkI18n.t('messages.loading'));
    }
    if (_error.isNotEmpty) {
      return SdkworkErrorView(message: _error, onRetry: _load);
    }
    if (_rows.isEmpty) {
      return SdkworkEmptyView(message: SdkworkI18n.t('messages.empty'));
    }
    return Column(
      children: <Widget>[
        Expanded(
          child: ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: _rows.length,
            separatorBuilder: (context, index) => const SizedBox(height: 12),
            itemBuilder: (context, index) => _buildRow(_rows[index]),
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(16),
          child: Text(
            SdkworkI18n.t('messages.footnote'),
            style: Theme.of(context).textTheme.bodySmall,
            textAlign: TextAlign.center,
          ),
        ),
      ],
    );
  }

  Widget _buildRow(
    ({String category, String id, String summary, String time, String title, bool unread}) row,
  ) {
    return Card(
      margin: EdgeInsets.zero,
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: _categoryColor(row.category),
          child: Text(
            _categoryLabel(row.category),
            style: const TextStyle(color: Colors.white, fontSize: 12),
          ),
        ),
        title: Row(
          children: [
            if (row.unread)
              Padding(
                padding: const EdgeInsets.only(right: 6),
                child: Container(
                  width: 6,
                  height: 6,
                  decoration: const BoxDecoration(
                    color: Color(0xFFE93B3D),
                    shape: BoxShape.circle,
                  ),
                ),
              ),
            Expanded(
              child: Text(
                row.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (row.summary.isNotEmpty)
              Text(row.summary, maxLines: 2, overflow: TextOverflow.ellipsis),
            if (row.time.isNotEmpty) Text(row.time),
          ],
        ),
        trailing: TextButton(
          onPressed: () => Navigator.of(context).pushNamed('/notices'),
          child: Text(SdkworkI18n.t('messages.view')),
        ),
        onTap: () => Navigator.of(context).pushNamed('/notices'),
      ),
    );
  }

  Color _categoryColor(String category) {
    switch (category) {
      case 'trade':
        return const Color(0xFFE93B3D);
      case 'system':
        return const Color(0xFF2563EB);
      default:
        return const Color(0xFFF59E0B);
    }
  }

  String _categoryLabel(String category) {
    switch (category) {
      case 'trade':
        return SdkworkI18n.t('messages.categories.trade');
      case 'system':
        return SdkworkI18n.t('messages.categories.system');
      case 'notice':
        return SdkworkI18n.t('messages.categories.notice');
      default:
        return SdkworkI18n.t('messages.categories.other');
    }
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
        _rows = page.items.map((notice) {
          final requestedAt = asString(notice, <String>['requestedAt']);
          return (
            category: asString(notice, <String>['category'], fallback: 'system'),
            id: asString(notice, <String>['notificationId']),
            summary: asString(notice, <String>['body']),
            time: requestedAt.isEmpty ? '' : formatTime(requestedAt),
            title: asString(notice, <String>['title'], fallback: SdkworkI18n.t('messages.title')),
            unread: asString(notice, <String>['status'], fallback: 'read') == 'unread',
          );
        }).toList();
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
}
