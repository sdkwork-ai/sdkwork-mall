import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'session.dart';

/// Commerce transport seam for the Flutter root.
///
/// The generated Dart SDK family for the mall commerce authority has not been
/// produced yet, so this client speaks the same commerce app-api contract the
/// H5/MP consumers use, through a single [request] seam: envelope unwrapping
/// (`{code, data, traceId}`), ProblemDetail error mapping, bearer auth, and a
/// bounded timeout live here and nowhere else. When the Dart SDK family lands,
/// services swap this transport for the generated client without page changes.
class SdkworkMallFlutterCommerceClient {
  SdkworkMallFlutterCommerceClient({
    required this.appApiBaseUrl,
  });

  final String appApiBaseUrl;
  final HttpClient _http = HttpClient()
    ..connectionTimeout = const Duration(seconds: 15);

  Future<Map<String, dynamic>> request(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? body,
    Map<String, String>? query,
  }) async {
    var url = '${appApiBaseUrl.replaceAll(RegExp(r'/+$'), '')}$path';
    if (query != null) {
      final params = <String>[];
      query.forEach((key, value) {
        if (value.isNotEmpty) {
          params.add(
            '${Uri.encodeQueryComponent(key)}=${Uri.encodeQueryComponent(value)}',
          );
        }
      });
      if (params.isNotEmpty) {
        url = '$url?${params.join('&')}';
      }
    }

    final request = await _http.openUrl(method, Uri.parse(url));
    request.headers.contentType = ContentType.json;
    final token = SdkworkSession.instance.token;
    if (token.isNotEmpty) {
      request.headers.set(HttpHeaders.authorizationHeader, 'Bearer $token');
    }
    if (body != null) {
      request.write(jsonEncode(body));
    }

    final response = await request.close().timeout(const Duration(seconds: 15));
    final text = await response.transform(utf8.decoder).join();
    final decoded = text.isEmpty
        ? <String, dynamic>{}
        : jsonDecode(text) as Map<String, dynamic>;

    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (decoded.containsKey('code')) {
        if (num.tryParse('${decoded['code']}') == 0) {
          final data = decoded['data'];
          return data is Map<String, dynamic>
              ? data
              : <String, dynamic>{'value': data};
        }
        throw SdkworkApiException(
          '${decoded['message'] ?? '请求失败'}',
          code: decoded['code']?.toString(),
          traceId: decoded['traceId']?.toString(),
        );
      }
      return decoded;
    }

    throw SdkworkApiException(
      (decoded['detail'] ??
              decoded['title'] ??
              decoded['message'] ??
              '请求失败（HTTP ${response.statusCode}）')
          .toString(),
      code: (decoded['code'] ?? response.statusCode).toString(),
      traceId: decoded['traceId']?.toString(),
      statusCode: response.statusCode,
    );
  }
}

class SdkworkApiException implements Exception {
  SdkworkApiException(
    this.message, {
    this.code,
    this.traceId,
    this.statusCode,
  });

  final String message;
  final String? code;
  final String? traceId;
  final int? statusCode;

  @override
  String toString() => message;
}
