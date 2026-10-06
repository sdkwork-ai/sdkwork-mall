import 'package:flutter_test/flutter_test.dart';
import 'package:sdkwork_mall_flutter_mobile/services/after_sales_service.dart';
import 'package:sdkwork_mall_flutter_mobile/services/drive_upload_service.dart';

void main() {
  group('buildUploaderPrepareBody', () {
    test('carries the declaration and file identity per the drive wire contract', () {
      final bytes = 'evidence-bytes'.codeUnits;
      final body = buildUploaderPrepareBody(
        declaration: sdkworkAfterSalesEvidenceUpload,
        appResourceId: 'after-sales-evidence',
        file: SdkworkUploadFile(
          fileName: 'evidence.jpg',
          contentType: 'image/jpeg',
          bytes: bytes,
        ),
      );
      expect(body['appResourceType'], 'mall.after-sales-evidence');
      expect(body['appResourceId'], 'after-sales-evidence');
      expect(body['scene'], 'after-sales-evidence');
      expect(body['source'], 'sdkwork-mall-flutter-mobile');
      expect(body['uploadProfileCode'], 'image');
      expect(body['retention'], <String, dynamic>{'mode': 'long_term'});
      expect(body['originalFileName'], 'evidence.jpg');
      expect(body['contentLength'], '${bytes.length}');
      expect(body['fileFingerprint'], contains('evidence.jpg'));
      // FIPS 180-4 vector for "abc" guards the checksum pipeline end to end.
      final abcBody = buildUploaderPrepareBody(
        declaration: sdkworkAfterSalesEvidenceUpload,
        appResourceId: 'after-sales-evidence',
        file: SdkworkUploadFile(
          fileName: 'a.txt',
          contentType: 'text/plain',
          bytes: 'abc'.codeUnits,
        ),
      );
      expect(
        abcBody['checksumSha256Hex'],
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
      );
    });
  });

  group('formatDriveImageUri', () {
    test('renders the persist-safe drive reference', () {
      expect(formatDriveImageUri('space-upload', 'node-1005'),
          'drive://spaces/space-upload/nodes/node-1005');
    });
  });

  group('buildCreateAfterSalesBody evidenceSnapshot', () {
    test('rides the free-form snapshot array when evidence is present', () {
      final body = buildCreateAfterSalesBody(
        orderId: 'order-1015',
        afterSalesType: 'refund',
        reasonCode: 'not-as-described',
        evidenceSnapshot: const <AfterSalesEvidenceItem>[
          AfterSalesEvidenceItem(
            reference: 'drive://spaces/space-upload/nodes/node-1005',
            fileName: 'evidence.jpg',
          ),
        ],
        requestedAmountCny: 89,
        items: const <AfterSalesItemInput>[
          AfterSalesItemInput(orderItemId: 'item-1', requestedQuantity: 1),
        ],
      );
      final snapshot = body['evidenceSnapshot'] as List<Map<String, dynamic>>;
      expect(snapshot, hasLength(1));
      expect(snapshot.first['reference'], 'drive://spaces/space-upload/nodes/node-1005');
      expect(snapshot.first['fileName'], 'evidence.jpg');
    });

    test('omits the snapshot field when no evidence was uploaded', () {
      final body = buildCreateAfterSalesBody(
        orderId: 'order-1015',
        afterSalesType: 'refund',
        reasonCode: 'other',
        requestedAmountCny: 10,
        items: const <AfterSalesItemInput>[
          AfterSalesItemInput(orderItemId: 'item-1', requestedQuantity: 1),
        ],
      );
      expect(body.containsKey('evidenceSnapshot'), isFalse);
    });
  });
}
