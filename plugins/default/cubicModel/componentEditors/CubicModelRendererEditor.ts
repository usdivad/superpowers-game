import { CubicModelRendererConfigPub } from "../componentConfigs/CubicModelRendererConfig";
import CubicModelAsset from "../data/CubicModelAsset";

export default class CubicModelRendererEditor {
  tbody: HTMLTableSectionElement;
  projectClient: SupClient.ProjectClient;
  editConfig: any;

  cubicModelAssetId: string;
  animationId: string;
  shaderAssetId: string;

  cubicModelFieldSubscriber: SupClient.table.AssetFieldSubscriber;
  // animationSelectBox: HTMLSelectElement;
  // horizontalFlipField: HTMLInputElement;
  // verticalFlipField: HTMLInputElement;
  // castShadowField: HTMLInputElement;
  // receiveShadowField: HTMLInputElement;
  // colorField: HTMLInputElement;
  // colorPicker: HTMLInputElement;
  // overrideOpacityField: HTMLInputElement;
  // transparentField: HTMLInputElement;
  // opacityField: HTMLInputElement;
  // materialSelectBox: HTMLSelectElement;
  // shaderTextField: HTMLInputElement;
  // shaderButtonElt: HTMLButtonElement;

  asset: CubicModelAsset;

  constructor(tbody: HTMLTableSectionElement, config: CubicModelRendererConfigPub, projectClient: SupClient.ProjectClient, editConfig: any) {
    this.tbody = tbody;
    this.projectClient = projectClient;
    this.editConfig = editConfig;
    this.cubicModelAssetId = config.cubicModelAssetId;
    // this.animationId = config.animationId;
    // this.shaderAssetId = config.shaderAssetId;

    const cubicModelRow = SupClient.table.appendRow(tbody, SupClient.i18n.t("componentEditors:CubicModelRenderer.cubicModel"));
    this.cubicModelFieldSubscriber = SupClient.table.appendAssetField(cubicModelRow.valueCell, this.cubicModelAssetId, "cubicModel", projectClient);
    this.cubicModelFieldSubscriber.on("select", (assetId: string) => {
      this.editConfig("setProperty", "cubicModelAssetId", assetId);
      // this.editConfig("setProperty", "animationId", null);
    });

    /*
    const animationRow = SupClient.table.appendRow(tbody, "Animation");
    this.animationSelectBox = SupClient.table.appendSelectBox(animationRow.valueCell, { "": "(None)" });
    this.animationSelectBox.addEventListener("change", this._onChangeCubicModelAnimation);
    this.animationSelectBox.disabled = true;

    const flipRow = SupClient.table.appendRow(tbody, "Flip");
    const flipDiv = document.createElement("div") as HTMLDivElement;
    flipDiv.classList.add("inputs");
    flipRow.valueCell.appendChild(flipDiv);

    const horizontalSpan = document.createElement("span");
    horizontalSpan.style.marginLeft = "5px";
    horizontalSpan.textContent = "H";
    flipDiv.appendChild(horizontalSpan);
    this.horizontalFlipField = SupClient.table.appendBooleanField(flipDiv, config.horizontalFlip);
    this.horizontalFlipField.addEventListener("change", (event: any) => {
      this.editConfig("setProperty", "horizontalFlip", event.target.checked);
    });

    const verticalSpan = document.createElement("span");
    verticalSpan.style.marginLeft = "5px";
    verticalSpan.textContent = "V";
    flipDiv.appendChild(verticalSpan);
    this.verticalFlipField = SupClient.table.appendBooleanField(flipDiv, config.verticalFlip);
    this.verticalFlipField.addEventListener("change", (event: any) => {
      this.editConfig("setProperty", "verticalFlip", event.target.checked);
    });

    const shadowRow = SupClient.table.appendRow(tbody, "Shadow");
    const shadowDiv = document.createElement("div") as HTMLDivElement;
    shadowDiv.classList.add("inputs");
    shadowRow.valueCell.appendChild(shadowDiv);

    const castSpan = document.createElement("span");
    castSpan.style.marginLeft = "5px";
    castSpan.textContent = "Cast";
    shadowDiv.appendChild(castSpan);
    this.castShadowField = SupClient.table.appendBooleanField(shadowDiv, config.castShadow);
    this.castShadowField.addEventListener("change", (event: any) => {
      this.editConfig("setProperty", "castShadow", event.target.checked);
    });
    this.castShadowField.disabled = true;

    const receiveSpan = document.createElement("span");
    receiveSpan.style.marginLeft = "5px";
    receiveSpan.textContent = "Receive";
    shadowDiv.appendChild(receiveSpan);
    this.receiveShadowField = SupClient.table.appendBooleanField(shadowDiv, config.receiveShadow);
    this.receiveShadowField.addEventListener("change", (event: any) => {
      this.editConfig("setProperty", "receiveShadow", event.target.checked);
    });
    this.receiveShadowField.disabled = true;

    const colorRow = SupClient.table.appendRow(tbody, "Color");
    const colorInputs = SupClient.table.appendColorField(colorRow.valueCell, config.color);

    this.colorField = colorInputs.textField;
    this.colorField.addEventListener("change", (event: any) => {
      this.editConfig("setProperty", "color", event.target.value);
    });
    this.colorField.disabled = true;

    this.colorPicker = colorInputs.pickerField;
    this.colorPicker.addEventListener("change", (event: any) => {
      this.editConfig("setProperty", "color", event.target.value.slice(1));
    });
    this.colorPicker.disabled = true;

    const opacityRow = SupClient.table.appendRow(tbody, "Opacity", { checkbox: true } );
    this.overrideOpacityField = opacityRow.checkbox;
    this.overrideOpacityField.checked = config.overrideOpacity;
    this.overrideOpacityField.addEventListener("change", (event: any) => {
      this.editConfig("setProperty", "overrideOpacity", event.target.checked);
    });

    const opacityParent = document.createElement("div");
    opacityParent.style.display = "flex";
    opacityParent.style.alignItems = "center";
    opacityRow.valueCell.appendChild(opacityParent);

    this.transparentField = SupClient.table.appendBooleanField(<any>opacityParent, config.opacity != null);
    this.transparentField.style.width = "50%";
    this.transparentField.style.borderRight = "1px solid #ccc";
    this.transparentField.addEventListener("change", (event: any) => {
      const opacity = (event.target.checked) ? 1 : null;
      this.editConfig("setProperty", "opacity", opacity);
    });
    this.transparentField.disabled = !config.overrideOpacity;

    this.opacityField = SupClient.table.appendNumberField(<any>opacityParent, config.opacity, { min: 0, max: 1 });
    this.opacityField.addEventListener("input", (event: any) => {
      this.editConfig("setProperty", "opacity", parseFloat(event.target.value));
    });
    this.opacityField.step = "0.1";
    this.opacityField.disabled = !config.overrideOpacity;

    const materialRow = SupClient.table.appendRow(tbody, "Material");
    this.materialSelectBox = SupClient.table.appendSelectBox(materialRow.valueCell, { "basic": "Basic", "phong": "Phong", "shader": "Shader" }, config.materialType);
    this.materialSelectBox.addEventListener("change", (event: any) => {
      this.editConfig("setProperty", "materialType", event.target.value);
    })
    this.materialSelectBox.disabled = true;

    const shaderRow = SupClient.table.appendRow(tbody, "Shader");
    const shaderFields = SupClient.table.appendAssetField(shaderRow.valueCell, "");
    this.shaderTextField = shaderFields.textField;
    this.shaderTextField.addEventListener("input", this._onChangeShaderAsset);
    this.shaderTextField.disabled = true;
    this.shaderButtonElt = shaderFields.buttonElt;
    this.shaderButtonElt.addEventListener("click", (event) => {
      SupClient.openEntry(this.shaderAssetId);
    });
    this.shaderButtonElt.disabled = this.shaderAssetId == null;
    this._updateShaderField(config.materialType);*/
  }

  destroy() {
    this.cubicModelFieldSubscriber.destroy();

    if (this.cubicModelAssetId != null) this.projectClient.unsubAsset(this.cubicModelAssetId, this);
  }

  config_setProperty(path: string, value: any) {
    if (this.projectClient.entries == null) return;

    switch (path) {
      case "cubicModelAssetId":
        if (this.cubicModelAssetId != null) {
          this.projectClient.unsubAsset(this.cubicModelAssetId, this);
          this.asset = null;
        }
        this.cubicModelAssetId = value;
        // this.animationSelectBox.disabled = true;

        if (this.cubicModelAssetId != null) this.projectClient.subAsset(this.cubicModelAssetId, "cubicModel", this);
        this.cubicModelFieldSubscriber.onChangeAssetId(this.cubicModelAssetId);
        break;

      /*case "animationId":
        if (!this.animationSelectBox.disabled) this.animationSelectBox.value = (value != null) ? value : "";
        this.animationId = value;
        break;

      case "horizontalFlip":
        this.horizontalFlipField.checked = value;
        break;

      case "verticalFlip":
        this.verticalFlipField.checked = value;
        break;

      case "castShadow":
        this.castShadowField.checked = value;
        break;

      case "receiveShadow":
        this.receiveShadowField.checked = value;
        break;

      case "color":
        this.colorField.value = value;
        this.colorPicker.value = `#${value}`;
        break;

      case "overrideOpacity":
        this.overrideOpacityField.checked = value;
        this.transparentField.disabled = !value;
        this.transparentField.checked = false;
        this.opacityField.value = null;
        this.opacityField.disabled = true;
        break;

      case "opacity":
        this.transparentField.checked = value != null;
        this.opacityField.disabled = value == null;
        this.opacityField.value = value;
        break;

      case "materialType":
        this.materialSelectBox.value = value;
        this._updateShaderField(value);
        break;

      case "shaderAssetId":
        this.shaderAssetId = value;
        this.shaderButtonElt.disabled = this.shaderAssetId == null;
        if (value != null) this.shaderTextField.value = this.projectClient.entries.getPathFromId(value);
        else this.shaderTextField.value = "";
        break;*/
    }
  }

  // Network callbacks
  onAssetReceived(assetId: string, asset: any) {
    if (assetId !== this.cubicModelAssetId) return;
    this.asset = asset;

    /*
    this._clearAnimations();

    for (const animation of this.asset.pub.animations) {
      SupClient.table.appendSelectOption(this.animationSelectBox, animation.id, animation.name);
    }

    this.animationSelectBox.value = (this.animationId != null) ? this.animationId : "";
    this.animationSelectBox.disabled = false;*/
  }

  onAssetEdited(assetId: string, command: string, ...args: any[]) {
    if (assetId !== this.cubicModelAssetId) return;
    if (command.indexOf("Animation") === -1) return;

    /*const animationId = this.animationSelectBox.value;

    this._clearAnimations();

    for (const animation of this.asset.pub.animations) {
      SupClient.table.appendSelectOption(this.animationSelectBox, animation.id, animation.name);
    }

    if (animationId != null && this.asset.animations.byId[animationId] != null) this.animationSelectBox.value = animationId;
    else this.editConfig("setProperty", "animationId", "");*/
  }

  onAssetTrashed() {
    this.asset = null;
    this.clearAnimations();

    // this.animationSelectBox.value = "";
    // this.animationSelectBox.disabled = true;
  }

  // User interface
  private clearAnimations() {
    /*while (true) {
      const child = this.animationSelectBox.children[1];
      if (child == null) break;
      this.animationSelectBox.removeChild(child);
    }*/
  }

  // private updateShaderField(materialType: string) {
    // const shaderRow = this.shaderTextField.parentElement.parentElement.parentElement;
    // if (materialType === "shader") {
    //   if (shaderRow.parentElement == null) this.tbody.appendChild(shaderRow);
    // } else if (shaderRow.parentElement != null) shaderRow.parentElement.removeChild(shaderRow);
  // }

  // private onChangeCubicModelAnimation = (event: any) => {
  //   const animationId = (event.target.value === "") ? null : event.target.value;
  //   this.editConfig("setProperty", "animationId", animationId);
  // };

  // private onChangeShaderAsset = (event: any) => {
  //   if (event.target.value === "") this.editConfig("setProperty", "shaderAssetId", null);
  //   else {
  //     const entry = SupClient.findEntryByPath(this.projectClient.entries.pub, event.target.value);
  //     if (entry != null && entry.type === "shader") this.editConfig("setProperty", "shaderAssetId", entry.id);
  //   }
  // };
}
