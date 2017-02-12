import { data } from "./network";
import mapArea, { setupPattern, setupFillPattern, flipTilesVertically, flipTilesHorizontally, rotateTiles, selectEntireLayer } from "./mapArea";
import tileSetArea from "./tileSetArea";

import * as TreeView from "dnd-tree-view";
import * as ResizeHandle from "resize-handle";

const tmpPosition = new SupEngine.THREE.Vector3();
const tmpScale = new SupEngine.THREE.Vector3();

import { TileMapLayerPub } from "../../data/TileMapLayers";

const ui: {
  tileSetInput: HTMLInputElement;
  openTileSetButton: HTMLButtonElement;

  sizeInput: HTMLInputElement;

  settings: { [name: string]: HTMLInputElement };

  gridCheckbox: HTMLInputElement;
  highlightCheckbox: HTMLInputElement;
  highlightSlider: HTMLInputElement;

  brushToolButton: HTMLInputElement;
  fillToolButton: HTMLInputElement;
  selectionToolButton: HTMLInputElement;
  eraserToolButton: HTMLInputElement;

  layersTreeView: TreeView;

  mousePositionLabel?: { x: HTMLLabelElement; y: HTMLLabelElement; };
} = {} as any;
export default ui;

// Setup resize handles
new ResizeHandle(document.querySelector(".sidebar") as HTMLElement, "right");
new ResizeHandle(document.querySelector(".layers") as HTMLElement, "bottom");

ui.tileSetInput = document.querySelector(".property-tileSetId") as HTMLInputElement;
ui.tileSetInput.addEventListener("input", onTileSetChange);
ui.tileSetInput.addEventListener("keyup", (event: Event) => { event.stopPropagation(); });

ui.openTileSetButton = document.querySelector("button.open-tileSet") as HTMLButtonElement;
ui.openTileSetButton.addEventListener("click", (event) => {
  SupClient.openEntry(data.tileMapUpdater.tileMapAsset.pub.tileSetId);
});

ui.sizeInput = document.querySelector(".property-size") as HTMLInputElement;
(document.querySelector("button.resize") as HTMLInputElement).addEventListener("click", onResizeMapClick);
(document.querySelector("button.move") as HTMLInputElement).addEventListener("click", onMoveMapClick);

ui.settings = {};
[ "pixelsPerUnit", "layerDepthOffset" ].forEach((setting: string) => {
  const queryName = `.property-${setting}`;
  const settingObj = ui.settings[setting] = document.querySelector(queryName) as HTMLInputElement;

  settingObj.addEventListener("change", (event) => {
    const value = (setting === "layerDepthOffset") ? parseFloat(settingObj.value) : parseInt(settingObj.value, 10);
    data.projectClient.editAsset(SupClient.query.asset, "setProperty", setting, value);
  });
});

ui.gridCheckbox = document.querySelector("input.grid-checkbox") as HTMLInputElement;
ui.gridCheckbox.addEventListener("change", onChangeGridDisplay);
ui.highlightCheckbox = document.querySelector("input.highlight-checkbox") as HTMLInputElement;
ui.highlightCheckbox.addEventListener("change", onChangeHighlight);
ui.highlightSlider = document.querySelector("input.highlight-slider") as HTMLInputElement;
ui.highlightSlider.addEventListener("input", onChangeHighlight);

ui.brushToolButton = document.querySelector("input#Brush") as HTMLInputElement;
ui.brushToolButton.addEventListener("change", () => { selectBrushTool(); });
ui.fillToolButton = document.querySelector("input#Fill") as HTMLInputElement;
ui.fillToolButton.addEventListener("change", () => { selectFillTool(); });
ui.selectionToolButton = document.querySelector("input#Selection") as HTMLInputElement;
ui.selectionToolButton.addEventListener("change", () => { selectSelectionTool(); });
ui.eraserToolButton = document.querySelector("input#Eraser") as HTMLInputElement;
ui.eraserToolButton.addEventListener("change", () => { selectEraserTool(); });

ui.layersTreeView = new TreeView(document.querySelector(".layers-tree-view") as HTMLElement, { dragStartCallback: () => true, dropCallback: onLayersTreeViewDrop, multipleSelection: false });
ui.layersTreeView.on("selectionChange", onLayerSelect);

document.querySelector("button.new-layer").addEventListener("click", onNewLayerClick);
document.querySelector("button.rename-layer").addEventListener("click", onRenameLayerClick);
document.querySelector("button.delete-layer").addEventListener("click", onDeleteLayerClick);

ui.mousePositionLabel = {
  x: document.querySelector("label.position-x") as HTMLLabelElement,
  y: document.querySelector("label.position-y") as HTMLLabelElement
};

// Keybindings
document.addEventListener("keyup", (event) => {
  if ((event.target as HTMLInputElement).tagName === "INPUT") return;

  const keyEvent = (window as any).KeyEvent;
  switch (event.keyCode) {
    case keyEvent.DOM_VK_B: selectBrushTool(); break;
    case keyEvent.DOM_VK_F: selectFillTool(); break;
    case keyEvent.DOM_VK_S: selectSelectionTool(); break;
    case keyEvent.DOM_VK_E: selectEraserTool(); break;
    case keyEvent.DOM_VK_G: ui.gridCheckbox.checked = !ui.gridCheckbox.checked; onChangeGridDisplay(); break;
    case keyEvent.DOM_VK_I: ui.highlightCheckbox.checked = !ui.highlightCheckbox.checked; onChangeHighlight(); break;
    case keyEvent.DOM_VK_H: flipTilesHorizontally(); break;
    case keyEvent.DOM_VK_V: flipTilesVertically(); break;
    case keyEvent.DOM_VK_R: rotateTiles(); break;
    case keyEvent.DOM_VK_A:
      if (event.ctrlKey) {
        selectSelectionTool();
        selectEntireLayer();
      }
      break;
  }
});
SupClient.setupHelpCallback(() => {
    window.parent.postMessage({ type: "openTool", name: "documentation", state: { section: "tileMap" } }, window.location.origin);
});

function onTileSetChange(event: Event) {
  const value = (event.target as HTMLInputElement).value;
  if (value === "") { data.projectClient.editAsset(SupClient.query.asset, "changeTileSet", null); return; }

  const entry = SupClient.findEntryByPath(data.projectClient.entries.pub, value);
  if (entry != null && entry.type === "tileSet") data.projectClient.editAsset(SupClient.query.asset, "changeTileSet", entry.id);
}

function onResizeMapClick() {
  const options = {
    initialValue: data.tileMapUpdater.tileMapAsset.pub.width.toString(),
    validationLabel: SupClient.i18n.t("tileMapEditor:resize"),
    cancelLabel: SupClient.i18n.t("common:actions.skip")
  };

  new SupClient.Dialogs.PromptDialog(SupClient.i18n.t("tileMapEditor:newWidthPrompt"), options, (newWidthString) => {
    let newWidth = data.tileMapUpdater.tileMapAsset.pub.width;
    if (newWidthString != null && !isNaN(parseInt(newWidthString, 10)))
      newWidth = parseInt(newWidthString, 10);

    const options = {
      initialValue: data.tileMapUpdater.tileMapAsset.pub.height.toString(),
      validationLabel: SupClient.i18n.t("tileMapEditor:resize"),
      cancelLabel: SupClient.i18n.t("common:actions.skip")
    };

    new SupClient.Dialogs.PromptDialog(SupClient.i18n.t("tileMapEditor:newHeightPrompt"), options, (newHeightString) => {
      let newHeight = data.tileMapUpdater.tileMapAsset.pub.height;
      if (newHeightString != null && !isNaN(parseInt(newHeightString, 10)))
        newHeight = parseInt(newHeightString, 10);

      if (newWidth === data.tileMapUpdater.tileMapAsset.pub.width && newHeight === data.tileMapUpdater.tileMapAsset.pub.height) return;
      data.projectClient.editAsset(SupClient.query.asset, "resizeMap", newWidth, newHeight);
    });
  });
}

function onMoveMapClick() {
  const options = {
    initialValue: "0",
    validationLabel: SupClient.i18n.t("tileMapEditor:applyOffset"),
    cancelLabel: SupClient.i18n.t("common:actions.skip")
  };

  new SupClient.Dialogs.PromptDialog(SupClient.i18n.t("tileMapEditor:horizontalOffsetPrompt"), options, (horizontalOffsetString) => {
    let horizontalOffset = 0;
    if (horizontalOffsetString != null && !isNaN(parseInt(horizontalOffsetString, 10)))
      horizontalOffset = parseInt(horizontalOffsetString, 10);

    new SupClient.Dialogs.PromptDialog(SupClient.i18n.t("tileMapEditor:verticalOffsetPrompt"), options, (verticalOffsetString) => {
      let verticalOffset = 0;
      if (verticalOffsetString != null && !isNaN(parseInt(verticalOffsetString, 10)))
        verticalOffset = parseInt(verticalOffsetString, 10);

      if (horizontalOffset === 0 && verticalOffset === 0) return;
      data.projectClient.editAsset(SupClient.query.asset, "moveMap", horizontalOffset, verticalOffset);
    });
  });
}

function onNewLayerClick() {
  const options = {
    initialValue: SupClient.i18n.t("tileMapEditor:newLayerInitialValue"),
    validationLabel: SupClient.i18n.t("common:actions.create")
  };

  new SupClient.Dialogs.PromptDialog(SupClient.i18n.t("tileMapEditor:newLayerPrompt"), options, (name) => {
    if (name == null) return;

    let index = SupClient.getTreeViewInsertionPoint(ui.layersTreeView).index;
    index = data.tileMapUpdater.tileMapAsset.pub.layers.length - index + 1;
    data.projectClient.editAsset(SupClient.query.asset, "newLayer", name, index, (layerId: string) => {
      ui.layersTreeView.clearSelection();
      ui.layersTreeView.addToSelection(ui.layersTreeView.treeRoot.querySelector(`li[data-id="${layerId}"]`) as HTMLLIElement);
      tileSetArea.selectedLayerId = layerId;
    });
  });
}

function onRenameLayerClick() {
  if (ui.layersTreeView.selectedNodes.length !== 1) return;

  const selectedNode = ui.layersTreeView.selectedNodes[0];
  const layer = data.tileMapUpdater.tileMapAsset.layers.byId[selectedNode.dataset["id"]];

  const options = {
    initialValue: layer.name,
    validationLabel: SupClient.i18n.t("common:actions.rename")
  };

  new SupClient.Dialogs.PromptDialog(SupClient.i18n.t("tileMapEditor:renameLayerPrompt"), options, (newName) => {
    if (newName == null) return;
    data.projectClient.editAsset(SupClient.query.asset, "renameLayer", layer.id, newName);
  });
}

function onDeleteLayerClick() {
  if (ui.layersTreeView.selectedNodes.length !== 1) return;

  const confirmLabel = SupClient.i18n.t("tileMapEditor:deleteLayerConfirm");
  const validationLabel = SupClient.i18n.t("common:actions.delete");
  new SupClient.Dialogs.ConfirmDialog(confirmLabel, { validationLabel }, (confirm) => {
    if (!confirm) return;

    const selectedNode = ui.layersTreeView.selectedNodes[0];
    data.projectClient.editAsset(SupClient.query.asset, "deleteLayer", selectedNode.dataset["id"]);
  });
}

function onLayersTreeViewDrop(event: DragEvent, dropLocation: TreeView.DropLocation, orderedNodes: HTMLLIElement[]) {
  const id = orderedNodes[0].dataset["id"];
  const newIndex = SupClient.getListViewDropIndex(dropLocation, data.tileMapUpdater.tileMapAsset.layers, true);

  data.projectClient.editAsset(SupClient.query.asset, "moveLayer", id, newIndex);
  return false;
}

function onLayerSelect() {
  if (ui.layersTreeView.selectedNodes.length === 0) {
    ui.layersTreeView.addToSelection(ui.layersTreeView.treeRoot.querySelector(`li[data-id="${tileSetArea.selectedLayerId}"]`) as HTMLLIElement);
  } else {
    tileSetArea.selectedLayerId = ui.layersTreeView.selectedNodes[0].dataset["id"];
  }

  onChangeHighlight();

  const pub = data.tileMapUpdater.tileMapAsset.pub;
  const layer = data.tileMapUpdater.tileMapAsset.layers.byId[tileSetArea.selectedLayerId];
  const z = (pub.layers.indexOf(layer) + 0.5) * pub.layerDepthOffset;
  mapArea.patternActor.setLocalPosition(new SupEngine.THREE.Vector3(0, 0, z));
}

function onChangeGridDisplay() {
  mapArea.gridActor.threeObject.visible = ui.gridCheckbox.checked;
}

function onChangeHighlight() {
  for (const id in data.tileMapUpdater.tileMapRenderer.layerMeshesById) {
    const layerMesh = data.tileMapUpdater.tileMapRenderer.layerMeshesById[id];

    const opacity = ui.highlightCheckbox.checked && id !== tileSetArea.selectedLayerId ? parseFloat(ui.highlightSlider.value) / 100 : 1;
    (layerMesh.material as THREE.ShaderMaterial).uniforms["opacity"].value = opacity;
  }
}

export function selectBrushTool(x?: number, y?: number, width = 1, height = 1) {
  ui.brushToolButton.checked = true;

  if (data.tileMapUpdater.tileSetAsset == null || data.tileMapUpdater.tileSetAsset.pub == null) return;
  if (x != null && y != null) data.tileSetUpdater.tileSetRenderer.select(x, y, width, height);

  const ratio = data.tileSetUpdater.tileSetAsset.pub.grid.width / data.tileSetUpdater.tileSetAsset.pub.grid.height;
  data.tileSetUpdater.tileSetRenderer.selectedTileActor.getLocalPosition(tmpPosition);
  tmpPosition.y = Math.round(tmpPosition.y * ratio);
  data.tileSetUpdater.tileSetRenderer.selectedTileActor.getLocalScale(tmpScale);
  tmpScale.y = Math.round(tmpScale.y * ratio);
  const layerData: (number|boolean)[][] = [];
  for (let y = -tmpScale.y - 1; y >= 0; y--) {
    for (let x = 0; x < tmpScale.x; x++) {
      layerData.push([ tmpPosition.x + x, -tmpPosition.y + y, false, false, 0 ]);
    }
  }
  setupPattern(layerData, tmpScale.x);

  mapArea.lastTile = null;
  mapArea.patternActor.threeObject.visible = true;
  data.tileSetUpdater.tileSetRenderer.selectedTileActor.threeObject.visible = true;
  mapArea.patternBackgroundActor.threeObject.visible = true;
  mapArea.patternBackgroundActor.setLocalScale(new SupEngine.THREE.Vector3(width, height / ratio, 1));
}

export function selectFillTool(x?: number, y?: number) {
  ui.fillToolButton.checked = true;

  if (data.tileMapUpdater.tileSetAsset == null || data.tileMapUpdater.tileSetAsset.pub == null) return;
  if (x != null && y != null) data.tileSetUpdater.tileSetRenderer.select(x, y);

  data.tileSetUpdater.tileSetRenderer.selectedTileActor.getLocalPosition(tmpPosition);
  setupFillPattern([ tmpPosition.x, -tmpPosition.y, false, false, 0 ]);

  mapArea.patternActor.threeObject.visible = true;
  data.tileSetUpdater.tileSetRenderer.selectedTileActor.threeObject.visible = true;
  mapArea.patternBackgroundActor.threeObject.visible = false;
}

export function selectSelectionTool() {
  ui.selectionToolButton.checked = true;

  if (data.tileMapUpdater.tileSetAsset == null || data.tileMapUpdater.tileSetAsset.pub == null) return;

  mapArea.patternActor.threeObject.visible = false;
  mapArea.patternBackgroundActor.threeObject.visible = false;
  data.tileSetUpdater.tileSetRenderer.selectedTileActor.threeObject.visible = false;

  mapArea.selectionStartPoint = null;
}

export function selectEraserTool() {
  ui.eraserToolButton.checked = true;

  if (data.tileMapUpdater.tileSetAsset == null || data.tileMapUpdater.tileSetAsset.pub == null) return;

  mapArea.patternActor.threeObject.visible = false;
  data.tileSetUpdater.tileSetRenderer.selectedTileActor.threeObject.visible = false;
  mapArea.patternBackgroundActor.threeObject.visible = true;
  const ratio = data.tileSetUpdater.tileSetAsset.pub.grid.width / data.tileSetUpdater.tileSetAsset.pub.grid.height;
  mapArea.patternBackgroundActor.setLocalScale(new SupEngine.THREE.Vector3(1, 1 / ratio, 1));
}

export function setupLayer(layer: TileMapLayerPub, index: number) {
  const liElt = document.createElement("li") as HTMLLIElement;
  liElt.dataset["id"] = layer.id;

  const displayCheckbox = document.createElement("input");
  displayCheckbox.classList.add("display");
  displayCheckbox.type = "checkbox";
  displayCheckbox.checked = true;
  displayCheckbox.addEventListener("change", () => {
    data.tileMapUpdater.tileMapRenderer.layerVisibleById[layer.id] = displayCheckbox.checked;
  });
  displayCheckbox.addEventListener("click", (event) => { event.stopPropagation(); });
  liElt.appendChild(displayCheckbox);

  const indexSpan = document.createElement("span");
  indexSpan.classList.add("index");
  indexSpan.textContent = `${index} -`;
  liElt.appendChild(indexSpan);

  const nameSpan = document.createElement("span");
  nameSpan.classList.add("name");
  nameSpan.textContent = layer.name;
  liElt.appendChild(nameSpan);

  ui.layersTreeView.insertAt(liElt, "item", data.tileMapUpdater.tileMapAsset.pub.layers.length - 1 - index);
}

export function refreshLayersId() {
  for (let layerIndex = 0; layerIndex < data.tileMapUpdater.tileMapAsset.pub.layers.length; layerIndex++) {
    const layerId = data.tileMapUpdater.tileMapAsset.pub.layers[layerIndex].id;
    const indexSpanElt = ui.layersTreeView.treeRoot.querySelector(`[data-id="${layerId}"] .index`) as HTMLSpanElement;
    indexSpanElt.textContent = `${layerIndex} -`;
  }
}
