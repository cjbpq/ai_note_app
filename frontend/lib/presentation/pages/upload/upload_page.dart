import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import '../../../l10n/app_localizations.dart';
import '../../../config/routes.dart';
import '../../../providers/upload_provider.dart';
import '../../../providers/notes_provider.dart';
import '../../theme/colors.dart';

/// Upload page with camera/gallery selection and progress display
class UploadPage extends ConsumerStatefulWidget {
  const UploadPage({super.key});

  @override
  ConsumerState<UploadPage> createState() => _UploadPageState();
}

class _UploadPageState extends ConsumerState<UploadPage> {
  final ImagePicker _picker = ImagePicker();
  File? _selectedImage;

  Future<void> _pickImage(ImageSource source) async {
    final l10n = AppLocalizations.of(context)!;
    try {
      final XFile? image = await _picker.pickImage(
        source: source,
        maxWidth: 1920,
        maxHeight: 1920,
        imageQuality: 85,
      );

      if (image != null) {
        setState(() {
          _selectedImage = File(image.path);
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(l10n.selectImageFailed)),
        );
      }
    }
  }

  Future<void> _startUpload() async {
    if (_selectedImage == null) return;

    await ref.read(uploadProvider.notifier).uploadImage(_selectedImage!.path);
  }

  void _resetSelection() {
    setState(() {
      _selectedImage = null;
    });
    ref.read(uploadProvider.notifier).reset();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final uploadState = ref.watch(uploadProvider);
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final primaryColor = isDark ? AppColors.darkPrimary : AppColors.lightPrimary;

    // Navigate to note detail when upload complete
    ref.listen<UploadState>(uploadProvider, (previous, next) {
      if (next.isComplete && next.completedNote != null) {
        // Add note to list
        ref.read(notesListProvider.notifier).addNote(next.completedNote!);

        // Show success and navigate
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(l10n.noteCreated)),
        );

        // Reset state and navigate
        _resetSelection();
        context.push(AppRoutes.noteDetailPath(next.completedNote!.id));
      }
    });

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.uploadImage),
        actions: [
          if (_selectedImage != null && !uploadState.isUploading)
            IconButton(
              icon: const Icon(Icons.close),
              onPressed: _resetSelection,
              tooltip: l10n.cancel,
            ),
        ],
      ),
      body: _buildBody(context, uploadState, primaryColor, theme, l10n),
    );
  }

  Widget _buildBody(
    BuildContext context,
    UploadState uploadState,
    Color primaryColor,
    ThemeData theme,
    AppLocalizations l10n,
  ) {
    // Show progress during upload
    if (uploadState.isUploading || uploadState.currentJob != null) {
      return _buildProgressView(uploadState, primaryColor, theme, l10n);
    }

    // Show selected image preview
    if (_selectedImage != null) {
      return _buildPreviewView(primaryColor, theme, l10n);
    }

    // Show upload options
    return _buildUploadOptions(primaryColor, theme, l10n);
  }

  Widget _buildUploadOptions(Color primaryColor, ThemeData theme, AppLocalizations l10n) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.cloud_upload_outlined,
              size: 80,
              color: primaryColor,
            ),
            const SizedBox(height: 24),
            Text(
              l10n.uploadImageTitle,
              style: theme.textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            Text(
              l10n.uploadImageHint,
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.outline,
              ),
            ),
            const SizedBox(height: 32),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                ElevatedButton.icon(
                  onPressed: () => _pickImage(ImageSource.camera),
                  icon: const Icon(Icons.camera_alt_outlined),
                  label: Text(l10n.takePhoto),
                ),
                const SizedBox(width: 16),
                OutlinedButton.icon(
                  onPressed: () => _pickImage(ImageSource.gallery),
                  icon: const Icon(Icons.photo_library_outlined),
                  label: Text(l10n.gallery),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPreviewView(Color primaryColor, ThemeData theme, AppLocalizations l10n) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          // Image preview
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Image.file(
              _selectedImage!,
              width: double.infinity,
              fit: BoxFit.contain,
            ),
          ),
          const SizedBox(height: 24),
          // Upload button
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _startUpload,
              icon: const Icon(Icons.upload),
              label: Text(l10n.startUpload),
            ),
          ),
          const SizedBox(height: 12),
          // Change image button
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => _pickImage(ImageSource.gallery),
              icon: const Icon(Icons.image),
              label: Text(l10n.reselect),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProgressView(
    UploadState uploadState,
    Color primaryColor,
    ThemeData theme,
    AppLocalizations l10n,
  ) {
    final job = uploadState.currentJob;
    final progress = uploadState.progress;
    final statusText = uploadState.statusText;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Progress indicator
            SizedBox(
              width: 120,
              height: 120,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  CircularProgressIndicator(
                    value: progress,
                    strokeWidth: 8,
                    backgroundColor: theme.colorScheme.surfaceContainerHighest,
                    valueColor: AlwaysStoppedAnimation<Color>(
                      uploadState.isFailed
                          ? theme.colorScheme.error
                          : primaryColor,
                    ),
                  ),
                  Center(
                    child: Text(
                      '${(progress * 100).toInt()}%',
                      style: theme.textTheme.headlineMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 32),

            // Status text
            Text(
              statusText,
              style: theme.textTheme.titleMedium,
            ),
            const SizedBox(height: 8),

            // Detailed status
            if (job != null)
              Text(
                _getStatusDescription(job.status, l10n),
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.outline,
                ),
              ),

            // Error message
            if (uploadState.error != null) ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: theme.colorScheme.error.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  uploadState.error!,
                  style: TextStyle(color: theme.colorScheme.error),
                ),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _resetSelection,
                child: Text(l10n.retry),
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _getStatusDescription(dynamic status, AppLocalizations l10n) {
    switch (status) {
      case 'received':
        return l10n.imageReceived;
      case 'stored':
        return l10n.imageStored;
      case 'queued':
        return l10n.queued;
      case 'ocrPending':
        return l10n.ocrPending;
      case 'ocrDone':
        return l10n.ocrDone;
      case 'aiPending':
        return l10n.aiPending;
      case 'aiDone':
        return l10n.aiDone;
      case 'persisted':
        return l10n.persisted;
      case 'failed':
        return l10n.failed;
      default:
        return l10n.processing;
    }
  }
}
