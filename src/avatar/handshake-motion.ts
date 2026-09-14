import * as THREE from 'three';

type Bone = THREE.Object3D;
const findBone=(root:THREE.Object3D,patterns:RegExp[])=>{let hit:Bone|null=null;root.traverse(o=>{if(hit)return;const n=o.name.toLowerCase();if(patterns.some(p=>p.test(n)))hit=o});return hit};

export function createHandshakeMotion(root:THREE.Object3D){
  const shoulder=findBone(root,[/right.*shoulder|shoulder.*right|mixamorig:rightshoulder|rightshoulder/i]);
  const upper=findBone(root,[/right.*arm|arm.*right|rightupperarm|right.*upperarm/i]);
  const fore=findBone(root,[/right.*forearm|forearm.*right|rightlowerarm|right.*lowerarm|rightelbow/i]);
  const hand=findBone(root,[/right.*hand|hand.*right|righthand/i]);
  let active=false; let started=0;
  const base=new Map<Bone,{x:number;y:number;z:number}>();
  [shoulder,upper,fore,hand].forEach(b=>{if(b)base.set(b,{x:b.rotation.x,y:b.rotation.y,z:b.rotation.z})});
  const restore=(b:Bone|null)=>{if(!b)return;const v=base.get(b);if(!v)return;b.rotation.x=THREE.MathUtils.damp(b.rotation.x,v.x,7,.016);b.rotation.y=THREE.MathUtils.damp(b.rotation.y,v.y,7,.016);b.rotation.z=THREE.MathUtils.damp(b.rotation.z,v.z,7,.016)};
  return {start(){active=true;started=performance.now()/1000},stop(){active=false},update(time:number){if(!active){restore(shoulder);restore(upper);restore(fore);restore(hand);return}const t=time-started;const reach=THREE.MathUtils.smoothstep(Math.min(t/.9,1),0,1);const shake=t<1.15?0:Math.sin((t-1.15)*18)*.10*Math.min((t-1.15)/.25,1)*Math.max(0,1-(t-2.5)/.7);if(shoulder){shoulder.rotation.y=base.get(shoulder)!.y-.10*reach;shoulder.rotation.z=base.get(shoulder)!.z-.08*reach}if(upper){upper.rotation.x=base.get(upper)!.x-.35*reach;upper.rotation.y=base.get(upper)!.y-.20*reach;upper.rotation.z=base.get(upper)!.z-.32*reach}if(fore){fore.rotation.x=base.get(fore)!.x+.72*reach+shake;fore.rotation.y=base.get(fore)!.y-.18*reach}if(hand){hand.rotation.x=base.get(hand)!.x-.15*reach-shake*.7;hand.rotation.z=base.get(hand)!.z-.22*reach}if(t>3.15)active=false}};
}
