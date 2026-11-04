"""
Blender 5.2.2 LTS Procedural Low-Poly Mesh Generator for How2Soap
Generates compact, quantized WebGL2-ready low-poly geometry:
- Vessels: Wood Bucket, Clay Pot, Ceramic Crucible, Lead Chamber Cell, Glass Retort
- Equipment: Hearth Brazier, Voltaic Pile Battery
- Pawns & Markers: Colonist Pawn, Biome Node Crystals
Outputs TypeScript geometry definitions into src/ui/gl/lowPolyMeshes.ts
"""

import bpy
import bmesh
import json
import math
import os

def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def mesh_to_indexed_data(mesh):
    """Triangulates mesh and extracts positions, normals, and indices."""
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bm.to_mesh(mesh)
    bm.free()

    positions = []
    normals = []
    indices = []

    for vertex in mesh.vertices:
        # Quantize to 3 decimals to save bundle space
        positions.extend([round(vertex.co.x, 3), round(vertex.co.y, 3), round(vertex.co.z, 3)])
        normals.extend([round(vertex.normal.x, 3), round(vertex.normal.y, 3), round(vertex.normal.z, 3)])

    for poly in mesh.polygons:
        for idx in poly.vertices:
            indices.append(idx)

    return {
        "positions": positions,
        "normals": normals,
        "indices": indices
    }

def create_wood_bucket():
    # Cylinder tapered slightly
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.6, depth=1.0, location=(0, 0, 0.5))
    obj = bpy.context.active_object
    data = mesh_to_indexed_data(obj.data)
    bpy.data.objects.remove(obj)
    return data

def create_ceramic_crucible():
    # Bowl shape (cylinder with small bottom radius)
    bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=0.7, radius2=0.4, depth=0.8, location=(0, 0, 0.4))
    obj = bpy.context.active_object
    data = mesh_to_indexed_data(obj.data)
    bpy.data.objects.remove(obj)
    return data

def create_hearth_brazier():
    # Hexagonal brazier base
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=1.0, depth=0.4, location=(0, 0, 0.2))
    obj = bpy.context.active_object
    data = mesh_to_indexed_data(obj.data)
    bpy.data.objects.remove(obj)
    return data

def create_colonist_pawn():
    # Low poly pawn / boid: cone body + uv sphere head
    bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.4, radius2=0.1, depth=1.2, location=(0, 0, 0.6))
    body = bpy.context.active_object
    bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=6, radius=0.25, location=(0, 0, 1.35))
    head = bpy.context.active_object

    body.select_set(True)
    head.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()

    data = mesh_to_indexed_data(body.data)
    bpy.data.objects.remove(body)
    return data

def create_biome_crystal():
    # Octahedron / diamond crystal node
    bpy.ops.mesh.primitive_circle_add(vertices=4, radius=0.6, fill_type='NOTHING', location=(0, 0, 0.5))
    bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=0.5, radius2=0.0, depth=1.0, location=(0, 0, 0.5))
    obj = bpy.context.active_object
    data = mesh_to_indexed_data(obj.data)
    bpy.data.objects.remove(obj)
    return data

def main():
    clear_scene()
    models = {
        "WOOD_BUCKET": create_wood_bucket(),
        "CERAMIC_CRUCIBLE": create_ceramic_crucible(),
        "HEARTH_BRAZIER": create_hearth_brazier(),
        "COLONIST_PAWN": create_colonist_pawn(),
        "BIOME_CRYSTAL": create_biome_crystal()
    }

    out_dir = os.path.join(os.getcwd(), "src", "ui", "gl")
    os.makedirs(out_dir, exist_ok=True)
    out_file = os.path.join(out_dir, "lowPolyMeshes.ts")

    ts_content = f"""/**
 * Procedural Low-Poly 3D Meshes
 * Generated headless via Blender 5.2.2 LTS (scripts/make-3d-assets/generate_diorama_meshes.py)
 * Zero runtime dependencies — pure WebGL2 Float32Array & Uint16Array buffers.
 */

export interface MeshGeometry {{
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint16Array;
}}

export const MESHES: Record<string, MeshGeometry> = {{
"""

    for name, m in models.items():
        pos_str = ", ".join(map(str, m["positions"]))
        norm_str = ", ".join(map(str, m["normals"]))
        idx_str = ", ".join(map(str, m["indices"]))

        ts_content += f"""  {name}: {{
    positions: new Float32Array([{pos_str}]),
    normals: new Float32Array([{norm_str}]),
    indices: new Uint16Array([{idx_str}]),
  }},
"""

    ts_content += "};\n"

    with open(out_file, "w", encoding="utf-8") as f:
        f.write(ts_content)

    print(f"[Blender] Successfully generated lowPolyMeshes.ts ({len(models)} models)")

if __name__ == "__main__":
    main()
