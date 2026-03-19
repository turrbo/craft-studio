import { useState, useRef, useCallback, useEffect } from "react";
import { convertToPattern, renderPreview, generateColoringPage, generatePaintByNumbers, generateSVGTrace } from "../utils/patternEngine";
import { downloadCraftPDF, generateColoringPagePDF, generatePaintByNumbersPDF } from "../utils/craftPdfGenerator";
import "./SingleMode.css";

export default function SingleMode({ craft }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [pattern, setPattern] = useState(null);
  const [specialResult, setSpecialResult] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [settings, setSettings] = useState({
    gridWidth: craft.defaults.gridWidth,
    maxColors: craft.defaults.maxColors,
    title: "",
  });
  const canvasRef = useRef(null);
  const dropRef = useRef(null);

  useEffect(() => {
    setSettings((s) => ({
      ...s,
      gridWidth: craft.defaults.gridWidth,
      maxColors: craft.defaults.maxColors,
    }));
    setPattern(null);
    setSpecialResult(null);
  }, [craft]);

  const handleFile = useCallback((f) => {
    if (!f || !f.type.startsWith("image/")) return;
    setFile(f);
    setPattern(null);
    setSpecialResult(null);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(f);
    setSettings((s) => ({ ...s, title: f.name.replace(/\.[^.]+$/, "") }));
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dropRef.current?.classList.remove("drag-over");
    handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const convert = useCallback(() => {
    if (!preview) return;
    setProcessing(true);
    const img = new Image();
    img.onload = () => {
      if (craft.id === "coloringPage") {
        const canvas = generateColoringPage(img, settings.gridWidth);
        setSpecialResult({ type: "coloring", canvas });
        setPattern(null);
      } else if (craft.id === "svgCut") {
        const svg = generateSVGTrace(img, settings.gridWidth);
        setSpecialResult({ type: "svg", svg, width: settings.gridWidth });
        setPattern(null);
      } else if (craft.id === "paintByNumbers") {
        const pbn = generatePaintByNumbers(img, settings.gridWidth, settings.maxColors);
        setSpecialResult({ type: "pbn", ...pbn });
        setPattern(null);
      } else {
        const pat = convertToPattern(img, {
          gridWidth: settings.gridWidth,
          maxColors: settings.maxColors,
          palette: craft.palette,
        });
        setPattern(pat);
        setSpecialResult(null);
      }
      setProcessing(false);
    };
    img.src = preview;
  }, [preview, settings, craft]);

  useEffect(() => {
    if (pattern && canvasRef.current) renderPreview(canvasRef.current, pattern);
  }, [pattern]);

  useEffect(() => {
    if (specialResult && canvasRef.current) {
      const c = canvasRef.current;
      if (specialResult.type === "coloring" || specialResult.type === "pbn") {
        const src = specialResult.canvas;
        c.width = src.width;
        c.height = src.height;
        c.getContext("2d").drawImage(src, 0, 0);
      }
    }
  }, [specialResult]);

  const handleDownload = () => {
    const title = settings.title || "Pattern";
    if (specialResult?.type === "coloring") {
      const doc = generateColoringPagePDF(specialResult.canvas, title);
      doc.save(`${title.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`);
    } else if (specialResult?.type === "pbn") {
      const doc = generatePaintByNumbersPDF(specialResult, title);
      doc.save(`${title.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`);
    } else if (specialResult?.type === "svg") {
      const blob = new Blob([specialResult.svg], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.replace(/[^a-zA-Z0-9]/g, "_")}.svg`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (pattern) {
      downloadCraftPDF(pattern, craft, title);
    }
  };

  const hasResult = pattern || specialResult;
  const unit = craft.unitLabel || "units";

  return (
    <div className="single-mode">
      <div
        ref={dropRef}
        className={`drop-zone ${file ? "has-file" : ""}`}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); dropRef.current?.classList.add("drag-over"); }}
        onDragLeave={(e) => { e.preventDefault(); dropRef.current?.classList.remove("drag-over"); }}
        onClick={() => document.getElementById("file-input").click()}
      >
        <input id="file-input" type="file" accept="image/*" hidden onChange={(e) => handleFile(e.target.files[0])} />
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
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p className="drop-title">Drop an image here or click to browse</p>
            <p className="drop-sub">PNG, JPG, WEBP supported</p>
          </div>
        )}
      </div>

      {file && (
        <div className="controls-panel">
          <h3 className="panel-title">{craft.name} Settings</h3>
          <div className="controls-grid">
            <label className="control">
              <span className="control-label">Pattern Title</span>
              <input type="text" value={settings.title} onChange={(e) => setSettings({ ...settings, title: e.target.value })} className="control-input" />
            </label>
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
                <span className="control-label">Max Colors{craft.brandLabel ? ` (${craft.brandLabel})` : ""}</span>
                <div className="range-row">
                  <input type="range" min={craft.colorRange[0]} max={craft.colorRange[1]} value={settings.maxColors}
                    onChange={(e) => setSettings({ ...settings, maxColors: Number(e.target.value) })} />
                  <span className="range-val">{settings.maxColors}</span>
                </div>
              </label>
            )}
          </div>
          <button className="btn-primary" onClick={convert} disabled={processing}>
            {processing ? "Converting..." : `Generate ${craft.name}`}
          </button>
        </div>
      )}

      {hasResult && (
        <div className="result-panel">
          <div className="result-header">
            <h3 className="panel-title">{craft.name} Preview</h3>
            {pattern && (
              <div className="result-stats">
                <span>{pattern.width} x {pattern.height} {unit}</span>
                <span className="dot">-</span>
                <span>{pattern.colorMap.size} colors</span>
              </div>
            )}
          </div>
          <div className="canvas-wrap">
            <canvas ref={canvasRef} />
            {specialResult?.type === "svg" && (
              <div dangerouslySetInnerHTML={{ __html: specialResult.svg }} style={{ maxWidth: "100%" }} />
            )}
          </div>

          {pattern && (
            <div className="color-legend">
              <h4>{craft.brandLabel} Legend</h4>
              <div className="legend-grid">
                {Array.from(pattern.colorMap.values()).sort((a, b) => b.count - a.count).map((entry) => (
                  <div key={entry.dmc.id} className="legend-item">
                    <span className="swatch" style={{ background: entry.dmc.hex }} />
                    <span className="symbol">{entry.symbol}</span>
                    <span className="dmc-id">{craft.brandLabel} {entry.dmc.id}</span>
                    <span className="dmc-name">{entry.dmc.name}</span>
                    <span className="stitch-count">{entry.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {specialResult?.type === "pbn" && (
            <div className="color-legend">
              <h4>Color Legend</h4>
              <div className="legend-grid">
                {specialResult.colorList.map((c) => (
                  <div key={c.number} className="legend-item">
                    <span className="swatch" style={{ background: c.hex }} />
                    <span className="symbol">{c.number}</span>
                    <span className="dmc-id">{c.hex}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button className="btn-primary download-btn" onClick={handleDownload}>
            Download {craft.outputFormat === "svg" ? "SVG" : "PDF"}
          </button>
        </div>
      )}
    </div>
  );
}
