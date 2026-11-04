"""export_glb.py — glTF 2.0 export helper for How2Soap.
Usage: blender --background --python blender/scripts/export_glb.py -- --asset building --lod 0
    --asset terrain/buildings/characters/props
    --lod 0|1|2 (0=full, 1=50% decimate, 2=25% decimate)
    --draco on|off
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

# glTF export — Binary .glb, +Y Up, Apply Modifiers, JPEG, Draco optional
bpy.ops.export_scene.gltf(
    filepath=out_path,
    export_format='GLB',
    use_selection=True,
    export_apply=True,
    export_yup=True,
    export_normals=True,
    export_tangents=False,
    export_vertex_color='NONE' if asset == 'terrain' else 'MATERIAL',
    export_draco_mesh_compression_enable=draco_on,
    export_draco_mesh_compression_level=7,
    export_draco_mesh_compression_position_quantization=14,
    export_draco_mesh_compression_normal_quantization=10,
    export_draco_mesh_compression_texcoord_quantization=12,
    export_draco_mesh_compression_color_quantization=8,
    export_image_format='AUTO',  # Blender auto-converts to JPEG/PNG
    export_texture_dir=out_dir,
)
print(f"EXPORTED: {out_path} (draco={'on' if draco_on else 'off'}, lod={lod})")
