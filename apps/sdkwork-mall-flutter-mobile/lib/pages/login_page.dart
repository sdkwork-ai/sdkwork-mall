import 'package:flutter/material.dart';

import '../bootstrap/session.dart';
import '../services/commerce.dart';

/// 登录：账号密码走 IAM 会话合约（POST /auth/sessions），
/// 开发令牌粘贴保留为无网环境的回退入口。
class SdkworkLoginPage extends StatefulWidget {
  const SdkworkLoginPage({super.key});

  @override
  State<SdkworkLoginPage> createState() => _SdkworkLoginPageState();
}

class _SdkworkLoginPageState extends State<SdkworkLoginPage> {
  final TextEditingController _account = TextEditingController();
  final TextEditingController _password = TextEditingController();
  final TextEditingController _token = TextEditingController();
  bool _useTokenFallback = false;
  bool _busy = false;
  bool _obscure = true;

  @override
  void dispose() {
    _account.dispose();
    _password.dispose();
    _token.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('登录 SDKWork 商城')),
      body: ListView(
        padding: const EdgeInsets.symmetric(vertical: 20),
        children: [
          if (_useTokenFallback) ..._buildTokenForm() else ..._buildPasswordForm(),
          const SizedBox(height: 12),
          Center(
            child: TextButton(
              onPressed:
                  _busy ? null : () => setState(() => _useTokenFallback = !_useTokenFallback),
              child: Text(_useTokenFallback ? '使用账号密码登录' : '使用访问令牌登录（开发）'),
            ),
          ),
        ],
      ),
    );
  }

  List<Widget> _buildPasswordForm() {
    return [
      TextField(
        controller: _account,
        autocorrect: false,
        decoration: const InputDecoration(
          labelText: '用户名 / 手机号 / 邮箱',
          border: OutlineInputBorder(),
        ),
      ),
      const SizedBox(height: 16),
      TextField(
        controller: _password,
        obscureText: _obscure,
        decoration: InputDecoration(
          labelText: '密码',
          border: const OutlineInputBorder(),
          suffixIcon: IconButton(
            icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined),
            onPressed: () => setState(() => _obscure = !_obscure),
          ),
        ),
      ),
      const SizedBox(height: 16),
      FilledButton(
        onPressed: _busy ? null : _signInWithPassword,
        child: Text(_busy ? '登录中...' : '登录'),
      ),
      if (SdkworkSession.instance.isLoggedIn) ...[
        const SizedBox(height: 12),
        OutlinedButton(onPressed: _signOut, child: const Text('退出当前账号')),
      ],
    ];
  }

  List<Widget> _buildTokenForm() {
    return [
      Text(
        '开发回退：直接粘贴平台签发的访问令牌。',
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
        onPressed: _busy ? null : _signInWithToken,
        child: Text(_busy ? '登录中...' : '登录'),
      ),
      if (SdkworkSession.instance.isLoggedIn) ...[
        const SizedBox(height: 12),
        OutlinedButton(onPressed: _signOut, child: const Text('清除令牌')),
      ],
    ];
  }

  Future<void> _signInWithPassword() async {
    final account = _account.text.trim();
    final password = _password.text;
    if (account.isEmpty || password.isEmpty) {
      _showSnack('请输入账号与密码');
      return;
    }
    setState(() => _busy = true);
    try {
      final result = await MallCommerce.instance.auth.loginWithPassword(
        username: account.contains('@') || RegExp(r'^1\d{10}$').hasMatch(account) ? '' : account,
        phone: RegExp(r'^1\d{10}$').hasMatch(account) ? account : '',
        email: account.contains('@') ? account : '',
        password: password,
      );
      await SdkworkSession.instance.signInWithTokens(
        authToken: result.authToken,
        accessToken: result.accessToken,
        userId: result.userId,
      );
      if (mounted) {
        Navigator.of(context).pop();
      }
    } catch (cause) {
      _showSnack('$cause');
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  Future<void> _signInWithToken() async {
    final token = _token.text.trim();
    if (token.isEmpty) {
      _showSnack('请输入访问令牌');
      return;
    }
    await SdkworkSession.instance.signIn(token);
    if (mounted) {
      Navigator.of(context).pop();
    }
  }

  Future<void> _signOut() async {
    await SdkworkSession.instance.signOut();
    if (mounted) {
      setState(() {
        _token.clear();
        _password.clear();
      });
    }
  }

  void _showSnack(String message) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }
}
