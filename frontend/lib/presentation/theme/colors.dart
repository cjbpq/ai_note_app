import 'package:flutter/material.dart';

/// App color palette - Notion style (Light) and Obsidian style (Dark)
class AppColors {
  // Light theme colors (Notion style)
  static const Color lightPrimary = Color(0xFF6366F1);  // Indigo
  static const Color lightPrimaryVariant = Color(0xFF4F46E5);
  static const Color lightBackground = Color(0xFFFAFAFA);
  static const Color lightSurface = Color(0xFFFFFFFF);
  static const Color lightCard = Color(0xFFFFFFFF);
  static const Color lightText = Color(0xFF1F2937);
  static const Color lightTextSecondary = Color(0xFF6B7280);
  static const Color lightBorder = Color(0xFFE5E7EB);
  static const Color lightDivider = Color(0xFFF3F4F6);
  static const Color lightError = Color(0xFFEF4444);
  static const Color lightSuccess = Color(0xFF10B981);
  static const Color lightWarning = Color(0xFFF59E0B);

  // Dark theme colors (Obsidian style)
  static const Color darkPrimary = Color(0xFF818CF8);  // Indigo Light
  static const Color darkPrimaryVariant = Color(0xFFA5B4FC);
  static const Color darkBackground = Color(0xFF1E1E1E);
  static const Color darkSurface = Color(0xFF252525);
  static const Color darkCard = Color(0xFF2D2D2D);
  static const Color darkText = Color(0xFFE0E0E0);
  static const Color darkTextSecondary = Color(0xFF9CA3AF);
  static const Color darkBorder = Color(0xFF404040);
  static const Color darkDivider = Color(0xFF333333);
  static const Color darkError = Color(0xFFF87171);
  static const Color darkSuccess = Color(0xFF34D399);
  static const Color darkWarning = Color(0xFFFBBF24);

  // Category colors
  static const Map<String, Color> categoryColors = {
    'note': Color(0xFF6366F1),      // Indigo
    'recipe': Color(0xFFF59E0B),    // Amber
    'medical': Color(0xFFEF4444),   // Red
    'finance': Color(0xFF10B981),   // Emerald
    'travel': Color(0xFF3B82F6),    // Blue
    'work': Color(0xFF8B5CF6),      // Violet
    'personal': Color(0xFFEC4899),  // Pink
    'other': Color(0xFF6B7280),     // Gray
  };

  static Color getCategoryColor(String category) {
    return categoryColors[category.toLowerCase()] ?? categoryColors['other']!;
  }
}
