import * as THREE from "three";

/**
 * Box-projected UVs in scene units (cm): each vertex takes the two position
 * axes of the face it points away from. With a texture repeat of 1 / size-in-cm,
 * every part shows the material at real-world scale, whatever its size.
 */
export function cmUV<T extends THREE.BufferGeometry>(g: T): T {
  const pos = g.getAttribute("position");
  const nor = g.getAttribute("normal");
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i));
    const ny = Math.abs(nor.getY(i));
    const nz = Math.abs(nor.getZ(i));
    const [u, v] =
      nx >= ny && nx >= nz ? [pos.getZ(i), pos.getY(i)] : ny >= nz ? [pos.getX(i), pos.getZ(i)] : [pos.getX(i), pos.getY(i)];
    uv[i * 2] = u;
    uv[i * 2 + 1] = v;
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return g;
}

/**
 * Wraps `object` so it stands on y = 0, centred on x/z, front turned by
 * `turnDeg`, and fills exactly `w` × `h` × `d`: a piece always shows at the
 * size set in the planner.
 */
export function fitToBox(object: THREE.Object3D, w: number, h: number, d: number, turnDeg = 0): THREE.Group {
  const root = new THREE.Group();
  object.rotation.y = (turnDeg * Math.PI) / 180;
  root.add(object);
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object, true);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  object.position.set(-center.x, -box.min.y, -center.z);
  root.scale.set(w / (size.x || 1), h / (size.y || 1), d / (size.z || 1));
  return root;
}
