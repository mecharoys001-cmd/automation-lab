"use client";

import { StackTool, Connection, CATEGORIES, CAT_COLOR } from "@/lib/techStack";

const LANE_W   = 172;
const LANE_GAP = 16;
const NODE_H   = 42;
const NODE_W   = 152;
const NODE_GAP = 10;
const HEADER_H = 52;
const PAD      = 20;

interface Pos { x: number; y: number; cx: number; cy: number; }

function getPositions(tools: StackTool[]): Record<string, Pos> {
  const activeCats = CATEGORIES.filter(c => tools.some(t => t.category === c));
  const out: Record<string, Pos> = {};
  activeCats.forEach((cat, ci) => {
    tools.filter(t => t.category === cat).forEach((tool, ti) => {
      const x = PAD + ci * (LANE_W + LANE_GAP);
      const y = HEADER_H + ti * (NODE_H + NODE_GAP);
      out[tool.id] = { x, y, cx: x + LANE_W / 2, cy: y + NODE_H / 2 };
    });
  });
  return out;
}

function canvasSize(tools: StackTool[]): { w: number; h: number } {
  const activeCats = CATEGORIES.filter(c => tools.some(t => t.category === c));
  const maxRows = Math.max(0, ...CATEGORIES.map(c => tools.filter(t => t.category === c).length));
  return {
    w: Math.max(520, PAD * 2 + activeCats.length * (LANE_W + LANE_GAP) - LANE_GAP),
    h: Math.max(260, HEADER_H + maxRows * (NODE_H + NODE_GAP) + PAD * 2),
  };
}

interface Props {
  tools: StackTool[];
  connections: Connection[];
  selected: string | null;
  onNodeClick: (id: string) => void;
}

export default function TechStackMap({ tools, connections, selected, onNodeClick }: Props) {
  const pos = getPositions(tools);
  const { w, h } = canvasSize(tools);
  const activeCats = CATEGORIES.filter(c => tools.some(t => t.category === c));

  if (tools.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "280px", color: "#475569", gap: "1rem" }}>
        <div style={{ fontSize: "3rem" }}>🗺️</div>
        <div style={{ fontWeight: 600, fontSize: "15px", color: "#64748b" }}>Your map will appear here</div>
        <div style={{ fontSize: "13px", color: "#334155" }}>Add tools from the panel on the left</div>
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto", overflowY: "visible" }}>
      <div style={{ position: "relative", width: w, height: h, minWidth: w }}>

        {/* Category lane headers */}
        {activeCats.map((cat, ci) => {
          const x = PAD + ci * (LANE_W + LANE_GAP);
          const color = CAT_COLOR[cat];
          return (
            <div key={cat} style={{ position: "absolute", left: x, top: 0, width: LANE_W }}>
              <div style={{
                fontSize: "10px", fontWeight: 700, textTransform: "uppercase",
                letterSpacing: "0.12em", color, textAlign: "center",
                padding: "5px 6px", backgroundColor: `${color}12`,
                border: `1px solid ${color}28`, borderRadius: "7px",
              }}>
                {cat}
              </div>
            </div>
          );
        })}

        {/* SVG connection layer */}
        <svg
          style={{ position: "absolute", top: 0, left: 0, width: w, height: h, pointerEvents: "none", overflow: "visible" }}
        >
          {connections.map(conn => {
            const from = pos[conn.a];
            const to   = pos[conn.b];
            if (!from || !to) return null;
            const mx = (from.cx + to.cx) / 2;
            return (
              <path
                key={conn.id}
                d={`M ${from.cx} ${from.cy} C ${mx} ${from.cy} ${mx} ${to.cy} ${to.cx} ${to.cy}`}
                fill="none"
                stroke="#6366f1"
                strokeWidth="1.5"
                strokeOpacity="0.55"
                strokeLinecap="round"
              />
            );
          })}
        </svg>

        {/* Tool nodes */}
        {tools.map(tool => {
          const p     = pos[tool.id];
          if (!p) return null;
          const color = CAT_COLOR[tool.category];
          const isSel = tool.id === selected;
          return (
            <div
              key={tool.id}
              onClick={() => onNodeClick(tool.id)}
              title={`${tool.name} · ${tool.category}`}
              style={{
                position: "absolute",
                left: p.x, top: p.y,
                width: NODE_W, height: NODE_H,
                display: "flex", alignItems: "center", gap: "8px",
                padding: "0 12px",
                backgroundColor: isSel ? color : "#111827",
                border: `1.5px solid ${isSel ? color : color + "44"}`,
                borderRadius: "10px",
                cursor: "pointer",
                transition: "all 0.12s",
                fontSize: "12px", fontWeight: 600,
                color: isSel ? "#fff" : "#dde4f0",
                boxShadow: isSel ? `0 0 18px ${color}55` : "none",
                userSelect: "none",
                overflow: "hidden",
              }}
            >
              <span style={{ fontSize: "15px", flexShrink: 0 }}>{tool.icon}</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tool.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
