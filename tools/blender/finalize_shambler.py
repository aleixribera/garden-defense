import bpy, os, math

root=os.getcwd()
bpy.ops.wm.open_mainfile(filepath=os.path.join(root,'art/enemies/shambler/shambler.blend'))
arm=bpy.data.objects['Shambler']
for lod in (0,1):
    o=bpy.data.objects[f'Shambler_LOD{lod}']; o.data.name=o.name
for track in arm.animation_data.nla_tracks: track.mute=True
for name,n,amplitude in [('Walk',20,.8),('Run',16,1.15)]:
    arm.animation_data.action=bpy.data.actions[name]
    for f in range(n+1):
        phase=2*math.pi*f/n
        for side,value in [('L',-amplitude*math.cos(phase)),('R',amplitude*.75*math.cos(phase))]:
            b=arm.pose.bones['Thigh.'+side]; b.rotation_mode='XYZ'; b.rotation_euler=(value,0,0); b.keyframe_insert(data_path='rotation_euler',frame=f)
    arm.animation_data.action=None
arm.animation_data.action=bpy.data.actions['Death_Front']
for f in range(61):
    b=arm.pose.bones['Hips']; b.location=(0,-.57*min(1,f/23),0); b.keyframe_insert(data_path='location',frame=f)
arm.animation_data.action=None
for name,n in [('Attack_R',30),('Attack_L',30),('Attack_Both',30),('Spawn',26),('Death_Back',60),('Death_Front',60)]:
    arm.animation_data.action=bpy.data.actions[name]
    for f in (0,n) if name.startswith('Attack') else ((n,) if name=='Spawn' else (0,)):
        jaw=arm.pose.bones['Jaw']; jaw.rotation_mode='XYZ'; jaw.rotation_euler=(.06,0,0); jaw.keyframe_insert(data_path='rotation_euler',frame=f)
        if name in ('Attack_L','Attack_Both'):
            left=arm.pose.bones['Arm.L']; left.rotation_mode='XYZ'; left.rotation_euler=(0,0,-.12); left.keyframe_insert(data_path='rotation_euler',frame=f)
    arm.animation_data.action=None
# Re-render the strips whose motion was adjusted after the first pass.
scene=bpy.context.scene; scene.render.resolution_x=256; scene.render.resolution_y=256
bpy.data.objects['Shambler_LOD1'].hide_render=True
for name,n in [('Walk',20),('Run',16),('Death_Front',60)]:
    arm.animation_data.action=bpy.data.actions[name]
    for i in range(6):
        scene.frame_set(round(n*i/5)); scene.render.filepath=os.path.join(root,'docs/enemies/shambler',f'_{name}_{i}.png'); bpy.ops.render.render(write_still=True)
    arm.animation_data.action=None
scene.frame_set(0)
bpy.data.objects['Shambler_LOD1'].hide_render=False
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(root,'art/enemies/shambler/shambler.blend'))
bpy.ops.object.select_all(action='DESELECT'); arm.select_set(True)
for lod in (0,1): bpy.data.objects[f'Shambler_LOD{lod}'].select_set(True)
bpy.context.view_layer.objects.active=arm
for track in arm.animation_data.nla_tracks: track.mute=False
bpy.ops.export_scene.gltf(filepath=os.path.join(root,'assets/enemies/shambler.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_yup=True)
