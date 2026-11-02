import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// Route-reference integrity for the Flutter root.
///
/// `buildSdkworkMallRoutes()` is the only place that knows which named routes
/// exist, and capability_routes.dart maps the canonical capability ids onto
/// those paths. A page that pushes a route the shell never registered lands on
/// `onGenerateRoute` returning null (a blank navigation), and a registered route
/// nobody pushes is an implemented-but-unreachable screen. Both are invisible to
/// `flutter analyze`, so they are pinned here.
void main() {
  test('every named route used by a page is registered by the shell', () {
    final registeredRoutePaths = _registeredRoutePaths();
    expect(registeredRoutePaths, isNotEmpty,
        reason: 'buildSdkworkMallRoutes() must register named routes');

    final violations = <String>[];
    for (final file in _pageFiles()) {
      final source = file.readAsStringSync();
      for (final match in RegExp(r"'(/[a-z0-9-]+)'").allMatches(source)) {
        final route = match.group(1)!;
        if (!registeredRoutePaths.contains(route)) {
          violations.add('${_relative(file)} → $route');
        }
      }
    }

    expect(violations, isEmpty,
        reason: 'Pages push routes the shell does not register:\n${violations.join("\n")}');
  });

  test('every registered route is reachable from a page', () {
    final registeredRoutePaths = _registeredRoutePaths();
    final referenced = _routeReferences(_pageFiles());

    final unreachable =
        registeredRoutePaths.where((route) => !referenced.contains(route)).toList()..sort();
    expect(unreachable, isEmpty,
        reason: 'Routes registered by the shell but never pushed:\n${unreachable.join("\n")}');
  });

  test('capability registry paths are a subset of the registered routes', () {
    final registeredRoutePaths = _registeredRoutePaths();
    final capabilityPaths = RegExp(r"path: '(/[a-z0-9-]+)'")
        .allMatches(File('lib/routes/capability_routes.dart').readAsStringSync())
        .map((match) => match.group(1)!)
        .toSet();

    expect(capabilityPaths, isNotEmpty);
    final missing = capabilityPaths.difference(registeredRoutePaths).toList()..sort();
    expect(missing, isEmpty,
        reason: 'Capability registry paths with no shell route:\n${missing.join("\n")}');
  });
}

Set<String> _registeredRoutePaths() {
  final source = File('lib/shell/mobile_shell.dart').readAsStringSync();
  return RegExp(r"'(\/[a-z0-9-]+)':\s*\(context\)")
      .allMatches(source)
      .map((match) => match.group(1)!)
      .toSet();
}

Set<String> _routeReferences(List<File> files) {
  final routes = <String>{};
  for (final file in files) {
    for (final match in RegExp(r"'(/[a-z0-9-]+)'").allMatches(file.readAsStringSync())) {
      routes.add(match.group(1)!);
    }
  }
  return routes;
}

List<File> _pageFiles() {
  final directory = Directory('lib/pages');
  if (!directory.existsSync()) {
    return const <File>[];
  }
  return directory
      .listSync(recursive: true)
      .whereType<File>()
      .where((file) => file.path.endsWith('.dart'))
      .toList();
}

String _relative(File file) => file.path.replaceAll(r'\', '/').replaceFirst('lib/', '');
