# Fixtures

Populate this directory with ground-truth annotations for each benchmark sample.

Each `<sample>.json` file should contain:
- `reference_text`: full human-transcribed text from the image.
- `reference_note`: structured note matching the desired AI output format (title, sections, key_points, optional extras).

Update `manifest.json` whenever you add or remove samples.
