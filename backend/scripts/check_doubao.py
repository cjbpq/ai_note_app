import os
import traceback

from app.services.doubao_service import doubao_service


def main() -> None:
    images = [os.path.join("uploaded_images", name) for name in os.listdir("uploaded_images")]
    if not images:
        raise SystemExit("No images found in uploaded_images/")

    image = images[0]
    print(f"Using image: {image}")
    try:
        result = doubao_service.generate_structured_note(
            [image],
            note_type="lecture",
            tags=["demo"],
            max_completion_tokens=512,
        )
    except Exception as exc:  # noqa: BLE001
        print("Error during Doubao request:", type(exc).__name__, exc)
        traceback.print_exc()
        raise

    note = result["note"]
    print("Note keys:", list(note.keys()))
    print("Raw text length:", len(result.get("raw_text", "")))
    print("Response status:", result["response"].get("status"))


if __name__ == "__main__":
    main()
