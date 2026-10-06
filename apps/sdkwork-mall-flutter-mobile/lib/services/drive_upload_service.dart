import '../bootstrap/commerce_transport.dart';
import 'package:crypto/crypto.dart' as crypto;

/// Upload declaration value carried from
/// `specs/upload.declaration.json` (`DRIVE_SPEC.md` §18).
class SdkworkUploadDeclaration {
  const SdkworkUploadDeclaration({
    required this.appResourceType,
    required this.scene,
    required this.source,
    this.uploadProfileCode = 'image',
    this.retentionMode = 'long_term',
  });

  final String appResourceType;
  final String scene;
  final String source;
  final String uploadProfileCode;
  final String retentionMode;
}

/// The mall after-sales evidence intent (`specs/upload.declaration.json`).
const sdkworkAfterSalesEvidenceUpload = SdkworkUploadDeclaration(
  appResourceType: 'mall.after-sales-evidence',
  scene: 'after-sales-evidence',
  source: 'sdkwork-mall-flutter-mobile',
);

/// Bytes plus identity of one picked evidence image.
class SdkworkUploadFile {
  const SdkworkUploadFile({
    required this.fileName,
    required this.contentType,
    required this.bytes,
  });

  final String fileName;
  final String contentType;
  final List<int> bytes;
}

/// Pure: builds the `POST /drive/uploader/uploads` body for one file.
Map<String, dynamic> buildUploaderPrepareBody({
  required SdkworkUploadDeclaration declaration,
  required String appResourceId,
  required SdkworkUploadFile file,
}) {
  final fingerprint =
      '${declaration.source}:${file.fileName}:${file.contentType}:${file.bytes.length}';
  final taskId = 'uploader-$fingerprint';
  return <String, dynamic>{
    'appResourceId': appResourceId,
    'appResourceType': declaration.appResourceType,
    'checksumSha256Hex': crypto.sha256.convert(file.bytes).toString(),
    'chunkSizeBytes': '5242880',
    'contentType': file.contentType,
    'contentLength': '${file.bytes.length}',
    'fileFingerprint': fingerprint,
    'id': 'upload-item-$taskId',
    'originalFileName': file.fileName,
    'retention': <String, dynamic>{'mode': declaration.retentionMode},
    'scene': declaration.scene,
    'source': declaration.source,
    'taskId': taskId,
    'uploadProfileCode': declaration.uploadProfileCode,
  };
}

/// Pure: the persist-safe `drive://` reference (`DRIVE_SPEC.md` §10).
String formatDriveImageUri(String spaceId, String nodeId) =>
    'drive://spaces/$spaceId/nodes/$nodeId';

/// Drive uploader dev-contract flow over the Flutter transport seam:
/// prepare → presigned part → raw storage PUT (ETag) → part registration →
/// session completion. Returns the backend-addressable `drive://` reference.
Future<String> uploadDriveImage({
  required SdkworkMallFlutterCommerceClient client,
  required SdkworkUploadDeclaration declaration,
  required String appResourceId,
  required SdkworkUploadFile file,
}) async {
  final prepareBody = buildUploaderPrepareBody(
    declaration: declaration,
    appResourceId: appResourceId,
    file: file,
  );
  final prepared = await client.request(
    '/drive/uploader/uploads',
    method: 'POST',
    body: prepareBody,
  );
  final uploadItem = asMap(prepared['uploadItem']);
  final uploadSession = asMap(prepared['uploadSession']);
  final uploadSessionId =
      '${uploadItem['uploadSessionId'] ?? uploadSession['id'] ?? ''}';
  final spaceId = '${uploadItem['spaceId'] ?? uploadSession['spaceId'] ?? ''}';
  final nodeId = '${uploadItem['nodeId'] ?? uploadSession['nodeId'] ?? ''}';
  if (uploadSessionId.isEmpty || spaceId.isEmpty || nodeId.isEmpty) {
    throw const SdkworkApiException('存储会话创建失败：响应缺少会话标识');
  }

  final presigned = await client.request(
    '/drive/upload_sessions/$uploadSessionId/parts/1',
    method: 'PUT',
    body: <String, dynamic>{'requestedTtlSeconds': 600},
  );
  final uploadUrl = '${presigned['uploadUrl'] ?? ''}';
  if (uploadUrl.isEmpty) {
    throw const SdkworkApiException('存储预签名失败：响应缺少 uploadUrl');
  }
  final stored = await client.rawPut(
    uploadUrl,
    body: file.bytes,
    contentType: file.contentType,
  );

  await client.request(
    '/drive/uploader/uploads/${uploadItem['id']}/parts/1',
    method: 'POST',
    body: <String, dynamic>{
      'uploadSessionId': uploadSessionId,
      'offsetBytes': '0',
      'sizeBytes': '${file.bytes.length}',
      'etag': stored.etag,
    },
  );

  await client.request(
    '/drive/upload_sessions/$uploadSessionId/complete',
    method: 'POST',
    body: <String, dynamic>{
      'uploadId': uploadSession['storageUploadId'] ?? '',
      'contentType': file.contentType,
      'contentLength': '${file.bytes.length}',
      'checksumSha256Hex': prepareBody['checksumSha256Hex'],
      'parts': <Map<String, dynamic>>[
        <String, dynamic>{'partNo': 1, 'etag': stored.etag},
      ],
    },
  );

  return formatDriveImageUri(spaceId, nodeId);
}

Map<String, dynamic> asMap(Object? value) =>
    value is Map<String, dynamic> ? value : <String, dynamic>{};
