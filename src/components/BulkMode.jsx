import { useState, useRef, useCallback, useEffect } from "react";
import { convertToPattern, generateColoringPage, generatePaintByNumbers, generateSVGTrace } from "../utils/patternEngine";
import { generateCraftPDFBlob, downloadCraftPDF, generateColoringPagePDF, generatePaintByNumbersPDF } from "../utils/craftPdfGenerator";
import JSZip from "jszip";
import "./BulkMode.css";

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function BulkMode({ craft }) {
  const [files, setFiles] = useState([]);
  const [settings, setSettings] = useState({
    gridWidth: craft.defaults.gridWidth,
    maxColors: craft.defaults.maxColors,
  });
  const [results, setResults] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const dropRef = useRef(null);

  useEffect(() => {
    setSettings({ gridWidth: craft.defaults.gridWidth, maxColors: craft.defaults.maxColors });
    setResults([]);
  }, [craft]);

  const addFiles = useCallback((newFiles) => {
    const imageFiles = Array.from(newFiles).filter((f) => f.type.startsWith("image/"));
    setFiles((prev) => [...prev, ...imageFiles]);
    setResults([]);
  }, []);

  const removeFile = (idx) => { setFiles((prev) => prev.filter((_, i) => i !== idx)); setResults([]); };
  const clearAll = () => { setFiles([]); setResults([]); };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    dropRef.current?.classList.remove("drag-over");
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const processAll = async () => {
    setProcessing(true);
    setProgress({ current: 0, total: files.length });
    const newResults = [];
    for (let i = 0; i < files.length; i++) {
      setProgress({ current: i + 1, total: files.length });
      const file = files[i];
      const name = file.name.replace(/\.[^.]+$/, "");
      try {
        const dataUrl = await readFile(file);
        const img = await loadImage(dataUrl);
        if (craft.id === "coloringPage") {
          const canvas = generateColoringPage(img, settings.gridWidth);
          newResults.push({ name, status: "done", specialType: "coloring", canvas });
        } else if (craft.id === "svgCut") {
          const svg = generateSVGTrace(img, settings.gridWidth);
          newResults.push({ name, status: "done", specialType: "svg", svg });
        } else if (craft.id === "paintByNumbers") {
          const pbn = generatePaintByNumbers(img, settings.gridWidth, settings.maxColors);
          newResults.push({ name, status: "done", specialType: "pbn", pbn });
        } else {
          const pattern = convertToPattern(img, {
            gridWidth: settings.gridWidth,
            maxColors: settings.maxColors,
            palette: craft.palette,
          });
          newResults.push({ name, status: "done", pattern });
        }
      } catch (err) {
        newResults.push({ name, status: "error", error: err.message });
      }
      setResults([...newResults]);
    }
    setProcessing(false);
  };

  const downloadSingle = (r) => {
    const safeName = r.name.replace(/[^a-zA-Z0-9]/g, "_");
    if (r.pattern) {
      downloadCraftPDF(r.pattern, craft, r.name);
    } else if (r.specialType === "coloring") {
      generateColoringPagePDF(r.canvas, r.name).save(`${safeName}.pdf`);
    } else if (r.specialType === "pbn") {
      generatePaintByNumbersPDF(r.pbn, r.name).save(`${safeName}.pdf`);
    } else if (r.specialType === "svg") {
      const blob = new Blob([r.svg], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${safeName}.svg`; a.click();
      URL.revokeObjectURL(url);
    }
  };

  const downloadAllZip = async () => {
    const zip = new JSZip();
    for (const r of results) {
      if (r.status !== "done") continue;
      const safeName = r.name.replace(/[^a-zA-Z0-9]/g, "_");
      if (r.pattern) {
        zip.file(`${safeName}.pdf`, generateCraftPDFBlob(r.pattern, craft, r.name));
      } else if (r.specialType === "coloring") {
        zip.file(`${safeName}.pdf`, generateColoringPagePDF(r.canvas, r.name).output("blob"));
      } else if (r.specialType === "pbn") {
        zip.file(`${safeName}.pdf`, generatePaintByNumbersPDF(r.pbn, r.name).output("blob"));
      } else if (r.specialType === "svg") {
        zip.file(`${safeName}.svg`, r.svg);
      }
    }
    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement("a"); a.href = url; a.download = `${craft.zipName}.zip`; a.click();
    URL.revokeObjectURL(url);
  };

  const doneCount = results.filter((r) => r.status === "done").length;
  const unit = craft.unitLabel || "units";

  return (
    <div className="bulk-mode">
      <div
        ref={dropRef}
        className="bulk-drop"
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); dropRef.current?.classList.add("drag-over"); }}
        onDragLeave={() => dropRef.current?.classList.remove("drag-over")}
        onClick={() => document.getElementById("bulk-input").click()}
      >
        <input id="bulk-input" type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <p className="bulk-drop-title">Drop multiple images or click to browse</p>
        <p className="bulk-drop-sub">Each image becomes its own {craft.name} {craft.outputFormat === "svg" ? "SVG" : "PDF"}</p>
      </div>

      {files.length > 0 && (
        <>
          <div className="bulk-panel">
            <div className="bulk-panel-header">
              <h3>{files.length} image{files.length !== 1 ? "s" : ""} selected</h3>
              <button className="btn-ghost" onClick={clearAll}>Clear All</button>
            </div>
            <div className="file-list">
              {files.map((f, i) => (
                <div key={i} className="file-row">
                  <span className="file-row-name">{f.name}</span>
                  <span className="file-row-size">{(f.size / 1024).toFixed(0)} KB</span>
                  <button className="file-row-remove" onClick={() => removeFile(i)} title="Remove">x</button>
                </div>
              ))}
            </div>
          </div>
          <div className="bulk-panel">
            <h3 className="bulk-settings-title">Settings (applied to all)</h3>
            <div className="bulk-controls">
              <label className="control">
                <span className="control-label">Width ({craft.isSpecial ? "px" : unit})</span>
                <div className="range-row">
                  <input type="range" min={craft.widthRange[0]} max={craft.widthRange[1]} value={settings.gridWidth}
                    onChange={(e) => setSettings({ ...settings, gridWidth: Number(e.target.value) })} />
                  <span className="range-val">{settings.gridWidth}</span>
                </div>
              </label>
              {!craft.noColorControl && (
                <label className="control">
                  <span className="control-label">Max Colors</span>
                  <div className="range-row">
                    <input type="range" min={craft.colorRange[0]} max={craft.colorRange[1]} value={settings.maxColors}
                      onChange={(e) => setSettings({ ...settings, maxColors: Number(e.target.value) })} />
                    <span className="range-val">{settings.maxColors}</span>
                  </div>
                </label>
              )}
            </div>
            <button className="btn-primary" onClick={processAll} disabled={processing}>
              {processing ? `Processing ${progress.current} / ${progress.total}...` : `Generate All`}
            </button>
          </div>
        </>
      )}

      {results.length > 0 && (
        <div className="bulk-panel">
          <div className="bulk-panel-header">
            <h3>Results ({doneCount} of {results.length} complete)</h3>
            {doneCount > 1 && (
              <button className="btn-primary btn-sm" onClick={downloadAllZip}>Download All as ZIP</button>
            )}
          </div>
          <div className="result-list">
            {results.map((r, i) => (
              <div key={i} className={`result-row ${r.status}`}>
                <span className={`status-dot ${r.status}`} />
                <span className="result-name">{r.name}</span>
                {r.status === "done" && r.pattern && (
                  <span className="result-info">{r.pattern.width}x{r.pattern.height} - {r.pattern.colorMap.size} colors</span>
                )}
                {r.status === "error" && <span className="result-error">{r.error}</span>}
                {r.status === "done" && (
                  <button className="btn-outline btn-sm" onClick={() => downloadSingle(r)}>
                    Download {craft.outputFormat === "svg" ? "SVG" : "PDF"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
