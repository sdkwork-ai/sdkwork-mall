import 'order_service.dart';
import '../utils/json.dart';

/// 买家评价中心。
///
/// T1 商品评价合约尚未落地，因此与 PC / H5 / 小程序保持一致：展示当前可评价的
/// 订单（已完成订单），不虚构评价传输层。合约落地后在本服务内接入写入接口即可，
/// 页面无需改动。
class ReviewsService {
  ReviewsService(this._orders);

  final OrderService _orders;

  Future<List<({String id, String subject, String amountText})>>
      listPendingReviewOrders() async {
    final orders = await _orders.listOrders(status: 'COMPLETED');
    return orders
        .map(
          (order) => (
            id: asString(order, <String>['orderId', 'id']),
            subject: _subjectOf(order),
            amountText: _amountText(order),
          ),
        )
        .where((order) => order.id.isNotEmpty)
        .toList();
  }

  String _subjectOf(Map<String, dynamic> order) {
    final subject = asString(order, <String>['subject', 'title']);
    return subject.isEmpty ? '订单' : subject;
  }

  String _amountText(Map<String, dynamic> order) {
    final stringAmount = asString(order, <String>['paidAmount', 'totalAmount']);
    if (stringAmount.isNotEmpty) {
      final parsed = num.tryParse(stringAmount);
      if (parsed != null) {
        return '¥${parsed.toStringAsFixed(2)}';
      }
    }
    final numericAmount = asNum(order, <String>['paidAmountCny', 'totalAmountCny']);
    return numericAmount == null ? '' : '¥${numericAmount.toStringAsFixed(2)}';
  }
}
