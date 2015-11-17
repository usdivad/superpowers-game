/// <reference path="../../../../typings/tsd.d.ts" />
/// <reference path="../../../../typings/github-electron/github-electron-renderer.d.ts" />
/// <reference path="../../SupRuntime/SupRuntime.d.ts" />
/// <reference path="../../../../SupCore/SupCore.d.ts" />

import * as async from "async";
import * as querystring from "querystring";

SupCore.system = new SupCore.System("");

// In app, open links in a browser window
let playerWindow: GitHubElectron.BrowserWindow;
if ((<any>window).process) {
  let nodeRequire = require;
  playerWindow = nodeRequire("remote").getCurrentWindow();

  document.body.addEventListener("click", (event: any) => {
    if (event.target.tagName !== "A") return;
    event.preventDefault();
    nodeRequire("shell").openExternal(event.target.href);
  });
}
let qs = querystring.parse(window.location.search.slice(1));

document.body.addEventListener("keydown", (event) => {
  if (event.keyCode === (<any>window)["KeyEvent"].DOM_VK_F12) {
    if (qs.project != null && playerWindow != null) playerWindow.toggleDevTools();
  }
});

// Prevent keypress events from leaking out to a parent window
// They might trigger scrolling for instance
document.body.addEventListener("keypress", (event) => { event.preventDefault(); });

let progressBar = <HTMLProgressElement>document.querySelector("progress");
let loadingElt = document.getElementById("loading");
let canvas = <HTMLCanvasElement>document.querySelector("canvas");

if (qs.debug != null && playerWindow != null) playerWindow.openDevTools();

let player: SupRuntime.Player;

let onLoadProgress = (value: number, max: number) => {
  progressBar.value = value;
  progressBar.max = max;
}
let onLoaded = (err: Error) => {
  if (err != null) {
    console.error(err);

    let aElt = <HTMLAnchorElement>loadingElt.querySelector("a");
    aElt.parentElement.removeChild(aElt);

    let errorElt = document.createElement("div");
    errorElt.className = "error";
    errorElt.textContent = err.message;
    loadingElt.appendChild(errorElt);
    return;
  }

  setTimeout(() => {
    loadingElt.classList.remove("start");
    loadingElt.classList.add("end");

    setTimeout(() => {
      loadingElt.parentElement.removeChild(loadingElt);

      player.run();
      return
    }, (qs.project == null) ? 500 : 0);
  }, (qs.project == null) ? 500 : 0);
}

// Load plugins
window.fetch("plugins.json").then((response) => response.json()).then((pluginsInfo: SupCore.PluginsInfo) => {
  async.each(pluginsInfo.list, (pluginName, pluginCallback) => {
    async.series([

      (cb) => {
        let apiScript = document.createElement("script");
        apiScript.src = `plugins/${pluginName}/api.js`;
        apiScript.addEventListener("load", () => cb(null, null));
        apiScript.addEventListener("error", (err) => cb(null, null));
        document.body.appendChild(apiScript);
      },

      (cb) => {
        let componentsScript = document.createElement("script");
        componentsScript.src = `plugins/${pluginName}/components.js`;
        componentsScript.addEventListener("load", () => cb(null, null));
        componentsScript.addEventListener("error", () => cb(null, null));
        document.body.appendChild(componentsScript);
      },

      (cb) => {
        let runtimeScript = document.createElement("script");
        runtimeScript.src = `plugins/${pluginName}/runtime.js`;
        runtimeScript.addEventListener("load", () => cb(null, null));
        runtimeScript.addEventListener("error", () => cb(null, null));
        document.body.appendChild(runtimeScript);
      }

    ], pluginCallback);
  }, (err) => {
    if (err != null) console.log(err);
    // Load game
    let buildPath = (qs.project != null) ? `/builds/${qs.project}/${qs.build}/` : "/";
    player = new SupRuntime.Player(canvas, buildPath, { debug: qs.debug != null });
    player.load(onLoadProgress, onLoaded);
  });
});

loadingElt.classList.add("start");
