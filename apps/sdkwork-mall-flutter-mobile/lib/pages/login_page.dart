import 'package:flutter/material.dart';

import '../bootstrap/session.dart';

/// 登录: IAM Dart 家族落地前使用平台签发的访问令牌.
class SdkworkLoginPage extends StatefulWidget {
  const SdkworkLoginPage({super.key});

  @override
  State<SdkworkLoginPage> createState() => _SdkworkLoginPageState();
}

class _SdkworkLoginPageState extends State<SdkworkLoginPage> {
  final TextEditingController _token = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _token.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('登录 SDKWork 商城')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            '小程序/移动端 IAM（code2session 与原生登录）合约落地前，'
            '使用平台签发的访问令牌登录。',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _token,
            obscureText: true,
            decoration: const InputDecoration(
              labelText: '访问令牌',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _busy ? null : _signIn,
            child: Text(_busy ? '登录中...' : '登录'),
          ),
          if (SdkworkSession.instance.isLoggedIn) ...[
            const SizedBox(height: 12),
            OutlinedButton(onPressed: _signOut, child: const Text('清除令牌')),
          ],
        ],
      ),
    );
  }

  void _signIn() {
    final token = _token.text.trim();
    if (token.isEmpty) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('请输入访问令牌')));
      return;
    }
    setState(() => _busy = true);
    SdkworkSession.instance.signIn(token);
    if (mounted) {
      Navigator.of(context).pop();
    }
  }

  void _signOut() {
    SdkworkSession.instance.signOut();
    if (mounted) {
      setState(() => _token.clear());
    }
  }
}
