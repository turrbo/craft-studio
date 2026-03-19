import { useState, useRef, useCallback, useEffect } from "react";
import { convertToPattern, renderPreview } from "../utils/crossStitchEngine";
import { downloadPDF } from "../utils/pdfGenerator";
import "./SingleMode.css";

export default function SingleMode() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [pattern, setPattern] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [settings, setSettings] = useState({ gridWidth: 60, maxColors: 20, title: "" });
  const canvasRef = useRef(null);
  const dropRef = useRef(null);

  const handleFile = useCallback((f) => {
    if (!f || !f.type.startsWith("image/")) return;
    setFile(f);
    setPattern(null);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(f);
    setSettings((s) => ({ ...s, title: f.name.replace(/\.[^.]+$/, "") }));
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dropRef.current?.classList.remove("drag-over");
    const f = e.dataTransfer.files[0];
    handleFile(f);
  }, [handleFile]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    dropRef.current?.classList.add("drag-over");
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    dropRef.current?.classList.remove("drag-over");
  }, []);

  const convert = useCallback(() => {
    if (!preview) return;
    setProcessing(true);
    const img = new Image();
    img.onload = () => {
      const pat = convertToPattern(img, {
        gridWidth: settings.gridWidth,
        maxColors: settings.maxColors,
      });
      setPattern(pat);
      setProcessing(false);
    };
    img.src = preview;
  }, [preview, settings.gridWidth, settings.maxColors]);

  useEffect(() => {
    if (pattern && canvasRef.current) {
      renderPreview(canvasRef.current, pattern);
    }
  }, [pattern]);

  const handleDownload = () => {
    if (!pattern) return;
    downloadPDF(pattern, settings.title || "Cross-Stitch Pattern");
  };

  return (
    <div className="single-mode">
      {/* Upload area */}
      <div
        ref={dropRef}
        className={`drop-zone ${file ? "has-file" : ""}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => document.getElementById("file-input").click()}
      >
        <input
          id="file-input"
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => handleFile(e.target.files[0])}
        />
        {preview ? (
          <div className="file-preview">
            <img src={preview} alt="Preview" className="thumb" />
            <div className="file-info">
              <span className="file-name">{file?.name}</span>
              <span className="file-hint">Click or drop to replace</span>
            </div>
          </div>
        ) : (
          <div className="drop-prompt">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p className="drop-title">Drop an image here or click to browse</p>
            <p className="drop-sub">PNG, JPG, WEBP supported</p>
          </div>
        )}
      </div>

      {file && (
        <div className="controls-panel">
          <h3 className="panel-title">Pattern Settings</h3>
          <div className="controls-grid">
            <label className="control">
              <span className="control-label">Pattern Title</span>
              <input
                type="text"
                value={settings.title}
                onChange={(e) => setSettings({ ...settings, title: e.target.value })}
                className="control-input"
              />
            </label>
            <label className="control">
              <span className="control-label">Width (stitches)</span>
              <div className="range-row">
                <input
                  type="range"
                  min="20"
                  max="200"
                  value={settings.gridWidth}
                  onChange={(e) => setSettings({ ...settings, gridWidth: Number(e.target.value) })}
                />
                <span className="range-val">{settings.gridWidth}</span>
              </div>
            </label>
            <label className="control">
              <span className="control-label">Max Colors (DMC threads)</span>
              <div className="range-row">
                <input
                  type="range"
                  min="4"
                  max="60"
                  value={settings.maxColors}
                  onChange={(e) => setSettings({ ...settings, maxColors: Number(e.target.value) })}
                />
                <span className="range-val">{settings.maxColors}</span>
              </div>
            </label>
          </div>
          <button className="btn-primary" onClick={convert} disabled={processing}>
            {processing ? "Converting..." : "Generate Pattern"}
          </button>
        </div>
      )}

      {pattern && (
        <div className="result-panel">
          <div className="result-header">
            <h3 className="panel-title">Pattern Preview</h3>
            <div className="result-stats">
              <span>{pattern.width} x {pattern.height} stitches</span>
              <span className="dot">-</span>
              <span>{pattern.colorMap.size} colors</span>
            </div>
          </div>
          <div className="canvas-wrap">
            <canvas ref={canvasRef} />
          </div>
          <div className="color-legend">
            <h4>Thread Legend</h4>
            <div className="legend-grid">
              {Array.from(pattern.colorMap.values())
                .sort((a, b) => b.count - a.count)
                .map((entry) => (
                  <div key={entry.dmc.id} className="legend-item">
                    <span className="swatch" style={{ background: entry.dmc.hex }} />
                    <span className="symbol">{entry.symbol}</span>
                    <span className="dmc-id">DMC {entry.dmc.id}</span>
                    <span className="dmc-name">{entry.dmc.name}</span>
                    <span className="stitch-count">{entry.count}</span>
                  </div>
                ))}
            </div>
          </div>
          <button className="btn-primary download-btn" onClick={handleDownload}>
            Download PDF
          </button>
        </div>
      )}
    </div>
  );
}
