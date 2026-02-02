import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';

/// 全屏图片查看器
class ImageViewer extends StatefulWidget {
  final String imageUrl;
  final String? heroTag;

  const ImageViewer({
    super.key,
    required this.imageUrl,
    this.heroTag,
  });

  /// 显示全屏图片
  static void show(BuildContext context, String imageUrl, {String? heroTag}) {
    Navigator.of(context).push(
      PageRouteBuilder(
        opaque: false,
        barrierDismissible: true,
        barrierColor: Colors.black87,
        pageBuilder: (context, animation, secondaryAnimation) {
          return ImageViewer(imageUrl: imageUrl, heroTag: heroTag);
        },
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          return FadeTransition(opacity: animation, child: child);
        },
      ),
    );
  }

  @override
  State<ImageViewer> createState() => _ImageViewerState();
}

class _ImageViewerState extends State<ImageViewer> {
  final TransformationController _transformationController =
      TransformationController();
  double _currentScale = 1.0;

  @override
  void dispose() {
    _transformationController.dispose();
    super.dispose();
  }

  void _handleDoubleTap() {
    if (_currentScale != 1.0) {
      _transformationController.value = Matrix4.identity();
      _currentScale = 1.0;
    } else {
      _transformationController.value = Matrix4.identity()..scale(2.0);
      _currentScale = 2.0;
    }
  }

  @override
  Widget build(BuildContext context) {
    Widget imageWidget = CachedNetworkImage(
      imageUrl: widget.imageUrl,
      fit: BoxFit.contain,
      placeholder: (context, url) => const Center(
        child: CircularProgressIndicator(color: Colors.white),
      ),
      errorWidget: (context, url, error) => const Center(
        child: Icon(Icons.broken_image, color: Colors.white, size: 64),
      ),
    );

    if (widget.heroTag != null) {
      imageWidget = Hero(tag: widget.heroTag!, child: imageWidget);
    }

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: Stack(
        children: [
          // 可缩放的图片
          GestureDetector(
            onTap: () => Navigator.of(context).pop(),
            onDoubleTap: _handleDoubleTap,
            child: InteractiveViewer(
              transformationController: _transformationController,
              minScale: 0.5,
              maxScale: 4.0,
              onInteractionEnd: (details) {
                _currentScale = _transformationController.value.getMaxScaleOnAxis();
              },
              child: Center(child: imageWidget),
            ),
          ),
          // 关闭按钮
          Positioned(
            top: MediaQuery.of(context).padding.top + 8,
            right: 8,
            child: IconButton(
              icon: const Icon(Icons.close, color: Colors.white, size: 28),
              onPressed: () => Navigator.of(context).pop(),
            ),
          ),
        ],
      ),
    );
  }
}
