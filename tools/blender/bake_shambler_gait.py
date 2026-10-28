import bpy, math, os
root=os.getcwd(); blend=os.path.join(root,'art/enemies/shambler/shambler.blend')
bpy.ops.wm.open_mainfile(filepath=blend)
scene=bpy.context.scene; arm=bpy.data.objects['Shambler']
for t in arm.animation_data.nla_tracks: t.mute=True
for name,n,halfstride,hipz in [('Walk',20,.475,.69),('Run',16,.70,.455)]:
    arm.animation_data.action=bpy.data.actions[name]; targets={}
    for side in ('L','R'):
        target=bpy.data.objects.new('_ik_'+side,None); bpy.context.collection.objects.link(target); targets[side]=target
        c=arm.pose.bones['Shin.'+side].constraints.new('IK'); c.target=target; c.chain_count=2; c.iterations=200
    for f in range(n+1):
        scene.frame_set(f); arm.pose.bones['Hips'].location=(0,hipz-1,0); arm.pose.bones['Hips'].keyframe_insert(data_path='location',frame=f)
        for side,offset in [('L',0),('R',.5)]:
            q=(f/n-offset)%1
            if q<.5: y=-halfstride+4*halfstride*q; z=0
            else:
                r=2*(q-.5); y=halfstride-2*halfstride*r; z=.13*math.sin(math.pi*r)
            targets[side].location=(.17 if side=='L' else -.17,y,z); targets[side].keyframe_insert(data_path='location',frame=f)
    bpy.ops.object.select_all(action='DESELECT'); arm.select_set(True); bpy.context.view_layer.objects.active=arm
    bpy.ops.object.mode_set(mode='POSE')
    bpy.ops.nla.bake(frame_start=0,frame_end=n,only_selected=False,visual_keying=True,clear_constraints=True,use_current_action=True,bake_types={'POSE'},channel_types={'ROTATION'})
    bpy.ops.object.mode_set(mode='OBJECT')
    for t in targets.values(): bpy.data.objects.remove(t,do_unlink=True)
    arm.animation_data.action=None

scene.render.engine='BLENDER_EEVEE'; scene.render.resolution_x=256; scene.render.resolution_y=256
bpy.data.objects['Shambler_LOD1'].hide_render=True
for name,n in [('Walk',20),('Run',16)]:
    arm.animation_data.action=bpy.data.actions[name]
    for i in range(6):
        scene.frame_set(round(n*i/5)); scene.render.filepath=os.path.join(root,'docs/enemies/shambler',f'_{name}_{i}.png'); bpy.ops.render.render(write_still=True)
    arm.animation_data.action=None
scene.frame_set(0); bpy.data.objects['Shambler_LOD1'].hide_render=False
bpy.context.preferences.filepaths.save_version=0; bpy.ops.wm.save_as_mainfile(filepath=blend)
bpy.ops.object.select_all(action='DESELECT'); arm.select_set(True)
for lod in (0,1): bpy.data.objects[f'Shambler_LOD{lod}'].select_set(True)
bpy.context.view_layer.objects.active=arm
for tr in arm.animation_data.nla_tracks: tr.mute=False
bpy.ops.export_scene.gltf(filepath=os.path.join(root,'assets/enemies/shambler.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_yup=True)
