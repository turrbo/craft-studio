import DMC_COLORS from "./dmcColors";

// Find the nearest DMC color using Euclidean distance in RGB space
function findNearestDMC(r, g, b) {
  let bestMatch = DMC_COLORS[0];
  let bestDist = Infinity;

  for (const dmc of DMC_COLORS) {
    const dr = r - dmc.rgb[0];
    const dg = g - dmc.rgb[1];
    const db = b - dmc.rgb[2];
    // Weighted distance (human eye is more sensitive to green)
    const dist = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
    if (dist < bestDist) {
      bestDist = dist;
      bestMatch = dmc;
    }
  }
  return bestMatch;
}

// Symbol set - ASCII only for reliable jsPDF rendering
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

/**
 * Convert an image to a cross-stitch pattern
 * @param {HTMLImageElement} img - The source image
 * @param {Object} options - Conversion options
 * @param {number} options.gridWidth - Number of stitches wide
 * @param {number} options.maxColors - Maximum number of DMC colors
 * @returns {{ grid: Array, colorMap: Map, width: number, height: number }}
 */
export function convertToPattern(img, options = {}) {
  const { gridWidth = 60, maxColors = 20 } = options;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  // Calculate grid height maintaining aspect ratio
  const aspect = img.height / img.width;
  const gridHeight = Math.round(gridWidth * aspect);

  canvas.width = gridWidth;
  canvas.height = gridHeight;

  // Disable image smoothing for crisp pixelation
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "medium";
  ctx.drawImage(img, 0, 0, gridWidth, gridHeight);

  const imageData = ctx.getImageData(0, 0, gridWidth, gridHeight);
  const pixels = imageData.data;

  // First pass: find the nearest DMC color for every pixel
  const rawGrid = [];
  const colorFrequency = new Map();

  for (let y = 0; y < gridHeight; y++) {
    const row = [];
    for (let x = 0; x < gridWidth; x++) {
      const i = (y * gridWidth + x) * 4;
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const a = pixels[i + 3];

      if (a < 128) {
        row.push(null); // transparent
        continue;
      }

      const dmc = findNearestDMC(r, g, b);
      row.push(dmc);
      colorFrequency.set(dmc.id, (colorFrequency.get(dmc.id) || 0) + 1);
    }
    rawGrid.push(row);
  }

  // Reduce colors to maxColors by keeping the most frequent
  const sortedColors = [...colorFrequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxColors);
  const allowedIds = new Set(sortedColors.map(([id]) => id));
  const allowedColors = DMC_COLORS.filter((c) => allowedIds.has(c.id));

  // Second pass: remap any color not in allowedColors to the nearest allowed color
  const grid = rawGrid.map((row) =>
    row.map((cell) => {
      if (!cell) return null;
      if (allowedIds.has(cell.id)) return cell;
      // Find nearest among allowed colors
      let best = allowedColors[0];
      let bestDist = Infinity;
      for (const ac of allowedColors) {
        const dr = cell.rgb[0] - ac.rgb[0];
        const dg = cell.rgb[1] - ac.rgb[1];
        const db = cell.rgb[2] - ac.rgb[2];
        const dist = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
        if (dist < bestDist) {
          bestDist = dist;
          best = ac;
        }
      }
      return best;
    })
  );

  // Build the color map: DMC id -> { dmc, symbol, count }
  const colorMap = new Map();
  let symbolIdx = 0;
  const finalFreq = new Map();
  for (const row of grid) {
    for (const cell of row) {
      if (!cell) continue;
      finalFreq.set(cell.id, (finalFreq.get(cell.id) || 0) + 1);
      if (!colorMap.has(cell.id)) {
        colorMap.set(cell.id, {
          dmc: cell,
          symbol: SYMBOLS[symbolIdx % SYMBOLS.length],
        });
        symbolIdx++;
      }
    }
  }
  // Attach counts
  for (const [id, entry] of colorMap) {
    entry.count = finalFreq.get(id) || 0;
  }

  return { grid, colorMap, width: gridWidth, height: gridHeight };
}

/**
 * Render a pattern preview to a canvas element
 */
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

  // Grid lines
  ctx.strokeStyle = "rgba(0,0,0,0.1)";
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= width; x++) {
    ctx.beginPath();
    ctx.moveTo(x * cellSize, 0);
    ctx.lineTo(x * cellSize, height * cellSize);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * cellSize);
    ctx.lineTo(width * cellSize, y * cellSize);
    ctx.stroke();
  }

  // Bold lines every 10
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= width; x += 10) {
    ctx.beginPath();
    ctx.moveTo(x * cellSize, 0);
    ctx.lineTo(x * cellSize, height * cellSize);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += 10) {
    ctx.beginPath();
    ctx.moveTo(0, y * cellSize);
    ctx.lineTo(width * cellSize, y * cellSize);
    ctx.stroke();
  }
}
