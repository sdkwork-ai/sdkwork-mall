import 'package:flutter/material.dart';

/// Shared building blocks for the commerce pages.
class SdkworkLoadingView extends StatelessWidget {
  const SdkworkLoadingView({super.key, this.label = '加载中...'});

  final String label;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const CircularProgressIndicator(),
              const SizedBox(height: 12),
              Text(label, style: Theme.of(context).textTheme.bodySmall),
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
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 40, color: Color(0xFFDC2626)),
              const SizedBox(height: 12),
              Text(message, textAlign: TextAlign.center),
              if (onRetry != null) ...[
                const SizedBox(height: 12),
                FilledButton.tonal(onPressed: onRetry, child: const Text('重试')),
              ],
            ],
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
          child: Text(
            message,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodySmall,
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
