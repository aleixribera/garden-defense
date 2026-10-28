import bpy, math, os, random
from mathutils import Vector

ROOT = os.getcwd()
OUT = os.path.join(ROOT, 'assets/enemies/shambler.glb')
BLEND = os.path.join(ROOT, 'art/enemies/shambler/shambler.blend')
PRE = os.path.join(ROOT, 'docs/enemies/shambler')
for p in (os.path.dirname(OUT), os.path.dirname(BLEND), PRE): os.makedirs(p, exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
random.seed(25)

# A single packed atlas: broad painted colour fields with understated variation.
colors = [(0.53,0.60,0.43),(.42,.48,.34),(.34,.25,.17),(.25,.18,.12),(.70,.68,.60),(.43,.23,.20),(.28,.26,.22),(.15,.12,.10),(.37,.37,.32),(.61,.60,.48),(.12,.14,.10),(.53,.51,.44)]
im = bpy.data.images.new('Commuter painted atlas', width=1024, height=1024, alpha=True)
pix = []
for y in range(1024):
    for x in range(1024):
        c = colors[min(11,x//85)]
        shade = .96 + .035*math.sin(y*.035)*math.sin(x*.041) + .015*math.sin(x*.11+y*.07)
        pix.extend((c[0]*shade,c[1]*shade,c[2]*shade,1))
im.pixels.foreach_set(pix); im.pack()
materials=[]
for name,rough in [('skin',.7),('cloth',.9),('shoe',.5),('eye',.25),('teeth',.4)]:
    m=bpy.data.materials.new(name); m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Roughness'].default_value=rough
    tex=m.node_tree.nodes.new('ShaderNodeTexImage'); tex.image=im
    m.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color']); materials.append(m)

# Rest skeleton: +X is the character's left; front is -Y.
bones = {
'Hips':((0,0,1.0),(0,0,1.12),None), 'Chest':((0,0,1.05),(0,0,1.67),'Hips'),
'Head':((0,0,1.72),(0,0,2.2),'Chest'), 'Jaw':((0,-.03,1.94),(0,-.28,1.90),'Head'),
}
for side,s in [('L',1),('R',-1)]:
    bones.update({f'Arm.{side}':((s*.27,0,1.60),(s*.53,0,1.37),'Chest'),
      f'Forearm.{side}':((s*.53,0,1.37),(s*.72,-.02,1.16),f'Arm.{side}'),
      f'Hand.{side}':((s*.72,-.02,1.16),(s*.82,-.03,1.04),f'Forearm.{side}'),
      f'Thigh.{side}':((s*.16,0,.99),(s*.17,0,.55),'Hips'),
      f'Shin.{side}':((s*.17,0,.55),(s*.17,0,.14),f'Thigh.{side}'),
      f'Foot.{side}':((s*.17,0,.14),(s*.17,-.20,.08),f'Shin.{side}')})
armdata=bpy.data.armatures.new('Shambler skeleton'); arm=bpy.data.objects.new('Shambler',armdata); bpy.context.collection.objects.link(arm)
bpy.context.view_layer.objects.active=arm; arm.select_set(True); bpy.ops.object.mode_set(mode='EDIT')
for name,(head,tail,parent) in bones.items():
    b=armdata.edit_bones.new(name); b.head=head; b.tail=tail
    if parent: b.parent=armdata.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT'); arm.select_set(False)

def build_lod(lod):
    parts=[]; seg=12 if lod==0 else 8; rings=8 if lod==0 else 5
    def blob(pos,scale,bone,col,mat=0,rot=None):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, location=pos)
        o=bpy.context.object; o.scale=scale
        if rot: o.rotation_euler=rot
        bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
        for poly in o.data.polygons: poly.use_smooth=True
        o.data.materials.append(materials[mat]); uv=o.data.uv_layers.active
        for loop in uv.data: loop.uv=((col+.5)*85/1024, .5)
        vg=o.vertex_groups.new(name=bone); vg.add(list(range(len(o.data.vertices))),1,'REPLACE'); parts.append(o)
    def limb(a,b,r,bone,col,mat=1):
        mid=(Vector(a)+Vector(b))/2; vec=Vector(b)-Vector(a)
        blob(mid,(r,r,vec.length/2+r*.3),bone,col,mat,vec.to_track_quat('Z','Y').to_euler())
    # Big head, chin and mismatched sleepy eyes.
    blob((0,0,2.035),(.31,.27,.30),'Head',0)
    blob((0,-.20,1.88),(.235,.14,.11),'Jaw',1)
    blob((0,-.315,1.915),(.20,.028,.035),'Jaw',1)
    for x in [-.10,0,.09]: blob((x,-.325,1.945),(.033,.025,.045),'Jaw',9,4)
    for x,r in [(.12,.095),(-.12,.072)]:
        blob((x,-.235,2.08),(r,.055,r*.8),'Head',4,3)
        blob((x,-.287,2.08),(.021,.014,.023),'Head',10,3)
        blob((x,-.257,2.145),(r*1.08,.046,.036),'Head',1)
    blob((0,-.29,2.00),(.055,.055,.064),'Head',0)
    for s in [-1,1]: blob((s*.30,0,2.02),(.06,.055,.08),'Head',1)
    if lod==0:
        for x in [-.11,-.04,.03,.10]: limb((x,0,2.29),(x+.045,.025,2.36),.012,'Head',10,1)
    blob((0,0,1.70),(.085,.08,.13),'Chest',1)
    blob((0,0,1.37),(.30,.20,.34),'Chest',2,1)
    blob((0,-.16,1.35),(.20,.07,.26),'Chest',4,1)
    for s in [-1,1]:
        blob((s*.20,-.145,1.45),(.10,.07,.23),'Chest',3,1, (0,s*.23,0))
    limb((0,-.23,1.55),(.16,-.20,1.62),.025,'Chest',5)
    limb((.16,-.20,1.62),(.28,.03,1.65),.03,'Chest',5)
    for s in [-1,1]: limb((s*.10,-.20,1.58),(0,-.22,1.24),.012,'Chest',8)
    blob((0,-.24,1.25),(.07,.015,.08),'Chest',11,1)
    blob((0,0,1.02),(.24,.16,.14),'Hips',6,1)
    for side,s in [('L',1),('R',-1)]:
        limb((s*.27,0,1.58),(s*.53,0,1.37),.105,f'Arm.{side}',2)
        limb((s*.53,0,1.37),(s*.72,-.02,1.16),.075,f'Forearm.{side}',2 if side=='L' else 0,1 if side=='L' else 0)
        blob((s*.76,-.025,1.11),(.105,.07,.115),f'Hand.{side}',0)
        if lod==0:
            for j in range(3): blob((s*(.73+j*.035),-.045,1.035),(.025,.03,.07),f'Hand.{side}',0)
        limb((s*.16,0,.99),(s*.17,0,.55),.105,f'Thigh.{side}',6)
        limb((s*.17,0,.55),(s*.17,0,.14),.075,f'Shin.{side}',6)
        blob((s*.17,-.09,.09),(.11,.20,.09),f'Foot.{side}',7 if side=='L' else 8,2 if side=='L' else 1)
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts: o.select_set(True)
    bpy.context.view_layer.objects.active=parts[0]; bpy.ops.object.join(); o=bpy.context.object; o.name=f'Shambler_LOD{lod}'; o.data.name=o.name
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    # Keep the two runtime meshes within the requested triangle budgets.
    tris=sum(len(p.vertices)-2 for p in o.data.polygons)
    budget=3400 if lod==0 else 850
    if tris>budget:
        dec=o.modifiers.new('LOD reduction','DECIMATE'); dec.ratio=budget/tris
        bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=dec.name)
    mod=o.modifiers.new('Skin','ARMATURE'); mod.object=arm; o.parent=arm
    return o
lod0=build_lod(0); lod1=build_lod(1)

# Actions baked every frame. Clips deliberately start and end in a common idle pose.
clips={'Idle':90,'Walk':20,'Run':16,'Attack_R':30,'Attack_L':30,'Attack_Both':30,'Stun':60,'Spawn':26,'Death_Back':60,'Death_Front':60}
fps=30; bpy.context.scene.render.fps=fps
arm.animation_data_create()
for name,n in clips.items():
    arm.animation_data.action=None
    for f in range(n+1):
        t=f/n; p=2*math.pi*t
        for b in arm.pose.bones: b.rotation_mode='XYZ'; b.rotation_euler=(0,0,0); b.location=(0,0,0)
        def rot(b,x=0,y=0,z=0): arm.pose.bones[b].rotation_euler=(x,y,z)
        rot('Chest',.13); rot('Head',-.12); rot('Arm.L',0,0,-.12); rot('Jaw',.06)
        if name=='Idle':
            rot('Chest',.13+.018*math.sin(p),0,.025*math.sin(p)); rot('Head',-.12+.035*math.sin(p),.04*math.sin(p),.05*math.sin(p)); rot('Jaw',.06+.05*math.sin(p))
        elif name in ('Walk','Run'):
            run=name=='Run'; a=1.15 if run else .8
            rot('Chest',.23,0,.09*math.sin(p)); rot('Head',-.18,0,.07*math.sin(p))
            rot('Thigh.L',-a*math.cos(p)); rot('Thigh.R',a*.75*math.cos(p)); rot('Shin.L',max(0,-math.cos(p))*.55); rot('Shin.R',max(0,math.cos(p))*.35)
            rot('Arm.L',-.85+.18*math.sin(p),0,-.12); rot('Arm.R',(-.75 if run else 0)+.35*math.sin(p))
            arm.pose.bones['Hips'].location.y=.035*math.sin(2*p)-.025
        elif name.startswith('Attack'):
            k=(f/11 if f<=11 else max(0,1-(f-13)/17)) if f!=12 else .9
            if f==13: k=1.4
            rot('Chest',.13+.20*k); rot('Head',-.12+.12*k)
            if name!='Attack_L': rot('Arm.R',-1.3*k,0,.35*k)
            if name!='Attack_R': rot('Arm.L',-1.3*k,0,-.12-.35*k)
            if name=='Attack_Both': rot('Jaw',.06+.5*k)
        elif name=='Stun':
            rot('Head',-.1+.18*math.sin(p),.16*math.cos(p),.16*math.sin(p)); rot('Jaw',.4); rot('Thigh.L',.15); rot('Thigh.R',.15); rot('Chest',.15,0,.06*math.sin(p))
        elif name=='Spawn':
            k=max(0,1-t); rot('Thigh.L',-.8*k); rot('Thigh.R',-.8*k); rot('Shin.L',1.3*k); rot('Shin.R',1.3*k); rot('Chest',.13+.7*k); arm.pose.bones['Hips'].location.y=-.45*k
        elif name.startswith('Death'):
            hit=19 if name=='Death_Back' else 23; k=min(1,f/hit); direction=-1 if name=='Death_Back' else 1
            rot('Hips',direction*1.43*k); arm.pose.bones['Hips'].location.y=(-.76 if name=='Death_Back' else -.57)*k; rot('Arm.L',-.8*k); rot('Arm.R',-.8*k)
        for b in arm.pose.bones:
            b.keyframe_insert(data_path='rotation_euler',frame=f); b.keyframe_insert(data_path='location',frame=f)
    action=arm.animation_data.action; action.name=name
    track=arm.animation_data.nla_tracks.new(); track.name=name; track.strips.new(name,0,action); arm.animation_data.action=None

# Preview scene; lights and camera are excluded from the export selection.
scene=bpy.context.scene; scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x=512; scene.render.resolution_y=512; scene.render.resolution_percentage=100
scene.world.color=(.18,.18,.18)
def point(o,target): o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(3,-5,2.5)); cam=bpy.context.object; scene.camera=cam; cam.data.type='ORTHO'; cam.data.ortho_scale=3.3; point(cam,(0,0,1.2))
for loc,power,size in [((3,-4,6),500,4),((-3,-2,4),300,4),((0,3,5),350,3)]:
    bpy.ops.object.light_add(type='AREA',location=loc); l=bpy.context.object; l.data.energy=power; l.data.shape='DISK'; l.data.size=size; point(l,(0,0,1))
def render(path): scene.render.filepath=os.path.join(PRE,path); bpy.ops.render.render(write_still=True)
for track in arm.animation_data.nla_tracks: track.mute=True
lod1.hide_render=True
for filename,loc in [('front.png',(0,-6,1.5)),('side.png',(6,0,1.5)),('back.png',(0,6,1.5)),('three-quarter.png',(4,-6,2.3))]:
    cam.location=loc; point(cam,(0,0,1.2)); render(filename)
lod0.hide_render=True; lod1.hide_render=False; render('lod1-three-quarter.png'); lod0.hide_render=False; lod1.hide_render=True
# Reference capsule, render only.
caps=[]
bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=.3, depth=2.0, location=(1,0,1.3)); caps.append(bpy.context.object)
for z in (.3,2.3):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,radius=.3,location=(1,0,z)); caps.append(bpy.context.object)
for cap in caps: cap.data.materials.append(materials[1])
render('scale-reference.png')
for cap in caps: bpy.data.objects.remove(cap,do_unlink=True)
# Render evenly spaced animation poses to temporary frames; compose strips outside Blender.
scene.render.resolution_x=256; scene.render.resolution_y=256
for track in arm.animation_data.nla_tracks:
    track.mute=False; name=track.name; n=clips[name]
    for i in range(6):
        scene.frame_set(round(n*i/5)); render('_'+name+'_'+str(i)+'.png')
    track.mute=True
scene.frame_set(0); lod1.hide_render=False
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=BLEND)
bpy.ops.object.select_all(action='DESELECT'); arm.select_set(True); lod0.select_set(True); lod1.select_set(True); bpy.context.view_layer.objects.active=arm
for track in arm.animation_data.nla_tracks: track.mute=False
bpy.ops.export_scene.gltf(filepath=OUT,export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_yup=True)
print('TRIANGLES',[(o.name,sum(len(p.vertices)-2 for p in o.data.polygons)) for o in (lod0,lod1)])
