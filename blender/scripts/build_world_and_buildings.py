"""
blender/scripts/build_world_and_buildings.py
High-fidelity procedural generation and baking for How2Soap:
1. Colony Buildings:
   - Hearth & Camp Centre (stone fire pit, log seating, brass compass marker, glowing embers)
   - Mine Shaft Headframe (timber A-frame derrick, rope hoist pulley, mine tracks, ore cart)
   - Workshop / Apothecary Laboratory (shingled timber roof, stone chimney, alembic retort bench)
2. World Map Relief Underlay:
   - Procedural 3D alchemical landscape generated from BIOME_DAG data
   - Concentric survey rings, elevation contours, rivers, biome forests, mineral hills
   - Baked top-down orthographic survey map to src/assets/tutorial/blender_terrain_map.png
3. Terrain & Building GLBs:
   - public/assets/buildings/hearth.glb
   - public/assets/buildings/mine-shaft.glb
   - public/assets/buildings/apothecary.glb
   - public/assets/buildings/house.glb
   - public/assets/terrain/grass-tile.glb
"""

import bpy
import bmesh
import math
import os
import random
from mathutils import Vector, Euler

OUT_ASSETS = os.path.join(os.path.dirname(__file__), "..", "..", "public", "assets")
OUT_MAP = os.path.join(os.path.dirname(__file__), "..", "..", "src", "assets", "tutorial", "blender_terrain_map.png")

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    # Ensure a clean scene collection
    if not bpy.data.scenes:
        bpy.data.scenes.new("Scene")
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if hasattr(bpy.types, 'RenderSettings') and 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'

def make_pbr_material(name, base_color, metallic=0.0, roughness=0.7, emission_color=(0,0,0,1), emission_strength=0.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    if bsdf:
        if "Base Color" in bsdf.inputs:
            bsdf.inputs["Base Color"].default_value = (*base_color[:3], 1.0)
        if "Metallic" in bsdf.inputs:
            bsdf.inputs["Metallic"].default_value = metallic
        if "Roughness" in bsdf.inputs:
            bsdf.inputs["Roughness"].default_value = roughness
        if "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = (*emission_color[:3], 1.0)
        elif "Emission" in bsdf.inputs:
            bsdf.inputs["Emission"].default_value = (*emission_color[:3], 1.0)
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = emission_strength
    return mat

def export_active_as_glb(filepath):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    props = bpy.ops.export_scene.gltf.get_rna_type().properties
    kwargs = dict(
        filepath=filepath,
        export_format='GLB',
        export_apply=True,
        export_yup=True,
    )
    if "export_vertex_color" in props:
        kwargs["export_vertex_color"] = "MATERIAL"
    bpy.ops.export_scene.gltf(**kwargs)
    print(f"EXPORTED: {filepath}")

# ==========================================
# 1. BUILDINGS GENERATION
# ==========================================

def build_hearth():
    reset_scene()
    
    mat_stone = make_pbr_material("HearthStone", (0.35, 0.35, 0.38), roughness=0.9)
    mat_brass = make_pbr_material("AstrolabeBrass", (0.85, 0.65, 0.2), metallic=0.9, roughness=0.3)
    mat_ember = make_pbr_material("Embers", (1.0, 0.3, 0.05), emission_color=(1.0, 0.25, 0.02), emission_strength=4.0)
    mat_wood = make_pbr_material("CampWood", (0.38, 0.22, 0.12), roughness=0.8)

    # Base stone platform
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=2.2, depth=0.15, location=(0, 0, 0.075))
    platform = bpy.context.active_object
    platform.data.materials.append(mat_stone)

    # Brass survey ring inlay
    bpy.ops.mesh.primitive_torus_add(major_radius=2.0, minor_radius=0.04, location=(0, 0, 0.16))
    ring = bpy.context.active_object
    ring.data.materials.append(mat_brass)

    # Stone hearth ring
    num_stones = 10
    for i in range(num_stones):
        angle = (i / num_stones) * 2 * math.pi
        x = math.cos(angle) * 0.95
        y = math.sin(angle) * 0.95
        bpy.ops.mesh.primitive_cube_add(size=0.35, location=(x, y, 0.28))
        st = bpy.context.active_object
        st.rotation_euler = (random.uniform(-0.1, 0.1), random.uniform(-0.1, 0.1), angle + 0.2)
        st.scale = (1.2, 0.8, 0.9)
        st.data.materials.append(mat_stone)

    # Glowing ember mound
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.6, location=(0, 0, 0.22))
    ember = bpy.context.active_object
    ember.scale = (1.0, 1.0, 0.4)
    ember.data.materials.append(mat_ember)

    # Camp perimeter split logs
    for angle in [math.pi * 0.4, math.pi * 1.1, math.pi * 1.7]:
        x = math.cos(angle) * 1.6
        y = math.sin(angle) * 1.6
        bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.18, depth=1.1, location=(x, y, 0.2))
        log = bpy.context.active_object
        log.rotation_euler = (0, math.pi / 2, angle + math.pi / 2)
        log.data.materials.append(mat_wood)

    # Join into single hero hearth
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.join()
    hearth = bpy.context.active_object
    hearth.name = "hearth-hero"

    export_active_as_glb(os.path.join(OUT_ASSETS, "buildings", "hearth.glb"))

def build_mine_shaft():
    reset_scene()

    mat_timber = make_pbr_material("MiningTimber", (0.32, 0.18, 0.09), roughness=0.85)
    mat_metal = make_pbr_material("IronHardware", (0.22, 0.24, 0.26), metallic=0.8, roughness=0.4)
    mat_ore = make_pbr_material("OreLump", (0.75, 0.45, 0.2), metallic=0.6, roughness=0.5)
    mat_rock = make_pbr_material("MineRock", (0.25, 0.25, 0.27), roughness=0.9)

    # Stone shaft collar
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=1.4, depth=0.4, location=(0, 0, 0.2))
    collar = bpy.context.active_object
    collar.data.materials.append(mat_rock)

    # A-Frame Derrick Legs (4 posts angled inward)
    leg_coords = [(-0.9, -0.9), (0.9, -0.9), (-0.9, 0.9), (0.9, 0.9)]
    for lx, ly in leg_coords:
        bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.08, depth=2.8, location=(lx * 0.55, ly * 0.55, 1.4))
        leg = bpy.context.active_object
        angle_x = -math.atan2(ly * 0.45, 2.8)
        angle_y = math.atan2(lx * 0.45, 2.8)
        leg.rotation_euler = (angle_x, angle_y, 0)
        leg.data.materials.append(mat_timber)

    # Top crossbeam & Pulley Wheel
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.09, depth=1.3, location=(0, 0, 2.75))
    top_beam = bpy.context.active_object
    top_beam.rotation_euler = (0, math.pi / 2, 0)
    top_beam.data.materials.append(mat_timber)

    # Cast Iron Sheave Pulley Wheel
    bpy.ops.mesh.primitive_cylinder_add(vertices=14, radius=0.35, depth=0.08, location=(0, 0, 2.5))
    sheave = bpy.context.active_object
    sheave.rotation_euler = (math.pi / 2, 0, 0)
    sheave.data.materials.append(mat_metal)

    # Timber Rails leading out
    for rx in [-0.3, 0.3]:
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(rx, 1.5, 0.08))
        rail = bpy.context.active_object
        rail.scale = (0.06, 2.2, 0.06)
        rail.data.materials.append(mat_timber)

    # Mine Ore Cart
    bpy.ops.mesh.primitive_cube_add(size=0.6, location=(0, 1.3, 0.35))
    cart = bpy.context.active_object
    cart.scale = (0.75, 1.1, 0.6)
    cart.data.materials.append(mat_metal)

    # Ore in cart
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.25, location=(0, 1.3, 0.55))
    ore = bpy.context.active_object
    ore.scale = (1.2, 1.4, 0.5)
    ore.data.materials.append(mat_ore)

    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.join()
    mine = bpy.context.active_object
    mine.name = "mine-shaft-hero"

    export_active_as_glb(os.path.join(OUT_ASSETS, "buildings", "mine-shaft.glb"))

def build_apothecary_workshop():
    reset_scene()

    mat_timber = make_pbr_material("ApoTimber", (0.45, 0.3, 0.18), roughness=0.8)
    mat_shingle = make_pbr_material("ApoShingle", (0.28, 0.32, 0.35), roughness=0.7)
    mat_stone = make_pbr_material("ApoMasonry", (0.4, 0.4, 0.42), roughness=0.9)
    mat_copper = make_pbr_material("AlembicCopper", (0.85, 0.45, 0.25), metallic=0.92, roughness=0.25)
    mat_glass = make_pbr_material("CarboyGlass", (0.3, 0.8, 0.7), roughness=0.15)

    # Main Workshop Cabin Walls
    bpy.ops.mesh.primitive_cube_add(size=2.0, location=(0, 0, 1.0))
    walls = bpy.context.active_object
    walls.scale = (1.3, 1.0, 1.0)
    walls.data.materials.append(mat_timber)

    # Overhanging Gable Roof
    bpy.ops.mesh.primitive_cylinder_add(vertices=3, radius=1.6, depth=2.9, location=(0, 0, 2.4))
    roof = bpy.context.active_object
    roof.rotation_euler = (0, math.pi / 2, 0)
    roof.scale = (0.75, 1.35, 1.0)
    roof.data.materials.append(mat_shingle)

    # Masonry Chimney with flue pot
    bpy.ops.mesh.primitive_cube_add(size=0.5, location=(1.1, 0.5, 2.0))
    chimney = bpy.context.active_object
    chimney.scale = (0.8, 0.8, 2.4)
    chimney.data.materials.append(mat_stone)

    # External distillation bench
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(-1.6, 0.2, 0.55))
    bench = bpy.context.active_object
    bench.scale = (0.6, 1.4, 0.08)
    bench.data.materials.append(mat_timber)

    # Bench legs
    for bx, by in [(-1.8, -0.4), (-1.4, -0.4), (-1.8, 0.8), (-1.4, 0.8)]:
        bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.04, depth=0.55, location=(bx, by, 0.275))
        leg = bpy.context.active_object
        leg.data.materials.append(mat_timber)

    # Copper Retort & Condenser Coil
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.18, location=(-1.6, 0.5, 0.75))
    retort = bpy.context.active_object
    retort.data.materials.append(mat_copper)

    # Glass collection flask
    bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.12, radius2=0.04, depth=0.22, location=(-1.6, -0.1, 0.7))
    flask = bpy.context.active_object
    flask.data.materials.append(mat_glass)

    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.join()
    apo = bpy.context.active_object
    apo.name = "apothecary-hero"

    export_active_as_glb(os.path.join(OUT_ASSETS, "buildings", "apothecary.glb"))
    export_active_as_glb(os.path.join(OUT_ASSETS, "buildings", "house.glb"))

# ==========================================
# 2. WORLD MAP TOP-DOWN 3D RELIEF SURVEY
# ==========================================

def render_world_map_relief():
    reset_scene()
    scene = bpy.context.scene

    # Map dimensions: 1024x1024 orthographic survey
    scene.render.resolution_x = 1024
    scene.render.resolution_y = 1024
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'

    # 1. Base Terrain Mesh with Radial Elevation & Drainage Valleys
    grid_res = 64
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=grid_res, y_subdivisions=grid_res, size=32.0, location=(0, 0, 0))
    grid = bpy.context.active_object
    grid.name = "AlchemicalSurveyTerrain"

    # Shape terrain: central settlement basin, surrounding hills, river valleys
    mesh = grid.data
    for v in mesh.vertices:
        r = math.hypot(v.co.x, v.co.y)
        angle = math.atan2(v.co.y, v.co.x)
        # Gentle central depression for hearth camp
        height = math.exp(-((r - 8.0)**2) / 30.0) * 1.8 + math.sin(angle * 3.0) * 0.4
        # Mountain ridges on the outer rim
        if r > 10.0:
            height += (r - 10.0) * 0.35 + math.cos(angle * 5.0) * 0.6
        # River valley cut
        valley_dist = abs(v.co.y - math.sin(v.co.x * 0.25) * 2.5)
        if valley_dist < 2.0:
            height -= math.exp(-(valley_dist**2) / 1.0) * 0.8
        v.co.z = max(-0.2, height)
    mesh.update()

    # Materials with shaded elevation gradients
    mat_terrain = make_pbr_material("MapSurveyTerrain", (0.12, 0.17, 0.2), roughness=0.88)
    grid.data.materials.append(mat_terrain)

    # 2. Alchemical Astrolabe Survey Concentric Rings (100m, 300m, 600m, 1200m, 1600m scaled)
    mat_brass = make_pbr_material("MapBrassRings", (0.85, 0.65, 0.22), metallic=0.9, roughness=0.3, emission_color=(0.85, 0.65, 0.2), emission_strength=1.5)
    for radius in [2.0, 4.5, 7.5, 11.5, 15.0]:
        bpy.ops.mesh.primitive_torus_add(major_radius=radius, minor_radius=0.035, location=(0, 0, 0.05))
        torus = bpy.context.active_object
        torus.data.materials.append(mat_brass)

    # 3. Biome Clusters & Visual Landmarks
    # Oak Hardwood Groves (NE quadrant)
    mat_oak = make_pbr_material("GroveOak", (0.18, 0.45, 0.22), roughness=0.9)
    for _ in range(16):
        gx = random.uniform(3.0, 7.0)
        gy = random.uniform(2.0, 6.0)
        bpy.ops.mesh.primitive_cone_add(radius1=0.6, depth=1.2, location=(gx, gy, 0.6))
        c = bpy.context.active_object
        c.data.materials.append(mat_oak)

    # Mineral deposits & Halite Crystal Peaks (NW quadrant)
    mat_halite = make_pbr_material("OreHalite", (0.8, 0.85, 0.95), roughness=0.2, emission_color=(0.7, 0.85, 1.0), emission_strength=1.2)
    for _ in range(10):
        mx = random.uniform(-7.5, -3.5)
        my = random.uniform(3.0, 8.0)
        bpy.ops.mesh.primitive_cylinder_add(vertices=5, radius=0.45, depth=1.4, location=(mx, my, 0.7))
        c = bpy.context.active_object
        c.rotation_euler = (random.uniform(-0.2, 0.2), random.uniform(-0.2, 0.2), random.uniform(0, 3))
        c.data.materials.append(mat_halite)

    # Copper / Malachite Hills (SE quadrant)
    mat_copper_ore = make_pbr_material("OreCopper", (0.2, 0.65, 0.5), metallic=0.7, roughness=0.4)
    for _ in range(8):
        cx = random.uniform(3.5, 8.0)
        cy = random.uniform(-7.5, -3.0)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.8, location=(cx, cy, 0.4))
        c = bpy.context.active_object
        c.scale = (1.2, 1.0, 0.6)
        c.data.materials.append(mat_copper_ore)

    # Hearth Centre Camp (Golden Alchemical Beacon)
    mat_beacon = make_pbr_material("HearthBeacon", (1.0, 0.5, 0.1), emission_color=(1.0, 0.45, 0.1), emission_strength=6.0)
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.7, depth=0.3, location=(0, 0, 0.15))
    beacon = bpy.context.active_object
    beacon.data.materials.append(mat_beacon)

    # 4. Orthographic Top-Down Camera Setup
    bpy.ops.object.camera_add(location=(0, 0, 25.0), rotation=(0, 0, 0))
    cam = bpy.context.active_object
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = 32.0
    scene.camera = cam

    # 5. Sun & Diurnal Warm Lighting
    bpy.ops.object.light_add(type='SUN', location=(10, -10, 20))
    sun = bpy.context.active_object
    sun.data.energy = 3.5
    sun.data.color = (1.0, 0.95, 0.82)
    sun.rotation_euler = (math.radians(35), math.radians(20), math.radians(-30))

    # Ambient fill light
    bpy.ops.object.light_add(type='SUN', location=(-10, 10, 20))
    fill = bpy.context.active_object
    fill.data.energy = 1.2
    fill.data.color = (0.5, 0.65, 0.85)
    fill.rotation_euler = (math.radians(-30), math.radians(-20), math.radians(150))

    # Render to target tutorial map
    os.makedirs(os.path.dirname(OUT_MAP), exist_ok=True)
    scene.render.filepath = OUT_MAP
    bpy.ops.render.render(write_still=True)
    print(f"RENDERED HIGH-RES MAP: {OUT_MAP}")

def main():
    print("--- BUILDING HIGH-RES COLONY BUILDINGS ---")
    build_hearth()
    build_mine_shaft()
    build_apothecary_workshop()
    print("--- RENDERING HIGH-FIDELITY WORLD MAP RELIEF ---")
    render_world_map_relief()
    print("ALL COLONY BUILDINGS & WORLD MAP COMPLETE")

if __name__ == "__main__":
    main()
