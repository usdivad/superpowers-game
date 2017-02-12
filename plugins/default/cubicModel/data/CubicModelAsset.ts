const serverRequire = require;
let THREE: typeof SupEngine.THREE;
// NOTE: It is important that we require THREE through SupEngine
// so that we inherit any settings, like the global Euler order
// (or, alternatively, we could duplicate those settings...)
if ((<any>global).window == null) THREE = serverRequire("../../../../SupEngine").THREE;
else if ((<any>window).SupEngine != null) THREE = SupEngine.THREE;

import * as path from "path";
import * as fs from "fs";
import * as async from "async";
import * as _ from "lodash";

import CubicModelNodes, { XYZ, Node, Shape, getShapeTextureSize, getShapeTextureFaceSize } from "./CubicModelNodes";

type AddNodeCallback = SupCore.Data.Base.ErrorCallback & ((err: string, nodeId: string, node: Node, parentId: string, index: number) => void);
type SetNodePropertyCallback = SupCore.Data.Base.ErrorCallback & ((err: string, ack: any, id: string, path: string, value: any) => void);
type MoveNodePivotCallback = SupCore.Data.Base.ErrorCallback & ((err: string, ack: any, id: string, value: { x: number; y: number; z: number; }) => void);
type MoveNodeCallback = SupCore.Data.Base.ErrorCallback & ((err: string, ack: any, id: string, parentId: string, index: number) => void);
type DuplicateNodeCallback = SupCore.Data.Base.ErrorCallback & ((err: string, nodeId: string, rootNode: Node, newNodes: DuplicatedNode[]) => void);
type RemoveNodeCallback = SupCore.Data.Base.ErrorCallback & ((err: string, ack: any, id: string) => void);

type MoveNodeTextureOffsetCallback = SupCore.Data.Base.ErrorCallback & ((err: string, ack: any, nodeIds: string[], offset: { x: number; y: number }) => void);

type ChangeTextureWidthCallback = SupCore.Data.Base.ErrorCallback & ((err: string, ack: any, newWidth: number) => void);
type ChangeTextureHeightCallback = SupCore.Data.Base.ErrorCallback & ((err: string, ack: any, newHeight: number) => void);
type EditTextureCallback = SupCore.Data.Base.ErrorCallback & ((err: string, ack: any, name: string, edits: TextureEdit[]) => void);

export interface CubicModelAssetPub {
  pixelsPerUnit: number;
  nodes: Node[];

  textureWidth: number;
  textureHeight: number;
  textures?: { [name: string]: THREE.Texture; };
  maps: { [name: string]: ArrayBuffer; };
  mapSlots: { [name: string]: string; };
}

export interface DuplicatedNode {
  node: Node;
  parentId: string;
  index: number;
}

export interface TextureEdit {
  x: number; y: number;
  value: { r: number; g: number; b: number; a: number; };
}

export default class CubicModelAsset extends SupCore.Data.Base.Asset {

  static schema: SupCore.Data.Schema = {
    pixelsPerUnit: { type: "integer", min: 1, mutable: true },
    nodes: { type: "array" },

    textureWidth: { type: "number" },
    textureHeight: { type: "number" },

    maps: { type: "hash", values: { type: "buffer?" } },
    mapSlots: {
      type: "hash",
      properties: {
        map: { type: "string?", mutable: true },
        light: { type: "string?", mutable: true },
        specular: { type: "string?", mutable: true },
        alpha: { type: "string?", mutable: true },
        normal: { type: "string?", mutable: true }
      }
    }
  };

  static validTextureSizes = [32, 64, 128, 256, 512, 1024, 2048];

  pub: CubicModelAssetPub;
  nodes: CubicModelNodes;

  textureDatas: { [name: string]: Uint8ClampedArray; };

  // Only used on client-side
  clientTextureDatas: { [name: string]: { imageData: ImageData; ctx: CanvasRenderingContext2D; } } = {};

  constructor(id: string, pub: any, server: ProjectServer) {
    super(id, pub, CubicModelAsset.schema, server);
  }

  init(options: any, callback: Function) {
    this.server.data.resources.acquire("cubicModelSettings", null, (err: Error, cubicModelSettings: any) => {
      this.server.data.resources.release("cubicModelSettings", null);

      const pixelsPerUnit: number = cubicModelSettings.pub.pixelsPerUnit;
      const initialTextureSize = 256;

      this.pub = {
        pixelsPerUnit,
        nodes: [],
        textureWidth: initialTextureSize,
        textureHeight: initialTextureSize,
        maps: { map: new ArrayBuffer(initialTextureSize * initialTextureSize * 4) },
        mapSlots: {
          map: "map",
          light: null,
          specular: null,
          alpha: null,
          normal: null
        }
      };

      const data = new Uint8ClampedArray(this.pub.maps["map"]);
      for (let i = 0; i < data.length; i++) data[i] = 255;

      super.init(options, callback);
    });
  }

  setup() {
    this.nodes = new CubicModelNodes(this);

    this.textureDatas = {};
    for (const mapName in this.pub.maps) {
      this.textureDatas[mapName] = new Uint8ClampedArray(this.pub.maps[mapName]);
    }
  }

  load(assetPath: string) {
    fs.readFile(path.join(assetPath, "cubicModel.json"), { encoding: "utf8" }, (err, json) => {
      const pub: CubicModelAssetPub = JSON.parse(json);

      const mapNames = (pub as any).maps as string[];
      pub.maps = {};

      async.each(mapNames, (mapName, cb) => {
        // TODO: Replace this with a PNG disk format
        fs.readFile(path.join(assetPath, `map-${mapName}.dat`), (err, data) => {
          if (err) { cb(err); return; }

          pub.maps[mapName] = new Uint8ClampedArray(data).buffer;
          cb();
        });
      }, (err) => {
        if (err) throw err;
        this._onLoaded(assetPath, pub);
      });
    });
  }

  client_load() { this.loadTextures(); }
  client_unload() { this.unloadTextures(); }

  save(outputPath: string, callback: (err: Error) => void) {
    this.write(fs.writeFile, outputPath, (err) => {
      if (err != null) { callback(err); return; }

      // Clean up old maps from disk
      async.each(Object.keys(this.pub.maps), (mapName, cb) => {
        const map = new Buffer(new Uint8ClampedArray(this.pub.maps[mapName]));
        if (map != null) { cb(); return; }

        fs.unlink(path.join(outputPath, `map-${mapName}.dat`), (err) => {
          if (err != null && err.code !== "ENOENT") { cb(err); return; }
          cb();
        });
      }, callback);
    });
  }

  clientExport(outputPath: string, callback: (err: Error) => void) {
    this.write(SupApp.writeFile, outputPath, callback);
  }

  private write(writeFile: Function, outputPath: string, writeCallback: (err: Error) => void) {
    const maps = this.pub.maps;

    (this.pub as any).maps = [];
    for (const key in maps) {
      if (maps[key] != null) (this.pub as any).maps.push(key);
    }

    const textures = this.pub.textures;
    delete this.pub.textures;

    const json = JSON.stringify(this.pub, null, 2);

    this.pub.maps = maps;
    this.pub.textures = textures;

    writeFile(path.join(outputPath, "cubicModel.json"), json, { encoding: "utf8" }, (err: Error) => {
      if (err != null) { writeCallback(err); return; }

      async.each(Object.keys(maps), (mapName, cb) => {
        const value = maps[mapName];
        if (value == null) { cb(); return; }

        writeFile(path.join(outputPath, `map-${mapName}.dat`), new Buffer(value), cb);
      }, writeCallback);
    });
  }

  private unloadTextures() {
    for (const textureName in this.pub.textures) this.pub.textures[textureName].dispose();
  }

  private loadTextures() {
    this.unloadTextures();
    this.pub.textures = {};
    this.clientTextureDatas = {};

    // Texturing
    // NOTE: This is the unoptimized variant for editing
    // There should be an option you can pass to setModel to ask for editable version vs (default) optimized
    for (const mapName in this.pub.maps) {
      const canvas = document.createElement("canvas");
      canvas.width = this.pub.textureWidth;
      canvas.height = this.pub.textureHeight;
      const  ctx = canvas.getContext("2d");
      const texture = this.pub.textures[mapName] = new THREE.Texture(canvas);
      texture.needsUpdate = true;
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;

      const imageData = new ImageData(this.textureDatas[mapName], this.pub.textureWidth, this.pub.textureHeight);
      ctx.putImageData(imageData, 0, 0);
      this.clientTextureDatas[mapName] = { imageData, ctx };
    }
  }

  // Nodes
  server_addNode(client: SupCore.RemoteClient, name: string, options: any, callback: AddNodeCallback) {
    const parentId = (options != null) ? options.parentId : null;

    const node: Node = {
      id: null, name: name, children: [],
      position: (options != null && options.transform != null && options.transform.position != null) ? options.transform.position : { x: 0, y: 0, z: 0 },
      orientation: (options != null && options.transform != null && options.transform.orientation != null) ? options.transform.orientation : { x: 0, y: 0, z: 0, w: 1 },
      shape: (options != null && options.shape != null) ? options.shape : { type: "none", offset: { x: 0, y: 0, z: 0 }, textureOffset: {}, settings: null }
    };
    node.shape.textureLayoutCustom = false;

    if (node.shape.type !== "none") {
      const origin = { x: 0, y: 0 };
      let placed = false;
      const size = getShapeTextureSize(node.shape);

      for (let j = 0; j < this.pub.textureHeight - size.height; j++) {
        for (let i = 0; i < this.pub.textureWidth; i++) {
          let pushed: boolean;
          do {
            pushed = false;
            for (const otherNodeId in this.nodes.byId) {
              const otherNode = this.nodes.byId[otherNodeId];
              if (otherNode.shape.type === "none") continue;

              // + 1 and - 1 because we need a one-pixel border
              // to avoid filtering issues
              for (const faceName in otherNode.shape.textureLayout) {
                const faceOffset = otherNode.shape.textureLayout[faceName].offset;
                const otherSize = getShapeTextureFaceSize(otherNode.shape, faceName);
                if ((i + size.width >= faceOffset.x - 1) && (j + size.height >= faceOffset.y - 1) &&
                (i <= faceOffset.x + otherSize.width + 1) && (j <= faceOffset.y + otherSize.height + 1)) {
                  i = faceOffset.x + otherSize.width + 2;
                  pushed = true;
                  break;
                }
              }
              if (pushed) break;
            }
          } while(pushed);

          if (i < this.pub.textureWidth && i + size.width < this.pub.textureWidth) {
            origin.x = i;
            origin.y = j;
            placed = true;
            break;
          }
        }
        if (placed) break;
      }

      if (!placed)
        console.log("Could not find any room for the node's texture. Texture needs to be expanded and all blocks should be re-laid out from bigger to smaller!");

      switch (node.shape.type) {
        case "box":
          const size = node.shape.settings.size as { x: number; y: number; z: number; };
          node.shape.textureLayout = {
            "top": {
              offset: { x: origin.x + size.z, y: origin.y },
              mirror: { x: false, y: false },
              angle: 0
            },
            "bottom": {
              offset: { x: origin.x + size.z + size.x, y: origin.y },
              mirror: { x: false, y: false },
              angle: 0
            },
            "front": {
              offset: { x: origin.x + size.z, y: origin.y + size.z },
              mirror: { x: false, y: false },
              angle: 0
            },
            "back": {
              offset: { x: origin.x + 2 * size.z + size.x, y: origin.y + size.z },
              mirror: { x: false, y: false },
              angle: 0
            },
            "left": {
              offset: { x: origin.x, y: origin.y + size.z },
              mirror: { x: false, y: false },
              angle: 0
            },
            "right": {
              offset: { x: origin.x + size.z + size.x, y: origin.y + size.z },
              mirror: { x: false, y: false },
              angle: 0
            }
          };
          break;
        case "none":
          node.shape.textureLayout = {};
          break;
      }
    }

    const index = (options != null) ? options.index : null;
    this.nodes.add(node, parentId, index, (err, actualIndex) => {
      if (err != null) { callback(err); return; }

      callback(null, node.id, node, parentId, actualIndex);
      this.emit("change");
    });
  }

  client_addNode(node: Node, parentId: string, index: number) {
    this.nodes.client_add(node, parentId, index);
  }


  server_setNodeProperty(client: SupCore.RemoteClient, id: string, path: string, value: any, callback: SetNodePropertyCallback) {
    const oldSize = this.nodes.byId[id].shape.settings.size;

    this.nodes.setProperty(id, path, value, (err, actualValue) => {
      if (err != null) { callback(err); return; }

      if (path === "shape.settings.size") this._updateNodeUvFromSize(oldSize, this.nodes.byId[id].shape);

      callback(null, null, id, path, actualValue);
      this.emit("change");
    });
  }

  client_setNodeProperty(id: string, path: string, value: any) {
    const oldSize = this.nodes.byId[id].shape.settings.size;
    this.nodes.client_setProperty(id, path, value);
    if (path === "shape.settings.size") this._updateNodeUvFromSize(oldSize, this.nodes.byId[id].shape);
  }

  _updateNodeUvFromSize(oldSize: XYZ, shape: Shape) {
    if (shape.textureLayoutCustom) return;

    switch (shape.type) {
      case "box":
        const newSize: XYZ = shape.settings.size;
        const x = newSize.x - oldSize.x;
        const z = newSize.z - oldSize.z;

        shape.textureLayout["top"].offset.x += z;
        shape.textureLayout["bottom"].offset.x += x + z;

        shape.textureLayout["front"].offset.x += z;
        shape.textureLayout["right"].offset.x += x + z;
        shape.textureLayout["back"].offset.x += x + 2 * z;

        shape.textureLayout["front"].offset.y += z;
        shape.textureLayout["back"].offset.y += z;
        shape.textureLayout["left"].offset.y += z;
        shape.textureLayout["right"].offset.y += z;
        break;
    }
  }

  server_moveNodePivot(client: SupCore.RemoteClient, id: string, value: { x: number; y: number; z: number; }, callback: MoveNodePivotCallback) {
    const node = this.nodes.byId[id];
    const oldMatrix = (node != null) ? this.computeGlobalMatrix(node) : null;

    this.nodes.setProperty(id, "position", value, (err, actualValue) => {
      if (err != null) { callback(err); return; }

      const newInverseMatrix = this.computeGlobalMatrix(node);
      newInverseMatrix.getInverse(newInverseMatrix);

      const offset = new THREE.Vector3(node.shape.offset.x, node.shape.offset.y, node.shape.offset.z);
      offset.applyMatrix4(oldMatrix).applyMatrix4(newInverseMatrix);
      node.shape.offset.x = offset.x;
      node.shape.offset.y = offset.y;
      node.shape.offset.z = offset.z;

      callback(null, null, id, actualValue);
      this.emit("change");
    });
  }

  client_moveNodePivot(id: string, value: { x: number; y: number; z: number; }) {
    const node = this.nodes.byId[id];
    const oldMatrix = (node != null) ? this.computeGlobalMatrix(node) : null;

    this.nodes.client_setProperty(id, "position", value);

    const newInverseMatrix = this.computeGlobalMatrix(node);
    newInverseMatrix.getInverse(newInverseMatrix);

    const offset = new THREE.Vector3(node.shape.offset.x, node.shape.offset.y, node.shape.offset.z);
    offset.applyMatrix4(oldMatrix).applyMatrix4(newInverseMatrix);
    node.shape.offset.x = offset.x;
    node.shape.offset.y = offset.y;
    node.shape.offset.z = offset.z;
  }


  server_moveNode(client: SupCore.RemoteClient, id: string, parentId: string, index: number, callback: MoveNodeCallback) {
    const node = this.nodes.byId[id];
    if (node == null) { callback(`Invalid node id: ${id}`); return; }

    const globalMatrix = this.computeGlobalMatrix(node);

    this.nodes.move(id, parentId, index, (err, actualIndex) => {
      if (err != null) { callback(err); return; }

      this.applyGlobalMatrix(node, globalMatrix);

      callback(null, null, id, parentId, actualIndex);
      this.emit("change");
    });
  }

  computeGlobalMatrix(node: Node, includeShapeOffset = false) {
    const defaultScale = new THREE.Vector3(1, 1, 1);
    const matrix = new THREE.Matrix4().compose(<THREE.Vector3>node.position, <THREE.Quaternion>node.orientation, defaultScale);

    let parentNode = this.nodes.parentNodesById[node.id];
    const parentMatrix = new THREE.Matrix4();
    const parentPosition  = new THREE.Vector3();
    const parentOffset = new THREE.Vector3();
    while (parentNode != null) {
      parentPosition.set(parentNode.position.x, parentNode.position.y, parentNode.position.z);
      parentOffset.set(parentNode.shape.offset.x, parentNode.shape.offset.y, parentNode.shape.offset.z);
      parentOffset.applyQuaternion(<THREE.Quaternion>parentNode.orientation);
      parentPosition.add(parentOffset);
      parentMatrix.identity().compose(parentPosition, <THREE.Quaternion>parentNode.orientation, defaultScale);
      matrix.multiplyMatrices(parentMatrix, matrix);
      parentNode = this.nodes.parentNodesById[parentNode.id];
    }
    return matrix;
  }

  applyGlobalMatrix(node: Node, matrix: THREE.Matrix4) {
    const parentGlobalMatrix = new THREE.Matrix4();

    let parentNode = this.nodes.parentNodesById[node.id];
    const parentMatrix = new THREE.Matrix4();
    const defaultScale = new THREE.Vector3(1, 1, 1);
    const parentPosition  = new THREE.Vector3();
    const parentOffset = new THREE.Vector3();
    while (parentNode != null) {
      parentPosition.set(parentNode.position.x, parentNode.position.y, parentNode.position.z);
      parentOffset.set(parentNode.shape.offset.x, parentNode.shape.offset.y, parentNode.shape.offset.z);
      parentOffset.applyQuaternion(<THREE.Quaternion>parentNode.orientation);
      parentPosition.add(parentOffset);
      parentMatrix.identity().compose(parentPosition, <THREE.Quaternion>parentNode.orientation, defaultScale);
      parentGlobalMatrix.multiplyMatrices(parentMatrix, parentGlobalMatrix);
      parentNode = this.nodes.parentNodesById[parentNode.id];
    }

    matrix.multiplyMatrices(parentGlobalMatrix.getInverse(parentGlobalMatrix), matrix);

    const position = new THREE.Vector3();
    const orientation = new THREE.Quaternion();
    matrix.decompose(position, orientation, defaultScale);
    node.position.x = position.x;
    node.position.y = position.y;
    node.position.z = position.z;
    node.orientation.x = orientation.x;
    node.orientation.y = orientation.y;
    node.orientation.z = orientation.z;
    node.orientation.w = orientation.w;
  }

  client_moveNode(id: string, parentId: string, index: number) {
    const node = this.nodes.byId[id];
    const globalMatrix = this.computeGlobalMatrix(node);
    this.nodes.client_move(id, parentId, index);
    this.applyGlobalMatrix(node, globalMatrix);
  }


  server_duplicateNode(client: SupCore.RemoteClient, newName: string, id: string, index: number, callback: DuplicateNodeCallback) {
    const referenceNode = this.nodes.byId[id];
    if (referenceNode == null) { callback(`Invalid node id: ${id}`); return; }

    const newNodes: DuplicatedNode[] = [];
    let totalNodeCount = 0;
    const walk = (node: Node) => {
      totalNodeCount += 1;
      for (const childNode of node.children) walk(childNode);
    };
    walk(referenceNode);

    const rootNode: Node = {
      id: null, name: newName, children: [],
      position: _.cloneDeep(referenceNode.position),
      orientation: _.cloneDeep(referenceNode.orientation),
      shape: _.cloneDeep(referenceNode.shape)
    };
    const parentId = (this.nodes.parentNodesById[id] != null) ? this.nodes.parentNodesById[id].id : null;

    const addNode = (newNode: Node, parentId: string, index: number, children: Node[]) => {
      this.nodes.add(newNode, parentId, index, (err, actualIndex) => {
        if (err != null) { callback(err); return; }

        // TODO: Copy shape

        newNodes.push({ node: newNode, parentId, index: actualIndex });

        if (newNodes.length === totalNodeCount) {
          callback(null, rootNode.id, rootNode, newNodes);
          this.emit("change");
        }

        for (let childIndex = 0; childIndex < children.length; childIndex++) {
          const childNode = children[childIndex];
          const node: Node = {
            id: null, name: childNode.name, children: [],
            position: _.cloneDeep(childNode.position),
            orientation: _.cloneDeep(childNode.orientation),
            shape: _.cloneDeep(childNode.shape)
          };
          addNode(node, newNode.id, childIndex, childNode.children);
        }
      });
    };
    addNode(rootNode, parentId, index, referenceNode.children);
  }

  client_duplicateNode(rootNode: Node, newNodes: DuplicatedNode[]) {
    for (const newNode of newNodes) {
      newNode.node.children.length = 0;
      this.nodes.client_add(newNode.node, newNode.parentId, newNode.index);
    }
  }


  server_removeNode(client: SupCore.RemoteClient, id: string, callback: RemoveNodeCallback) {
    this.nodes.remove(id, (err) => {
      if (err != null) { callback(err); return; }

      callback(null, null, id);
      this.emit("change");
    });
  }

  client_removeNode(id: string) {
    this.nodes.client_remove(id);
  }

  server_moveNodeTextureOffset(client: SupCore.RemoteClient, nodeIds: string[], offset: { x: number; y: number }, callback: MoveNodeTextureOffsetCallback) {
    // TODO: add checks

    this.client_moveNodeTextureOffset(nodeIds, offset);
    callback(null, null, nodeIds, offset);
    this.emit("change");
  }

  client_moveNodeTextureOffset(nodeIds: string[], offset: { x: number; y: number }) {
    for (const id of nodeIds) {
      const node = this.nodes.byId[id];
      for (const faceName in node.shape.textureLayout) {
        const faceOffset = node.shape.textureLayout[faceName].offset;
        faceOffset.x += offset.x;
        faceOffset.y += offset.y;
      }
    }
  }

  // Texture
  server_changeTextureWidth(client: SupCore.RemoteClient, newWidth: number, callback: ChangeTextureWidthCallback) {
    if (CubicModelAsset.validTextureSizes.indexOf(newWidth) === -1) { callback(`Invalid new texture width: ${newWidth}`); return; }

    this._changeTextureWidth(newWidth);
    callback(null, null, newWidth);
    this.emit("change");
  }

  client_changeTextureWidth(newWidth: number) {
    this._changeTextureWidth(newWidth);
    this.loadTextures();
  }

  _changeTextureWidth(newWidth: number) {
    for (const mapName in this.pub.maps) {
      const oldMapData = this.textureDatas[mapName];

      const newMapBuffer = new ArrayBuffer(newWidth * this.pub.textureHeight * 4);
      const newMapData = new Uint8ClampedArray(newMapBuffer);

      for (let y = 0; y < this.pub.textureHeight; y++) {
        let x = 0;
        while (x < Math.max(this.pub.textureWidth, newWidth)) {
          const oldIndex = (y * this.pub.textureWidth + x) * 4;
          const newIndex = (y * newWidth              + x) * 4;

          for (let i = 0; i < 4; i++) {
            const value = x >= this.pub.textureWidth ? 255 : oldMapData[oldIndex + i];
            newMapData[newIndex + i] = value;
          }
          x++;
        }
      }

      this.pub.maps[mapName] = newMapBuffer;
      this.textureDatas[mapName] = newMapData;
    }
    this.pub.textureWidth = newWidth;
  }

  server_changeTextureHeight(client: SupCore.RemoteClient, newHeight: number, callback: ChangeTextureHeightCallback) {
    if (CubicModelAsset.validTextureSizes.indexOf(newHeight) === -1) { callback(`Invalid new texture height: ${newHeight}`); return; }

    this._changeTextureHeight(newHeight);
    callback(null, null, newHeight);
    this.emit("change");
  }

  client_changeTextureHeight(newHeight: number) {
    this._changeTextureHeight(newHeight);
    this.loadTextures();
  }

  _changeTextureHeight(newHeight: number) {
    for (const mapName in this.pub.maps) {
      const oldMapData = this.textureDatas[mapName];

      const newMapBuffer = new ArrayBuffer(this.pub.textureWidth * newHeight * 4);
      const newMapData = new Uint8ClampedArray(newMapBuffer);

      for (let y = 0; y < Math.max(this.pub.textureHeight, newHeight); y++) {
        for (let x = 0; x < this.pub.textureWidth; x++) {
          let index = (y * this.pub.textureWidth + x) * 4;
          for (let i = 0; i < 4; i++) {
            let value = y >= this.pub.textureHeight ? 255 : oldMapData[index + i];
            newMapData[index + i] = value;
          }
        }
      }

      this.pub.maps[mapName] = newMapBuffer;
      this.textureDatas[mapName] = newMapData;
    }
    this.pub.textureHeight = newHeight;
  }

  server_editTexture(client: SupCore.RemoteClient, name: string, edits: TextureEdit[], callback: EditTextureCallback) {
    if (this.pub.maps[name] == null) { callback(`Invalid map name: ${name}`); return; }
    for (const edit of edits) {
      if (edit.x == null || edit.x < 0 || edit.x >= this.pub.textureWidth) { callback(`Invalid edit x: ${edit.x}`); return; }
      if (edit.y == null || edit.y < 0 || edit.y >= this.pub.textureHeight) { callback(`Invalid edit y: ${edit.y}`); return; }
      if (edit.value.r == null || edit.value.r < 0 || edit.value.r > 255) { callback(`Invalid edit value r: ${edit.value.r}`); return; }
      if (edit.value.g == null || edit.value.g < 0 || edit.value.g > 255) { callback(`Invalid edit value g: ${edit.value.g}`); return; }
      if (edit.value.b == null || edit.value.b < 0 || edit.value.b > 255) { callback(`Invalid edit value b: ${edit.value.b}`); return; }
      if (edit.value.a == null || edit.value.a < 0 || edit.value.a > 255) { callback(`Invalid edit value a: ${edit.value.a}`); return; }
    }

    this._editTextureData(name, edits);

    callback(null, null, name, edits);
    this.emit("change");
  }

  client_editTexture(name: string, edits: TextureEdit[]) {
    this._editTextureData(name, edits);

    const imageData = this.clientTextureDatas[name].imageData;
    this.clientTextureDatas[name].ctx.putImageData(imageData, 0, 0);
    this.pub.textures[name].needsUpdate = true;
  }

  _editTextureData(name: string, edits: TextureEdit[]) {
    const array = this.textureDatas[name];
    for (const edit of edits) {
      const index = (edit.y * this.pub.textureWidth + edit.x) * 4;
      array[index + 0] = edit.value.r;
      array[index + 1] = edit.value.g;
      array[index + 2] = edit.value.b;
      array[index + 3] = edit.value.a;
    }
  }
}
