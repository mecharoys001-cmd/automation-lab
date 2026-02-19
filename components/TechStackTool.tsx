"use client";

import { useState, useRef } from "react";
import {
  StackMap, StackTool, Connection, LibTool, Category,
  TOOL_LIBRARY, CATEGORIES, CAT_COLOR,
  newMap, connKey, downloadJson,
} from "@/lib/techStack";
import TechStackMap from "./TechStackMap";

const ACCENT = "#0ea5e9";

type Mode = "browse" | "connect" | "delete";

export default function TechStackTool() {
  const [map,        setMap]        = useState<StackMap>(newMap());
  const [mode,       setMode]       = useState<Mode>("browse");
  const [selected,   setSelected]   = useState<string | null>(null);
  const [search,     setSearch]     = useState("");
  const [customName, setCustomName] = useState("");
  const [customCat,  setCustomCat]  = useState<Category>("Other");
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Library helpers ──────────────────────────────────────────────────────
  const isAdded = (lt: LibTool) => map.tools.some(t => t.name === lt.name);

  const toggleLib = (lt: LibTool) => {
    if (isAdded(lt)) {
      const id = map.tools.find(t => t.name === lt.name)!.id;
      setMap(m => ({
        ...m,
        tools: m.tools.filter(t => t.id !== id),
        connections: m.connections.filter(c => c.a !== id && c.b !== id),
      }));
    } else {
      const tool: StackTool = { id: `t-${Date.now()}-${Math.random().toString(36).slice(2)}`, ...lt };
      setMap(m => ({ ...m, tools: [...m.tools, tool] }));
    }
  };

  const addCustom = () => {
    const name = customName.trim();
    if (!name) return;
    const tool: StackTool = {
      id: `t-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name, category: customCat, icon: "🔧",
    };
    setMap(m => ({ ...m, tools: [...m.tools, tool] }));
    setCustomName("");
  };

  // ── Canvas click handler ────────────────────────────────────────────────
  const handleNodeClick = (id: string) => {
    if (mode === "delete") {
      setMap(m => ({
        ...m,
        tools: m.tools.filter(t => t.id !== id),
        connections: m.connections.filter(c => c.a !== id && c.b !== id),
      }));
      return;
    }
    if (mode === "connect") {
      if (!selected) { setSelected(id); return; }
      if (selected === id) { setSelected(null); return; }
      const key = connKey(selected, id);
      const exists = map.connections.find(c => connKey(c.a, c.b) === key);
      if (exists) {
        setMap(m => ({ ...m, connections: m.connections.filter(c => connKey(c.a, c.b) !== key) }));
      } else {
        const conn: Connection = {
          id: `c-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          a: selected, b: id,
        };
        setMap(m => ({ ...m, connections: [...m.connections, conn] }));
      }
      setSelected(null);
    }
  };

  // ── Import ───────────────────────────────────────────────────────────────
  const importJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try { setMap(JSON.parse(ev.target?.result as string)); } catch { /* ignore malformed */ }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const filtered = TOOL_LIBRARY.filter(t =>
    !search.trim() || t.name.toLowerCase().includes(search.toLowerCase())
  );

  const btnStyle = (active: boolean, danger?: boolean): React.CSSProperties => ({
    backgroundColor: active ? (danger ? "#dc2626" : ACCENT) : "transparent",
    border: `1px solid ${active ? "transparent" : "#334155"}`,
    borderRadius: "8px", padding: "7px 14px", fontSize: "12px",
    fontWeight: 600, color: active ? "#fff" : "#64748b",
    cursor: "pointer", whiteSpace: "nowrap" as const,
  });

  return (
    <div style={{ display: "flex", minHeight: "620px", overflow: "hidden" }}>

      {/* ── Left: Tool Library ─────────────────────────────────────── */}
      <div style={{
        width: "256px", flexShrink: 0, borderRight: "1px solid #1e293b",
        padding: "1.25rem", overflowY: "auto", maxHeight: "720px",
        backgroundColor: "#07090f",
      }}>
        <div style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "0.9rem" }}>
          Tool Library
        </div>

        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search tools…"
          style={{ width: "100%", backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "8px", color: "#e2e8f0", padding: "8px 11px", fontSize: "13px", marginBottom: "1rem", boxSizing: "border-box" }}
        />

        {CATEGORIES.map(cat => {
          const tools = filtered.filter(t => t.category === cat);
          if (!tools.length) return null;
          const color = CAT_COLOR[cat];
          return (
            <div key={cat} style={{ marginBottom: "1.1rem" }}>
              <div style={{ fontSize: "9px", fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "5px" }}>{cat}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                {tools.map(lt => {
                  const added = isAdded(lt);
                  return (
                    <button key={lt.name} onClick={() => toggleLib(lt)} style={{
                      display: "flex", alignItems: "center", gap: "8px",
                      backgroundColor: added ? `${color}18` : "transparent",
                      border: `1px solid ${added ? color + "40" : "#1e293b"}`,
                      borderRadius: "7px", padding: "5px 10px",
                      color: added ? color : "#94a3b8",
                      fontSize: "12px", cursor: "pointer", textAlign: "left",
                    }}>
                      <span>{lt.icon}</span>
                      <span style={{ flex: 1 }}>{lt.name}</span>
                      {added && <span style={{ fontSize: "10px", opacity: 0.8 }}>✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Custom tool form */}
        <div style={{ borderTop: "1px solid #1e293b", paddingTop: "1.1rem", marginTop: "0.5rem" }}>
          <div style={{ fontSize: "9px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "8px" }}>Custom Tool</div>
          <input
            value={customName} onChange={e => setCustomName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addCustom()}
            placeholder="Tool name…"
            style={{ width: "100%", backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "7px", color: "#e2e8f0", padding: "7px 10px", fontSize: "12px", marginBottom: "6px", boxSizing: "border-box" }}
          />
          <select
            value={customCat} onChange={e => setCustomCat(e.target.value as Category)}
            style={{ width: "100%", backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "7px", color: "#e2e8f0", padding: "7px 10px", fontSize: "12px", marginBottom: "6px" }}
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button onClick={addCustom} style={{ width: "100%", backgroundColor: ACCENT, color: "#fff", border: "none", borderRadius: "7px", padding: "8px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
            + Add Custom
          </button>
        </div>
      </div>

      {/* ── Right: Canvas ──────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

        {/* Toolbar */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "0.85rem 1.25rem", borderBottom: "1px solid #1e293b", flexWrap: "wrap", backgroundColor: "#07090f" }}>
          <input
            value={map.title} onChange={e => setMap(m => ({ ...m, title: e.target.value }))}
            style={{ flex: 1, minWidth: "140px", backgroundColor: "transparent", border: "1px solid #1e293b", borderRadius: "8px", color: "#e2e8f0", padding: "7px 12px", fontSize: "13px", fontWeight: 600 }}
          />
          <button onClick={() => { setMode("browse"); setSelected(null); }} style={btnStyle(mode === "browse")}>👁 Browse</button>
          <button onClick={() => { setMode("connect"); setSelected(null); }} style={btnStyle(mode === "connect")}>🔗 Connect</button>
          <button onClick={() => { setMode("delete"); setSelected(null); }} style={btnStyle(mode === "delete", true)}>🗑 Delete</button>
          <button onClick={() => downloadJson(map)} style={btnStyle(false)}>⬇ JSON</button>
          <button onClick={() => fileRef.current?.click()} style={btnStyle(false)}>⬆ Import</button>
          <button onClick={() => { setMap(newMap()); setSelected(null); }} style={btnStyle(false)}>✕ Clear</button>
          <input ref={fileRef} type="file" accept=".json" style={{ display: "none" }} onChange={importJson} />
        </div>

        {/* Mode hint */}
        {mode !== "browse" && (
          <div style={{
            padding: "7px 1.25rem", fontSize: "12px", fontWeight: 500,
            backgroundColor: mode === "connect" ? `${ACCENT}15` : "#dc262612",
            color: mode === "connect" ? ACCENT : "#f87171",
            borderBottom: "1px solid #1e293b",
          }}>
            {mode === "connect"
              ? selected ? "🔗 Now click a second tool — click again to toggle off" : "🔗 Click a tool to start a connection"
              : "🗑 Click any tool to remove it from the map"}
          </div>
        )}

        {/* Stats bar */}
        {map.tools.length > 0 && (
          <div style={{ padding: "7px 1.25rem", display: "flex", gap: "1.5rem", borderBottom: "1px solid #1e293b", backgroundColor: "#07090f" }}>
            {[
              { label: "tools",        val: map.tools.length },
              { label: "integrations", val: map.connections.length },
              { label: "isolated",     val: map.tools.filter(t => !map.connections.some(c => c.a === t.id || c.b === t.id)).length },
            ].map(({ label, val }) => (
              <div key={label} style={{ fontSize: "12px", color: "#64748b" }}>
                <span style={{ fontWeight: 700, color: "#94a3b8" }}>{val}</span> {label}
              </div>
            ))}
          </div>
        )}

        {/* Map canvas */}
        <div style={{ flex: 1, padding: "1.5rem", backgroundColor: "#080c14", overflowX: "auto" }}>
          <TechStackMap
            tools={map.tools}
            connections={map.connections}
            selected={selected}
            onNodeClick={handleNodeClick}
          />
        </div>
      </div>
    </div>
  );
}
