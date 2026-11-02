import 'package:flutter/material.dart';

/// Shared building blocks for the commerce pages.

/// Pulsing skeleton bar; the loading view composes a few of them.
class _SdkworkSkeletonLine extends StatefulWidget {
  const _SdkworkSkeletonLine({required this.height, this.widthFactor = 1});

  final double height;
  final double widthFactor;

  @override
  State<_SdkworkSkeletonLine> createState() => _SdkworkSkeletonLineState();
}

class _SdkworkSkeletonLineState extends State<_SdkworkSkeletonLine>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1200),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reduceMotion = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    final line = Container(
      height: widget.height,
      decoration: BoxDecoration(
        color: const Color(0xFFEEF1F5),
        borderRadius: BorderRadius.circular(10),
      ),
    );
    return FractionallySizedBox(
      alignment: Alignment.centerLeft,
      widthFactor: widget.widthFactor,
      child: reduceMotion
          ? line
          : FadeTransition(
              opacity: Tween<double>(begin: 0.55, end: 1).animate(
                CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
              ),
              child: line,
            ),
    );
  }
}

class SdkworkLoadingView extends StatelessWidget {
  const SdkworkLoadingView({super.key, this.label = '加载中...'});

  final String label;

  @override
  Widget build(BuildContext context) => Semantics(
        label: label,
        child: const Padding(
          padding: EdgeInsets.symmetric(horizontal: 20, vertical: 28),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _SdkworkSkeletonLine(height: 160),
              SizedBox(height: 20),
              _SdkworkSkeletonLine(height: 20, widthFactor: 0.6),
              SizedBox(height: 12),
              _SdkworkSkeletonLine(height: 16, widthFactor: 0.85),
              SizedBox(height: 12),
              _SdkworkSkeletonLine(height: 16, widthFactor: 0.4),
            ],
          ),
        ),
      );
}

class SdkworkErrorView extends StatelessWidget {
  const SdkworkErrorView({super.key, required this.message, this.onRetry});

  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: const Color(0xFFFEE2E2)),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.error_outline,
                  size: 40,
                  color: Color(0xFFDC2626),
                ),
                const SizedBox(height: 12),
                Text(
                  message,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                if (onRetry != null) ...[
                  const SizedBox(height: 16),
                  FilledButton(onPressed: onRetry, child: const Text('重试')),
                ],
              ],
            ),
          ),
        ),
      );
}

class SdkworkEmptyView extends StatelessWidget {
  const SdkworkEmptyView({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.inbox_outlined,
                size: 44,
                color: Color(0xFFCBD5E1),
              ),
              const SizedBox(height: 12),
              Text(
                message,
                textAlign: TextAlign.center,
                style: Theme.of(context)
                    .textTheme
                    .bodyMedium
                    ?.copyWith(color: const Color(0xFF6B7280)),
              ),
            ],
          ),
        ),
      );
}

class SdkworkProductCard extends StatelessWidget {
  const SdkworkProductCard({
    super.key,
    required this.product,
    required this.onTap,
  });

  final Map<String, dynamic> product;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final imageUrl = product['imageUrl']?.toString() ?? '';
    final price = product['priceText']?.toString() ?? '';
    final sales = product['sales']?.toString() ?? '';
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AspectRatio(
              aspectRatio: 1,
              child: imageUrl.isEmpty
                  ? ColoredBox(
                      color: Theme.of(context).colorScheme.surfaceContainerHighest,
                      child: const Center(child: Icon(Icons.image_outlined)),
                    )
                  : Image.network(
                      imageUrl,
                      fit: BoxFit.cover,
                      errorBuilder: (context, error, stackTrace) =>
                          const Center(child: Icon(Icons.broken_image_outlined)),
                    ),
            ),
            Padding(
              padding: const EdgeInsets.all(10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    product['title']?.toString() ?? '商品',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 6),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        price,
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.primary,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      if (sales.isNotEmpty)
                        Text(
                          '已售 $sales',
                          style: Theme.of(context).textTheme.labelSmall,
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class SdkworkSectionHeader extends StatelessWidget {
  const SdkworkSectionHeader({super.key, required this.title});

  final String title;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
        child: Text(
          title,
          style: Theme.of(context).textTheme.titleMedium,
        ),
      );
}

/// Opens the product detail page by id.
void openSdkworkProduct(BuildContext context, String productId) {
  Navigator.of(context).pushNamed('/product', arguments: productId);
}

/// Compact inline failure notice with a retry action.
///
/// Used when a page keeps rendering the data it already has (asset pages, a
/// partially loaded detail) instead of replacing the whole body with the
/// full-screen [SdkworkErrorView].
class SdkworkInlineError extends StatelessWidget {
  const SdkworkInlineError({
    super.key,
    required this.message,
    this.onRetry,
  });

  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(12),
      child: Row(
        children: <Widget>[
          const Icon(Icons.error_outline, size: 18, color: Color(0xFFDC2626)),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(color: Color(0xFFB91C1C), fontSize: 13),
            ),
          ),
          if (onRetry != null)
            TextButton(
              onPressed: onRetry,
              child: const Text('重试'),
            ),
        ],
      ),
    );
  }
}