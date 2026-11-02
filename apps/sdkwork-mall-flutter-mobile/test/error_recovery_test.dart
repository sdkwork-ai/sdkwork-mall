import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// Error-recovery invariant for the Flutter root.
///
/// A page that fails to load and only shows a message leaves the buyer with no
/// way forward except restarting the app; `SdkworkErrorView` therefore takes an
/// `onRetry` and every full-page error state must wire it to the page's loader.
/// Compact partial failures may use `SdkworkInlineError` instead, where a retry
/// is optional because the page still shows data.
void main() {
  test('every full-page error view wires a retry action', () {
    final pages = _pageFiles();
    expect(pages, isNotEmpty);

    final violations = <String>[];
    for (final file in pages) {
      final source = file.readAsStringSync();
      for (final match in RegExp(r'SdkworkErrorView\(').allMatches(source)) {
        final constructor = source.substring(match.start, source.length);
        final window = constructor.length > 240 ? constructor.substring(0, 240) : constructor;
        if (!window.contains('onRetry:')) {
          violations.add(_relative(file));
        }
      }
    }

    expect(violations, isEmpty,
        reason: 'Full-page error views without onRetry:\n${violations.join("\n")}');
  });

  test('partial failures use the inline error primitive, not a bare text row', () {
    final offenders = <String>[];
    for (final file in _pageFiles()) {
      final source = file.readAsStringSync();
      if (source.contains('Text(_error') && !source.contains('SdkworkInlineError')) {
        offenders.add(_relative(file));
      }
    }
    expect(offenders, isEmpty,
        reason: 'Bare error text rows (use SdkworkInlineError):\n${offenders.join("\n")}');
  });
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
      .where((file) => !file.path.endsWith('widgets.dart'))
      .toList();
}

String _relative(File file) => file.path.replaceAll(r'\', '/').replaceFirst('lib/', '');
