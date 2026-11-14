# Launch video credits

- Music and sound effects: synthesized from scratch with `video/music.py` (numpy and scipy, 120 BPM, sine, noise and filter synthesis). No samples. Original work for this repo, same licence as the repo.
- Voiceover: macOS built-in text-to-speech (`say`, voice Samantha), generated locally. Output is bundled in the video only.
- Visuals: GrowthOS product screenshots from `frontend/public/shots` and the GrowthOS logo, rendered by `video/scene.html`. Figures shown are sample demo data.
- Typography: system UI font at render time.
- Third-party code and assets from the reference project (latent-spaces/brag) were read for creative guidance only. None is included or executed.

Rebuild: `python3 video/build.py <workdir> frontend/public/video` (needs macOS, ffmpeg, Chrome, and the python packages playwright, numpy, scipy).
