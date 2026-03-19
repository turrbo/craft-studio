import { CRAFT_LIST } from "../utils/craftTypes";
import "./CraftSelector.css";

const ICONS = {
  crossStitch: "M4 4h4v4H4zm8 0h4v4h-4zm-8 8h4v4H4zm8 0h4v4h-4z",
  diamondPainting: "M12 2l8 10-8 10-8-10z",
  perlerBeads: "M6 6a2 2 0 104 0 2 2 0 00-4 0zm8 0a2 2 0 104 0 2 2 0 00-4 0zm-8 8a2 2 0 104 0 2 2 0 00-4 0zm8 0a2 2 0 104 0 2 2 0 00-4 0z",
  c2cCrochet: "M3 21L21 3M3 16l13-13M3 11l8-8M8 21l13-13M13 21l8-8",
  knitting: "M6 3v18M12 3v18M18 3v18M3 8h18M3 14h18",
  pixelArt: "M3 3h6v6H3zm12 0h6v6h-6zM3 15h6v6H3zm12 0h6v6h-6zm-6-6h6v6H9z",
  punchNeedle: "M12 3v12m0 0c-2 0-4 2-4 4m4-4c2 0 4 2 4 4M8 19h8",
  mosaic: "M3 3h5v5H3zm7 0h4v5h-4zm6 0h5v5h-5zM3 10h5v4H3zm7 0h4v4h-4zm6 0h5v4h-5zM3 16h5v5H3zm7 0h4v5h-4zm6 0h5v5h-5z",
  paintByNumbers: "M12 2a10 10 0 100 20 10 10 0 000-20zm0 5a1 1 0 110 2 1 1 0 010-2zm-3 5h6",
  coloringPage: "M15.5 2.5l6 6-12 12H3.5v-6zM18 9l-3-3",
  svgCut: "M6 3v18l6-4 6 4V3z",
};

export default function CraftSelector({ selected, onSelect }) {
  return (
    <div className="craft-selector">
      <div className="craft-grid">
        {CRAFT_LIST.map((c) => (
          <button
            key={c.id}
            className={`craft-card ${selected.id === c.id ? "active" : ""}`}
            onClick={() => onSelect(c)}
          >
            <svg className="craft-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d={ICONS[c.id] || ICONS.crossStitch} />
            </svg>
            <span className="craft-name">{c.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
