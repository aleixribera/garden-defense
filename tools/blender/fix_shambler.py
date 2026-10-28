"""Repair the Shambler's in-place gait and deformation, then export its GLB."""
import bpy, math, os
from mathutils import Vector

ROOT=os.getcwd()
BLEND=os.path.join(ROOT,'art/enemies/shambler/shambler.blend')
GLB=os.path.join(ROOT,'assets/enemies/shambler.glb')
PRE=os.path.join(ROOT,'docs/enemies/shambler')
bpy.ops.wm.open_mainfile(filepath=BLEND)
scene=bpy.context.scene; arm=bpy.data.objects['Shambler']
for tr in arm.animation_data.nla_tracks: tr.mute=True
arm.animation_data.action=None

# Blend across the joints of each originally rigid component. Preserve at most
# two influences and use the rest-space bone heads, which are in mesh space.
adj={
 'Hips':['Chest','Thigh.L','Thigh.R'], 'Chest':['Hips','Head','Arm.L','Arm.R'],
 'Head':['Chest','Jaw'], 'Jaw':['Head'],
}
for s in ('L','R'):
    adj.update({f'Arm.{s}':['Chest',f'Forearm.{s}'], f'Forearm.{s}':[f'Arm.{s}',f'Hand.{s}'],
      f'Hand.{s}':[f'Forearm.{s}'], f'Thigh.{s}':['Hips',f'Shin.{s}'],
      f'Shin.{s}':[f'Thigh.{s}',f'Foot.{s}'], f'Foot.{s}':[f'Shin.{s}']})
for lod in (0,1):
    obj=bpy.data.objects[f'Shambler_LOD{lod}']
    for v in obj.data.vertices:
        if not v.groups: continue
        primary=max(v.groups,key=lambda w:w.weight); group=obj.vertex_groups[primary.group]; bone=arm.data.bones.get(group.name)
        if not bone or group.name not in adj: continue
        best=None
        for other in adj[group.name]:
            ob=arm.data.bones[other]
            joint=bone.head_local if bone.parent==ob else ob.head_local
            d=(v.co-joint).length
            if best is None or d<best[0]: best=(d,other)
        if best and best[0]<.16:
            w=.48*(1-best[0]/.16)
            group.add([v.index],1-w,'REPLACE'); obj.vertex_groups[best[1]].add([v.index],w,'REPLACE')

# The atlas has one colour column per surface. Spread UVs within the field and
# paint a low-contrast vertical gradient plus soft mottling into each field.
im=bpy.data.images['Commuter painted atlas']; cols=[(.53,.60,.43),(.42,.48,.34),(.34,.25,.17),(.25,.18,.12),(.70,.68,.60),(.43,.23,.20),(.28,.26,.22),(.15,.12,.10),(.37,.37,.32),(.61,.60,.48),(.12,.14,.10),(.53,.51,.44)]
pixels=[]
for y in range(1024):
    for x in range(1024):
        c=cols[min(11,x//85)]; shade=.83+.15*y/1023+.022*math.sin(x*.045)*math.sin(y*.037)
        pixels.extend((c[0]*shade,c[1]*shade,c[2]*shade,1))
im.pixels.foreach_set(pixels); im.pack()
for lod in (0,1):
    obj=bpy.data.objects[f'Shambler_LOD{lod}']; uv=obj.data.uv_layers.active.data
    for poly in obj.data.polygons:
        for li in poly.loop_indices:
            loop=obj.data.loops[li]; co=obj.data.vertices[loop.vertex_index].co
            u=uv[li].uv.x; stripe=min(11,int(u*1024//85))
            uv[li].uv=((stripe*85+42+12*math.sin(co.x*8+co.y*5))/1024, max(.03,min(.97,.32+.25*co.z)))

# Temporary IK targets are sampled into the existing 16 deform bones and
# deleted. In-place stance travels backward as the game's root advances.
targets={}
for side in ('L','R'):
    t=bpy.data.objects.new('_foot_target_'+side,None); bpy.context.collection.objects.link(t); targets[side]=t
    c=arm.pose.bones['Shin.'+side].constraints.new('IK'); c.name='_bake_foot'; c.target=t; c.chain_count=2; c.iterations=100

for name,n,halfstride,hipz in [('Walk',20,.475,.69),('Run',16,.70,.455)]:
    action=bpy.data.actions[name]; arm.animation_data.action=action
    samples=[]
    for f in range(n+1):
        phase=f/n
        # Root lowered enough to reach the long in-place stance at either end.
        hips=arm.pose.bones['Hips']; hips.location=(0,hipz-1,0); hips.keyframe_insert(data_path='location',frame=f)
        for side,offset in [('L',0),('R',.5)]:
            q=(phase-offset)%1
            if q < .5: y=-halfstride+4*halfstride*q; z=0
            else:
                r=(q-.5)*2; y=halfstride-2*halfstride*r; z=.13*math.sin(math.pi*r)
            targets[side].location=(.17 if side=='L' else -.17,y,z)
        scene.frame_set(f); bpy.context.view_layer.update()
        evaluated=arm.evaluated_get(bpy.context.evaluated_depsgraph_get())
        samples.append({b:evaluated.pose.bones[b].matrix.copy() for b in ('Thigh.L','Shin.L','Foot.L','Thigh.R','Shin.R','Foot.R')})
    # Clear IK before applying the evaluated matrices in parent order.
    for s in ('L','R'): arm.pose.bones['Shin.'+s].constraints['_bake_foot'].mute=True
    for f,poses in enumerate(samples):
        scene.frame_set(f)
        for s in ('L','R'):
            for part in ('Thigh','Shin','Foot'):
                b=arm.pose.bones[part+'.'+s]; b.matrix=poses[b.name]; b.keyframe_insert(data_path='rotation_euler',frame=f)
    for s in ('L','R'): arm.pose.bones['Shin.'+s].constraints['_bake_foot'].mute=False
    arm.animation_data.action=None
for side in ('L','R'):
    arm.pose.bones['Shin.'+side].constraints.remove(arm.pose.bones['Shin.'+side].constraints['_bake_foot'])
    bpy.data.objects.remove(targets[side],do_unlink=True)

# Lift the animated root as needed at each frame so evaluated geometry does
# not penetrate the floor. Record the corrections in the actual actions.
obj=bpy.data.objects['Shambler_LOD0']
for name in ('Death_Back','Death_Front'):
    arm.animation_data.action=bpy.data.actions[name]
    for f in range(61):
        scene.frame_set(f); deps=bpy.context.evaluated_depsgraph_get(); ev=obj.evaluated_get(deps); mesh=ev.to_mesh()
        low=min((ev.matrix_world@v.co).z for v in mesh.vertices); ev.to_mesh_clear()
        if low<0:
            b=arm.pose.bones['Hips']; b.location.y+=-low+.001; b.keyframe_insert(data_path='location',frame=f)
    arm.animation_data.action=None

# Re-render all requested views and six samples per action.
scene.render.engine='BLENDER_EEVEE'; scene.render.resolution_percentage=100
lod0=bpy.data.objects['Shambler_LOD0']; lod1=bpy.data.objects['Shambler_LOD1']; cam=scene.camera
def point(target): cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler()
def render(name): scene.render.filepath=os.path.join(PRE,name); bpy.ops.render.render(write_still=True)
scene.frame_set(0); lod1.hide_render=True; scene.render.resolution_x=512; scene.render.resolution_y=512
for filename,loc in [('front.png',(0,-6,1.5)),('side.png',(6,0,1.5)),('back.png',(0,6,1.5)),('three-quarter.png',(4,-6,2.3))]:
    cam.location=loc; point((0,0,1.2)); render(filename)
lod0.hide_render=True; lod1.hide_render=False; render('lod1-three-quarter.png'); lod0.hide_render=False; lod1.hide_render=True
caps=[]
bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=.3,depth=2,location=(1,0,1.3)); caps.append(bpy.context.object)
for z in (.3,2.3):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,radius=.3,location=(1,0,z)); caps.append(bpy.context.object)
for cap in caps: cap.data.materials.append(bpy.data.materials['cloth'])
render('scale-reference.png')
for cap in caps: bpy.data.objects.remove(cap,do_unlink=True)
scene.render.resolution_x=256; scene.render.resolution_y=256
clips={'Idle':90,'Walk':20,'Run':16,'Attack_R':30,'Attack_L':30,'Attack_Both':30,'Stun':60,'Spawn':26,'Death_Back':60,'Death_Front':60}
for name,n in clips.items():
    arm.animation_data.action=bpy.data.actions[name]
    for i in range(6):
        scene.frame_set(round(n*i/5)); render(f'_{name}_{i}.png')
    arm.animation_data.action=None
scene.frame_set(0); lod1.hide_render=False
bpy.context.preferences.filepaths.save_version=0; bpy.ops.wm.save_as_mainfile(filepath=BLEND)
bpy.ops.object.select_all(action='DESELECT'); arm.select_set(True); lod0.select_set(True); lod1.select_set(True); bpy.context.view_layer.objects.active=arm
for tr in arm.animation_data.nla_tracks: tr.mute=False
bpy.ops.export_scene.gltf(filepath=GLB,export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_yup=True)
