import 'package:flutter/material.dart';

import '../services/commerce.dart';
import '../services/messages_service.dart';
import '../utils/format.dart';
import 'widgets.dart';

/// 消息中心: 订单与售后进度即时合成（对齐 H5 `/buyer/messages`）.
class SdkworkMessagesPage extends StatefulWidget {
  const SdkworkMessagesPage({super.key});

  @override
  State<SdkworkMessagesPage> createState() => _SdkworkMessagesPageState();
}

class _SdkworkMessagesPageState extends State<SdkworkMessagesPage> {
  List<MallMessageRow> _rows = const <MallMessageRow>[];
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
      appBar: AppBar(title: const Text('消息中心')),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const SdkworkLoadingView(label: '加载消息...');
    }
    if (_error.isNotEmpty) {
      return SdkworkErrorView(message: _error, onRetry: _load);
    }
    if (_rows.isEmpty) {
      return const SdkworkEmptyView(message: '暂无消息');
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
            '消息由订单与售后进度即时合成；推送通知将在消息服务上线后开放。',
            style: Theme.of(context).textTheme.bodySmall,
            textAlign: TextAlign.center,
          ),
        ),
      ],
    );
  }

  Widget _buildRow(MallMessageRow row) {
    final isOrder = row.type == 'order';
    final target = isOrder ? '/orders' : '/after-sales';
    return Card(
      margin: EdgeInsets.zero,
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: isOrder ? const Color(0xFFE93B3D) : const Color(0xFFF59E0B),
          child: Text(
            isOrder ? '单' : '修',
            style: const TextStyle(color: Colors.white, fontSize: 13),
          ),
        ),
        title: Text(
          row.title,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(row.summary, maxLines: 1, overflow: TextOverflow.ellipsis),
            if (row.occurredAt.isNotEmpty) Text(formatTime(row.occurredAt)),
          ],
        ),
        trailing: TextButton(
          onPressed: () => Navigator.of(context).pushNamed(target),
          child: const Text('查看'),
        ),
        onTap: () => Navigator.of(context).pushNamed(target),
      ),
    );
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      final rows = await MallCommerce.instance.messages.listRows();
      if (!mounted) {
        return;
      }
      setState(() {
        _rows = rows;
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
