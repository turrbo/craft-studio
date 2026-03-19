import { useState } from "react";
import SingleMode from "./components/SingleMode";
import BulkMode from "./components/BulkMode";
import "./App.css";

export default function App() {
  const [mode, setMode] = useState("single");

  return (
    <div className="app">
      <header className="header">
        <h1 className="logo">CrossStitch Studio</h1>
        <p className="tagline">Convert images to cross-stitch patterns and download as PDF</p>
      </header>

      <nav className="mode-tabs">
        <button
          className={`tab ${mode === "single" ? "active" : ""}`}
          onClick={() => setMode("single")}
        >
          Single Image
        </button>
        <button
          className={`tab ${mode === "bulk" ? "active" : ""}`}
          onClick={() => setMode("bulk")}
        >
          Bulk Upload
        </button>
      </nav>

      <main className="main">
        {mode === "single" ? <SingleMode /> : <BulkMode />}
      </main>
    </div>
  );
}
