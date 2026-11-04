"""build_assets.py — Headless Blender script to create 6 initial glTF assets.

Creates: grass-tile, tree, rock, house, mine-shaft, colonist
Each asset is built as a separate scene setup, exported to public/assets/.

Usage: blender --background --python blender/scripts/build_assets.py
"""
import bpy, os, math
from mathutils import Vector

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "public", "assets")

def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for block in bpy.data.meshes:
        bpy.data.meshes.remove(block)
    for block in bpy.data.materials:
        bpy.data.materials.remove(block)
    for block in bpy.data.cameras:
        bpy.data.cameras.remove(block)

def make_material(name, rgb, metallic=0.0, roughness=0.9):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    return mat

def shade_flat(obj):
    for p in obj.data.polygons:
        p.use_smooth = False

# ── grass-tile (16×16m, 2 tris, vertex-colour) ──
clear_scene()
bpy.ops.mesh.primitive_plane_add(size=16)
tile = bpy.context.active_object
tile.name = "grass-tile"
mat = make_material("Grass", (0.3, 0.6, 0.3))
tile.data.materials.append(mat)
shade_flat(tile)

os.makedirs(os.path.join(OUT, "terrain"), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, "terrain", "grass-tile.glb"),
    export_format='GLB', export_apply=True, export_yup=True)
print("EXPORTED: grass-tile.glb")

# ── tree (icosphere trunk + cone canopy, ~80 tris) ──
clear_scene()
bpy.ops.mesh.primitive_cylinder_add(radius=0.15, depth=1.2, location=(0, 0, 0.6))
trunk = bpy.context.active_object
trunk.name = "tree-trunk"
mat_trunk = make_material("Trunk", (0.4, 0.25, 0.1))
trunk.data.materials.append(mat_trunk)
shade_flat(trunk)

bpy.ops.mesh.primitive_cone_add(radius1=0.8, depth=1.8, location=(0, 0, 2.0))
canopy = bpy.context.active_object
canopy.name = "tree-canopy"
mat_leaf = make_material("Leaf", (0.2, 0.7, 0.25))
canopy.data.materials.append(mat_leaf)
shade_flat(canopy)

# Join
bpy.ops.object.select_all(action='SELECT')
bpy.context.view_layer.objects.active = canopy
bpy.ops.object.join()
tree = bpy.context.active_object
tree.name = "tree"

os.makedirs(os.path.join(OUT, "props"), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, "props", "tree.glb"),
    export_format='GLB', export_apply=True, export_yup=True)
print("EXPORTED: tree.glb")

# ── rock (icosphere, ~80 tris) ──
clear_scene()
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.5, location=(0, 0, 0.3))
rock = bpy.context.active_object
rock.name = "rock"
mat_rock = make_material("Stone", (0.5, 0.5, 0.5))
rock.data.materials.append(mat_rock)
shade_flat(rock)

bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, "props", "rock.glb"),
    export_format='GLB', export_apply=True, export_yup=True)
print("EXPORTED: rock.glb")

# ── house (cube + cone roof, ~50 tris) ──
clear_scene()
bpy.ops.mesh.primitive_cube_add(size=2.0, location=(0, 0, 1.0))
house = bpy.context.active_object
house.name = "house"
mat_wall = make_material("Wall", (0.85, 0.75, 0.6))
house.data.materials.append(mat_wall)
shade_flat(house)

bpy.ops.mesh.primitive_cube_add(size=2.4, location=(0, 0, 2.2))
roof = bpy.context.active_object
roof.name = "roof"
mat_roof = make_material("Roof", (0.6, 0.2, 0.15))
roof.data.materials.append(mat_roof)
shade_flat(roof)

bpy.ops.object.select_all(action='SELECT')
bpy.context.view_layer.objects.active = roof
bpy.ops.object.join()
house = bpy.context.active_object
house.name = "house"

os.makedirs(os.path.join(OUT, "buildings"), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, "buildings", "house.glb"),
    export_format='GLB', export_apply=True, export_yup=True)
print("EXPORTED: house.glb")

# ── mine-shaft (cylinder hole ring + timber frame, ~120 tris) ──
clear_scene()
bpy.ops.mesh.primitive_cylinder_add(radius=1.0, depth=1.5, location=(0, 0, 0.75))
shaft = bpy.context.active_object
shaft.name = "mine-shaft"
mat_shaft = make_material("StoneDark", (0.3, 0.3, 0.3))
shaft.data.materials.append(mat_shaft)
shade_flat(shaft)

os.makedirs(os.path.join(OUT, "buildings"), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, "buildings", "mine-shaft.glb"),
    export_format='GLB', export_apply=True, export_yup=True)
print("EXPORTED: mine-shaft.glb")

# ── colonist (4-bone rig: root/spine/head/arm-stub) ──
clear_scene()
# Body
bpy.ops.mesh.primitive_cube_add(size=0.4, location=(0, 0, 0.9))
body = bpy.context.active_object
body.name = "colonist-body"
mat_body = make_material("ColonistCloth", (0.5, 0.4, 0.3))
body.data.materials.append(mat_body)
shade_flat(body)

# Head
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.18, location=(0, 0, 1.35))
head = bpy.context.active_object
head.name = "colonist-head"
mat_head = make_material("Skin", (0.9, 0.75, 0.6))
head.data.materials.append(mat_head)
shade_flat(head)

# Arm stub
bpy.ops.mesh.primitive_cube_add(size=0.15, location=(0.25, 0, 0.9))
arm = bpy.context.active_object
arm.name = "colonist-arm"
arm.data.materials.append(mat_body)
shade_flat(arm)

# Armature (4 bones)
bpy.ops.object.armature_add(enter_editmode=False, location=(0, 0, 0))
armature = bpy.context.active_object
armature.name = "colonist-rig"
bpy.ops.object.mode_set(mode='EDIT')
eb = armature.data.edit_bones
# root
root = eb.new("root")
root.head = (0, 0, 0.6); root.tail = (0, 0, 0.8)
# spine
spine = eb.new("spine")
spine.head = (0, 0, 0.8); spine.tail = (0, 0, 1.15)
spine.parent = root
# head
head_bone = eb.new("head")
head_bone.head = (0, 0, 1.15); head_bone.tail = (0, 0, 1.45)
head_bone.parent = spine
# arm
arm_bone = eb.new("arm")
arm_bone.head = (0.15, 0, 1.0); arm_bone.tail = (0.3, 0, 1.0)
arm_bone.parent = spine
bpy.ops.object.mode_set(mode='OBJECT')

# Parent with automatic weights
for obj in [body, head, arm]:
    obj.select_set(True)
armature.select_set(True)
bpy.context.view_layer.objects.active = armature
bpy.ops.object.parent_set(type='ARMATURE_AUTO')

os.makedirs(os.path.join(OUT, "characters"), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, "characters", "colonist.glb"),
    export_format='GLB', export_apply=True, export_yup=True)
print("EXPORTED: colonist.glb")

print("ALL ASSETS EXPORTED — Phase 1 build_assets complete")
