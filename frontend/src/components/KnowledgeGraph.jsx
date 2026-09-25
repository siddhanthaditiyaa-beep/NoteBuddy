import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Network as GraphIcon, Loader2 } from "lucide-react";
import { getKnowledgeGraph } from "../lib/api";

const WIDTH = 640;
const HEIGHT = 420;

// A small Fruchterman-Reingold force-directed layout, computed once and
// synchronously (no animation-frame loop needed — these graphs are tiny,
// 8-16 nodes) rather than pulling in a graph-visualization library just
// for this one feature.
function layoutGraph(nodes, edges) {
  const area = WIDTH * HEIGHT;
  const k = Math.sqrt(area / Math.max(nodes.length, 1)) * 0.9;
  const positioned = nodes.map((n, i) => {
    const angle = (i / nodes.length) * 2 * Math.PI;
    return { ...n, x: WIDTH / 2 + Math.cos(angle) * 120, y: HEIGHT / 2 + Math.sin(angle) * 120, vx: 0, vy: 0 };
  });
  const byId = Object.fromEntries(positioned.map((n) => [n.id, n]));
  const validEdges = edges.filter((e) => byId[e.source] && byId[e.target]);

  let temperature = WIDTH / 10;
  const iterations = 250;

  for (let iter = 0; iter < iterations; iter++) {
    // Repulsion between every pair of nodes.
    for (let i = 0; i < positioned.length; i++) {
      positioned[i].vx = 0;
      positioned[i].vy = 0;
      for (let j = 0; j < positioned.length; j++) {
        if (i === j) continue;
        const dx = positioned[i].x - positioned[j].x;
        const dy = positioned[i].y - positioned[j].y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 0.01);
        const force = (k * k) / dist;
        positioned[i].vx += (dx / dist) * force;
        positioned[i].vy += (dy / dist) * force;
      }
    }
    // Attraction along edges.
    for (const e of validEdges) {
      const a = byId[e.source];
      const b = byId[e.target];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 0.01);
      const force = (dist * dist) / k;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx -= fx;
      a.vy -= fy;
      b.vx += fx;
      b.vy += fy;
    }
    // Apply, cooling down over time so the layout settles.
    for (const n of positioned) {
      const disp = Math.max(Math.sqrt(n.vx * n.vx + n.vy * n.vy), 0.01);
      n.x += (n.vx / disp) * Math.min(disp, temperature);
      n.y += (n.vy / disp) * Math.min(disp, temperature);
      n.x = Math.min(WIDTH - 50, Math.max(50, n.x));
      n.y = Math.min(HEIGHT - 40, Math.max(40, n.y));
    }
    temperature *= 0.97;
  }

  return { nodes: positioned, edges: validEdges };
}

export default function KnowledgeGraph({ noteId }) {
  const [raw, setRaw] = useState(null); // { nodes, edges } | null
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [activeId, setActiveId] = useState(null);

  const layout = useMemo(() => (raw ? layoutGraph(raw.nodes, raw.edges) : null), [raw]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getKnowledgeGraph(noteId);
      setRaw(data);
    } catch (e) {
      toast.error(e.message || "Couldn't build a concept map right now.");
    } finally {
      setLoading(false);
      setFetched(true);
    }
  };

  useEffect(() => {
    setRaw(null);
    setFetched(false);
    setActiveId(null);
  }, [noteId]);

  if (!fetched) {
    return (
      <div className="text-center py-10">
        <div className="w-16 h-16 rounded-xl3 bg-primary-50 flex items-center justify-center mx-auto mb-4">
          <GraphIcon className="text-primary-500" size={28} />
        </div>
        <h3 className="font-display text-xl font-bold mb-2">Visual Knowledge Graph</h3>
        <p className="text-sm font-semibold text-ink/50 mb-6 max-w-sm mx-auto">
          Maps the key concepts in this note and how they connect — sometimes seeing the shape of an idea is what
          makes it click.
        </p>
        <button
          onClick={load}
          disabled={loading}
          className="px-6 py-3 rounded-xl2 bg-primary-500 text-white font-bold shadow-soft hover:bg-primary-600 disabled:opacity-60 transition-colors flex items-center gap-2 mx-auto"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <GraphIcon size={16} />}
          {loading ? "Mapping concepts..." : "Build the concept map"}
        </button>
      </div>
    );
  }

  if (!layout || layout.nodes.length === 0) {
    return <p className="text-center text-ink/40 font-semibold py-10">Couldn't find enough distinct concepts to map.</p>;
  }

  const activeEdgeSet = activeId
    ? new Set(layout.edges.filter((e) => e.source === activeId || e.target === activeId).map((e) => `${e.source}|${e.target}`))
    : null;
  const neighborIds = activeId
    ? new Set(layout.edges.filter((e) => e.source === activeId || e.target === activeId).flatMap((e) => [e.source, e.target]))
    : null;

  return (
    <div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto bg-primary-50/30 rounded-xl2">
        {layout.edges.map((e, i) => {
          const a = layout.nodes.find((n) => n.id === e.source);
          const b = layout.nodes.find((n) => n.id === e.target);
          const isActive = activeEdgeSet?.has(`${e.source}|${e.target}`);
          const midX = (a.x + b.x) / 2;
          const midY = (a.y + b.y) / 2;
          return (
            <g key={i} opacity={activeId && !isActive ? 0.15 : 1}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={isActive ? "#7C5CFC" : "#c9bfff"} strokeWidth={isActive ? 2 : 1.5} />
              <text x={midX} y={midY} fontSize="9" fill="#8b83a8" textAnchor="middle" className="font-semibold select-none">
                {e.relation}
              </text>
            </g>
          );
        })}
        {layout.nodes.map((n) => {
          const isActive = n.id === activeId;
          const isNeighbor = neighborIds?.has(n.id);
          const dim = activeId && !isActive && !isNeighbor;
          return (
            <g
              key={n.id}
              transform={`translate(${n.x}, ${n.y})`}
              onClick={() => setActiveId(activeId === n.id ? null : n.id)}
              className="cursor-pointer"
              opacity={dim ? 0.35 : 1}
            >
              <circle r={isActive ? 30 : 26} fill={isActive ? "#7C5CFC" : "#fff"} stroke="#7C5CFC" strokeWidth={2} />
              <text
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="9"
                fontWeight="700"
                fill={isActive ? "#fff" : "#2d2a3d"}
                className="select-none"
              >
                {(n.label || "").length > 16 ? `${n.label.slice(0, 14)}…` : n.label}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="text-xs font-semibold text-ink/40 text-center mt-3">
        Tap a concept to highlight what it connects to.
      </p>
    </div>
  );
}
