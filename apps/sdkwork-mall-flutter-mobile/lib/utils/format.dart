String formatCny(num? value) {
  if (value == null) {
    return '--';
  }
  return '¥${value.toStringAsFixed(2)}';
}

String formatTime(String? value) {
  if (value == null || value.isEmpty) {
    return '--';
  }
  final date = DateTime.tryParse(value);
  if (date == null) {
    return value;
  }
  String pad(int part) => part.toString().padLeft(2, '0');
  return '${date.year}-${pad(date.month)}-${pad(date.day)} '
      '${pad(date.hour)}:${pad(date.minute)}';
}

const Map<String, String> _statusLabels = <String, String>{
  'CANCELLED': '已取消',
  'COMPLETED': '已完成',
  'EXPIRED': '已超时',
  'PAID': '已支付',
  'PENDING_PAYMENT': '待付款',
  'PENDING_RECEIPT': '待收货',
  'PENDING_SHIPMENT': '待发货',
  'REFUNDED': '已退款',
  'REFUNDING': '退款中',
};

String statusLabel(String status) =>
    _statusLabels[status.toUpperCase()] ?? '处理中';
