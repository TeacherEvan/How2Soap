# RISK Classification

## Risks introduced by this change
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Three.js bundle >200 KiB | **Resolved** — entrypoint 186 KiB | High | Dynamic import lazy chunk (StrategyMap3D uses `await import('three')`) |
| glTF asset malformed | **Low** — Blender 5.2.2 generates valid glTF | Med | Khronos Validator in CI; Blender template enforces settings |
| WASM decoder CDN compromise | **None** — self-hosted | High | Decoders in public/draco/, not CDN |
| WCAG 2.3.1 photosensitivity (bloom) | **Low** | Med | Phase 2 must gate bloom behind prefers-reduced-motion |

## Overall risk: **LOW** — all mitigations in place or planned.
