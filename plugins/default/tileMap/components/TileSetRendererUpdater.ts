import TileSetAsset from "../data/TileSetAsset";
import TileSet from "./TileSet";
import TileSetRenderer from "./TileSetRenderer";

export default class TileSetRendererUpdater {

  client: SupClient.ProjectClient;
  tileSetRenderer: TileSetRenderer;

  receiveAssetCallbacks: any;
  editAssetCallbacks: any;

  tileSetAssetId: string;

  tileSetSubscriber: SupClient.AssetSubscriber;

  tileSetAsset: TileSetAsset;

  constructor(client: SupClient.ProjectClient, tileSetRenderer: TileSetRenderer, config: any, receiveAssetCallbacks?: any, editAssetCallbacks?: any) {
    this.client = client;
    this.tileSetRenderer = tileSetRenderer;
    this.receiveAssetCallbacks = receiveAssetCallbacks;
    this.editAssetCallbacks = editAssetCallbacks;
    this.tileSetAssetId = config.tileSetAssetId;

    this.tileSetSubscriber = {
      onAssetReceived: this.onTileSetAssetReceived,
      onAssetEdited: this.onTileSetAssetEdited,
      onAssetTrashed: this.onTileSetAssetTrashed
    };
    if (this.tileSetAssetId != null) this.client.subAsset(this.tileSetAssetId, "tileSet", this.tileSetSubscriber);
  }

  destroy() {
    if (this.tileSetAssetId != null) { this.client.unsubAsset(this.tileSetAssetId, this.tileSetSubscriber); }
  }

  changeTileSetId(tileSetId: string) {
    if (this.tileSetAssetId != null) this.client.unsubAsset(this.tileSetAssetId, this.tileSetSubscriber);
    this.tileSetAssetId = tileSetId;

    this.tileSetAsset = null;
    this.tileSetRenderer.setTileSet(null);
    this.tileSetRenderer.gridRenderer.resize(1, 1);

    if (this.tileSetAssetId != null) this.client.subAsset(this.tileSetAssetId, "tileSet", this.tileSetSubscriber);
  }

  private onTileSetAssetReceived = (assetId: string, asset: TileSetAsset) => {
    this.prepareTexture(asset.pub.texture, () => {
      this.tileSetAsset = asset;

      if (asset.pub.texture != null) {
        this.tileSetRenderer.setTileSet(new TileSet(asset.pub));
        this.tileSetRenderer.gridRenderer.setGrid({
          width: asset.pub.texture.image.width / asset.pub.grid.width,
          height: asset.pub.texture.image.height / asset.pub.grid.height,
          direction: -1,
          orthographicScale: 10,
          ratio: { x: 1, y: asset.pub.grid.width / asset.pub.grid.height }
        });
      }

      if (this.receiveAssetCallbacks != null && this.receiveAssetCallbacks.tileSet != null) this.receiveAssetCallbacks.tileSet();
    });
  };

  private prepareTexture(texture: THREE.Texture, callback: Function) {
    if (texture == null) {
      callback();
      return;
    }

    if (texture.image.complete) callback();
    else texture.image.addEventListener("load", callback);
  }

  private onTileSetAssetEdited = (id: string, command: string, ...args: any[]) => {
    let callEditCallback = true;
    let commandFunction = (<any>this)[`onEditCommand_${command}`];
    if (commandFunction != null) {
      if (commandFunction.apply(this, args) === false) callEditCallback = false;
    }

    if (callEditCallback && this.editAssetCallbacks != null) {
      let editCallback = this.editAssetCallbacks.tileSet[command];
      if (editCallback != null) editCallback.apply(null, args);
    }
  };

  /* tslint:disable:no-unused-variable */
  private onEditCommand_upload() {
    let texture = this.tileSetAsset.pub.texture;
    this.prepareTexture(texture, () => {
      this.tileSetRenderer.setTileSet(new TileSet(this.tileSetAsset.pub));

      let width = texture.image.width / this.tileSetAsset.pub.grid.width;
      let height = texture.image.height / this.tileSetAsset.pub.grid.height;
      this.tileSetRenderer.gridRenderer.resize(width, height);
      this.tileSetRenderer.gridRenderer.setRatio({ x: 1, y: this.tileSetAsset.pub.grid.width / this.tileSetAsset.pub.grid.height });

      let editCallback = (this.editAssetCallbacks != null) ? this.editAssetCallbacks.tileSet["upload"] : null;
      if (editCallback != null) editCallback();
    });
  }

  private onEditCommand_setProperty(key: string, value: any) {
    switch (key) {
      case "grid.width":
      case "grid.height":
        this.tileSetRenderer.refreshScaleRatio();

        let width = this.tileSetAsset.pub.texture.image.width / this.tileSetAsset.pub.grid.width;
        let height = this.tileSetAsset.pub.texture.image.height / this.tileSetAsset.pub.grid.height;
        this.tileSetRenderer.gridRenderer.resize(width, height);
        this.tileSetRenderer.gridRenderer.setRatio({ x: 1, y: this.tileSetAsset.pub.grid.width / this.tileSetAsset.pub.grid.height });
        break;
    }
  }
  /* tslint:enable:no-unused-variable */

  private onTileSetAssetTrashed = (assetId: string) => {
    this.tileSetRenderer.setTileSet(null);
    if (this.editAssetCallbacks != null) {
      // FIXME: We should probably have a this.trashAssetCallback instead
      // and let editors handle things how they want
      SupClient.onAssetTrashed();
    }
  };
}
