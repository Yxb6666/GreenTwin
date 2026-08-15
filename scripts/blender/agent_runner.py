import json
import math
import os
import sys

import bpy
from mathutils import Vector


def read_arguments():
    separator = sys.argv.index("--")
    return sys.argv[separator + 1], sys.argv[separator + 2], sys.argv[separator + 3]


def _normalize_color(color):
    values = list(color)[:4]
    if len(values) == 3:
        values.append(1.0)
    if len(values) != 4:
        raise ValueError(
            "材质颜色必须包含 3 或 4 个分量，实际为 %d" % len(values)
        )
    numeric = [float(item) for item in values]
    if any(item < 0 or item > 1 for item in numeric[:3]):
        numeric = [item / 255.0 for item in numeric]
    return tuple(numeric)


def material(name, color, metallic=0.0, roughness=0.7, *args, **kwargs):
    value = bpy.data.materials.new(name)
    value.use_nodes = True
    shader = value.node_tree.nodes.get("Principled BSDF")
    normalized = _normalize_color(color)
    value.diffuse_color = normalized
    shader.inputs["Base Color"].default_value = normalized
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    if normalized[3] < 1:
        shader.inputs["Alpha"].default_value = normalized[3]
        value.surface_render_method = "DITHERED"
    return value


def add_box(name, location, dimensions, value, build_stage=1, *args, **kwargs):
    bpy.ops.mesh.primitive_cube_add(location=location)
    item = bpy.context.object
    item.name = name
    item.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    item.data.materials.append(value)
    item["build_stage"] = build_stage
    return item


def add_beveled_box(
    name, location, dimensions, value, build_stage=1, bevel=0.06, *args, **kwargs
):
    item = add_box(name, location, dimensions, value, build_stage)
    if bevel > 0:
        modifier = item.modifiers.new(name="Soft edges", type="BEVEL")
        modifier.width = bevel
        modifier.segments = 2
    return item


def add_cylinder(
    name, location, radius, depth, value, build_stage=2, vertices=12, *args, **kwargs
):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=location,
    )
    item = bpy.context.object
    item.name = name
    item.data.materials.append(value)
    item["build_stage"] = build_stage
    bevel = item.modifiers.new(name="Rounded edges", type="BEVEL")
    bevel.width = min(radius * 0.12, 0.045)
    bevel.segments = 2
    return item


def add_beam_between(
    name, start, end, radius, value, build_stage=3, vertices=8, *args, **kwargs
):
    start_point = Vector(start)
    end_point = Vector(end)
    direction = end_point - start_point
    item = add_cylinder(
        name,
        (start_point + end_point) / 2,
        radius,
        direction.length,
        value,
        build_stage,
        vertices,
    )
    item.rotation_mode = "QUATERNION"
    item.rotation_quaternion = direction.to_track_quat("Z", "Y")
    return item


def add_roof_mesh(name, vertices, faces, value, build_stage=3, *args, **kwargs):
    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    item = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(item)
    item.data.materials.append(value)
    item["build_stage"] = build_stage
    solidify = item.modifiers.new(name="Roof thickness", type="SOLIDIFY")
    solidify.thickness = 0.16
    bevel = item.modifiers.new(name="Roof edge softness", type="BEVEL")
    bevel.width = 0.05
    bevel.segments = 2
    return item


ALLOWED_IMPORT_MODULES = {"math", "mathutils", "bpy"}


def safe_import(name, globals=None, locals=None, fromlist=(), level=0):
    if level != 0:
        raise ImportError("不允许相对导入")
    module_name = str(name).split(".")[0]
    if module_name not in ALLOWED_IMPORT_MODULES:
        raise ImportError("不允许导入模块: %s" % name)
    return __import__(name, globals, locals, fromlist, level)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for mesh in list(bpy.data.meshes):
        if mesh.users == 0:
            bpy.data.meshes.remove(mesh)
    for value in list(bpy.data.materials):
        if value.users == 0:
            bpy.data.materials.remove(value)


def export_stages(code_path, config_path, output_path):
    with open(config_path, "r", encoding="utf-8") as stream:
        config = json.load(stream)
    with open(code_path, "r", encoding="utf-8") as stream:
        code = stream.read()

    clear_scene()

    safe_builtins = {
        "abs": abs,
        "all": all,
        "any": any,
        "bool": bool,
        "dict": dict,
        "enumerate": enumerate,
        "float": float,
        "int": int,
        "isinstance": isinstance,
        "len": len,
        "list": list,
        "max": max,
        "min": min,
        "print": print,
        "range": range,
        "round": round,
        "set": set,
        "sorted": sorted,
        "str": str,
        "sum": sum,
        "tuple": tuple,
        "type": type,
        "zip": zip,
        "__import__": safe_import,
    }
    safe_globals = {
        "__builtins__": safe_builtins,
        "bpy": bpy,
        "math": math,
        "Vector": Vector,
        "config": config,
        "material": material,
        "add_box": add_box,
        "add_beveled_box": add_beveled_box,
        "add_cylinder": add_cylinder,
        "add_beam_between": add_beam_between,
        "add_roof_mesh": add_roof_mesh,
    }
    exec(compile(code, "<agent>", "exec"), safe_globals)
    build_custom = safe_globals.get("build_custom")
    if not callable(build_custom):
        raise RuntimeError("生成的脚本未定义 build_custom 函数")
    build_custom(config)

    for item in bpy.context.scene.objects:
        if item.type == "MESH" and item.get("build_stage") is None:
            item["build_stage"] = 4

    bpy.context.scene.world.color = (0.025, 0.04, 0.045)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    stem, extension = os.path.splitext(output_path)
    for stage in range(1, 5):
        bpy.ops.object.select_all(action="DESELECT")
        for item in bpy.context.scene.objects:
            if item.type == "MESH" and item.get("build_stage", 1) <= stage:
                item.select_set(True)
        bpy.ops.export_scene.gltf(
            filepath=f"{stem}-stage-{stage}{extension}",
            export_format="GLB",
            use_selection=True,
            export_apply=True,
            export_cameras=False,
            export_lights=False,
        )
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format="GLB",
        export_apply=True,
        export_cameras=False,
        export_lights=False,
    )
    print(json.dumps({"status": "completed", "output": output_path}, ensure_ascii=False))


def main():
    code_path, config_path, output_path = read_arguments()
    export_stages(code_path, config_path, output_path)


if __name__ == "__main__":
    main()
