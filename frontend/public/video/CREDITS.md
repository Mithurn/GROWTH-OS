# Launch video credits

- Music and sound effects: synthesized from scratch with `video/music.py` (numpy and scipy, 120 BPM, sine, noise and filter synthesis). No samples. Original work for this repo, same licence as the repo.
- Voiceover: Kokoro-82M (voice `af_heart`), an open-weight neural TTS model under the Apache-2.0 licence (commercial use allowed), https://huggingface.co/hexgrad/Kokoro-82M. Run fully offline through the MIT-licensed `kokoro-onnx` package (https://pypi.org/project/kokoro-onnx/) with the v1.0 ONNX model files from its model-files-v1.0 release. Generated locally by `video/voice.py`; only the rendered audio is bundled in the video.
- Visuals: GrowthOS product screenshots from `frontend/public/shots` and the GrowthOS logo, rendered by `video/scene.html`. Figures shown are sample demo data.
- Typography: system UI font at render time.
- Third-party code and assets from the reference project (latent-spaces/brag) were read for creative guidance only. None is included or executed.

Rebuild: `python3 video/build.py <workdir> frontend/public/video` (needs ffmpeg, Chrome, and the python packages playwright, numpy, scipy). For the voice, set `KOKORO_DIR` to the folder holding `kokoro-v1.0.onnx` and `voices-v1.0.bin`, and `TTS_PYTHON` to a python with `kokoro-onnx` and `soundfile` installed.
