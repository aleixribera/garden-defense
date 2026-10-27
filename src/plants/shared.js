// Helpers shared by the plant modules (src/plants/*.js). index.html plugs the game's particle system in at boot
// (usePlantFx), so models and animators can spray particles without importing the game itself.
import * as THREE from 'three';

export const randRange = ([a, b]) => a + Math.random() * (b - a);
// Unit forward vector of a yaw (model faces +Z, heroes face −Z at yaw 0)
export const yawForward = (yaw, out = new THREE.Vector3()) => out.set(-Math.sin(yaw), 0, -Math.cos(yaw));
export const animFwd = new THREE.Vector3(), animRight = new THREE.Vector3();   // animator scratch vectors

export let spawnParticle = () => {};
export function usePlantFx(fx) { spawnParticle = fx.spawnParticle; }
