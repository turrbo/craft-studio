import { jsPDF } from "jspdf";
import { generateC2CInstructions } from "./patternEngine";

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 12;
const CONTENT_W = PAGE_W - MARGIN * 2;
const CONTENT_H = PAGE_H - MARGIN * 2;

/**
 * Generate a PDF for any grid-based craft type.
 */
export function generateCraftPDF(pattern, craft, title = "Pattern") {
  const { grid, colorMap, width, height } = pattern;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // ─── Cover Page ─────────────
  drawCoverPage(doc, pattern, craft, title);

  // ─── Color Legend ───────────
  doc.addPage();
  drawColorLegend(doc, colorMap, craft, title);

  // ─── C2C Written Instructions (if applicable) ─────────
  if (craft.hasWrittenInstructions) {
    doc.addPage();
    drawC2CInstructions(doc, pattern, title);
  }

  // ─── Pattern Grid Pages ─────
  const maxCell = 4, minCell = 2.5;
  let cellSize = Math.min(maxCell, CONTENT_W / width);
  cellSize = Math.max(minCell, cellSize);

  const colsPerPage = Math.floor(CONTENT_W / cellSize);
  const rowsPerPage = Math.floor((CONTENT_H - 15) / cellSize);
  const totalPCols = Math.ceil(width / colsPerPage);
  const totalPRows = Math.ceil(height / rowsPerPage);

  for (let pr = 0; pr < totalPRows; pr++) {
    for (let pc = 0; pc < totalPCols; pc++) {
      doc.addPage();
      const sX = pc * colsPerPage, sY = pr * rowsPerPage;
      const eX = Math.min(sX + colsPerPage, width);
      const eY = Math.min(sY + rowsPerPage, height);
      const cols = eX - sX, rows = eY - sY;

      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.setFont("helvetica", "normal");
      doc.text(
        `${title} - Section (${pc + 1},${pr + 1}) of (${totalPCols},${totalPRows})  |  Cols ${sX + 1}-${eX}, Rows ${sY + 1}-${eY}`,
        MARGIN, MARGIN + 3
      );

      const gY = MARGIN + 8, gX = MARGIN;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cell = grid[sY + r]?.[sX + c];
          const cx = gX + c * cellSize, cy = gY + r * cellSize;
          if (cell) {
            const rgb = cell.rgb;
            doc.setFillColor(
              Math.min(255, rgb[0] + Math.round((255 - rgb[0]) * 0.6)),
              Math.min(255, rgb[1] + Math.round((255 - rgb[1]) * 0.6)),
              Math.min(255, rgb[2] + Math.round((255 - rgb[2]) * 0.6))
            );
            doc.rect(cx, cy, cellSize, cellSize, "F");

            const entry = colorMap.get(cell.id);
            if (entry) {
              const fontSize = Math.max(4, Math.min(10, cellSize * 2.2));
              doc.setFontSize(fontSize);
              doc.setFont("helvetica", "bold");
              doc.setTextColor(0);
              doc.text(entry.symbol, cx + cellSize / 2, cy + cellSize * 0.72, { align: "center" });
            }
          }
        }
      }

      // Grid lines
      doc.setDrawColor(180); doc.setLineWidth(0.1);
      for (let c = 0; c <= cols; c++) { const x = gX + c * cellSize; doc.line(x, gY, x, gY + rows * cellSize); }
      for (let r = 0; r <= rows; r++) { const y = gY + r * cellSize; doc.line(gX, y, gX + cols * cellSize, y); }
      doc.setDrawColor(60); doc.setLineWidth(0.3);
      for (let c = 0; c <= cols; c++) { if ((sX + c) % 10 === 0) { const x = gX + c * cellSize; doc.line(x, gY, x, gY + rows * cellSize); } }
      for (let r = 0; r <= rows; r++) { if ((sY + r) % 10 === 0) { const y = gY + r * cellSize; doc.line(gX, y, gX + cols * cellSize, y); } }

      // Numbers
      doc.setFontSize(5); doc.setTextColor(120); doc.setFont("helvetica", "normal");
      for (let c = 0; c < cols; c += 5) doc.text(String(sX + c + 1), gX + c * cellSize + cellSize / 2, gY - 1, { align: "center" });
      for (let r = 0; r < rows; r += 5) doc.text(String(sY + r + 1), gX - 1, gY + r * cellSize + cellSize * 0.7, { align: "right" });
    }
  }

  return doc;
}

function drawCoverPage(doc, pattern, craft, title) {
  const { grid, colorMap, width, height } = pattern;

  doc.setFontSize(22); doc.setTextColor(30);
  doc.text(title, PAGE_W / 2, 25, { align: "center" });
  doc.setFontSize(10); doc.setTextColor(100);
  doc.text(craft.pdfSubtitle, PAGE_W / 2, 33, { align: "center" });

  // Preview
  const cell = Math.min(160 / width, 180 / height, 3);
  const prevW = width * cell, prevH = height * cell;
  const prevX = (PAGE_W - prevW) / 2, prevY = 42;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const c = grid[y][x];
      if (c) { doc.setFillColor(c.rgb[0], c.rgb[1], c.rgb[2]); doc.rect(prevX + x * cell, prevY + y * cell, cell, cell, "F"); }
    }
  }

  const totalUnits = Array.from(colorMap.values()).reduce((s, e) => s + e.count, 0);
  const infoY = prevY + prevH + 10;
  doc.setFontSize(9); doc.setTextColor(60);
  doc.text(`Size: ${width} x ${height} ${craft.unitLabel}`, MARGIN, infoY);
  doc.text(`Total ${craft.unitLabel}: ${totalUnits.toLocaleString()}`, MARGIN, infoY + 5);
  doc.text(`Colors: ${colorMap.size} ${craft.brandLabel} colors`, MARGIN, infoY + 10);

  if (craft.id === "crossStitch" || craft.id === "diamondPainting") {
    doc.text("Estimated sizes:", MARGIN, infoY + 20);
    for (const [ct, label, yOff] of [[14, "14-count", 25], [16, "16-count", 30], [18, "18-count", 35]]) {
      const wI = (width / ct).toFixed(1), hI = (height / ct).toFixed(1);
      const wC = ((width / ct) * 2.54).toFixed(1), hC = ((height / ct) * 2.54).toFixed(1);
      doc.text(`  ${label}: ${wI}" x ${hI}" (${wC} x ${hC} cm)`, MARGIN, infoY + yOff);
    }
  }

  if (craft.pegboardNote) {
    doc.text(craft.pegboardNote, MARGIN, infoY + 20);
    const boards = Math.ceil(width / 29) * Math.ceil(height / 29);
    doc.text(`Pegboards needed: ${boards}`, MARGIN, infoY + 25);
  }
}

function drawColorLegend(doc, colorMap, craft, title) {
  doc.setFontSize(14); doc.setTextColor(30);
  doc.text(`${craft.brandLabel} Legend`, MARGIN, MARGIN + 6);
  doc.setFontSize(8); doc.setTextColor(100);
  doc.text(title, MARGIN, MARGIN + 12);

  const startY = MARGIN + 20, rowH = 7;
  const entries = Array.from(colorMap.values()).sort((a, b) => b.count - a.count);

  doc.setFontSize(7); doc.setTextColor(60);
  doc.text("Sym", MARGIN, startY);
  doc.text("Color", MARGIN + 10, startY);
  doc.text(`${craft.brandLabel} #`, MARGIN + 18, startY);
  doc.text("Name", MARGIN + 38, startY);
  doc.text(craft.unitLabel ? craft.unitLabel.charAt(0).toUpperCase() + craft.unitLabel.slice(1) : "Count", MARGIN + 105, startY);

  doc.setDrawColor(180); doc.setLineWidth(0.2);
  doc.line(MARGIN, startY + 1.5, PAGE_W - MARGIN, startY + 1.5);

  let y = startY + rowH;
  for (const entry of entries) {
    if (y + rowH > PAGE_H - MARGIN) { doc.addPage(); y = MARGIN + 10; }
    const { dmc, symbol, count } = entry;

    doc.setFillColor(dmc.rgb[0], dmc.rgb[1], dmc.rgb[2]);
    doc.rect(MARGIN + 10, y - 3.5, 5, 4, "F");
    doc.setDrawColor(150); doc.setLineWidth(0.1);
    doc.rect(MARGIN + 10, y - 3.5, 5, 4, "S");

    doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(0);
    doc.text(symbol, MARGIN + 3, y, { align: "center" });

    doc.setFontSize(7); doc.setFont("helvetica", "normal");
    doc.text(dmc.id, MARGIN + 20, y);
    doc.text(dmc.name, MARGIN + 38, y);
    doc.text(count.toLocaleString(), MARGIN + 105, y);
    y += rowH;
  }
}

function drawC2CInstructions(doc, pattern, title) {
  doc.setFontSize(14); doc.setTextColor(30);
  doc.text("Written Instructions (Row by Row)", MARGIN, MARGIN + 6);
  doc.setFontSize(8); doc.setTextColor(100);
  doc.text(title, MARGIN, MARGIN + 12);

  const instructions = generateC2CInstructions(pattern);
  let y = MARGIN + 20;
  doc.setFontSize(6.5); doc.setTextColor(30); doc.setFont("helvetica", "normal");

  for (const line of instructions) {
    if (y > PAGE_H - MARGIN) { doc.addPage(); y = MARGIN + 10; }
    doc.text(line, MARGIN, y, { maxWidth: CONTENT_W });
    y += 4;
  }
}

/**
 * Generate PDF for paint-by-numbers (canvas-based result).
 */
export function generatePaintByNumbersPDF(pbnResult, title = "Paint by Numbers") {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  doc.setFontSize(18); doc.setTextColor(30);
  doc.text(title, PAGE_W / 2, 20, { align: "center" });
  doc.setFontSize(10); doc.setTextColor(100);
  doc.text("Paint by Numbers Template", PAGE_W / 2, 28, { align: "center" });

  // Add the canvas as image
  const imgData = pbnResult.canvas.toDataURL("image/png");
  const aspect = pbnResult.height / pbnResult.width;
  const imgW = CONTENT_W;
  const imgH = imgW * aspect;
  const maxH = 200;
  const finalW = imgH > maxH ? maxH / aspect : imgW;
  const finalH = imgH > maxH ? maxH : imgH;
  doc.addImage(imgData, "PNG", (PAGE_W - finalW) / 2, 35, finalW, finalH);

  // Color legend
  const legendY = 35 + finalH + 10;
  doc.setFontSize(12); doc.setTextColor(30);
  doc.text("Color Legend", MARGIN, legendY);

  let y = legendY + 8;
  doc.setFontSize(8);
  for (const c of pbnResult.colorList) {
    if (y > PAGE_H - MARGIN) { doc.addPage(); y = MARGIN + 10; }
    doc.setFillColor(c.rgb[0], c.rgb[1], c.rgb[2]);
    doc.rect(MARGIN, y - 3, 6, 4, "F");
    doc.setDrawColor(150); doc.setLineWidth(0.1);
    doc.rect(MARGIN, y - 3, 6, 4, "S");
    doc.setTextColor(0);
    doc.text(`${c.number}`, MARGIN + 9, y);
    doc.setTextColor(80);
    doc.text(c.hex, MARGIN + 16, y);
    y += 6;
  }

  return doc;
}

/**
 * Generate PDF for a coloring page (canvas with line art).
 */
export function generateColoringPagePDF(canvas, title = "Coloring Page") {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  doc.setFontSize(14); doc.setTextColor(30);
  doc.text(title, PAGE_W / 2, 15, { align: "center" });

  const imgData = canvas.toDataURL("image/png");
  const aspect = canvas.height / canvas.width;
  const imgW = CONTENT_W;
  const imgH = imgW * aspect;
  const maxH = CONTENT_H - 20;
  const finalW = imgH > maxH ? maxH / aspect : imgW;
  const finalH = imgH > maxH ? maxH : imgH;
  doc.addImage(imgData, "PNG", (PAGE_W - finalW) / 2, 22, finalW, finalH);

  return doc;
}

// Convenience functions
export function downloadCraftPDF(pattern, craft, title) {
  const doc = generateCraftPDF(pattern, craft, title);
  doc.save(`${title.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`);
}

export function generateCraftPDFBlob(pattern, craft, title) {
  const doc = generateCraftPDF(pattern, craft, title);
  return doc.output("blob");
}
