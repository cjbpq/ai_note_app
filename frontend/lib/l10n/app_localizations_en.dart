// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appName => 'AI Note';

  @override
  String get welcomeBack => 'Welcome Back';

  @override
  String get loginToContinue => 'Login to continue using AI Note';

  @override
  String get username => 'Username';

  @override
  String get usernameHint => 'Enter username';

  @override
  String get password => 'Password';

  @override
  String get passwordHint => 'Enter password';

  @override
  String get login => 'Login';

  @override
  String get noAccount => 'Don\'t have an account?';

  @override
  String get registerNow => 'Register Now';

  @override
  String get createAccount => 'Create Account';

  @override
  String get email => 'Email';

  @override
  String get emailHint => 'Enter email address';

  @override
  String get confirmPassword => 'Confirm Password';

  @override
  String get confirmPasswordHint => 'Re-enter password';

  @override
  String get register => 'Register';

  @override
  String get hasAccount => 'Already have an account?';

  @override
  String get loginNow => 'Login Now';

  @override
  String get myNotes => 'My Notes';

  @override
  String get search => 'Search';

  @override
  String get noNotes => 'No Notes';

  @override
  String get noNotesHint => 'Upload an image to create your first note';

  @override
  String get noteDetail => 'Note Detail';

  @override
  String get editNote => 'Edit Note';

  @override
  String get deleteNote => 'Delete Note';

  @override
  String deleteNoteConfirm(String title) {
    return 'Are you sure you want to delete \"$title\"?';
  }

  @override
  String get cancel => 'Cancel';

  @override
  String get delete => 'Delete';

  @override
  String get save => 'Save';

  @override
  String get title => 'Title';

  @override
  String get titleHint => 'Enter note title';

  @override
  String get category => 'Category';

  @override
  String get tags => 'Tags';

  @override
  String get tagsHint => 'Enter tag';

  @override
  String get originalText => 'Original Text';

  @override
  String get uploadImage => 'Upload Image';

  @override
  String get uploadImageTitle => 'Upload Image to Create Note';

  @override
  String get uploadImageHint =>
      'Take a photo or select from gallery, AI will recognize and organize content';

  @override
  String get takePhoto => 'Camera';

  @override
  String get gallery => 'Gallery';

  @override
  String get startUpload => 'Start Upload';

  @override
  String get reselect => 'Reselect';

  @override
  String get imageReceived => 'Image Received';

  @override
  String get imageStored => 'Image Stored';

  @override
  String get queued => 'Queued';

  @override
  String get ocrPending => 'Recognizing text...';

  @override
  String get ocrDone => 'Text Recognition Done';

  @override
  String get aiPending => 'AI Processing...';

  @override
  String get aiDone => 'AI Processing Done';

  @override
  String get persisted => 'Note Generated';

  @override
  String get failed => 'Failed';

  @override
  String get processing => 'Processing...';

  @override
  String get noteCreated => 'Note created successfully!';

  @override
  String get noteDeleted => 'Note deleted';

  @override
  String get saveFailed => 'Save failed';

  @override
  String get saveSuccess => 'Saved successfully';

  @override
  String get settings => 'Settings';

  @override
  String get theme => 'Theme';

  @override
  String get themeLight => 'Light';

  @override
  String get themeDark => 'Dark';

  @override
  String get themeSystem => 'System';

  @override
  String get selectTheme => 'Select Theme';

  @override
  String get about => 'About';

  @override
  String get logout => 'Logout';

  @override
  String get logoutConfirm => 'Are you sure you want to logout?';

  @override
  String get loading => 'Loading...';

  @override
  String get retry => 'Retry';

  @override
  String get error => 'Error';

  @override
  String get networkError => 'Network Error';

  @override
  String get all => 'All';

  @override
  String get favorites => 'Favorites';

  @override
  String get filterByCategory => 'Filter by Category';

  @override
  String get searchNotes => 'Search Notes';

  @override
  String get searchHint => 'Enter keywords to search';

  @override
  String get noSearchResults => 'No notes found';

  @override
  String get recentSearches => 'Recent Searches';

  @override
  String get clearHistory => 'Clear History';

  @override
  String get pleaseEnterUsername => 'Please enter username';

  @override
  String get pleaseEnterPassword => 'Please enter password';

  @override
  String get pleaseEnterEmail => 'Please enter email';

  @override
  String get pleaseEnterValidEmail => 'Please enter a valid email address';

  @override
  String get usernameMinLength => 'Username must be at least 3 characters';

  @override
  String get passwordMinLength => 'Password must be at least 6 characters';

  @override
  String get passwordMismatch => 'Passwords do not match';

  @override
  String get pleaseConfirmPassword => 'Please confirm password';

  @override
  String get pleaseEnterTitle => 'Please enter title';

  @override
  String get registerSuccess => 'Registration successful, please login';

  @override
  String get selectImageFailed => 'Failed to select image';

  @override
  String get loadCategoryFailed => 'Failed to load categories';

  @override
  String get noteNotFound => 'Note not found';

  @override
  String get uploadingNewNote => 'Uploading new note...';

  @override
  String get cannotDeleteFavorite =>
      'Cannot delete favorited note. Please unfavorite it first';

  @override
  String get switchEditMode => 'Switch Edit Mode';

  @override
  String get previewMode => 'Preview';

  @override
  String get wysiwygMode => 'Rich Text';

  @override
  String get sourceMode => 'Source';

  @override
  String get unsavedChanges => 'Unsaved Changes';

  @override
  String get unsavedChangesMessage =>
      'You have unsaved changes. Are you sure you want to leave?';

  @override
  String get savedSuccessfully => 'Saved successfully';

  @override
  String get discardChanges => 'Discard Changes';

  @override
  String get saveChanges => 'Save Changes';
}
