"""bake_sprites.py — Eevee sprite-sheet renderer for How2Soap particle FX.

Usage:
    blender --background --python blender/scripts/bake_sprites.py -- --help
    blender --background --python blender/scripts/bake_sprites.py -- --dry-run   # print sheet plan, no render
    blender --background --python blender/scripts/bake_sprites.py -- --only flame bubbles
    blender --background --python blender/scripts/bake_sprites.py                # render all sheets

Atlas grid (also written to ``src/assets/sprites/atlas.json``):
    flame     4x4 (16 frames, 128px cells -> 512x512 atlas, 30fps loop)
    ember     4x1 (4 frames, 256px -> 1024x256 strip, 12fps)
    fume      4x1 (4 frames, 256px -> 1024x256 strip, 12fps)
    bubbles   4x1 (4 frames, 256px -> 1024x256 strip, 12fps)

Bundle budget: webpack ``maxAssetSize=200000`` covers PNGs (assetFilter only
exempts mp4/webm/map), so flame renders at 128px cells (512x512 px, <150KB
class). Layout/grid/fps are unchanged; only flame's cell resolution differs.

Method: each sheet's sprite is animated (transform-only) in Blender, the
evaluated pose per frame is duplicated into a grid of sprite copies, and the
grid is rendered once with Eevee (transparent film, PNG RGBA, ortho camera).
Transform-only animation keeps every atlas cell's pose exact with a single
shared material. Cell row 0 is the BOTTOM row (Blender origin); when drawing
from image-file top row, use ``row_from_top = rows - 1 - row``.

Outputs (real PNGs, committed with this script set):
    src/assets/sprites/flame.png, ember.png, fume.png, bubbles.png, atlas.json

Requires a working Eevee/OpenGL context. Where headless GL is unavailable,
use ``--dry-run`` (CI-safe) — the plan, grid, and manifest stay valid.
GLB assets are untouched by this script.
"""
import bpy
import json
import math
import os
import sys

CELL_PX = 256        # default cell size; flame uses 128px cells (512x512 sheet)
CELL_WORLD = 1.6      # world units per atlas cell (ortho framing)
OUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "src", "assets", "sprites"))

HELP = """bake_sprites.py — Eevee sprite-sheet renderer (flame/ember/fume/bubbles)

Usage:
    blender --background --python blender/scripts/bake_sprites.py -- --help
    blender --background --python blender/scripts/bake_sprites.py -- --dry-run
    blender --background --python blender/scripts/bake_sprites.py [--only NAME ...]

Options:
    --only NAME ...   Render only named sheets (default: all)
    --dry-run         Print sheet plan, write atlas.json, no render
    --help            Show this text

Outputs under src/assets/sprites/: flame.png (4x4), ember.png (4x1),
fume.png (4x1), bubbles.png (4x1), atlas.json.
"""


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    args = {"help": False, "only": [], "dry_run": False}
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--help":
            args["help"] = True
        elif a == "--only":
            # Consume only the values after --only; stop at the next --flag so
            # trailing flags (e.g. --dry-run) are still parsed.
            i += 1
            while i < len(argv) and not argv[i].startswith("--"):
                args["only"].append(argv[i])
                i += 1
            continue
        elif a == "--dry-run":
            args["dry_run"] = True
        i += 1
    return args


# ------------------------------------------------------------------ helpers

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for block in bpy.data.meshes:
        bpy.data.meshes.remove(block)
    for block in bpy.data.materials:
        bpy.data.materials.remove(block)
    for block in bpy.data.cameras:
        bpy.data.cameras.remove(block)
    for block in bpy.data.lights:
        bpy.data.lights.remove(block)
    for block in bpy.data.worlds:
        bpy.data.worlds.remove(block)


def make_material(name, rgb, emission=None, emission_strength=0.0, roughness=0.5):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    if emission is not None:
        try:
            bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        except KeyError:
            bsdf.inputs["Emission"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    mat.blend_method = 'BLEND'
    return mat


def shade_flat(obj):
    for p in obj.data.polygons:
        p.use_smooth = False


def kf(obj, frame, path, value):
    if path == "scale":
        obj.scale = value
    elif path == "location":
        obj.location = value
    elif path == "rotation_euler":
        obj.rotation_euler = value
    obj.keyframe_insert(data_path=path, frame=int(frame))


def setup_render(cols, rows, fps, cell_px=CELL_PX):
    scene = bpy.context.scene
    # Eevee engine (name differs across Blender versions)
    for engine in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE'):
        try:
            scene.render.engine = engine
            break
        except TypeError:
            continue
    scene.render.resolution_x = cols * cell_px
    scene.render.resolution_y = rows * cell_px
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.fps = int(fps)
    scene.render.fps_base = 1.0
    # Light + key light for form (transparent film keeps BG alpha 0)
    world = bpy.data.worlds.new("SpriteWorld")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.05, 0.045, 0.06, 1.0)
    bg.inputs[1].default_value = 1.0
    scene.world = world
    bpy.ops.object.light_add(type='SUN', location=(2, -2, 4))
    sun = bpy.context.active_object
    sun.data.energy = 2.5
    sun.rotation_euler = (math.radians(50), 0, math.radians(35))
    # Ortho camera centred on the grid (grid cells are symmetric about origin)
    bpy.ops.object.camera_add(location=(0, -5, 0), rotation=(math.radians(90), 0, 0))
    cam = bpy.context.active_object
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = max(cols, rows) * CELL_WORLD
    scene.camera = cam


def render_sheet(name, cols, rows, frames, fps, base_objects, cell_px=CELL_PX):
    """Duplicate evaluated per-frame poses into a grid and render once."""
    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = frames
    dg = bpy.context.evaluated_depsgraph_get()
    grid_col = bpy.data.collections.new("GridSprites")
    scene.collection.children.link(grid_col)
    for i in range(frames):
        f = i + 1
        scene.frame_set(f)
        dg.update()
        cx, cy = i % cols, i // cols
        ox = (cx - (cols - 1) / 2) * CELL_WORLD
        oz = (cy - (rows - 1) / 2) * CELL_WORLD
        for obj in base_objects:
            eval_obj = dg.objects[obj.name]
            copy = obj.copy()
            copy.animation_data_clear()  # copies inherit the rig's Action; clear so later dg.update() cannot re-pose them
            copy.data = obj.data.copy()
            # Compose the cell offset straight into the matrix: setting
            # copy.location after matrix_world does not recompose it headless.
            mat = eval_obj.matrix_world.copy()
            mat.translation.x += ox
            mat.translation.z += oz
            copy.matrix_world = mat
            grid_col.objects.link(copy)
    # Hide base rig objects so only the grid renders
    for obj in base_objects:
        obj.hide_render = True
    setup_render(cols, rows, fps, cell_px)
    os.makedirs(OUT_DIR, exist_ok=True)
    out_path = os.path.join(OUT_DIR, f"{name}.png")
    scene.render.filepath = out_path
    bpy.ops.render.render(write_still=True)
    print(f"RENDERED: {out_path} ({cols * cell_px}x{rows * cell_px}px, {frames} frames @ {fps}fps)")
    return out_path


# ------------------------------------------------------------------ sprites

def build_flame():
    clear_scene()
    objs = []
    bpy.ops.mesh.primitive_cone_add(radius1=0.5, depth=1.1, location=(0, 0, 0.0))
    outer = bpy.context.active_object
    outer.name = "flame_outer"
    outer.data.materials.append(make_material("Flame", (1.0, 0.45, 0.1), emission=(1.0, 0.35, 0.04), emission_strength=1.2, roughness=0.7))
    shade_flat(outer)
    objs.append(outer)
    bpy.ops.mesh.primitive_cone_add(radius1=0.28, depth=0.7, location=(0, 0, -0.15))
    inner = bpy.context.active_object
    inner.name = "flame_inner"
    inner.data.materials.append(make_material("FlameInner", (1.0, 0.82, 0.25), emission=(1.0, 0.65, 0.12), emission_strength=1.6, roughness=0.7))
    shade_flat(inner)
    objs.append(inner)
    for f in range(1, 17):  # 16-frame loop, period 8 -> closes on wrap
        t = (f - 1) / 16.0
        sq = 1.0 + 0.16 * math.sin(t * 8 * math.pi)
        fl = 1.0 + 0.10 * math.sin(t * 16 * math.pi + 0.6)
        kf(outer, f, "scale", (fl, fl, sq))
        kf(inner, f, "scale", (fl, fl, sq))
    return objs


def build_ember():
    clear_scene()
    objs = []
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.14, location=(0, 0, 0))
    ember = bpy.context.active_object
    ember.name = "ember"
    ember.data.materials.append(make_material("Ember", (1.0, 0.6, 0.15), emission=(1.0, 0.55, 0.1), emission_strength=6.0, roughness=0.6))
    shade_flat(ember)
    objs.append(ember)
    for (f, z, s) in ((1, -0.4, 1.0), (2, -0.1, 0.8), (3, 0.25, 0.6), (4, 0.55, 0.4)):
        kf(ember, f, "location", (0, 0, z))
        kf(ember, f, "scale", (s, s, s))
    return objs


def build_fume():
    clear_scene()
    objs = []
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.45, location=(0, 0, 0))
    fume = bpy.context.active_object
    fume.name = "fume"
    fume.data.materials.append(make_material("Fume", (0.55, 0.55, 0.58), roughness=1.0))
    shade_flat(fume)
    objs.append(fume)
    for (f, z, s) in ((1, -0.3, 0.4), (2, -0.05, 0.65), (3, 0.2, 0.9), (4, 0.45, 1.15)):
        kf(fume, f, "location", (0, 0, z))
        kf(fume, f, "scale", (s, s, s))
    return objs


def build_bubbles():
    clear_scene()
    objs = []
    mat = make_material("Bubble", (0.6, 0.85, 1.0), emission=(0.55, 0.8, 1.0), emission_strength=1.5, roughness=0.15)
    spots = [(-0.35, -0.2), (-0.1, 0.25), (0.15, -0.3), (0.35, 0.15), (0.0, 0.0)]
    for i, (x, y) in enumerate(spots):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.09 + 0.03 * (i % 3), location=(x, y, -0.2))
        b = bpy.context.active_object
        b.name = f"bubble_{i}"
        b.data.materials.append(mat)
        shade_flat(b)
        objs.append(b)
        for f in range(1, 5):
            s = 0.0 if f <= i else 1.0  # staggered pop-in
            kf(b, f, "scale", (s, s, s))
            kf(b, f, "location", (x, y, -0.2 + 0.12 * (f - 1)))
    return objs


SHEETS = {
    "flame":   {"cols": 4, "rows": 4, "frames": 16, "fps": 30, "cell_px": 128, "builder": build_flame},
    "ember":   {"cols": 4, "rows": 1, "frames": 4,  "fps": 12, "cell_px": 256, "builder": build_ember},
    "fume":    {"cols": 4, "rows": 1, "frames": 4,  "fps": 12, "cell_px": 256, "builder": build_fume},
    "bubbles": {"cols": 4, "rows": 1, "frames": 4,  "fps": 12, "cell_px": 256, "builder": build_bubbles},
}


def write_manifest():
    os.makedirs(OUT_DIR, exist_ok=True)
    manifest = {
        "format": "PNG RGBA, Eevee, transparent film, transform-only pose bake",
        "origin": "row 0 = BOTTOM row (Blender origin); row_from_top = rows - 1 - row",
        "cell_px_default": CELL_PX,
        "cell_px_note": "Per-sheet cell_px in sheets[]. flame renders at 128px cells (512x512 sheet) so its PNG stays <200KB under webpack maxAssetSize; other sheets use 256px cells. 4x4 layout/fps unchanged.",
        "cell_world": CELL_WORLD,
        "sheets": {
            name: {
                "file": f"{name}.png",
                "cols": s["cols"], "rows": s["rows"], "frames": s["frames"], "fps": s["fps"],
                "cell_px": s["cell_px"],
                "atlas_px": [s["cols"] * s["cell_px"], s["rows"] * s["cell_px"]],
                "loop": name == "flame",
            }
            for name, s in SHEETS.items()
        },
    }
    with open(os.path.join(OUT_DIR, "atlas.json"), "w") as fh:
        json.dump(manifest, fh, indent=2)
    print(f"WROTE: {os.path.join(OUT_DIR, 'atlas.json')}")


def main():
    args = parse_args()
    if args["help"]:
        print(HELP)
        sys.exit(0)
    wanted = args["only"] or list(SHEETS)
    if args["dry_run"]:
        print("DRY-RUN — sprite sheet plan (ortho, Eevee, PNG RGBA; per-sheet cell_px):")
        for name in wanted:
            s = SHEETS[name]
            print(f"  {name}: {s['cols']}x{s['rows']} = {s['frames']} frames @ {s['cell_px']}px cells -> "
                  f"{OUT_DIR}/{name}.png ({s['cols'] * s['cell_px']}x{s['rows'] * s['cell_px']}px) @ {s['fps']}fps")
        write_manifest()
        sys.exit(0)
    for name in wanted:
        if name not in SHEETS:
            print(f"SKIP: unknown sheet '{name}'")
            continue
        s = SHEETS[name]
        objs = s["builder"]()
        render_sheet(name, s["cols"], s["rows"], s["frames"], s["fps"], objs, cell_px=s["cell_px"])
    write_manifest()
    print(f"ALL SPRITE SHEETS COMPLETE — {len(wanted)} sheet(s)")


main()
