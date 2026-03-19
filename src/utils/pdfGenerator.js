import { jsPDF } from "jspdf";

const MM_PER_INCH = 25.4;
const PAGE_W = 210; // A4 width in mm
const PAGE_H = 297; // A4 height in mm
const MARGIN = 12;
const CONTENT_W = PAGE_W - MARGIN * 2;
const CONTENT_H = PAGE_H - MARGIN * 2;

/**
 * Generate a cross-stitch PDF from a pattern
 * @param {Object} pattern - { grid, colorMap, width, height }
 * @param {string} title - Title for the pattern
 * @returns {jsPDF}
 */
export function generatePDF(pattern, title = "Cross-Stitch Pattern") {
  const { grid, colorMap, width, height } = pattern;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  // ─── Cover Page ───────────────────────────────
  drawCoverPage(doc, pattern, title);

  // ─── Color Legend Page ────────────────────────
  doc.addPage();
  drawColorLegend(doc, colorMap, title);

  // ─── Pattern Grid Pages ───────────────────────
  // Calculate cell size to fit nicely, then paginate
  const maxCellSize = 4; // mm per stitch
  const minCellSize = 2.5;
  let cellSize = Math.min(maxCellSize, CONTENT_W / width);
  cellSize = Math.max(minCellSize, cellSize);

  const colsPerPage = Math.floor(CONTENT_W / cellSize);
  const rowsPerPage = Math.floor((CONTENT_H - 15) / cellSize); // reserve space for header

  const totalPageCols = Math.ceil(width / colsPerPage);
  const totalPageRows = Math.ceil(height / rowsPerPage);

  for (let pageRow = 0; pageRow < totalPageRows; pageRow++) {
    for (let pageCol = 0; pageCol < totalPageCols; pageCol++) {
      doc.addPage();

      const startX = pageCol * colsPerPage;
      const startY = pageRow * rowsPerPage;
      const endX = Math.min(startX + colsPerPage, width);
      const endY = Math.min(startY + rowsPerPage, height);
      const cols = endX - startX;
      const rows = endY - startY;

      // Page header
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(
        `${title} - Section (${pageCol + 1},${pageRow + 1}) of (${totalPageCols},${totalPageRows})  |  Columns ${startX + 1}-${endX}, Rows ${startY + 1}-${endY}`,
        MARGIN,
        MARGIN + 3
      );

      const gridStartY = MARGIN + 8;
      const gridStartX = MARGIN;

      // Draw cells
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cell = grid[startY + r]?.[startX + c];
          const cx = gridStartX + c * cellSize;
          const cy = gridStartY + r * cellSize;

          if (cell) {
            // Fill background with light tint
            const rgb = cell.rgb;
            doc.setFillColor(
              Math.min(255, rgb[0] + Math.round((255 - rgb[0]) * 0.6)),
              Math.min(255, rgb[1] + Math.round((255 - rgb[1]) * 0.6)),
              Math.min(255, rgb[2] + Math.round((255 - rgb[2]) * 0.6))
            );
            doc.rect(cx, cy, cellSize, cellSize, "F");

            // Draw symbol
            const entry = colorMap.get(cell.id);
            if (entry) {
              // Convert mm cell size to pt-based font size that fits within the cell
              const fontSize = Math.max(4, Math.min(10, cellSize * 2.2));
              doc.setFontSize(fontSize);
              doc.setFont("helvetica", "bold");
              doc.setTextColor(0);
              doc.text(entry.symbol, cx + cellSize / 2, cy + cellSize * 0.72, {
                align: "center",
              });
            }
          }
        }
      }

      // Grid lines
      doc.setDrawColor(180);
      doc.setLineWidth(0.1);
      for (let c = 0; c <= cols; c++) {
        const x = gridStartX + c * cellSize;
        doc.line(x, gridStartY, x, gridStartY + rows * cellSize);
      }
      for (let r = 0; r <= rows; r++) {
        const y = gridStartY + r * cellSize;
        doc.line(gridStartX, y, gridStartX + cols * cellSize, y);
      }

      // Bold lines every 10
      doc.setDrawColor(60);
      doc.setLineWidth(0.3);
      for (let c = 0; c <= cols; c++) {
        if ((startX + c) % 10 === 0) {
          const x = gridStartX + c * cellSize;
          doc.line(x, gridStartY, x, gridStartY + rows * cellSize);
        }
      }
      for (let r = 0; r <= rows; r++) {
        if ((startY + r) % 10 === 0) {
          const y = gridStartY + r * cellSize;
          doc.line(gridStartX, y, gridStartX + cols * cellSize, y);
        }
      }

      // Row/col numbers
      doc.setFontSize(5);
      doc.setTextColor(120);
      for (let c = 0; c < cols; c += 5) {
        doc.text(
          String(startX + c + 1),
          gridStartX + c * cellSize + cellSize / 2,
          gridStartY - 1,
          { align: "center" }
        );
      }
      for (let r = 0; r < rows; r += 5) {
        doc.text(
          String(startY + r + 1),
          gridStartX - 1,
          gridStartY + r * cellSize + cellSize * 0.7,
          { align: "right" }
        );
      }
    }
  }

  return doc;
}

function drawCoverPage(doc, pattern, title) {
  const { grid, colorMap, width, height } = pattern;

  // Title
  doc.setFontSize(22);
  doc.setTextColor(30);
  doc.text(title, PAGE_W / 2, 25, { align: "center" });

  // Subtitle
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text("Cross-Stitch Pattern", PAGE_W / 2, 33, { align: "center" });

  // Preview image (color blocks)
  const previewMaxW = 160;
  const previewMaxH = 180;
  const cellW = previewMaxW / width;
  const cellH = previewMaxH / height;
  const cell = Math.min(cellW, cellH, 3);
  const prevW = width * cell;
  const prevH = height * cell;
  const prevX = (PAGE_W - prevW) / 2;
  const prevY = 42;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const c = grid[y][x];
      if (c) {
        doc.setFillColor(c.rgb[0], c.rgb[1], c.rgb[2]);
        doc.rect(prevX + x * cell, prevY + y * cell, cell, cell, "F");
      }
    }
  }

  // Pattern info
  const infoY = prevY + prevH + 10;
  doc.setFontSize(9);
  doc.setTextColor(60);
  const totalStitches = Array.from(colorMap.values()).reduce(
    (sum, e) => sum + e.count,
    0
  );
  doc.text(`Size: ${width} x ${height} stitches`, MARGIN, infoY);
  doc.text(`Total stitches: ${totalStitches.toLocaleString()}`, MARGIN, infoY + 5);
  doc.text(`Colors: ${colorMap.size} DMC threads`, MARGIN, infoY + 10);

  // Fabric sizes at common counts
  doc.text("Estimated fabric sizes:", MARGIN, infoY + 20);
  for (const [ct, label] of [[14, "14-count Aida"], [16, "16-count Aida"], [18, "18-count Aida"]]) {
    const wInch = (width / ct).toFixed(1);
    const hInch = (height / ct).toFixed(1);
    const wCm = ((width / ct) * 2.54).toFixed(1);
    const hCm = ((height / ct) * 2.54).toFixed(1);
    doc.text(
      `  ${label}: ${wInch}" x ${hInch}" (${wCm} x ${hCm} cm)`,
      MARGIN,
      infoY + 25 + [[14,16,18].indexOf(ct)] * 5
    );
  }
  // Fix the positioning for fabric sizes
  doc.text(
    `  16-count Aida: ${(width / 16).toFixed(1)}" x ${(height / 16).toFixed(1)}" (${((width / 16) * 2.54).toFixed(1)} x ${((height / 16) * 2.54).toFixed(1)} cm)`,
    MARGIN,
    infoY + 30
  );
  doc.text(
    `  18-count Aida: ${(width / 18).toFixed(1)}" x ${(height / 18).toFixed(1)}" (${((width / 18) * 2.54).toFixed(1)} x ${((height / 18) * 2.54).toFixed(1)} cm)`,
    MARGIN,
    infoY + 35
  );
}

function drawColorLegend(doc, colorMap, title) {
  doc.setFontSize(14);
  doc.setTextColor(30);
  doc.text("Thread Legend", MARGIN, MARGIN + 6);

  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(title, MARGIN, MARGIN + 12);

  const startY = MARGIN + 20;
  const rowH = 7;
  const entries = Array.from(colorMap.values()).sort((a, b) => b.count - a.count);

  // Header
  doc.setFontSize(7);
  doc.setTextColor(60);
  doc.text("Symbol", MARGIN, startY);
  doc.text("Color", MARGIN + 12, startY);
  doc.text("DMC #", MARGIN + 18, startY);
  doc.text("Name", MARGIN + 35, startY);
  doc.text("Stitches", MARGIN + 100, startY);

  doc.setDrawColor(180);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, startY + 1.5, PAGE_W - MARGIN, startY + 1.5);

  let y = startY + rowH;
  let page = 0;

  for (let i = 0; i < entries.length; i++) {
    if (y + rowH > PAGE_H - MARGIN) {
      doc.addPage();
      y = MARGIN + 10;
      page++;
    }

    const entry = entries[i];
    const { dmc, symbol, count } = entry;

    // Color swatch
    doc.setFillColor(dmc.rgb[0], dmc.rgb[1], dmc.rgb[2]);
    doc.rect(MARGIN + 12, y - 3.5, 5, 4, "F");
    doc.setDrawColor(150);
    doc.setLineWidth(0.1);
    doc.rect(MARGIN + 12, y - 3.5, 5, 4, "S");

    // Symbol
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text(symbol, MARGIN + 3, y, { align: "center" });

    // DMC number
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(dmc.id, MARGIN + 22, y);

    // Name
    doc.text(dmc.name, MARGIN + 35, y);

    // Count
    doc.text(count.toLocaleString(), MARGIN + 100, y);

    y += rowH;
  }
}

/**
 * Generate and trigger download of a cross-stitch PDF
 */
export function downloadPDF(pattern, title = "Cross-Stitch Pattern") {
  const doc = generatePDF(pattern, title);
  doc.save(`${title.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`);
}

/**
 * Generate PDF as blob for zip packaging
 */
export function generatePDFBlob(pattern, title = "Cross-Stitch Pattern") {
  const doc = generatePDF(pattern, title);
  return doc.output("blob");
}
