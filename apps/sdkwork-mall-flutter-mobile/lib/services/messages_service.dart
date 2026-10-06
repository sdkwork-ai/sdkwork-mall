import 'after_sales_service.dart';
import 'order_service.dart';
import '../utils/json.dart';

/// One composed message-center row (order or after-sales progress).
class MallMessageRow {
  const MallMessageRow({
    required this.id,
    required this.title,
    required this.summary,
    required this.type,
    this.occurredAt = '',
  });

  final String id;
  final String title;
  final String summary;
  final String type; // 'order' | 'after-sales'
  final String occurredAt;
}

/// Pure composer turning raw order/after-sales rows into the message feed,
/// newest first. Mirrors the H5 `/buyer/messages` surface; kept pure so the
/// composition is unit-testable without transport.
List<MallMessageRow> composeMessageRows({
  required List<Map<String, dynamic>> orders,
  required List<Map<String, dynamic>> afterSalesRequests,
}) {
  final rows = <MallMessageRow>[];
  for (var index = 0; index < orders.length; index += 1) {
    final order = orders[index];
    final orderId = asString(order, ['orderId', 'id'], fallback: 'order-${index + 1}');
    final total = asNum(order, ['totalAmount', 'totalAmountCny']);
    rows.add(MallMessageRow(
      id: 'order-$orderId',
      title: '订单更新：${asString(order, ['subject'], fallback: orderId)}',
      summary:
          '金额 ${total != null ? formatRowCny(total) : '--'} · ${asString(order, ['statusName', 'status'], fallback: '状态更新')}',
      type: 'order',
      occurredAt: asString(order, ['createdAt', 'created_at', 'updatedAt']),
    ));
  }
  for (var index = 0; index < afterSalesRequests.length; index += 1) {
    final request = afterSalesRequests[index];
    final requestId = asString(request, ['id', 'afterSalesRequestId'],
        fallback: 'after-sales-${index + 1}');
    rows.add(MallMessageRow(
      id: 'after-sales-$requestId',
      title: '售后更新：${asString(request, ['orderId', 'order_id'], fallback: '售后单')}',
      summary: asString(request, ['reason', 'reasonText', 'description', 'statusName'],
          fallback: '售后进度更新'),
      type: 'after-sales',
      occurredAt: asString(request, ['createdAt', 'created_at', 'appliedAt']),
    ));
  }
  rows.sort((left, right) => right.occurredAt.compareTo(left.occurredAt));
  return rows;
}

String formatRowCny(num value) => '¥${value.toStringAsFixed(2)}';

/// Message-center domain: composes the order + after-sales progress feed.
/// Partial failures degrade to the successful half (allSettled semantics).
class MessagesService {
  MessagesService(this._orders, this._afterSales);

  final OrderService _orders;
  final AfterSalesService _afterSales;

  Future<List<MallMessageRow>> listRows() async {
    final results = await Future.wait<List<Map<String, dynamic>>>(<Future<List<Map<String, dynamic>>>>[
      _orders
          .listOrders(page: 1, pageSize: 10)
          .then((rows) => rows)
          .catchError((Object _) => <Map<String, dynamic>>[]),
      _afterSales
          .listRequests(page: 1, pageSize: 10)
          .then((rows) => rows)
          .catchError((Object _) => <Map<String, dynamic>>[]),
    ]);
    return composeMessageRows(orders: results[0], afterSalesRequests: results[1]);
  }
}
