import FontAsset from "../data/FontAsset";

export default class TextRendererEditor {
  tbody: HTMLTableSectionElement;
  projectClient: SupClient.ProjectClient;
  editConfig: any;

  fields: {[key: string]: any} = {};
  fontButtonElt: HTMLButtonElement;
  colorCheckbox: HTMLInputElement;
  sizeRow: HTMLTableRowElement;
  sizeCheckbox: HTMLInputElement;

  fontAssetId: string;
  fontAsset: FontAsset;
  color: string;
  size: number;

  fontFieldSubscriber: SupClient.table.AssetFieldSubscriber;

  overrideOpacityField: HTMLInputElement;
  transparentField: HTMLSelectElement;
  opacityFields: { sliderField: HTMLInputElement; numberField: HTMLInputElement; };

  pendingModification = 0;
  overrideOpacity: boolean;
  opacity: number;

  constructor(tbody: HTMLTableSectionElement, config: any, projectClient: SupClient.ProjectClient, editConfig: any) {
    this.tbody = tbody;
    this.editConfig = editConfig;
    this.projectClient = projectClient;

    this.fontAssetId = config.fontAssetId;
    this.color = config.color;
    this.size = config.size;

    this.overrideOpacity = config.overrideOpacity;
    this.opacity = config.opacity;

    const fontRow = SupClient.table.appendRow(tbody, SupClient.i18n.t("componentEditors:TextRenderer.font"));
    this.fontFieldSubscriber = SupClient.table.appendAssetField(fontRow.valueCell, this.fontAssetId, "font", projectClient);
    this.fontFieldSubscriber.on("select", (assetId: string) => {
      this.editConfig("setProperty", "fontAssetId", assetId);
    });

    const textRow = SupClient.table.appendRow(tbody, SupClient.i18n.t("componentEditors:TextRenderer.text"));
    this.fields["text"] = SupClient.table.appendTextAreaField(textRow.valueCell, config.text);
    this.fields["text"].addEventListener("input", (event: any) => {
      this.pendingModification += 1;
      this.editConfig("setProperty", "text", event.target.value, (err: string) => {
        this.pendingModification -= 1;
        if (err != null) { new SupClient.Dialogs.InfoDialog(err); return; }
      });
    });

    const alignmentRow = SupClient.table.appendRow(tbody, SupClient.i18n.t("componentEditors:TextRenderer.align.title"));
    const alignmentOptions: { [key: string]: string } = {
      "left": SupClient.i18n.t("componentEditors:TextRenderer.align.left"),
      "center": SupClient.i18n.t("componentEditors:TextRenderer.align.center"),
      "right": SupClient.i18n.t("componentEditors:TextRenderer.align.right")
    };
    this.fields["alignment"] = SupClient.table.appendSelectBox(alignmentRow.valueCell, alignmentOptions, config.alignment);
    this.fields["alignment"].addEventListener("change", (event: any) => { this.editConfig("setProperty", "alignment", event.target.value); });

    const verticalAlignmentRow = SupClient.table.appendRow(tbody, SupClient.i18n.t("componentEditors:TextRenderer.verticalAlign.title"));
    const verticalAlignmentOptions: { [key: string]: string } = {
      "top": SupClient.i18n.t("componentEditors:TextRenderer.verticalAlign.top"),
      "center": SupClient.i18n.t("componentEditors:TextRenderer.verticalAlign.center"),
      "bottom": SupClient.i18n.t("componentEditors:TextRenderer.verticalAlign.bottom")
    };
    this.fields["verticalAlignment"] = SupClient.table.appendSelectBox(verticalAlignmentRow.valueCell, verticalAlignmentOptions, config.verticalAlignment);
    this.fields["verticalAlignment"].addEventListener("change", (event: any) => { this.editConfig("setProperty", "verticalAlignment", event.target.value); });

    const colorRow = SupClient.table.appendRow(tbody, SupClient.i18n.t("componentEditors:TextRenderer.color"), { checkbox: true });
    this.colorCheckbox = colorRow.checkbox;
    this.colorCheckbox.addEventListener("change", (event) => {
      const color = this.colorCheckbox.checked ? (this.fontAsset != null ? this.fontAsset.pub.color : "ffffff") : null;
      this.editConfig("setProperty", "color", color);
    });

    const colorField = this.fields["color"] = SupClient.table.appendColorField(colorRow.valueCell, null);
    colorField.addListener("change", (color: string) => {
      this.editConfig("setProperty", "color", color);
    });
    this.updateColorField();

    const sizeRow = SupClient.table.appendRow(tbody, SupClient.i18n.t("componentEditors:TextRenderer.size"), { checkbox: true });
    this.sizeRow = sizeRow.row;
    this.sizeCheckbox = sizeRow.checkbox;
    this.sizeCheckbox.addEventListener("change", (event) => {
      const size = this.sizeCheckbox.checked ? (this.fontAsset != null ? this.fontAsset.pub.size : 16) : null;
      this.editConfig("setProperty", "size", size);
    });

    this.fields["size"] = SupClient.table.appendNumberField(sizeRow.valueCell, "", { min: 0 });
    this.fields["size"].addEventListener("input", (event: any) => {
      if (event.target.value === "") return;
      this.editConfig("setProperty", "size", parseInt(event.target.value, 10));
    });
    this.updateSizeField();

    const opacityRow = SupClient.table.appendRow(tbody, SupClient.i18n.t("componentEditors:TextRenderer.opacity"), { checkbox: true } );
    this.overrideOpacityField = opacityRow.checkbox;
    this.overrideOpacityField.addEventListener("change", (event: any) => {
      this.editConfig("setProperty", "opacity", this.fontAsset != null ? this.fontAsset.pub.opacity : null);
      this.editConfig("setProperty", "overrideOpacity", event.target.checked);
    });

    const opacityParent = document.createElement("div");
    opacityRow.valueCell.appendChild(opacityParent);

    const transparentOptions: {[key: string]: string} = {
      empty: "",
      opaque: SupClient.i18n.t("componentEditors:TextRenderer.opaque"),
      transparent: SupClient.i18n.t("componentEditors:TextRenderer.transparent"),
    };
    this.transparentField = SupClient.table.appendSelectBox(opacityParent, transparentOptions);
    (this.transparentField.children[0] as HTMLOptionElement).hidden = true;
    this.transparentField.addEventListener("change", (event) => {
      const opacity = this.transparentField.value === "transparent" ? 1 : null;
      this.editConfig("setProperty", "opacity", opacity);
    });

    this.opacityFields = SupClient.table.appendSliderField(opacityParent, "", { min: 0, max: 1, step: 0.1, sliderStep: 0.01 });
    this.opacityFields.numberField.parentElement.addEventListener("input", (event: any) => {
      this.editConfig("setProperty", "opacity", parseFloat(event.target.value));
    });
    this.updateOpacityField();
  }

  destroy() { this.fontFieldSubscriber.destroy(); }

  config_setProperty(path: string, value: any) {
    if (path === "fontAssetId") {
      if (this.fontAssetId != null) {
        this.projectClient.unsubAsset(this.fontAssetId, this);
        this.fontAsset = null;
      }
      this.fontAssetId = value;
      this.updateColorField();

      if (this.fontAssetId != null) this.projectClient.subAsset(this.fontAssetId, "font", this);
      this.fontFieldSubscriber.onChangeAssetId(this.fontAssetId);

    } else if (path === "color") {
      this.color = value;
      this.updateColorField();

    } else if (path === "size") {
      this.size = value;
      this.updateSizeField();

    } else if (path === "text") {
      if (this.pendingModification === 0) this.fields["text"].value = value;

    } else if (path === "overrideOpacity") {
      this.overrideOpacity = value;
      this.updateOpacityField();

    } else if (path === "opacity") {
      this.opacity = value;
      this.updateOpacityField();

    } else this.fields[path].value = value;
  }

  private updateColorField() {
    const color = this.color != null ? this.color : (this.fontAsset != null ? this.fontAsset.pub.color : null);
    this.fields["color"].setValue(color);

    this.colorCheckbox.checked = this.color != null;
    this.fields["color"].setDisabled(this.color == null);
  }

  private updateSizeField() {
    if (this.fontAsset != null && this.fontAsset.pub.isBitmap) {
      this.sizeRow.hidden = true;
      return;
    } else this.sizeRow.hidden = false;

    const size = this.size != null ? this.size : (this.fontAsset != null ? this.fontAsset.pub.size : "");
    this.fields["size"].value = size;

    this.sizeCheckbox.checked = this.size != null;
    this.fields["size"].disabled = this.size == null;
  }

  private updateOpacityField() {
    this.overrideOpacityField.checked = this.overrideOpacity;
    this.transparentField.disabled = !this.overrideOpacity;
    this.opacityFields.sliderField.disabled = !this.overrideOpacity;
    this.opacityFields.numberField.disabled = !this.overrideOpacity;

    if (!this.overrideOpacity && this.fontAsset == null) {
      this.transparentField.value = "empty";
      this.opacityFields.numberField.parentElement.hidden = true;
    } else {
      const opacity = this.overrideOpacity ? this.opacity : this.fontAsset.pub.opacity;
      if (opacity != null) {
        this.transparentField.value = "transparent";
        this.opacityFields.numberField.parentElement.hidden = false;
        this.opacityFields.sliderField.value = opacity.toString();
        this.opacityFields.numberField.value = opacity.toString();
      } else {
        this.transparentField.value = "opaque";
        this.opacityFields.numberField.parentElement.hidden = true;
      }
    }
  }

  // Network callbacks
  onAssetReceived(assetId: string, asset: FontAsset) {
    this.fontAsset = asset;

    this.updateColorField();
    this.updateSizeField();
    this.updateOpacityField();
  }
  onAssetEdited(assetId: string, command: string, ...args: any[]) {
    if (command !== "setProperty") return;

    if (command === "setProperty" && args[0] === "color") this.updateColorField();
    if (command === "setProperty" && (args[0] === "size" || args[0] === "isBitmap")) this.updateSizeField();
    if (command === "setProperty" && args[0] === "opacity") this.updateOpacityField();

  }
  onAssetTrashed(assetId: string) {
    this.fontAsset = null;

    this.updateColorField();
    this.updateSizeField();
    this.updateOpacityField();
  }
}
