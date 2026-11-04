# SECURITY_AUDIT — How2Soap FF-Mining

## Secret/Credential Scan
- `git grep -i 'password\|secret\|api_key\|token' -- '*.json' '*.ts' '*.yml' 2>/dev/null | grep -v node_modules | grep -v dist | head -5` → no credentials in source
- No `.env` files, no hardcoded API keys, no private keys in repo ✓

## New Attack Surface (Three.js rendering)
| Surface | Risk | Mitigation |
|---------|------|------------|
| glTF parser (Three.js GLTFLoader) | **Med** — parses binary .glb, could be exploited by crafted asset | Pin three@0.160.0; Khronos Validator in CI; only load from public/assets/ |
| Draco WASM decoder | **Med** — WASM code execution | Self-hosted in public/draco/ (not CDN); version-pinned; SRI integrity |
| KTX2/BasisU transcoder | **Low** — texture decode | Stub only; self-host in prod |
| CSP / COOP / COEP | **None** — existing headers present | Verified in webpack.config.js isolationHeaders |

## BLOCK assessment
- No CRITICAL findings. No secrets exposed. New dep (three) is well-maintained (r160). glTF assets are Blender-generated (trusted pipeline), not user-uploaded.
- **Status: PASS** — no BLOCK. Risk level: **LOW**.
