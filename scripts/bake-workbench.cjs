const fs = require('fs');
const path = require('path');

const ROOT = '/home/leandi-duplessis/github/workspaces/How to make soap';
const MANIFEST = path.join(ROOT, 'blender', 'templates', 'workbench_actions.json');
const OUT_TS = path.join(ROOT, 'src', 'ui', 'gl', 'bakedClips.ts');

const MESH_MAP = {"hearth_flame":"HEARTH_BRAZIER","bellows_pump":"WOOD_BUCKET","pour_stream":"WOOD_BUCKET","stir_vortex":"CERAMIC_CRUCIBLE","boil_shake":"HEARTH_BRAZIER","liquid_fill":"CERAMIC_CRUCIBLE","crystal_shimmer":"BIOME_CRYSTAL","colonist_walk_idle":"COLONIST_PAWN","kettle_cauldron":"HEARTH_BRAZIER","wood_trough":"WOOD_BUCKET","electrolysis_cell":"CERAMIC_CRUCIBLE","voltaic_pile":"WOOD_BUCKET","bench_table":"WOOD_BUCKET","paddock_set":"WOOD_BUCKET","tool_props":"WOOD_BUCKET","fermentation_pot":"CERAMIC_CRUCIBLE","mortar_pestle":"CERAMIC_CRUCIBLE","charcoal_clamp":"WOOD_BUCKET"};
const VERTEX_COUNTS = {"WOOD_BUCKET":24,"CERAMIC_CRUCIBLE":20,"HEARTH_BRAZIER":12,"COLONIST_PAWN":58,"BIOME_CRYSTAL":7};
const ONE_SHOT = new Set(["liquid_fill"]);

// Per-vertex offset encoding (see header). Gains keep vertex offsets bounded:
// translation raw metres, scale delta x0.5, rotation quat xyz x0.15.
const GAINS = { translation: 1.0, scale: 0.5, rotation: 0.15 };
const OFFSET_CLAMP = 0.5;

function typeStride(t) {
  return { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[t] || 3;
}

function parseGlbChannels(glbPath) {
    if (!fs.existsSync(glbPath)) return {};
    const data = fs.readFileSync(glbPath);
    const jsonLength = data.readUInt32LE(12);
    const jsonChunk = data.subarray(20, 20 + jsonLength);
    const doc = JSON.parse(jsonChunk.toString());
    // BIN chunk: 12-byte file header + [JSON chunk header(8) + JSON] + [BIN header(8) + payload].
    // bufferView.byteOffset is relative to BIN payload start, NOT file start.
    // The old script read at data.buffer+bufferView.byteOffset (off by 20+jsonLength+8)
    // which produced garbage floats (1e23/1e34) and zero-motion clips.
    const binBase = 20 + jsonLength + 8;
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    function readFloats(absOff, count) {
      const out = new Float32Array(count);
      for (let i = 0; i < count; i++) out[i] = view.getFloat32(absOff + i * 4, true);
      return out;
    }
    const channels = {};
    for (const anim of doc.animations || []) {
        const name = anim.name || 'unknown';
        channels[name] = {};
        for (const ch of anim.channels || []) {
            const target = ch.target;
            const p = target.path;
            const node = target.node;
            const sampler = anim.samplers[ch.sampler];
            const input = doc.accessors[sampler.input];
            const output = doc.accessors[sampler.output];
            if (input.bufferView === undefined || output.bufferView === undefined) continue;
            const bufferViewIn = doc.bufferViews[input.bufferView];
            const bufferViewOut = doc.bufferViews[output.bufferView];
            const times = readFloats(binBase + bufferViewIn.byteOffset + (input.byteOffset || 0), input.count);
            const stride = typeStride(output.type);
            const values = readFloats(binBase + bufferViewOut.byteOffset + (output.byteOffset || 0), output.count * stride);
            if (!channels[name][node]) channels[name][node] = {};
            // Multiple samplers on same node+path (e.g. hearth_flame + hearth_flame_inner
            // are separate animations so they don't collide; but keep first to be safe).
            if (!channels[name][node][p]) channels[name][node][p] = { times, values, stride };
        }
    }
    return channels;
}

function sampleChannel(channel, frameCount, fps) {
    if (!channel) return new Float32Array(frameCount * 3).fill(0);
    const { times, values, stride } = channel;
    const out = new Float32Array(frameCount * 3);
    const last = times.length - 1;
    for (let f = 0; f < frameCount; f++) {
        const t = f / fps;
        let i = 0;
        while (i < last && times[i + 1] <= t) i++;
        if (i >= last) {
          out[f*3+0] = values[last*stride+0] ?? 0;
          out[f*3+1] = values[last*stride+1] ?? 0;
          out[f*3+2] = values[last*stride+2] ?? 0;
        } else {
          const t0 = times[i], t1 = times[i+1];
          const alpha = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
          const v0 = i*stride, v1 = (i+1)*stride;
          for (let k = 0; k < 3; k++) {
            const a = values[v0+k] ?? 0, b = values[v1+k] ?? 0;
            out[f*3+k] = a + alpha * (b - a);
          }
        }
    }
    return out;
}

function interpBlenderOnly(bo, frameCount) {
  // bo: { frames: [1-based blender frames], values: number[] } -> per-bake-frame Float32Array
  const out = new Float32Array(frameCount);
  if (!bo || !bo.frames || !bo.values || bo.frames.length === 0) return out;
  for (let f = 0; f < frameCount; f++) {
    const bf = f + 1; // bake frame 0 == Blender frame 1
    if (bf <= bo.frames[0]) { out[f] = bo.values[0]; continue; }
    if (bf >= bo.frames[bo.frames.length-1]) { out[f] = bo.values[bo.values.length-1]; continue; }
    let i = 0;
    while (i < bo.frames.length-2 && bo.frames[i+1] < bf) i++;
    const f0 = bo.frames[i], f1 = bo.frames[i+1];
    const alpha = (bf - f0) / Math.max(1e-9, (f1 - f0));
    out[f] = bo.values[i] + alpha * (bo.values[i+1] - bo.values[i]);
  }
  return out;
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));

let tsOutput = '';
tsOutput += '/**\n';
tsOutput += ' * Baked Animation Clips -- generated by scripts/bake-workbench.cjs\n';
tsOutput += ' * DO NOT EDIT MANUALLY\n';
tsOutput += ' * Per-vertex offsets: (value - frame0Value) * gain, clamped to +/-0.5, 4-decimal quantized.\n';
tsOutput += ' * Gains: translation 1.0, scale 0.5 (delta from rest), rotation quat-xyz 0.15.\n';
tsOutput += ' * blender_only_channels are HONOURED: pour_stream curve.offset -> +Z (raw metres);\n';
tsOutput += ' * crystal_shimmer emission_strength -> +Z * 0.1 as emissive-pulse proxy (no GLB equivalent;\n';
tsOutput += ' *   miniGl has no uEmission yet, so the pulse rides the offset until that uniform lands).\n';
tsOutput += ' * GLB reads use the BIN-relative offset (20 + jsonLength + 8); rotation stride is 4 (quats).\n';
tsOutput += ' */\n\n';
tsOutput += "import type { AnimationClip } from './lowPolyMeshes';\n\n";
tsOutput += "export type { AnimationClip } from './lowPolyMeshes';\n\n";
tsOutput += "export const BAKED_CLIPS: Record<string, AnimationClip> = {\n";

const q = (v) => {
  const c = Math.max(-OFFSET_CLAMP, Math.min(OFFSET_CLAMP, v));
  return String(Number(c.toFixed(4)));
};

for (const [name, action] of Object.entries(manifest.actions)) {
    const frames = action.frames;
    const fps = action.fps;
    const glb = action.glb;
    const glbPath = path.join(ROOT, glb);
    const glbChannels = parseGlbChannels(glbPath);
    const meshName = MESH_MAP[name] || 'WOOD_BUCKET';
    const vertexCount = VERTEX_COUNTS[meshName] || 24;
    const loop = !ONE_SHOT.has(name);

    const nodeNames = Object.keys(glbChannels[name] || {});
    // Also fold in animations named "<action>_inner" style siblings? Blender exports
    // hearth_flame_inner as its own animation; the manifest action hearth_flame should
    // include it so the bake isn't missing half the flame. Merge sibling animations.
    const siblingNames = Object.keys(glbChannels).filter(n => n !== name && n.startsWith(name));
    const allNodeNames = [...nodeNames, ...siblingNames.flatMap(n => Object.keys(glbChannels[n]))];

    const sampled = {};
    const seenNodes = new Set();
    for (const node of allNodeNames) {
        // Find channels from primary or sibling animations
        let nodeChans = (glbChannels[name] || {})[node];
        if (!nodeChans) {
          for (const sib of siblingNames) { if (glbChannels[sib] && glbChannels[sib][node]) { nodeChans = glbChannels[sib][node]; break; } }
        }
        if (!nodeChans || seenNodes.has(node)) continue;
        seenNodes.add(node);
        for (const prop of Object.keys(nodeChans)) {
            const gain = GAINS[prop] ?? 0.15;
            const raw = sampleChannel(nodeChans[prop], frames, fps);
            const rx = raw[0], ry = raw[1], rz = raw[2];
            const delta = new Float32Array(frames * 3);
            for (let f = 0; f < frames; f++) {
              delta[f*3+0] = (raw[f*3+0]-rx) * gain;
              delta[f*3+1] = (raw[f*3+1]-ry) * gain;
              delta[f*3+2] = (raw[f*3+2]-rz) * gain;
            }
            sampled[node+'|'+prop] = delta;
        }
    }

    // Blender-only channels (from manifest, not GLB)
    const boList = action.blender_only_channels || [];
    let boPour = null, boEmission = null;
    for (const bo of boList) {
      if (bo.channel && bo.channel.includes('curve.data.offset')) boPour = interpBlenderOnly(bo, frames);
      if (bo.channel && bo.channel.includes('emission_strength')) boEmission = interpBlenderOnly(bo, frames);
    }

    tsOutput += '  ' + name + ': {\n';
    tsOutput += '    fps: ' + fps + ',\n';
    tsOutput += '    loop: ' + loop + ',\n';
    tsOutput += '    frames: [\n';

    for (let f = 0; f < frames; f++) {
        let dx = 0, dy = 0, dz = 0;
        for (const [, arr] of Object.entries(sampled)) {
            dx += arr[f*3];
            dy += arr[f*3+1];
            dz += arr[f*3+2];
        }
        if (boPour) dz += boPour[f];
        if (boEmission) dz += (boEmission[f] - 0.5) * 0.1;
        const one = q(dx)+','+q(dy)+','+q(dz);
        const parts = [];
        for (let v = 0; v < vertexCount; v++) parts.push(one);
        tsOutput += '      new Float32Array([' + parts.join(',') + ']),\n';
    }

    tsOutput += '    ],\n';
    tsOutput += '  },\n';
}

tsOutput += '};\n';
fs.writeFileSync(OUT_TS, tsOutput);
console.log('WROTE:', OUT_TS);
