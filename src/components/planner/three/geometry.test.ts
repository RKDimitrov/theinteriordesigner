import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { cmUV, fitToBox } from "./geometry";

const boundsOf = (o: THREE.Object3D) => {
  o.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(o);
};

describe("fitToBox", () => {
  // A model in metres, off-centre and below the floor, like many downloads.
  const model = () => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 0.5));
    m.position.set(3, -2, 1);
    const g = new THREE.Group();
    g.add(m);
    return g;
  };

  it("fills the exact size, standing on the floor and centred", () => {
    const b = boundsOf(fitToBox(model(), 180, 85, 90));
    expect(b.min.x).toBeCloseTo(-90);
    expect(b.max.x).toBeCloseTo(90);
    expect(b.min.y).toBeCloseTo(0);
    expect(b.max.y).toBeCloseTo(85);
    expect(b.min.z).toBeCloseTo(-45);
    expect(b.max.z).toBeCloseTo(45);
  });

  it("turns before fitting, so width follows the turned model", () => {
    const b = boundsOf(fitToBox(model(), 40, 85, 160, 90));
    const size = b.getSize(new THREE.Vector3());
    expect(size.x).toBeCloseTo(40);
    expect(size.z).toBeCloseTo(160);
  });
});

describe("cmUV", () => {
  it("maps each face to its own two axes, in scene units", () => {
    const g = cmUV(new THREE.BoxGeometry(200, 80, 50));
    const uv = g.getAttribute("uv");
    let maxU = 0;
    let maxV = 0;
    for (let i = 0; i < uv.count; i++) {
      maxU = Math.max(maxU, Math.abs(uv.getX(i)));
      maxV = Math.max(maxV, Math.abs(uv.getY(i)));
    }
    expect(maxU).toBeCloseTo(100);
    expect(maxV).toBeCloseTo(40);
  });
});
