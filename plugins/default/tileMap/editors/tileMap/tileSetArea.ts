import ui, { selectBrushTool, selectFillTool } from "./ui";
import { setupPattern } from "./mapArea";
import { data } from "./network";

const tmpVector3 = new SupEngine.THREE.Vector3();

const tileSetArea: {
  gameInstance?: SupEngine.GameInstance;

  cameraComponent?: any;

  selectedLayerId?: string;

  selectionStartPoint?: { x: number; y : number };
  selectionEndPoint?: { x: number; y : number };
} = {};

tileSetArea.gameInstance = new SupEngine.GameInstance(<HTMLCanvasElement>document.querySelector("canvas.tileSet"));
tileSetArea.gameInstance.threeRenderer.setClearColor(0xbbbbbb);

const cameraActor = new SupEngine.Actor(tileSetArea.gameInstance, "Camera");
cameraActor.setLocalPosition(new SupEngine.THREE.Vector3(0, 0, 10));
tileSetArea.cameraComponent = new SupEngine.componentClasses["Camera"](cameraActor);
tileSetArea.cameraComponent.setOrthographicMode(true);
new SupEngine.editorComponentClasses["Camera2DControls"](
  cameraActor, tileSetArea.cameraComponent,
  { zoomSpeed: 1.5, zoomMin: 0.1, zoomMax: 10000 },
  () => { data.tileSetUpdater.tileSetRenderer.gridRenderer.setOrthgraphicScale(tileSetArea.cameraComponent.orthographicScale); }
);
export default tileSetArea;

function getTileSetGridPosition(gameInstance: SupEngine.GameInstance, cameraComponent: any) {
  const mousePosition = gameInstance.input.mousePosition;
  const position = new SupEngine.THREE.Vector3(mousePosition.x, mousePosition.y, 0);
  cameraComponent.actor.getLocalPosition(tmpVector3);
  const ratio = data.tileMapUpdater.tileSetAsset.pub.grid.width / data.tileMapUpdater.tileSetAsset.pub.grid.height;

  let x = position.x / gameInstance.threeRenderer.domElement.width;
  x = x * 2 - 1;
  x *= cameraComponent.orthographicScale / 2 * cameraComponent.cachedRatio;
  x += tmpVector3.x;
  x = Math.floor(x);

  let y = position.y / gameInstance.threeRenderer.domElement.height;
  y = y * 2 - 1;
  y *= cameraComponent.orthographicScale / 2;
  y -= tmpVector3.y;
  y *= ratio;
  y = Math.floor(y);

  return [ x, y ];
}

export function handleTileSetArea() {
  if (data.tileMapUpdater == null) return;
  if (data.tileMapUpdater.tileMapAsset == null) return;
  if (data.tileMapUpdater.tileSetAsset == null) return;
  if (data.tileMapUpdater.tileSetAsset.pub.texture == null) return;

  const tilesPerRow = data.tileMapUpdater.tileSetAsset.pub.texture.image.width / data.tileMapUpdater.tileSetAsset.pub.grid.width;
  const tilesPerColumn = data.tileMapUpdater.tileSetAsset.pub.texture.image.height / data.tileMapUpdater.tileSetAsset.pub.grid.height;

  const [ mouseX, mouseY ] = getTileSetGridPosition(tileSetArea.gameInstance, tileSetArea.cameraComponent);
  if (tileSetArea.gameInstance.input.mouseButtons[0].wasJustPressed) {

    if (mouseX >= 0 && mouseX < tilesPerRow && mouseY >= 0 && mouseY < tilesPerColumn) {
      if (ui.fillToolButton.checked) {
        selectFillTool(mouseX, mouseY);
      } else {
        tileSetArea.selectionStartPoint = { x: mouseX, y: mouseY };
        selectBrushTool(mouseX, mouseY);
      }
    }

  } else if (tileSetArea.gameInstance.input.mouseButtons[0].wasJustReleased && tileSetArea.selectionStartPoint != null) {
    // Clamp mouse values
    const x = Math.max(0, Math.min(tilesPerRow - 1, mouseX));
    const y = Math.max(0, Math.min(tilesPerColumn - 1, mouseY));

    const startX = Math.min(tileSetArea.selectionStartPoint.x, x);
    const startY = Math.min(tileSetArea.selectionStartPoint.y, y);
    const width = Math.abs(x - tileSetArea.selectionStartPoint.x) + 1;
    const height = Math.abs(y - tileSetArea.selectionStartPoint.y);
    const layerData: (number|boolean)[][] = [];
    for (let y = height; y >= 0; y--) {
      for (let x = 0; x < width; x++) {
        layerData.push([ startX + x, startY + y, false, false, 0 ]);
      }
    }

    setupPattern(layerData, width);
    selectBrushTool(startX, startY, width, height + 1);
    tileSetArea.selectionStartPoint = null;
  }

  if (tileSetArea.selectionStartPoint != null) {
    // Clamp mouse values
    let x = Math.max(0, Math.min(tilesPerRow - 1, mouseX));
    let y = Math.max(0, Math.min(tilesPerColumn - 1, mouseY));

    let width = x - tileSetArea.selectionStartPoint.x;
    if (width >= 0) {
      width += 1;
      x = tileSetArea.selectionStartPoint.x;
    } else {
      width -= 1;
      x = tileSetArea.selectionStartPoint.x + 1;
    }

    let height = y - tileSetArea.selectionStartPoint.y;
    if (height >= 0) {
      height += 1;
      y = tileSetArea.selectionStartPoint.y;
    } else {
      height -= 1;
      y = tileSetArea.selectionStartPoint.y + 1;
    }

    data.tileSetUpdater.tileSetRenderer.select(x, y, width, height);
  }
}
