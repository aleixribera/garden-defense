import bpy, json, struct, os
from mathutils import Vector

path=os.path.abspath('assets/enemies/shambler.glb')
raw=open(path,'rb').read(); length=struct.unpack_from('<I',raw,12)[0]
g=json.loads(raw[20:20+length]); nodes=g['nodes']; skin=g['skins'][0]
parents={}
for i,node in enumerate(nodes):
    for child in node.get('children',[]): parents[child]=i
print('GLB bytes:',len(raw),'images:',len(g.get('images',[])))
for i in skin['joints']:
    parent=parents.get(i); print('BONE',nodes[i].get('name'),nodes[parent].get('name') if parent in skin['joints'] else None)
for mesh in g['meshes']:
    print('MESH',mesh['name'],sum(g['accessors'][p['indices']]['count']//3 for p in mesh['primitives']))
for a in g['animations']:
    times=[g['accessors'][s['input']] for s in a['samplers']]
    print('CLIP',a['name'],'frames',round(max(x['max'][0] for x in times)*30),'duration',max(x['max'][0] for x in times))

bpy.ops.wm.open_mainfile(filepath=os.path.abspath('art/enemies/shambler/shambler.blend'))
arm=bpy.data.objects['Shambler']; scene=bpy.context.scene
for track in arm.animation_data.nla_tracks: track.mute=True
for name,n in [('Walk',20),('Run',16)]:
    arm.animation_data.action=bpy.data.actions[name]
    samples=[]; right=[]; low=999
    for f in range(n+1):
        scene.frame_set(f); samples.append((arm.matrix_world @ arm.pose.bones['Foot.L'].head).copy()); right.append((arm.matrix_world @ arm.pose.bones['Foot.R'].head).copy())
        eo=bpy.data.objects['Shambler_LOD0'].evaluated_get(bpy.context.evaluated_depsgraph_get()); em=eo.to_mesh()
        low=min(low,min((eo.matrix_world @ v.co).z for v in em.vertices)); eo.to_mesh_clear()
    stance=samples[:n//2+1]; rstance=right[n//2:]+right[:1]
    print('GAIT',name,'left stance heights',[round(p.z,4) for p in stance], 'right stance heights',[round(p.z,4) for p in rstance], 'left slide',stance[-1].y-stance[0].y,'estimated cycle',2*abs(stance[-1].y-stance[0].y))
    print('GAIT_MAX_HEIGHT_ERROR',name,max(abs(p.z) for p in stance+rstance),'mesh minimum',low)
    arm.animation_data.action=None
for name in ('Death_Back','Death_Front'):
    arm.animation_data.action=bpy.data.actions[name]; lowest=999; maxradius=0
    original=bpy.data.objects['Shambler_LOD0']; chest=original.vertex_groups['Chest'].index
    chest_indices=[v.index for v in original.data.vertices if any(g.group==chest and g.weight>.5 for g in v.groups)]
    hit=19 if name=='Death_Back' else 23
    for f in range(61):
        scene.frame_set(f); deps=bpy.context.evaluated_depsgraph_get(); obj=bpy.data.objects['Shambler_LOD0'].evaluated_get(deps); mesh=obj.to_mesh()
        points=[obj.matrix_world @ v.co for v in mesh.vertices]; lowest=min(lowest,min(p.z for p in points))
        if f==60: maxradius=max((p.x*p.x+p.y*p.y)**.5 for p in points)
        if f in (hit-1,hit,hit+1): print('TORSO_HEIGHT',name,f,min(points[i].z for i in chest_indices))
        obj.to_mesh_clear()
    print('DEATH',name,'minimum height all frames',lowest,'final maximum radius',maxradius)
    arm.animation_data.action=None
