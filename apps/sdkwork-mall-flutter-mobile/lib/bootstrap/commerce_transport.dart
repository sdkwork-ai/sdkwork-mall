/// Commerce transport seam for the Flutter root.
///
/// PC/H5 consume federated commerce through the generated TypeScript
/// `@sdkwork/cloudrouter-app-sdk/domains` client; the Dart runtime needs a
/// generated Dart SDK family for the mall commerce authority, which the
/// ecosystem has not produced yet (`sdkwork-sdk-common-flutter` ships the
/// shared commons only). Until that family lands this seam stays intentionally
/// unimplemented and surfaces fail fast with guidance instead of issuing raw
/// HTTP.
class SdkworkMallFlutterCommerceClient {
  SdkworkMallFlutterCommerceClient({required String appApiBaseUrl, required String runtimeTarget}) {
    throw UnsupportedError(
      'mall Flutter commerce transport is pending the generated Dart SDK family; '
      'see apps/sdkwork-mall-flutter-mobile/docs/decisions.md',
    );
  }
}
