import { useState, useRef, useCallback } from "react";
import { convertToPattern } from "../utils/crossStitchEngine";
import { generatePDFBlob, downloadPDF } from "../utils/pdfGenerator";
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

export default function BulkMode() {
  const [files, setFiles] = useState([]);
  const [settings, setSettings] = useState({ gridWidth: 60, maxColors: 20 });
  const [results, setResults] = useState([]); // { name, status, pattern, error }
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const dropRef = useRef(null);

  const addFiles = useCallback((newFiles) => {
    const imageFiles = Array.from(newFiles).filter((f) => f.type.startsWith("image/"));
    setFiles((prev) => [...prev, ...imageFiles]);
    setResults([]);
  }, []);

  const removeFile = (idx) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setResults([]);
  };

  const clearAll = () => {
    setFiles([]);
    setResults([]);
  };

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
        const pattern = convertToPattern(img, {
          gridWidth: settings.gridWidth,
          maxColors: settings.maxColors,
        });
        newResults.push({ name, status: "done", pattern });
      } catch (err) {
        newResults.push({ name, status: "error", error: err.message });
      }
      setResults([...newResults]);
    }

    setProcessing(false);
  };

  const downloadSingle = (result) => {
    if (result.pattern) {
      downloadPDF(result.pattern, result.name);
    }
  };

  const downloadAllZip = async () => {
    const zip = new JSZip();
    for (const r of results) {
      if (r.status === "done" && r.pattern) {
        const blob = generatePDFBlob(r.pattern, r.name);
        zip.file(`${r.name}.pdf`, blob);
      }
    }
    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cross-stitch-patterns.zip";
    a.click();
    URL.revokeObjectURL(url);
  };

  const doneCount = results.filter((r) => r.status === "done").length;

  return (
    <div className="bulk-mode">
      {/* Upload area */}
      <div
        ref={dropRef}
        className="bulk-drop"
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); dropRef.current?.classList.add("drag-over"); }}
        onDragLeave={() => dropRef.current?.classList.remove("drag-over")}
        onClick={() => document.getElementById("bulk-input").click()}
      >
        <input
          id="bulk-input"
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => addFiles(e.target.files)}
        />
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <p className="bulk-drop-title">Drop multiple images or click to browse</p>
        <p className="bulk-drop-sub">Each image becomes its own cross-stitch PDF</p>
      </div>

      {files.length > 0 && (
        <>
          {/* File list */}
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

          {/* Settings */}
          <div className="bulk-panel">
            <h3 className="bulk-settings-title">Settings (applied to all)</h3>
            <div className="bulk-controls">
              <label className="control">
                <span className="control-label">Width (stitches)</span>
                <div className="range-row">
                  <input type="range" min="20" max="200" value={settings.gridWidth}
                    onChange={(e) => setSettings({ ...settings, gridWidth: Number(e.target.value) })} />
                  <span className="range-val">{settings.gridWidth}</span>
                </div>
              </label>
              <label className="control">
                <span className="control-label">Max Colors</span>
                <div className="range-row">
                  <input type="range" min="4" max="60" value={settings.maxColors}
                    onChange={(e) => setSettings({ ...settings, maxColors: Number(e.target.value) })} />
                  <span className="range-val">{settings.maxColors}</span>
                </div>
              </label>
            </div>
            <button className="btn-primary" onClick={processAll} disabled={processing}>
              {processing
                ? `Processing ${progress.current} / ${progress.total}...`
                : "Generate All Patterns"}
            </button>
          </div>
        </>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="bulk-panel">
          <div className="bulk-panel-header">
            <h3>Results ({doneCount} of {results.length} complete)</h3>
            {doneCount > 1 && (
              <button className="btn-primary btn-sm" onClick={downloadAllZip}>
                Download All as ZIP
              </button>
            )}
          </div>
          <div className="result-list">
            {results.map((r, i) => (
              <div key={i} className={`result-row ${r.status}`}>
                <span className={`status-dot ${r.status}`} />
                <span className="result-name">{r.name}</span>
                {r.status === "done" && r.pattern && (
                  <span className="result-info">
                    {r.pattern.width}x{r.pattern.height} - {r.pattern.colorMap.size} colors
                  </span>
                )}
                {r.status === "error" && (
                  <span className="result-error">{r.error}</span>
                )}
                {r.status === "done" && (
                  <button className="btn-outline btn-sm" onClick={() => downloadSingle(r)}>
                    Download PDF
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
