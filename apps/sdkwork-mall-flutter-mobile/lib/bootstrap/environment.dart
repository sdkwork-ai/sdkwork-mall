import 'dart:convert';
import 'dart:io' show Platform;

/// Typed runtime environment loaded from the dart-define env file
/// (`--dart-define-from-file=env/sdkwork.<profile>.<environment>.json`).
class SdkworkMallFlutterEnvironment {
  const SdkworkMallFlutterEnvironment({
    required this.environment,
    required this.deploymentProfile,
    required this.profileId,
    required this.runtimeTarget,
    required this.commerceAppApiBaseUrl,
  });

  final String environment;
  final String deploymentProfile;
  final String profileId;
  final String runtimeTarget;
  final String commerceAppApiBaseUrl;

  static const _environmentValue = String.fromEnvironment(
    'SDKWORK_ENVIRONMENT',
    defaultValue: 'development',
  );
  static const _deploymentProfileValue = String.fromEnvironment(
    'SDKWORK_DEPLOYMENT_PROFILE',
    defaultValue: 'standalone',
  );
  static const _profileIdValue = String.fromEnvironment(
    'SDKWORK_PROFILE_ID',
    defaultValue: 'sdkwork-mall-flutter-mobile',
  );
  static const _runtimeTargetValue = String.fromEnvironment(
    'SDKWORK_RUNTIME_TARGET',
    defaultValue: 'flutter-android',
  );
  static const _commerceAppApiBaseUrlValue = String.fromEnvironment(
    'SDKWORK_COMMERCE_APP_API_BASE_URL',
    defaultValue: 'https://api-dev.sdkwork.com/app/v3/api',
  );

  factory SdkworkMallFlutterEnvironment.fromDefineValues() {
    String hostOverride(String key) => Platform.environment[key] ?? '';
    final baseUrl = hostOverride('SDKWORK_COMMERCE_APP_API_BASE_URL');
    return SdkworkMallFlutterEnvironment(
      environment: _environmentValue,
      deploymentProfile: _deploymentProfileValue,
      profileId: _profileIdValue,
      runtimeTarget: _runtimeTargetValue,
      commerceAppApiBaseUrl: baseUrl.isEmpty ? _commerceAppApiBaseUrlValue : baseUrl,
    );
  }

  Map<String, String> toJson() => <String, String>{
        'environment': environment,
        'deploymentProfile': deploymentProfile,
        'profileId': profileId,
        'runtimeTarget': runtimeTarget,
        'commerceAppApiBaseUrl': commerceAppApiBaseUrl,
      };

  @override
  String toString() => jsonEncode(toJson());
}
