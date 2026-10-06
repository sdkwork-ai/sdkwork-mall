import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../bootstrap/commerce_transport.dart';
import '../services/after_sales_service.dart';
import '../services/commerce.dart';
import '../services/drive_upload_service.dart';
import '../utils/json.dart';
import 'widgets.dart';

const Map<String, String> _afterSalesTypeLabels = <String, String>{
  'refund': '仅退款',
  'return': '退货退款',
  'exchange': '换货',
};

const Map<String, String> _afterSalesStatusLabels = <String, String>{
  'PENDING': '待审核',
  'REVIEWING': '审核中',
  'APPROVED': '已通过',
  'REJECTED': '已拒绝',
  'COMPLETED': '已完成',
  'CANCELLED': '已撤销',
};

const List<Map<String, String>> _reasonPresets = <Map<String, String>>[
  {'code': 'not-as-described', 'label': '商品与描述不符'},
  {'code': 'quality-issue', 'label': '质量问题'},
  {'code': 'missing-item', 'label': '少件/漏发'},
  {'code': 'shipping-issue', 'label': '发货/物流问题'},
  {'code': 'change-mind', 'label': '多拍/错拍/不想要了'},
  {'code': 'other', 'label': '其他'},
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
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('售后中心')),
      body: _loading
          ? const SdkworkLoadingView(label: '加载售后...')
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
            Text('申请售后', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _orderId,
                    enabled: _orderItems.isEmpty,
                    decoration: const InputDecoration(
                      labelText: '订单号',
                      border: OutlineInputBorder(),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                _orderItems.isEmpty
                    ? FilledButton.tonal(
                        onPressed: _loadingOrder ? null : _loadOrder,
                        child: Text(_loadingOrder ? '读取中...' : '读取订单'),
                      )
                    : TextButton(
                        onPressed: _busy ? null : _clearOrder,
                        child: const Text('更换订单'),
                      ),
              ],
            ),
            if (_orderItems.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(
                '${_orderItems.length} 项商品'
                '${_amount.text.isNotEmpty ? ' · 申请金额 ¥${_amount.text}' : ''}',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              children: _afterSalesTypeLabels.entries
                  .map(
                    (entry) => ChoiceChip(
                      label: Text(entry.value),
                      selected: _type == entry.key,
                      onSelected: (_) => setState(() => _type = entry.key),
                    ),
                  )
                  .toList(),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _reasonCode,
              decoration: const InputDecoration(
                labelText: '售后原因',
                border: OutlineInputBorder(),
              ),
              items: _reasonPresets
                  .map(
                    (preset) => DropdownMenuItem<String>(
                      value: preset['code'],
                      child: Text(preset['label']!),
                    ),
                  )
                  .toList(),
              onChanged: (value) => setState(() => _reasonCode = value ?? _reasonCode),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _description,
              maxLength: 200,
              decoration: const InputDecoration(
                labelText: '问题描述（选填）',
                hintText: '补充描述有助于加快审核',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _amount,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(
                labelText: '售后金额（元）',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerLeft,
              child: Text(
                '凭证上传（可选，最多 $_maxEvidenceFiles 张）',
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
                child: Text(_busy ? '提交中...' : '提交申请'),
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
                    item['state'] == 'uploading' ? '上传中...' : '已上传',
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
            Text('售后记录', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            if (_requests.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 16),
                child: SdkworkEmptyView(message: '暂无售后记录'),
              )
            else
              for (final request in _requests)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(
                    '${_afterSalesTypeLabels[_typeKey(request)] ?? _typeKey(request)}'
                    ' · ¥${asString(request, ['requestedAmount'])}',
                  ),
                  subtitle: Text(
                    '订单 ${asString(request, ['orderId'])}'
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
                          child: const Text('撤销'),
                        ),
                      ],
                    ],
                  ),
                ),
          ],
        ),
      ),
    );
  }

  String _typeKey(Map<String, dynamic> request) =>
      asString(request, ['afterSalesType', 'type']).toLowerCase();

  String _statusLabel(Map<String, dynamic> request) {
    final status = asString(request, ['status']).toUpperCase();
    return _afterSalesStatusLabels[status] ?? status;
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
      setState(() => _message = '请填写订单号');
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
          throw const SdkworkApiException('单张凭证不能超过 5MB');
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
      setState(() => _message = '请先读取订单');
      return;
    }
    final amount = num.tryParse(_amount.text.trim());
    if (amount == null || amount <= 0) {
      setState(() => _message = '请填写有效的售后金额');
      return;
    }
    if (_evidence.any((item) => item['state'] == 'uploading')) {
      setState(() => _message = '凭证仍在上传中，请稍候');
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
        _message = '售后申请已提交';
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
