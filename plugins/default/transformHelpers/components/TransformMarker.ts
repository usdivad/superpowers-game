const THREE = SupEngine.THREE;

export default class TransformMarker extends SupEngine.ActorComponent {
  line: THREE.LineSegments;
  visible = true;

  constructor(actor: SupEngine.Actor) {
    super(actor, "TransformMarker");

    const geometry = new THREE.Geometry();
    geometry.vertices.push(
      new THREE.Vector3( -0.25, 0, 0 ),
      new THREE.Vector3(  0.25, 0, 0 ),

      new THREE.Vector3( 0, -0.25, 0 ),
      new THREE.Vector3( 0,  0.25, 0 ),

      new THREE.Vector3( 0, 0, -0.25 ),
      new THREE.Vector3( 0, 0,  0.25 )
    );

    this.line = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial( { color: 0xffffff, opacity: 0.25, transparent: true } ));
    this.actor.threeObject.add(this.line);
    this.line.updateMatrixWorld(false);
  }

  setIsLayerActive(active: boolean) { this.line.visible = active && this.visible; }

  move(target: THREE.Object3D) {
    this.visible = this.line.visible = true;
    this.actor.threeObject.position.copy(target.getWorldPosition());
    this.actor.threeObject.quaternion.copy(target.getWorldQuaternion());
    this.actor.threeObject.updateMatrixWorld(false);
  }

  hide() {
    this.visible = this.line.visible = false;
  }

  _destroy() {
    this.actor.threeObject.remove(this.line);
    this.line.geometry.dispose();
    this.line.material.dispose();
    this.line = null;

    super._destroy();
  }
}
