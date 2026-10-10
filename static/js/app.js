"use strict";

/*
 Spode NAS frontend

   1. Config and UI texts
   2. State
   3. Small helpers
   4. API layer (all server communication)
   5. Rendering (state -> HTML)
   6. Actions (what happens when the user does something)
   7. Event wiring and start
   


/*  1. Config and UI texts  */

const API_BASE = "";                       // empty = same server that served this page
const STORAGE_KEY = "spode";
const PREVIEW_EXTENSIONS = new Set([".pdf", ".txt"]);

// Every visible string lives here, so translating or rewording is a one-place edit.
const TEXT = {
  root: "Start",
  typeFolder: "Ordner",
  typeImage: "Bild",
  typeDocument: "Dokument",
  typeFile: "Datei",
  download: "Download",
  delete: "Löschen",
  emptyFolder: "Dieser Ordner ist leer. Dateien hochladen oder hierher ziehen.",
  noMatches: "Keine Treffer.",
  pathIsFile: "Dieser Pfad ist eine Datei.",
  unreachable: "Server nicht erreichbar.",
  loginFailed: "Anmeldung fehlgeschlagen. Bitte API-Token prüfen.",
  uploadFailed: "Upload fehlgeschlagen",
  folderPrompt: "Name des neuen Ordners",
  folderNameInvalid: "Ordnernamen dürfen keine Schrägstriche enthalten.",
  downloading: (name) => `Lade ${name} herunter...`,
  deleted: (name) => `${name} gelöscht`,
  folderCreated: (name) => `Ordner ${name} erstellt`,
  uploaded: (count) => (count === 1 ? "1 Datei hochgeladen" : `${count} Dateien hochgeladen`),
  confirmDelete: (item) =>
    `${item.isDir ? "Ordner" : "Datei"} "${item.name}" löschen? Das kann nicht rückgängig gemacht werden.`,
  confirmOverwrite: (name) => `"${name}" existiert bereits. Ersetzen?`,
  serverError: (status) => `Fehler ${status}`,
};


/*  2. State  */

const state = {
  token: "",
  currentPath: "",       // folder shown right now, "" is the root
  items: [],             // everything in the current folder
  visibleItems: [],      // items after filter and sort (what the table shows)
  sortKey: "name",       // "name" or "type"
  sortDirection: 1,      // 1 = ascending, -1 = descending
  previewItem: null,     // item shown in the preview dialog
  previewUrl: null,      // blob URL of that preview
};


/*  3. Small helpers  */

const $ = (selector) => document.querySelector(selector);

function escapeHtml(text) {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(text).replace(/[&<>"']/g, (char) => map[char]);
}

/** "a/b c" -> "a/b%20c" (each segment encoded, slashes kept). */
function encodePath(path) {
  return path.split("/").filter(Boolean).map(encodeURIComponent).join("/");
}

function joinPath(folder, name) {
  return folder ? `${folder}/${name}` : name;
}

let toastTimer;
function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}

function updateProgress(fraction) {
  $("#prog i").style.width = `${Math.round(fraction * 100)}%`;
}

function loadSettings() {
  try {
    state.token = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}").token || "";
  } catch {
    state.token = "";
  }
}

function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: state.token }));
  } catch {
    /* storage can be blocked, the token then only lasts for this page load */
  }
}

function openSettings() {
  $("#sTok").value = state.token;
  $("#dSet").showModal();
}


/*  4. API layer  */

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function toApiError(response) {
  let message = TEXT.serverError(response.status);
  try {
    message = (await response.json()).error || message;
  } catch {
    /* body was not JSON, keep the generic message */
  }
  return new ApiError(response.status, message);
}

/** fetch() with the auth header; throws ApiError for any non-2xx answer. */
async function request(path, options = {}) {
  const headers = new Headers(options.headers);
  if (state.token) headers.set("Authorization", `Bearer ${state.token}`);

  const response = await fetch(API_BASE + path, { ...options, headers });
  if (!response.ok) throw await toApiError(response);
  return response;
}

/** One function per backend route. */
const api = {
  browse: async (path) =>
    (await request("/browse" + (path ? `/${encodePath(path)}` : ""))).json(),
  download: async (path) => (await request(`/download/${encodePath(path)}`)).blob(),
  remove: (path) => request(`/delete/${encodePath(path)}`, { method: "DELETE" }),
  createFolder: (path) => request(`/new_folder/${encodePath(path)}`, { method: "POST" }),
};

/** Upload uses XMLHttpRequest because fetch() cannot report upload progress. */
function sendFile(file, overwrite, onProgress) {
  return new Promise((resolve) => {
    const url =
      API_BASE + `/upload/${encodePath(joinPath(state.currentPath, file.name))}` +
      (overwrite ? "?overwrite=true" : "");
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    if (state.token) xhr.setRequestHeader("Authorization", `Bearer ${state.token}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      let message = "";
      try {
        message = JSON.parse(xhr.responseText).error || "";
      } catch {
        /* no JSON body */
      }
      resolve({ status: xhr.status, message });
    };
    xhr.onerror = () => resolve({ status: 0, message: TEXT.unreachable });

    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}

/** Central error handling: open settings on 401, otherwise show a toast. */
function reportError(error) {
  if (error.status === 401) {
    openSettings();
    showToast(TEXT.loginFailed);
    return;
  }
  if (!(error instanceof ApiError)) console.error(error);
  showToast(error instanceof ApiError ? error.message : TEXT.unreachable);
}


/*  5. Rendering  */

const ICONS = {
  folder:
    '<svg class="ico dir" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v8.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z"/></svg>',
  file:
    '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M6 3h8l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v4h4"/></svg>',
  image:
    '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 18l5-5 4 4 3-3 4 4"/></svg>',
};

/** Turn a raw API entry into the shape the rest of the code uses. */
function toItem(raw, isDir) {
  return {
    name: raw.name,
    path: raw.rel_path,
    isDir,
    type: isDir ? "folder" : raw.file_type,   // folder | image | document | other
    extension: raw.extension || "",
  };
}

function iconFor(item) {
  if (item.type === "folder") return ICONS.folder;
  if (item.type === "image") return ICONS.image;
  return ICONS.file;
}

function typeLabel(item) {
  switch (item.type) {
    case "folder": return TEXT.typeFolder;
    case "image": return TEXT.typeImage;
    case "document": return TEXT.typeDocument;
    default: return item.extension || TEXT.typeFile;
  }
}

/** Folders first, then by the chosen column; numbers inside names sort naturally. */
function compareItems(a, b) {
  if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
  const sortValue = (item) => (state.sortKey === "type" ? item.type : "") + item.name.toLowerCase();
  return state.sortDirection * sortValue(a).localeCompare(sortValue(b), "de", { numeric: true });
}

function getVisibleItems() {
  const query = $("#q").value.trim().toLowerCase();
  return state.items
    .filter((item) => !query || item.name.toLowerCase().includes(query))
    .sort(compareItems);
}

function renderBreadcrumbs() {
  const parts = state.currentPath.split("/").filter(Boolean);
  let html = parts.length
    ? `<button data-path="">${TEXT.root}</button>`
    : `<span class="cur">${TEXT.root}</span>`;

  let path = "";
  parts.forEach((part, index) => {
    path = joinPath(path, part);
    const isLast = index === parts.length - 1;
    html += "<span>/</span>";
    html += isLast
      ? `<span class="cur">${escapeHtml(part)}</span>`
      : `<button data-path="${escapeHtml(path)}">${escapeHtml(part)}</button>`;
  });
  $("#crumbs").innerHTML = html;
}

function renderRow(item, index) {
  const downloadButton = item.isDir
    ? ""
    : `<button data-index="${index}" data-action="download">${TEXT.download}</button>`;

  return `
    <tr>
      <td>
        <div class="name">
          ${iconFor(item)}
          <a data-index="${index}" data-action="open" tabindex="0" role="link">${escapeHtml(item.name)}</a>
        </div>
      </td>
      <td class="hide-s tag">${escapeHtml(typeLabel(item))}</td>
      <td>
        <div class="acts">
          ${downloadButton}
          <button class="del" data-index="${index}" data-action="delete">${TEXT.delete}</button>
        </div>
      </td>
    </tr>`;
}

function render() {
  state.visibleItems = getVisibleItems();
  renderBreadcrumbs();
  $("#rows").innerHTML = state.visibleItems.map(renderRow).join("");

  const empty = $("#empty");
  empty.hidden = state.visibleItems.length > 0;
  empty.textContent = $("#q").value.trim() ? TEXT.noMatches : TEXT.emptyFolder;
}


/* 6. Actions  */

async function loadFolder(path) {
  try {
    const data = await api.browse(path);
    if (data.is_file) {
      showToast(TEXT.pathIsFile);
      return;
    }
    state.currentPath = path;
    state.items = [
      ...data.folders.map((folder) => toItem(folder, true)),
      ...data.files.map((file) => toItem(file, false)),
    ];
    $("#q").value = "";
    render();
  } catch (error) {
    reportError(error);
  }
}

function reloadFolder() {
  return loadFolder(state.currentPath);
}

/** Start a browser download from data we already have in memory. */
function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function downloadItem(item) {
  try {
    showToast(TEXT.downloading(item.name));
    saveBlob(await api.download(item.path), item.name);
  } catch (error) {
    reportError(error);
  }
}

function canPreview(item) {
  return item.type === "image" || PREVIEW_EXTENSIONS.has(item.extension);
}

async function buildPreviewElement(item, blob) {
  if (item.type === "image") {
    const img = document.createElement("img");
    img.src = state.previewUrl;
    img.alt = item.name;
    return img;
  }
  if (item.extension === ".pdf") {
    const frame = document.createElement("iframe");
    frame.src = state.previewUrl;
    frame.title = item.name;
    return frame;
  }
  const pre = document.createElement("pre");
  pre.textContent = await blob.text();
  return pre;
}

function releasePreview() {
  if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
  state.previewUrl = null;
  state.previewItem = null;
  $("#view").replaceChildren();
}

async function showPreview(item) {
  try {
    const blob = await api.download(item.path);
    releasePreview();
    state.previewItem = item;
    state.previewUrl = URL.createObjectURL(blob);

    $("#vTitle").textContent = item.name;
    $("#view").replaceChildren(await buildPreviewElement(item, blob));
    $("#dView").showModal();
  } catch (error) {
    reportError(error);
  }
}

/** Click on a name: folders open, previewable files preview, others download. */
function openItem(item) {
  if (item.isDir) return loadFolder(item.path);
  return canPreview(item) ? showPreview(item) : downloadItem(item);
}

async function deleteItem(item) {
  if (!confirm(TEXT.confirmDelete(item))) return;
  try {
    await api.remove(item.path);
    showToast(TEXT.deleted(item.name));
    await reloadFolder();
  } catch (error) {
    reportError(error);
  }
}

async function createFolder() {
  const name = (prompt(TEXT.folderPrompt) || "").trim();
  if (!name) return;
  if (/[\/\\]/.test(name)) {
    showToast(TEXT.folderNameInvalid);
    return;
  }
  try {
    await api.createFolder(joinPath(state.currentPath, name));
    showToast(TEXT.folderCreated(name));
    await reloadFolder();
  } catch (error) {
    reportError(error);
  }
}

/** Upload one file; on 409 ask the user whether to replace it. */
async function uploadSingle(file, onProgress) {
  let result = await sendFile(file, false, onProgress);
  if (result.status === 409) {
    if (!confirm(TEXT.confirmOverwrite(file.name))) return { ...result, skipped: true };
    result = await sendFile(file, true, onProgress);
  }
  return result;
}

async function uploadFiles(files) {
  let uploadedCount = 0;

  for (const [index, file] of files.entries()) {
    const onProgress = (fraction) => updateProgress((index + fraction) / files.length);
    const result = await uploadSingle(file, onProgress);

    if (result.status === 201) {
      uploadedCount++;
    } else if (result.status === 401) {
      reportError({ status: 401 });
      break;
    } else if (!result.skipped) {
      showToast(`${file.name}: ${result.message || TEXT.uploadFailed}`);
    }
  }

  updateProgress(0);
  if (uploadedCount) showToast(TEXT.uploaded(uploadedCount));
  await reloadFolder();
}

function setSort(key) {
  state.sortDirection = state.sortKey === key ? -state.sortDirection : 1;
  state.sortKey = key;
  render();
}

function saveSettingsAndReload() {
  state.token = $("#sTok").value.trim();
  saveSettings();
  $("#dSet").close();
  loadFolder("");
}


/* ---------- 7. Event wiring and start ---------- */

// Buttons inside table rows are looked up by their data-action attribute.
const rowActions = {
  open: openItem,
  download: downloadItem,
  delete: deleteItem,
};

function bindTableEvents() {
  $("#rows").addEventListener("click", (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const item = state.visibleItems[Number(target.dataset.index)];
    rowActions[target.dataset.action](item);
  });

  // Names are links without href, so Enter has to be wired by hand.
  $("#rows").addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target.dataset.action === "open") event.target.click();
  });

  document.querySelectorAll("th[data-k]").forEach((header) => {
    header.addEventListener("click", () => setSort(header.dataset.k));
  });
}

function bindToolbarEvents() {
  $("#crumbs").addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (button) loadFolder(button.dataset.path);
  });
  $("#q").addEventListener("input", render);
  $("#bNew").addEventListener("click", createFolder);
  $("#bUp").addEventListener("click", () => $("#file").click());
  $("#file").addEventListener("change", (event) => {
    const files = [...event.target.files];
    event.target.value = "";               // allows picking the same file again
    if (files.length) uploadFiles(files);
  });
}

function bindDropZone() {
  const zone = $("#drop");
  for (const name of ["dragenter", "dragover"]) {
    zone.addEventListener(name, (event) => {
      event.preventDefault();
      zone.classList.add("drop");
    });
  }
  for (const name of ["dragleave", "drop"]) {
    zone.addEventListener(name, (event) => {
      event.preventDefault();
      zone.classList.remove("drop");
    });
  }
  zone.addEventListener("drop", (event) => {
    const files = [...event.dataTransfer.files];
    if (files.length) uploadFiles(files);
  });
}

function bindDialogEvents() {
  $("#bSet").addEventListener("click", openSettings);
  $("#sCancel").addEventListener("click", () => $("#dSet").close());
  $("#sSave").addEventListener("click", saveSettingsAndReload);

  $("#vClose").addEventListener("click", () => $("#dView").close());
  $("#vDl").addEventListener("click", () => state.previewItem && downloadItem(state.previewItem));
  $("#dView").addEventListener("close", releasePreview);
}

function init() {
  loadSettings();
  bindTableEvents();
  bindToolbarEvents();
  bindDropZone();
  bindDialogEvents();
  loadFolder("");
}

init();