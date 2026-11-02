import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../bootstrap/commerce_transport.dart';
import '../services/after_sales_service.dart';
import '../services/commerce.dart';
import '../services/drive_upload_service.dart';
import '../src/i18n/runtime.dart';
import '../utils/json.dart';
import 'widgets.dart';

const Map<String, String> _afterSalesTypeKeys = <String, String>{
  'refund': 'afterSales.type.refund',
  'return': 'afterSales.type.return',
  'exchange': 'afterSales.type.exchange',
};

const Map<String, String> _afterSalesStatusKeys = <String, String>{
  'PENDING': 'afterSales.status.pending',
  'REVIEWING': 'afterSales.status.reviewing',
  'APPROVED': 'afterSales.status.approved',
  'REJECTED': 'afterSales.status.rejected',
  'COMPLETED': 'afterSales.status.completed',
  'CANCELLED': 'afterSales.status.cancelled',
};

const List<Map<String, String>> _reasonPresets = <Map<String, String>>[
  {'code': 'not-as-described', 'labelKey': 'afterSales.reason.notAsDescribed'},
  {'code': 'quality-issue', 'labelKey': 'afterSales.reason.qualityIssue'},
  {'code': 'missing-item', 'labelKey': 'afterSales.reason.missingItem'},
  {'code': 'shipping-issue', 'labelKey': 'afterSales.reason.shippingIssue'},
  {'code': 'change-mind', 'labelKey': 'afterSales.reason.changeMind'},
  {'code': 'other', 'labelKey': 'afterSales.reason.other'},
];

/// 售后中心：申请（订单预填、契约创建体）与记录撤销。
///
/// [orderId] 可为空（从「我的」进入时手工输入订单号）。
class SdkworkAfterSalesPage extends StatefulWidget {
  const SdkworkAfterSalesPage({super.key, this.orderId});

  final String? orderId;

  @override
  State<SdkworkAfterSalesPage> createState() => _SdkworkAfterSalesPageState();
}

class _SdkworkAfterSalesPageState extends State<SdkworkAfterSalesPage> {
  final TextEditingController _orderId = TextEditingController();
  final TextEditingController _description = TextEditingController();
  final TextEditingController _amount = TextEditingController();
  final TextEditingController _returnTracking = TextEditingController();
  final ImagePicker _imagePicker = ImagePicker();

  static const _maxEvidenceFiles = 6;
  static const _maxEvidenceBytes = 5 * 1024 * 1024;

  List<Map<String, dynamic>> _requests = const <Map<String, dynamic>>[];
  List<Map<String, dynamic>> _orderItems = const <Map<String, dynamic>>[];
  List<Map<String, dynamic>> _evidence = const <Map<String, dynamic>>[];
  String _type = 'refund';
  String _reasonCode = _reasonPresets.first['code']!;
  bool _loading = true;
  bool _loadingOrder = false;
  bool _busy = false;
  String? _message;
  String _returnFormRequestId = '';
  String _returnCarrierCode = afterSalesReturnCarriers.first['code']!;
  bool _returnBusy = false;
  String _progressRequestId = '';
  List<Map<String, dynamic>> _progressEvents = const <Map<String, dynamic>>[];
  bool _progressLoading = false;

  @override
  void initState() {
    super.initState();
    _orderId.text = widget.orderId ?? '';
    _reloadRequests();
  }

  @override
  void dispose() {
    _orderId.dispose();
    _description.dispose();
    _amount.dispose();
    _returnTracking.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(SdkworkI18n.t('afterSales.page.title'))),
      body: _loading
          ? SdkworkLoadingView(label: SdkworkI18n.t('afterSales.page.loading'))
          : ListView(
              padding: const EdgeInsets.symmetric(vertical: 16),
              children: [
                if (_message != null)
                  Container(
                    width: double.infinity,
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.errorContainer,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(_message!),
                  ),
                _buildApplyCard(),
                const SizedBox(height: 16),
                _buildRequestsCard(),
              ],
            ),
    );
  }

  Widget _buildApplyCard() {
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 4),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              SdkworkI18n.t('afterSales.apply.title'),
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _orderId,
                    enabled: _orderItems.isEmpty,
                    decoration: InputDecoration(
                      labelText: SdkworkI18n.t('afterSales.apply.orderLabel'),
                      border: const OutlineInputBorder(),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                _orderItems.isEmpty
                    ? FilledButton.tonal(
                        onPressed: _loadingOrder ? null : _loadOrder,
                        child: Text(
                          _loadingOrder
                              ? SdkworkI18n.t('afterSales.apply.reading')
                              : SdkworkI18n.t('afterSales.apply.readOrder'),
                        ),
                      )
                    : TextButton(
                        onPressed: _busy ? null : _clearOrder,
                        child: Text(
                          SdkworkI18n.t('afterSales.apply.changeOrder'),
                        ),
                      ),
              ],
            ),
            if (_orderItems.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(
                _amount.text.isNotEmpty
                    ? SdkworkI18n.t(
                        'afterSales.apply.orderSummaryAmount',
                        params: <String, String>{
                          'amount': _amount.text,
                          'count': '${_orderItems.length}',
                        },
                      )
                    : SdkworkI18n.t(
                        'afterSales.apply.orderSummary',
                        params: <String, String>{
                          'count': '${_orderItems.length}',
                        },
                      ),
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              children: _afterSalesTypeKeys.entries
                  .map(
                    (entry) => ChoiceChip(
                      label: Text(SdkworkI18n.t(entry.value)),
                      selected: _type == entry.key,
                      onSelected: (_) => setState(() => _type = entry.key),
                    ),
                  )
                  .toList(),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _reasonCode,
              decoration: InputDecoration(
                labelText: SdkworkI18n.t('afterSales.apply.reasonLabel'),
                border: const OutlineInputBorder(),
              ),
              items: _reasonPresets
                  .map(
                    (preset) => DropdownMenuItem<String>(
                      value: preset['code'],
                      child: Text(SdkworkI18n.t(preset['labelKey']!)),
                    ),
                  )
                  .toList(),
              onChanged: (value) => setState(() => _reasonCode = value ?? _reasonCode),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _description,
              maxLength: 200,
              decoration: InputDecoration(
                labelText: SdkworkI18n.t('afterSales.apply.descriptionLabel'),
                hintText: SdkworkI18n.t('afterSales.apply.descriptionHint'),
                border: const OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _amount,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              decoration: InputDecoration(
                labelText: SdkworkI18n.t('afterSales.apply.amountLabel'),
                border: const OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerLeft,
              child: Text(
                SdkworkI18n.t(
                  'afterSales.apply.evidenceLabel',
                  params: <String, String>{'count': '$_maxEvidenceFiles'},
                ),
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
            const SizedBox(height: 8),
            _buildEvidenceGrid(),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _busy ? null : _submit,
                child: Text(
                  _busy
                      ? SdkworkI18n.t('afterSales.apply.submitting')
                      : SdkworkI18n.t('afterSales.apply.submit'),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEvidenceGrid() {
    return GridView.count(
      crossAxisCount: 3,
      mainAxisSpacing: 8,
      crossAxisSpacing: 8,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      childAspectRatio: 1,
      children: <Widget>[
        for (final item in _evidence)
          Stack(
            fit: StackFit.expand,
            children: <Widget>[
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: Image.file(
                  File('${item['path']}'),
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) =>
                      const ColoredBox(color: Color(0xFFF3F4F6)),
                ),
              ),
              Positioned(
                top: 4,
                right: 4,
                child: InkWell(
                  onTap: () => _removeEvidence('${item['id']}'),
                  child: Container(
                    width: 20,
                    height: 20,
                    decoration: const BoxDecoration(
                      color: Color(0x8C111827),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.close, size: 14, color: Colors.white),
                  ),
                ),
              ),
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: ColoredBox(
                  color: const Color(0x8C111827),
                  child: Text(
                    item['state'] == 'uploading'
                        ? SdkworkI18n.t('afterSales.apply.evidenceUploading')
                        : SdkworkI18n.t('afterSales.apply.evidenceUploaded'),
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.white, fontSize: 10),
                  ),
                ),
              ),
            ],
          ),
        if (_evidence.length < _maxEvidenceFiles)
          InkWell(
            onTap: _chooseEvidence,
            child: Container(
              decoration: BoxDecoration(
                border: Border.all(color: const Color(0xFFD1D5DB)),
                borderRadius: BorderRadius.circular(10),
                color: Colors.white,
              ),
              child: const Icon(Icons.add, size: 32, color: Color(0xFF9CA3AF)),
            ),
          ),
      ],
    );
  }

  Widget _buildRequestsCard() {
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 4),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              SdkworkI18n.t('afterSales.list.title'),
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            if (_requests.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 16),
                child: SdkworkEmptyView(
                  message: SdkworkI18n.t('afterSales.list.empty'),
                ),
              )
            else
              for (final request in _requests) _buildRequestTile(request),
          ],
        ),
      ),
    );
  }

  Widget _buildRequestTile(Map<String, dynamic> request) {
    final requestId = asString(request, ['id']);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(
            '${_afterSalesTypeKeys[_typeKey(request)] == null ? _typeKey(request) : SdkworkI18n.t(_afterSalesTypeKeys[_typeKey(request)]!)}'
            ' · ¥${asString(request, ['requestedAmount'])}',
          ),
          subtitle: Text(
            '${SdkworkI18n.t('afterSales.list.orderNo', params: <String, String>{'id': asString(request, ['orderId'])})}'
            '${asString(request, ['afterSalesNo']).isNotEmpty ? ' · ${asString(request, ['afterSalesNo'])}' : ''}',
          ),
          trailing: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                _statusLabel(request),
                style: Theme.of(context).textTheme.bodySmall,
              ),
              if (_revokable(request)) ...[
                const SizedBox(width: 8),
                TextButton(
                  onPressed: _busy ? null : () => _cancel(request),
                  child: Text(SdkworkI18n.t('afterSales.list.cancel')),
                ),
              ],
            ],
          ),
        ),
        if (_returnable(request)) ...[
          if (_returnFormRequestId == requestId)
            _buildReturnForm()
          else
            TextButton(
              onPressed: () => setState(() {
                _returnFormRequestId = requestId;
                _returnTracking.clear();
                _returnCarrierCode = afterSalesReturnCarriers.first['code']!;
              }),
              child: Text(SdkworkI18n.t('afterSales.list.returnEntry')),
            ),
        ],
        TextButton(
          onPressed: () => _toggleProgress(requestId),
          child: Text(
            _progressRequestId == requestId
                ? SdkworkI18n.t('afterSales.list.progressCollapse')
                : SdkworkI18n.t('afterSales.list.progressToggle'),
          ),
        ),
        if (_progressRequestId == requestId) _buildProgressTimeline(),
      ],
    );
  }

  Widget _buildProgressTimeline() {
    final theme = Theme.of(context);
    if (_progressLoading) {
      return Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Text(
          SdkworkI18n.t('afterSales.list.progressLoading'),
          style: theme.textTheme.bodySmall,
        ),
      );
    }
    if (_progressEvents.isEmpty) {
      return Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: SdkworkEmptyView(
          message: SdkworkI18n.t('afterSales.list.progressEmpty'),
        ),
      );
    }
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.only(left: 12),
      decoration: BoxDecoration(
        border: Border(left: BorderSide(color: theme.dividerColor)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final event in _progressEvents)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    asString(event, ['eventType', 'action', 'toStatus'], fallback: 'event'),
                    style: theme.textTheme.bodyMedium,
                  ),
                  if (asString(event, ['createdAt']).isNotEmpty)
                    Text(
                      asString(event, ['createdAt']),
                      style: theme.textTheme.bodySmall,
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Future<void> _toggleProgress(String requestId) async {
    if (_progressRequestId == requestId) {
      setState(() => _progressRequestId = '');
      return;
    }
    setState(() {
      _progressRequestId = requestId;
      _progressEvents = const <Map<String, dynamic>>[];
      _progressLoading = true;
    });
    try {
      final events = await MallCommerce.instance.afterSales.listEvents(requestId);
      if (mounted && _progressRequestId == requestId) {
        setState(() {
          _progressEvents = events;
          _progressLoading = false;
        });
      }
    } catch (cause) {
      if (mounted) {
        setState(() {
          _progressLoading = false;
          _message = '$cause';
        });
      }
    }
  }

  Widget _buildReturnForm() {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                SdkworkI18n.t('afterSales.return.carrierLabel'),
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(width: 12),
              DropdownButton<String>(
                value: _returnCarrierCode,
                onChanged: _returnBusy
                    ? null
                    : (value) {
                        if (value != null) {
                          setState(() => _returnCarrierCode = value);
                        }
                      },
                items: [
                  for (final carrier in afterSalesReturnCarriers)
                    DropdownMenuItem<String>(
                      value: carrier['code']!,
                      child: Text(SdkworkI18n.t(carrier['nameKey']!)),
                    ),
                ],
              ),
            ],
          ),
          TextField(
            controller: _returnTracking,
            decoration: InputDecoration(
              labelText: SdkworkI18n.t('afterSales.return.trackingLabel'),
              hintText: SdkworkI18n.t('afterSales.return.trackingHint'),
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              FilledButton(
                onPressed: _returnBusy ? null : _submitReturnShipment,
                child: Text(
                  _returnBusy
                      ? SdkworkI18n.t('afterSales.return.submitting')
                      : SdkworkI18n.t('afterSales.return.submit'),
                ),
              ),
              const SizedBox(width: 8),
              TextButton(
                onPressed: _returnBusy
                    ? null
                    : () => setState(() {
                          _returnFormRequestId = '';
                          _returnTracking.clear();
                        }),
                child: Text(SdkworkI18n.t('afterSales.return.cancel')),
              ),
            ],
          ),
        ],
      ),
    );
  }

  bool _returnable(Map<String, dynamic> request) {
    final status = asString(request, ['status']).toUpperCase();
    final type = _typeKey(request);
    return status == 'APPROVED' && (type == 'return' || type == 'exchange');
  }

  Future<void> _submitReturnShipment() async {
    final trackingNo = _returnTracking.text.trim();
    if (trackingNo.isEmpty) {
      setState(() => _message = SdkworkI18n.t('afterSales.errors.trackingRequired'));
      return;
    }
    final carrier = afterSalesReturnCarriers.firstWhere(
      (entry) => entry['code'] == _returnCarrierCode,
      orElse: () => afterSalesReturnCarriers.first,
    );
    setState(() {
      _returnBusy = true;
      _message = null;
    });
    try {
      await MallCommerce.instance.afterSales.createReturnShipment(
        requestId: _returnFormRequestId,
        carrierCode: carrier['code']!,
        carrierName: carrier['nameKey'] == null
            ? null
            : SdkworkI18n.t(carrier['nameKey']!),
        trackingNo: trackingNo,
      );
      if (!mounted) {
        return;
      }
      setState(() {
        _returnBusy = false;
        _returnFormRequestId = '';
        _returnTracking.clear();
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(SdkworkI18n.t('afterSales.errors.returnSubmitted')),
        ),
      );
      await _reloadRequests();
    } catch (cause) {
      if (!mounted) {
        return;
      }
      setState(() {
        _returnBusy = false;
        _message = '$cause';
      });
    }
  }

  String _typeKey(Map<String, dynamic> request) =>
      asString(request, ['afterSalesType', 'type']).toLowerCase();

  String _statusLabel(Map<String, dynamic> request) {
    final status = asString(request, ['status']).toUpperCase();
    final key = _afterSalesStatusKeys[status];
    return key == null ? status : SdkworkI18n.t(key);
  }

  bool _revokable(Map<String, dynamic> request) {
    final status = asString(request, ['status']).toUpperCase();
    return status == 'PENDING' || status == 'REVIEWING';
  }

  Future<void> _reloadRequests() async {
    try {
      final requests = await MallCommerce.instance.afterSales.listRequests();
      if (!mounted) {
        return;
      }
      setState(() {
        _requests = requests;
        _loading = false;
      });
    } catch (cause) {
      if (!mounted) {
        return;
      }
      setState(() {
        _loading = false;
        _message = '$cause';
      });
    }
  }

  Future<void> _loadOrder() async {
    final orderId = _orderId.text.trim();
    if (orderId.isEmpty) {
      setState(() => _message = SdkworkI18n.t('afterSales.errors.orderRequired'));
      return;
    }
    setState(() {
      _loadingOrder = true;
      _message = null;
    });
    try {
      final detail = await MallCommerce.instance.orders.getOrderDetail(orderId);
      final items = asList(detail['items'])
          .map(
            (item) => <String, dynamic>{
              'orderItemId': asString(item, ['orderItemId', 'id']),
              'quantity': asNum(item, ['quantity']) ?? 1,
              'priceCny': asNum(item, ['priceCny', 'unitPrice']),
            },
          )
          .toList();
      if (!mounted) {
        return;
      }
      final paid = asNum(detail, ['paidAmount', 'paidAmountCny']);
      setState(() {
        _orderItems = items;
        if (_amount.text.isEmpty && paid != null) {
          _amount.text = paid.toStringAsFixed(2);
        }
        _loadingOrder = false;
      });
    } catch (cause) {
      if (!mounted) {
        return;
      }
      setState(() {
        _loadingOrder = false;
        _message = '$cause';
      });
    }
  }

  void _clearOrder() {
    setState(() {
      _orderItems = const <Map<String, dynamic>>[];
      _amount.clear();
      _orderId.clear();
    });
  }

  /// 拍摄/相册选图后逐张上传，凭证项带 uploading/uploaded 状态；
  /// 失败即移除并提示，绝不落本地 blob 引用（`DRIVE_SPEC.md` §18）。
  Future<void> _chooseEvidence() async {
    if (_evidence.length >= _maxEvidenceFiles) {
      return;
    }
    final picked = await _imagePicker.pickMultiImage(
      limit: _maxEvidenceFiles - _evidence.length,
    );
    for (final xfile in picked) {
      final entry = <String, dynamic>{
        'id': '${xfile.name}-${DateTime.now().microsecondsSinceEpoch}',
        'path': xfile.path,
        'name': xfile.name,
        'state': 'uploading',
        'reference': '',
      };
      setState(() => _evidence = [..._evidence, entry]);
      try {
        final bytes = await File(xfile.path).readAsBytes();
        if (bytes.length > _maxEvidenceBytes) {
          throw SdkworkApiException(
        SdkworkI18n.t('afterSales.errors.evidenceTooLarge'),
      );
        }
        final reference = await uploadDriveImage(
          client: MallCommerce.instance.client,
          declaration: sdkworkAfterSalesEvidenceUpload,
          appResourceId: sdkworkAfterSalesEvidenceUpload.scene,
          file: SdkworkUploadFile(
            fileName: xfile.name,
            contentType: xfile.mimeType ?? 'image/jpeg',
            bytes: bytes,
          ),
        );
        if (!mounted) {
          return;
        }
        setState(() {
          _evidence = _evidence
              .map((item) =>
                  item['id'] == entry['id']
                      ? <String, dynamic>{...item, 'state': 'uploaded', 'reference': reference}
                      : item)
              .toList();
        });
      } catch (cause) {
        if (!mounted) {
          return;
        }
        setState(() {
          _evidence = _evidence
              .where((item) => item['id'] != entry['id'])
              .toList();
          _message = '$cause';
        });
      }
    }
  }

  void _removeEvidence(String id) {
    setState(() {
      _evidence = _evidence.where((item) => item['id'] != id).toList();
    });
  }

  Future<void> _submit() async {
    if (_orderItems.isEmpty) {
      setState(() => _message = SdkworkI18n.t('afterSales.errors.readOrderFirst'));
      return;
    }
    final amount = num.tryParse(_amount.text.trim());
    if (amount == null || amount <= 0) {
      setState(() => _message = SdkworkI18n.t('afterSales.errors.amountInvalid'));
      return;
    }
    if (_evidence.any((item) => item['state'] == 'uploading')) {
      setState(() => _message = SdkworkI18n.t('afterSales.errors.evidenceUploading'));
      return;
    }
    setState(() {
      _busy = true;
      _message = null;
    });
    try {
      final evidenceSnapshot = _evidence
          .where((item) => item['state'] == 'uploaded' && '${item['reference']}'.isNotEmpty)
          .map(
            (item) => AfterSalesEvidenceItem(
              reference: '${item['reference']}',
              fileName: '${item['name']}',
            ),
          )
          .toList();
      await MallCommerce.instance.afterSales.createRequest(
        orderId: _orderId.text.trim(),
        afterSalesType: _type,
        reasonCode: _reasonCode,
        description: _description.text.trim().isEmpty ? null : _description.text.trim(),
        evidenceSnapshot: evidenceSnapshot,
        requestedAmountCny: amount,
        items: _orderItems
            .map(
              (item) => AfterSalesItemInput(
                orderItemId: '${item['orderItemId']}',
                requestedQuantity: (item['quantity'] as num?)?.toInt() ?? 1,
                refundAmountCny:
                    _type == 'exchange' ? null : item['priceCny'] as num?,
              ),
            )
            .toList(),
      );
      _description.clear();
      if (!mounted) {
        return;
      }
      setState(() {
        _message = SdkworkI18n.t('afterSales.errors.submitted');
        _evidence = const <Map<String, dynamic>>[];
      });
      await _reloadRequests();
    } catch (cause) {
      if (mounted) {
        setState(() => _message = '$cause');
      }
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  Future<void> _cancel(Map<String, dynamic> request) async {
    setState(() => _busy = true);
    try {
      await MallCommerce.instance.afterSales.cancelRequest(
        asString(request, ['id']),
      );
      await _reloadRequests();
    } catch (cause) {
      if (mounted) {
        setState(() => _message = '$cause');
      }
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }
}
