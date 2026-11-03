# How2Soap intro splash — generator

Rebuilds `src/media/how2soap-intro.mp4`, `src/media/how2soap-intro.webm` and
`src/media/how2soap-poster.png`. Deterministic (seeded), no external assets.

## Rebuild

```bash
cd scripts/make-splash
python3 make_splash.py            # frames -> WAV synth -> MP4 + WebM -> out/
python3 make_splash.py --check    # ffprobe duration/codec/size assertions
cp out/how2soap-intro.mp4 out/how2soap-intro.webm out/poster.png \
   ../../src/media/
mv ../../src/media/poster.png ../../src/media/how2soap-poster.png
```

Requires: Python 3.10+, Pillow, ffmpeg (libx264, libvpx-vp9, aac/opus).
Renders 270 frames at 1920×1080 (30 fps, 9.0 s).

## Acceptance checks

1. `ffprobe` (via `--check`): both files 6.5–10.5 s, 1920×1080, H.264/VP9, < 3 MB.
2. Poster ink margins ≥ 40 px on all four edges.
3. Spot-frames (`out/analysis_f*.png`): fire arc reads, wordmark legible, no clipping.
4. `npm run build` after copying new media into `src/media/`.

## Design tokens

Mirrors `src/styles.css`: `--bg #0b0f12`, `--accent #e0a458`, `--accent-2 #5fb3a1`,
`--text #dce6ec`, `--muted #7f929f`. Wordmark set in Liberation Serif Bold,
tagline `FIRE · ASH · LYE · SOAP`.

Shipped by webpack `asset/resource` (content-hashed, `/static/media/...`,
immutable cache headers from `vercel.json`).
