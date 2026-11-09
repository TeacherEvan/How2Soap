"""export_glb.py — glTF 2.0 export helper for How2Soap.
Usage: blender --background --python blender/scripts/export_glb.py -- --asset building --lod 0
    --asset terrain/buildings/characters/props
    --lod 0|1|2 (0=full, 1=50% decimate, 2=25% decimate)
    --draco on|off (auto-off under 2000 tris; terrain uses level 7, others 6)
    --animation-mode auto|actions|skinning (auto: prefers SKINNING for characters, else ACTIONS;
    resolved against the installed Blender exporter's enum — Blender 5.2 'ACTIONS' also carries skinning)
Animations: export_animations=True, export_animation_sampling=True (30fps bake).
"""
import bpy, sys, os

def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    args = {}
    it = iter(argv)
    for a in it:
        if a.startswith("--"):
            k = a[2:]
            try: v = next(it)
            except StopIteration: v = "true"
            args[k] = v
    return args

args = parse_args()
asset = args.get("asset", "terrain")
lod = int(args.get("lod", "0"))
draco_on = args.get("draco", "off").lower() == "on"

# Apply scale
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

# Count triangles across selected meshes for Draco policy
def count_tris(objects):
    total = 0
    for obj in objects:
        if obj.type == 'MESH':
            for poly in obj.data.polygons:
                total += max(0, len(poly.vertices) - 2)  # fan-triangulated estimate
    return total

tri_count = count_tris(bpy.context.selected_objects)
if draco_on and tri_count < 2000:
    # Draco decode CPU exceeds benefit on small assets
    draco_on = False
    print(f"DRACO AUTO-OFF: {tri_count} weighted tris < 2000 (decode CPU > benefit)")
draco_level = 7 if asset == 'terrain' else 6

# Decimate for LOD>0
if lod > 0:
    ratio = 0.5 if lod == 1 else 0.25
    for obj in bpy.context.selected_objects:
        if obj.type == 'MESH':
            mod = obj.modifiers.new(name=f"DecimateLOD{lod}", type='DECIMATE')
            mod.ratio = ratio
            mod.use_collapse_triangulate = True

out_dir = os.path.join(os.path.dirname(__file__), "..", "..", "public", "assets", asset)
os.makedirs(out_dir, exist_ok=True)
out_path = os.path.join(out_dir, f"{asset}_lod{lod}.glb" if lod > 0 else f"{asset}.glb")

# Animation mode: SKINNING for characters, ACTIONS otherwise (overridable)
# Animation mode: resolve against the installed exporter's enum (5.2 dropped
# 'SKINNING' — 'ACTIONS' carries armature skinning too; 4.x knew 'SKINNING')
def resolve_anim_mode(preferred):
    props = bpy.ops.export_scene.gltf.get_rna_type().properties
    if 'export_animation_mode' not in props:
        return preferred
    known = [i.identifier for i in props['export_animation_mode'].enum_items]
    if preferred in known:
        return preferred
    for fallback in ('ACTIONS', 'ACTIVE_ACTIONS'):
        if fallback in known:
            return fallback
    return preferred

anim_mode_arg = args.get("animation-mode", "auto").lower()
if anim_mode_arg == "auto":
    anim_mode = resolve_anim_mode('SKINNING' if asset == 'characters' else 'ACTIONS')
else:
    anim_mode = resolve_anim_mode(anim_mode_arg.upper())

candidate = dict(
    filepath=out_path,
    export_format='GLB',
    use_selection=True,
    export_apply=True,
    export_yup=True,
    export_normals=True,
    export_tangents=False,
    export_vertex_color='NONE' if asset == 'terrain' else 'MATERIAL',
    export_animations=True,
    export_animation_sampling=True,
    export_animation_mode=anim_mode,
    export_draco_mesh_compression_enable=draco_on,
    export_draco_mesh_compression_level=draco_level,
    export_draco_mesh_compression_position_quantization=14,
    export_draco_mesh_compression_normal_quantization=10,
    export_draco_mesh_compression_texcoord_quantization=12,
    export_draco_mesh_compression_color_quantization=8,
    export_image_format='AUTO',  # Blender auto-converts to JPEG/PNG
    export_texture_dir=out_dir,
)
# Only pass exporter kwargs the installed Blender version recognises
props = bpy.ops.export_scene.gltf.get_rna_type().properties
known = {p.identifier for p in props}
kwargs = {k: v for k, v in candidate.items() if k in known}

# glTF export — Binary .glb, +Y Up, Apply Modifiers, JPEG, Draco per policy
bpy.ops.export_scene.gltf(**kwargs)
print(f"EXPORTED: {out_path} (draco={'on' if draco_on else 'off'}_L{draco_level if draco_on else 'n/a'}, lod={lod}, anim={anim_mode}, tris~{tri_count})")
