/**
 * Unified pattern engine that works with any color palette.
 * Used by all grid-based craft types.
 */

// ASCII symbols safe for jsPDF
const SYMBOLS = [
  "A", "B", "C", "D", "E", "F", "G", "H",
  "J", "K", "L", "M", "N", "P", "R", "S",
  "T", "U", "V", "W", "X", "Y", "Z",
  "a", "b", "c", "d", "e", "f", "g", "h",
  "j", "k", "m", "n", "p", "q", "r", "s",
  "t", "u", "v", "w", "x", "y", "z",
  "2", "3", "4", "5", "6", "7", "8", "9",
  "+", "=", "#", "%", "@", "*", "~", "^",
];

function findNearest(r, g, b, palette) {
  let best = palette[0];
  let bestDist = Infinity;
  for (const c of palette) {
    const dr = r - c.rgb[0];
    const dg = g - c.rgb[1];
    const db = b - c.rgb[2];
    const dist = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
    if (dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  }
  return best;
}

/**
 * Convert image to a grid pattern using a given color palette.
 * If palette is null (pixel art), uses median-cut quantization to raw RGB.
 */
export function convertToPattern(img, options = {}) {
  const { gridWidth = 60, maxColors = 20, palette = null } = options;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const aspect = img.height / img.width;
  const gridHeight = Math.round(gridWidth * aspect);

  canvas.width = gridWidth;
  canvas.height = gridHeight;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "medium";
  ctx.drawImage(img, 0, 0, gridWidth, gridHeight);

  const imageData = ctx.getImageData(0, 0, gridWidth, gridHeight);
  const pixels = imageData.data;

  // If no palette, build one from the image via quantization
  const usePalette = palette || buildQuantizedPalette(pixels, gridWidth, gridHeight, maxColors);

  // First pass: map every pixel to nearest palette color
  const rawGrid = [];
  const colorFrequency = new Map();

  for (let y = 0; y < gridHeight; y++) {
    const row = [];
    for (let x = 0; x < gridWidth; x++) {
      const i = (y * gridWidth + x) * 4;
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2], a = pixels[i + 3];
      if (a < 128) { row.push(null); continue; }
      const c = findNearest(r, g, b, usePalette);
      row.push(c);
      colorFrequency.set(c.id, (colorFrequency.get(c.id) || 0) + 1);
    }
    rawGrid.push(row);
  }

  // Reduce to maxColors
  const sorted = [...colorFrequency.entries()].sort((a, b) => b[1] - a[1]).slice(0, maxColors);
  const allowedIds = new Set(sorted.map(([id]) => id));
  const allowed = usePalette.filter((c) => allowedIds.has(c.id));

  const grid = rawGrid.map((row) =>
    row.map((cell) => {
      if (!cell) return null;
      if (allowedIds.has(cell.id)) return cell;
      return findNearest(cell.rgb[0], cell.rgb[1], cell.rgb[2], allowed);
    })
  );

  // Build color map
  const colorMap = new Map();
  let symIdx = 0;
  const freq = new Map();
  for (const row of grid) {
    for (const cell of row) {
      if (!cell) continue;
      freq.set(cell.id, (freq.get(cell.id) || 0) + 1);
      if (!colorMap.has(cell.id)) {
        colorMap.set(cell.id, { dmc: cell, symbol: SYMBOLS[symIdx % SYMBOLS.length] });
        symIdx++;
      }
    }
  }
  for (const [id, entry] of colorMap) {
    entry.count = freq.get(id) || 0;
  }

  return { grid, colorMap, width: gridWidth, height: gridHeight };
}

/** Simple median-cut quantization for pixel art mode */
function buildQuantizedPalette(pixels, w, h, maxColors) {
  const colors = [];
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    colors.push([pixels[i], pixels[i + 1], pixels[i + 2]]);
  }
  const buckets = [colors];
  while (buckets.length < maxColors && buckets.length > 0) {
    let bestIdx = 0, bestRange = 0, bestChannel = 0;
    for (let i = 0; i < buckets.length; i++) {
      for (let ch = 0; ch < 3; ch++) {
        const vals = buckets[i].map((c) => c[ch]);
        const range = Math.max(...vals) - Math.min(...vals);
        if (range > bestRange) { bestRange = range; bestIdx = i; bestChannel = ch; }
      }
    }
    if (bestRange < 8) break;
    const bucket = buckets.splice(bestIdx, 1)[0];
    bucket.sort((a, b) => a[bestChannel] - b[bestChannel]);
    const mid = Math.floor(bucket.length / 2);
    if (mid > 0) buckets.push(bucket.slice(0, mid));
    if (mid < bucket.length) buckets.push(bucket.slice(mid));
  }
  return buckets.map((b, i) => {
    const avg = [0, 1, 2].map((ch) => Math.round(b.reduce((s, c) => s + c[ch], 0) / b.length));
    const hex = "#" + avg.map((v) => v.toString(16).padStart(2, "0")).join("");
    return { id: `RGB${i}`, name: `Color ${i + 1}`, hex, rgb: avg };
  });
}

/** Render pattern preview to canvas */
export function renderPreview(canvas, pattern, cellSize = 6) {
  const { grid, colorMap, width, height } = pattern;
  canvas.width = width * cellSize;
  canvas.height = height * cellSize;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = grid[y][x];
      if (!cell) continue;
      ctx.fillStyle = cell.hex;
      ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
    }
  }

  ctx.strokeStyle = "rgba(0,0,0,0.1)";
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= width; x++) { ctx.beginPath(); ctx.moveTo(x * cellSize, 0); ctx.lineTo(x * cellSize, height * cellSize); ctx.stroke(); }
  for (let y = 0; y <= height; y++) { ctx.beginPath(); ctx.moveTo(0, y * cellSize); ctx.lineTo(width * cellSize, y * cellSize); ctx.stroke(); }
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= width; x += 10) { ctx.beginPath(); ctx.moveTo(x * cellSize, 0); ctx.lineTo(x * cellSize, height * cellSize); ctx.stroke(); }
  for (let y = 0; y <= height; y += 10) { ctx.beginPath(); ctx.moveTo(0, y * cellSize); ctx.lineTo(width * cellSize, y * cellSize); ctx.stroke(); }
}

/**
 * Generate C2C crochet written instructions from a grid pattern.
 * Returns array of row strings: "Row 1: 3 White, 2 Black, ..."
 */
export function generateC2CInstructions(pattern) {
  const { grid, colorMap, height, width } = pattern;
  const rows = [];
  for (let y = 0; y < height; y++) {
    const runs = [];
    let cur = null, count = 0;
    for (let x = 0; x < width; x++) {
      const cell = grid[y][x];
      const name = cell ? cell.name : "Skip";
      if (name === cur) { count++; }
      else { if (cur !== null) runs.push(`${count} ${cur}`); cur = name; count = 1; }
    }
    if (cur !== null) runs.push(`${count} ${cur}`);
    rows.push(`Row ${y + 1}: ${runs.join(", ")}`);
  }
  return rows;
}

// ─── Special generators ──────────────────────────

/**
 * Generate a coloring page (edge detection) from an image.
 * Returns a canvas with black line art on white background.
 */
export function generateColoringPage(img, outputWidth = 800) {
  const aspect = img.height / img.width;
  const outputHeight = Math.round(outputWidth * aspect);

  const src = document.createElement("canvas");
  src.width = outputWidth;
  src.height = outputHeight;
  const sctx = src.getContext("2d");
  sctx.drawImage(img, 0, 0, outputWidth, outputHeight);

  const srcData = sctx.getImageData(0, 0, outputWidth, outputHeight);
  const gray = new Uint8Array(outputWidth * outputHeight);

  // Grayscale
  for (let i = 0; i < gray.length; i++) {
    const j = i * 4;
    gray[i] = Math.round(srcData.data[j] * 0.299 + srcData.data[j + 1] * 0.587 + srcData.data[j + 2] * 0.114);
  }

  // Sobel edge detection
  const edges = new Uint8Array(outputWidth * outputHeight);
  for (let y = 1; y < outputHeight - 1; y++) {
    for (let x = 1; x < outputWidth - 1; x++) {
      const idx = y * outputWidth + x;
      const gx =
        -gray[idx - outputWidth - 1] + gray[idx - outputWidth + 1]
        - 2 * gray[idx - 1] + 2 * gray[idx + 1]
        - gray[idx + outputWidth - 1] + gray[idx + outputWidth + 1];
      const gy =
        -gray[idx - outputWidth - 1] - 2 * gray[idx - outputWidth] - gray[idx - outputWidth + 1]
        + gray[idx + outputWidth - 1] + 2 * gray[idx + outputWidth] + gray[idx + outputWidth + 1];
      edges[idx] = Math.min(255, Math.sqrt(gx * gx + gy * gy));
    }
  }

  // Threshold and invert (black lines on white)
  const out = document.createElement("canvas");
  out.width = outputWidth;
  out.height = outputHeight;
  const octx = out.getContext("2d");
  const outData = octx.createImageData(outputWidth, outputHeight);
  const threshold = 40;
  for (let i = 0; i < edges.length; i++) {
    const j = i * 4;
    const v = edges[i] > threshold ? 0 : 255;
    outData.data[j] = v;
    outData.data[j + 1] = v;
    outData.data[j + 2] = v;
    outData.data[j + 3] = 255;
  }
  octx.putImageData(outData, 0, 0);
  return out;
}

/**
 * Generate a paint-by-numbers template from an image.
 * Returns { canvas, colorList } where canvas has numbered regions.
 */
export function generatePaintByNumbers(img, outputWidth = 800, maxColors = 15) {
  const aspect = img.height / img.width;
  const outputHeight = Math.round(outputWidth * aspect);

  const src = document.createElement("canvas");
  src.width = outputWidth;
  src.height = outputHeight;
  const sctx = src.getContext("2d");
  sctx.drawImage(img, 0, 0, outputWidth, outputHeight);
  const srcData = sctx.getImageData(0, 0, outputWidth, outputHeight);
  const pixels = srcData.data;

  // Quantize colors
  const allColors = [];
  for (let i = 0; i < pixels.length; i += 4) {
    allColors.push([pixels[i], pixels[i + 1], pixels[i + 2]]);
  }
  // Simple k-means-like quantization
  let centroids = [];
  for (let i = 0; i < maxColors; i++) {
    centroids.push(allColors[Math.floor(Math.random() * allColors.length)].slice());
  }
  const labels = new Int32Array(allColors.length);
  for (let iter = 0; iter < 8; iter++) {
    // Assign
    for (let i = 0; i < allColors.length; i++) {
      let bestDist = Infinity, bestJ = 0;
      for (let j = 0; j < centroids.length; j++) {
        const dr = allColors[i][0] - centroids[j][0];
        const dg = allColors[i][1] - centroids[j][1];
        const db = allColors[i][2] - centroids[j][2];
        const d = dr * dr + dg * dg + db * db;
        if (d < bestDist) { bestDist = d; bestJ = j; }
      }
      labels[i] = bestJ;
    }
    // Update centroids
    const sums = centroids.map(() => [0, 0, 0, 0]);
    for (let i = 0; i < allColors.length; i++) {
      const s = sums[labels[i]];
      s[0] += allColors[i][0]; s[1] += allColors[i][1]; s[2] += allColors[i][2]; s[3]++;
    }
    for (let j = 0; j < centroids.length; j++) {
      if (sums[j][3] > 0) {
        centroids[j] = [
          Math.round(sums[j][0] / sums[j][3]),
          Math.round(sums[j][1] / sums[j][3]),
          Math.round(sums[j][2] / sums[j][3]),
        ];
      }
    }
  }

  // Build color list
  const colorList = centroids.map((c, i) => ({
    number: i + 1,
    rgb: c,
    hex: "#" + c.map((v) => v.toString(16).padStart(2, "0")).join(""),
    name: `Color ${i + 1}`,
  }));

  // Draw outline template
  const out = document.createElement("canvas");
  out.width = outputWidth;
  out.height = outputHeight;
  const octx = out.getContext("2d");

  // Fill with flat colors first
  const outData = octx.createImageData(outputWidth, outputHeight);
  for (let i = 0; i < labels.length; i++) {
    const c = centroids[labels[i]];
    // Light tint for background
    const j = i * 4;
    outData.data[j] = Math.min(255, c[0] + Math.round((255 - c[0]) * 0.75));
    outData.data[j + 1] = Math.min(255, c[1] + Math.round((255 - c[1]) * 0.75));
    outData.data[j + 2] = Math.min(255, c[2] + Math.round((255 - c[2]) * 0.75));
    outData.data[j + 3] = 255;
  }
  octx.putImageData(outData, 0, 0);

  // Draw region borders
  octx.strokeStyle = "#333";
  octx.lineWidth = 0.5;
  for (let y = 0; y < outputHeight; y++) {
    for (let x = 0; x < outputWidth; x++) {
      const idx = y * outputWidth + x;
      const label = labels[idx];
      if (x < outputWidth - 1 && labels[idx + 1] !== label) {
        octx.beginPath(); octx.moveTo(x + 1, y); octx.lineTo(x + 1, y + 1); octx.stroke();
      }
      if (y < outputHeight - 1 && labels[idx + outputWidth] !== label) {
        octx.beginPath(); octx.moveTo(x, y + 1); octx.lineTo(x + 1, y + 1); octx.stroke();
      }
    }
  }

  // Place numbers in region centers (sample every Nth pixel)
  const regionPixels = new Map();
  for (let i = 0; i < labels.length; i++) {
    const l = labels[i];
    if (!regionPixels.has(l)) regionPixels.set(l, []);
    regionPixels.get(l).push(i);
  }

  octx.fillStyle = "#000";
  octx.textAlign = "center";
  octx.textBaseline = "middle";
  const fontSize = Math.max(8, Math.round(outputWidth / 80));
  octx.font = `bold ${fontSize}px sans-serif`;

  for (const [label, idxList] of regionPixels) {
    // Find centroid of this region
    let sx = 0, sy = 0;
    for (const idx of idxList) {
      sx += idx % outputWidth;
      sy += Math.floor(idx / outputWidth);
    }
    const cx = Math.round(sx / idxList.length);
    const cy = Math.round(sy / idxList.length);
    // Only label if region is large enough
    if (idxList.length > outputWidth * outputHeight * 0.001) {
      // White backing for readability
      const num = String(label + 1);
      const tw = octx.measureText(num).width;
      octx.fillStyle = "rgba(255,255,255,0.8)";
      octx.fillRect(cx - tw / 2 - 2, cy - fontSize / 2 - 1, tw + 4, fontSize + 2);
      octx.fillStyle = "#000";
      octx.fillText(num, cx, cy);
    }
  }

  return { canvas: out, colorList, labels, width: outputWidth, height: outputHeight };
}

/**
 * Generate an SVG traced outline from an image.
 * Returns SVG string.
 */
export function generateSVGTrace(img, outputWidth = 800) {
  const aspect = img.height / img.width;
  const outputHeight = Math.round(outputWidth * aspect);

  // Use coloring page engine for edge detection
  const edgeCanvas = generateColoringPage(img, outputWidth);
  const ctx = edgeCanvas.getContext("2d");
  const data = ctx.getImageData(0, 0, outputWidth, outputHeight);

  // Convert to SVG using path tracing of black pixels
  let paths = "";
  const visited = new Uint8Array(outputWidth * outputHeight);

  // Simplified: scan rows and create horizontal line segments for black pixels
  for (let y = 0; y < outputHeight; y++) {
    let inBlack = false;
    let startX = 0;
    for (let x = 0; x <= outputWidth; x++) {
      const idx = y * outputWidth + x;
      const isBlack = x < outputWidth && data.data[idx * 4] < 128;
      if (isBlack && !inBlack) { startX = x; inBlack = true; }
      else if (!isBlack && inBlack) {
        paths += `<rect x="${startX}" y="${y}" width="${x - startX}" height="1" />`;
        inBlack = false;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${outputWidth} ${outputHeight}" width="${outputWidth}" height="${outputHeight}">
<g fill="#000" stroke="none">${paths}</g>
</svg>`;
}
