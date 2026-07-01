/* global FFmpeg */
const { createFFmpeg, fetchFile } = FFmpeg;

const FONT_URL =
  "https://cdn.jsdelivr.net/gh/google/fonts@main/apache/roboto/static/Roboto-Regular.ttf";

const fileInput = document.getElementById("file-input");
const uploadText = document.getElementById("upload-text");
const editor = document.getElementById("editor");
const video = document.getElementById("preview");
const videoWrap = document.getElementById("video-wrap");
const cropBox = document.getElementById("crop-box");
const resizeHandle = document.getElementById("resize-handle");
const scrubber = document.getElementById("scrubber");
const currentTimeEl = document.getElementById("current-time");
const totalTimeEl = document.getElementById("total-time");

const trimStartInput = document.getElementById("trim-start");
const trimEndInput = document.getElementById("trim-end");
const setStartBtn = document.getElementById("set-start");
const setEndBtn = document.getElementById("set-end");

const cropEnable = document.getElementById("crop-enable");
const cropXInput = document.getElementById("crop-x");
const cropYInput = document.getElementById("crop-y");
const cropWInput = document.getElementById("crop-w");
const cropHInput = document.getElementById("crop-h");

const captionList = document.getElementById("caption-list");
const addCaptionBtn = document.getElementById("add-caption");
const captionTemplate = document.getElementById("caption-template");

const exportBtn = document.getElementById("export-btn");
const progressWrap = document.getElementById("progress-wrap");
const progressFill = document.getElementById("progress-fill");
const progressLabel = document.getElementById("progress-label");
const downloadLink = document.getElementById("download-link");

let currentFile = null;
let nativeWidth = 0;
let nativeHeight = 0;
let ffmpeg = null;
let fontLoaded = false;

function formatTime(seconds) {
  if (!isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ---------- File loading ----------

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;
  currentFile = file;
  uploadText.textContent = file.name;

  const url = URL.createObjectURL(file);
  video.src = url;
  editor.classList.remove("hidden");
  downloadLink.classList.add("hidden");
  progressWrap.classList.add("hidden");
});

video.addEventListener("loadedmetadata", () => {
  nativeWidth = video.videoWidth;
  nativeHeight = video.videoHeight;

  trimStartInput.value = 0;
  trimEndInput.value = video.duration.toFixed(1);
  scrubber.max = video.duration;
  totalTimeEl.textContent = formatTime(video.duration);

  cropXInput.value = 0;
  cropYInput.value = 0;
  cropWInput.value = nativeWidth;
  cropHInput.value = nativeHeight;

  syncCropBoxFromInputs();
});

video.addEventListener("timeupdate", () => {
  scrubber.value = video.currentTime;
  currentTimeEl.textContent = formatTime(video.currentTime);
});

scrubber.addEventListener("input", () => {
  video.currentTime = parseFloat(scrubber.value);
});

setStartBtn.addEventListener("click", () => {
  trimStartInput.value = video.currentTime.toFixed(2);
});
setEndBtn.addEventListener("click", () => {
  trimEndInput.value = video.currentTime.toFixed(2);
});

// ---------- Crop box ----------

function videoScale() {
  const rect = video.getBoundingClientRect();
  return {
    scale: nativeWidth ? rect.width / nativeWidth : 1,
    rect,
  };
}

function syncCropBoxFromInputs() {
  if (!nativeWidth) return;
  const { scale } = videoScale();
  cropBox.style.left = `${cropXInput.value * scale}px`;
  cropBox.style.top = `${cropYInput.value * scale}px`;
  cropBox.style.width = `${cropWInput.value * scale}px`;
  cropBox.style.height = `${cropHInput.value * scale}px`;
}

function syncInputsFromCropBox() {
  const { scale } = videoScale();
  cropXInput.value = Math.round(parseFloat(cropBox.style.left) / scale);
  cropYInput.value = Math.round(parseFloat(cropBox.style.top) / scale);
  cropWInput.value = Math.round(parseFloat(cropBox.style.width) / scale);
  cropHInput.value = Math.round(parseFloat(cropBox.style.height) / scale);
}

cropEnable.addEventListener("change", () => {
  cropBox.classList.toggle("hidden", !cropEnable.checked);
  if (cropEnable.checked) syncCropBoxFromInputs();
});

[cropXInput, cropYInput, cropWInput, cropHInput].forEach((el) => {
  el.addEventListener("input", syncCropBoxFromInputs);
});

window.addEventListener("resize", () => {
  if (cropEnable.checked) syncCropBoxFromInputs();
});

// Dragging the crop box around
let dragState = null;

cropBox.addEventListener("pointerdown", (e) => {
  if (e.target === resizeHandle) return;
  dragState = {
    mode: "move",
    startX: e.clientX,
    startY: e.clientY,
    origLeft: parseFloat(cropBox.style.left) || 0,
    origTop: parseFloat(cropBox.style.top) || 0,
  };
  cropBox.setPointerCapture(e.pointerId);
});

resizeHandle.addEventListener("pointerdown", (e) => {
  e.stopPropagation();
  dragState = {
    mode: "resize",
    startX: e.clientX,
    startY: e.clientY,
    origW: parseFloat(cropBox.style.width) || 0,
    origH: parseFloat(cropBox.style.height) || 0,
  };
  resizeHandle.setPointerCapture(e.pointerId);
});

window.addEventListener("pointermove", (e) => {
  if (!dragState) return;
  const dx = e.clientX - dragState.startX;
  const dy = e.clientY - dragState.startY;
  const { rect } = videoScale();

  if (dragState.mode === "move") {
    let left = dragState.origLeft + dx;
    let top = dragState.origTop + dy;
    left = Math.max(0, Math.min(left, rect.width - parseFloat(cropBox.style.width)));
    top = Math.max(0, Math.min(top, rect.height - parseFloat(cropBox.style.height)));
    cropBox.style.left = `${left}px`;
    cropBox.style.top = `${top}px`;
  } else if (dragState.mode === "resize") {
    let w = Math.max(20, dragState.origW + dx);
    let h = Math.max(20, dragState.origH + dy);
    w = Math.min(w, rect.width - parseFloat(cropBox.style.left));
    h = Math.min(h, rect.height - parseFloat(cropBox.style.top));
    cropBox.style.width = `${w}px`;
    cropBox.style.height = `${h}px`;
  }
  syncInputsFromCropBox();
});

window.addEventListener("pointerup", () => {
  dragState = null;
});

// ---------- Captions ----------

function addCaptionRow(defaults = {}) {
  const node = captionTemplate.content.firstElementChild.cloneNode(true);
  const textEl = node.querySelector(".cap-text");
  const startEl = node.querySelector(".cap-start");
  const endEl = node.querySelector(".cap-end");
  const sizeEl = node.querySelector(".cap-size");
  const colorEl = node.querySelector(".cap-color");
  const posEl = node.querySelector(".cap-pos");
  const removeBtn = node.querySelector(".remove-caption");

  textEl.value = defaults.text || "";
  startEl.value = defaults.start ?? 0;
  endEl.value = defaults.end ?? (video.duration ? video.duration.toFixed(1) : 5);
  sizeEl.value = defaults.size || 32;
  colorEl.value = defaults.color || "#ffffff";
  posEl.value = defaults.position || "bottom";

  removeBtn.addEventListener("click", () => node.remove());

  captionList.appendChild(node);
}

addCaptionBtn.addEventListener("click", () => addCaptionRow());

function collectCaptions() {
  return Array.from(captionList.querySelectorAll(".caption-item"))
    .map((node) => ({
      text: node.querySelector(".cap-text").value.trim(),
      start: parseFloat(node.querySelector(".cap-start").value) || 0,
      end: parseFloat(node.querySelector(".cap-end").value) || 0,
      size: parseInt(node.querySelector(".cap-size").value, 10) || 32,
      color: node.querySelector(".cap-color").value,
      position: node.querySelector(".cap-pos").value,
    }))
    .filter((c) => c.text.length > 0);
}

// ---------- Export ----------

function escapeDrawtext(str) {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "’")
    .replace(/%/g, "\\%");
}

function hexToFFColor(hex) {
  return hex.replace("#", "0x");
}

function buildFilterChain(captions, cropEnabled, crop) {
  const parts = [];
  let lastLabel = "0:v";
  let stageIndex = 0;

  if (cropEnabled) {
    const outLabel = `s${stageIndex++}`;
    parts.push(
      `[${lastLabel}]crop=${Math.round(crop.w)}:${Math.round(crop.h)}:${Math.round(
        crop.x
      )}:${Math.round(crop.y)}[${outLabel}]`
    );
    lastLabel = outLabel;
  }

  captions.forEach((cap) => {
    const outLabel = `s${stageIndex++}`;
    const text = escapeDrawtext(cap.text);
    const color = hexToFFColor(cap.color);
    let yExpr;
    if (cap.position === "top") yExpr = "h*0.08";
    else if (cap.position === "middle") yExpr = "(h-text_h)/2";
    else yExpr = "h-text_h-(h*0.08)";

    parts.push(
      `[${lastLabel}]drawtext=fontfile=font.ttf:text='${text}':fontsize=${cap.size}:fontcolor=${color}:` +
        `x=(w-text_w)/2:y=${yExpr}:enable='between(t,${cap.start},${cap.end})'[${outLabel}]`
    );
    lastLabel = outLabel;
  });

  return { filterStr: parts.join(";"), finalLabel: lastLabel, used: parts.length > 0 };
}

exportBtn.addEventListener("click", async () => {
  if (!currentFile) return;

  const start = parseFloat(trimStartInput.value) || 0;
  const end = parseFloat(trimEndInput.value) || video.duration;
  const captions = collectCaptions();
  const cropOn = cropEnable.checked;
  const crop = {
    x: parseFloat(cropXInput.value) || 0,
    y: parseFloat(cropYInput.value) || 0,
    w: parseFloat(cropWInput.value) || nativeWidth,
    h: parseFloat(cropHInput.value) || nativeHeight,
  };

  exportBtn.disabled = true;
  progressWrap.classList.remove("hidden");
  downloadLink.classList.add("hidden");
  progressFill.style.width = "0%";
  progressLabel.textContent = "Loading ffmpeg…";

  try {
    if (!ffmpeg) {
      ffmpeg = createFFmpeg({
        log: false,
        corePath: "https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js",
      });
      ffmpeg.setProgress(({ ratio }) => {
        const pct = Math.max(0, Math.min(100, Math.round(ratio * 100)));
        progressFill.style.width = `${pct}%`;
        progressLabel.textContent = `Processing… ${pct}%`;
      });
    }
    if (!ffmpeg.isLoaded()) {
      await ffmpeg.load();
    }

    if (captions.length > 0 && !fontLoaded) {
      progressLabel.textContent = "Loading font…";
      const fontData = await fetchFile(FONT_URL);
      ffmpeg.FS("writeFile", "font.ttf", fontData);
      fontLoaded = true;
    }

    const ext = (currentFile.name.split(".").pop() || "mp4").toLowerCase();
    const inputName = `input.${ext}`;
    progressLabel.textContent = "Reading file…";
    ffmpeg.FS("writeFile", inputName, await fetchFile(currentFile));

    const { filterStr, finalLabel, used } = buildFilterChain(captions, cropOn, crop);

    const args = ["-i", inputName, "-ss", String(start), "-to", String(end)];

    if (used) {
      args.push("-filter_complex", filterStr, "-map", `[${finalLabel}]`, "-map", "0:a?");
    }

    args.push(
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-crf",
      "23",
      "-c:a",
      "aac",
      "-movflags",
      "+faststart",
      "-y",
      "output.mp4"
    );

    progressLabel.textContent = "Processing… 0%";
    await ffmpeg.run(...args);

    const data = ffmpeg.FS("readFile", "output.mp4");
    const blob = new Blob([data.buffer], { type: "video/mp4" });
    const url = URL.createObjectURL(blob);

    downloadLink.href = url;
    downloadLink.classList.remove("hidden");
    progressLabel.textContent = "Done";
    progressFill.style.width = "100%";

    // clean up ffmpeg FS for next run
    try {
      ffmpeg.FS("unlink", inputName);
      ffmpeg.FS("unlink", "output.mp4");
    } catch (e) {
      /* ignore */
    }
  } catch (err) {
    console.error(err);
    progressLabel.textContent = "Something went wrong — check console for details.";
  } finally {
    exportBtn.disabled = false;
  }
});
