/// Typed accessors for loose API payloads.
String asString(
  Map<String, dynamic> map,
  List<String> keys, {
  String fallback = '',
}) {
  for (final key in keys) {
    final value = map[key];
    if (value != null && value.toString().isNotEmpty) {
      return value.toString();
    }
  }
  return fallback;
}

num? asNum(Map<String, dynamic> map, List<String> keys) {
  for (final key in keys) {
    final value = map[key];
    if (value is num) {
      return value;
    }
    if (value is String) {
      return num.tryParse(value);
    }
  }
  return null;
}

Map<String, dynamic> asMap(Object? value) =>
    value is Map<String, dynamic> ? value : <String, dynamic>{};

List<Map<String, dynamic>> asList(Object? value) =>
    value is List ? value.whereType<Map<String, dynamic>>().toList() : <Map<String, dynamic>>[];
