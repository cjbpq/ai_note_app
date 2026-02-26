# Benchmark Plan

## Goals
- Measure Doubao vision transcription quality on representative classroom and slide images.
- Track structured note quality using Doubao's JSON output.
- Provide repeatable scripts so future model or prompt tweaks can be compared.

## Pipeline stages
1. **Vision inference**: `app/services/doubao_service.DoubaoVisionService` (image → structured note + raw_text).
2. **Text cleaning**: `app/utils/text_cleaning.clean_ocr_text`.
3. **Persistence**: `app/services/pipeline_runner.process_note_job` (status tracking + DB write).

## Metrics
| Stage | Metric | Notes |
|-------|--------|-------|
| Doubao raw_text | Character Error Rate (CER), Word Error Rate (WER) | Computed against human-transcribed reference text for each sample image. |
| Cleaning | Token retention % | Optional sanity check to ensure cleaning is not dropping entire paragraphs. |
| Structured Notes | Section coverage, key point recall | Compare generated JSON against reference outline. Simple heuristics (e.g., heading match) to start. |

## Dataset outline
- Store sample images in `benchmarks/samples/`. Start with:
  - `ppt_slide.png`: classroom slide photo (from existing uploads).
  - `whiteboard.png`: hand-written board notes.
  - `printed_notes.png`: printed text.
- Provide human-written references in `benchmarks/fixtures/<sample>.json` with:
  ```json
  {
    "reference_text": "...",
    "reference_note": {
      "title": "...",
      "sections": [...],
      "key_points": [...]
    }
  }
  ```

## Outputs
- `benchmarks/results/pipeline_<timestamp>.json`: Doubao raw outputs + metrics per sample.

## Next steps
1. Copy curated images into `benchmarks/samples/` and transcribe ground truth.
2. Run `benchmarks/run_benchmark.py` to iterate samples.
3. Add pytest wrapper (`tests/test_benchmark_pipeline.py`) to prevent regressions.
4. Integrate into CI later if needed.

## Troubleshooting
- **Doubao 未配置**：运行 `venv\Scripts\python.exe benchmarks\run_benchmark.py`，若提示 `Doubao 服务不可用`，请确认安装 `volcengine-python-sdk[ark]` 并设置 `DOUBAO_API_KEY` 或 `ARK_API_KEY`。
- **网络异常**：如出现 `ConnectionResetError` 或超时，请确认可访问 Doubao Ark API 域名，必要时配置代理或加入网络白名单。
- **输出为空**：检查 `benchmarks/results/` 中生成的 JSON 是否包含 `raw_text`，若为空通常表示模型无法识别图片或请求被限流，可重试或降低并发。
