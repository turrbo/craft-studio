import { useState } from "react";
import SingleMode from "./components/SingleMode";
import BulkMode from "./components/BulkMode";
import CraftSelector from "./components/CraftSelector";
import CRAFT_TYPES from "./utils/craftTypes";
import "./App.css";

export default function App() {
  const [mode, setMode] = useState("single");
  const [craft, setCraft] = useState(CRAFT_TYPES.crossStitch);

  return (
    <div className="app">
      <header className="header">
        <h1 className="logo">Craft Pattern Studio</h1>
        <p className="tagline">Convert images to craft patterns and download as PDF</p>
      </header>

      <CraftSelector selected={craft} onSelect={setCraft} />

      <nav className="mode-tabs">
        <button className={`tab ${mode === "single" ? "active" : ""}`} onClick={() => setMode("single")}>
          Single Image
        </button>
        <button className={`tab ${mode === "bulk" ? "active" : ""}`} onClick={() => setMode("bulk")}>
          Bulk Upload
        </button>
      </nav>

      <main className="main">
        {mode === "single" ? <SingleMode craft={craft} /> : <BulkMode craft={craft} />}
      </main>
    </div>
  );
}
