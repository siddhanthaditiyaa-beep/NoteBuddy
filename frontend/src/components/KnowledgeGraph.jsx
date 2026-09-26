import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Network as GraphIcon, Loader2 } from "lucide-react";
import { getKnowledgeGraph } from "../lib/api";

const WIDTH = 760;
const HEIGHT = 480;
const MAX_CHARS_PER_LINE = 11;
const MIN_RADIUS = 32;
const MAX_RADIUS = 54;

// Splits a label into at most 2 short lines (word-wrapped, not
// mid-word-truncated) so long concept names stay fully readable instead
// of being cut off with an ellipsis.
function wrapLabel(label) {
  const words = (label || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  for (const w of words) {
    const next = current ? `${current} ${w}` : w;
    if (next.length > MAX_CHARS_PER_LINE && current) {
      lines.push(current);
      current = w;
    } else {
      current = next;
    }
    if (lines.length === 2) break;
  }
  if (current && lines.length < 2) lines.push(current);
  if (lines.length === 2 && words.join(" ").length > lines.join(" ").length) {
    // there was more text than fit — mark the second line as truncated
    const used = lines.join(" ").length;
    if (label.length > used) lines[1] = `${lines[1].slice(0, MAX_CHARS_PER_LINE - 1)}…`;
  }
  return lines.slice(0, 2);
}

function radiusFor(lines) {
  const longest = Math.max(...lines.map((l) => l.length), 4);
  return Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, 18 + longest * 2.6));
}

// A small Fruchterman-Reingold force-directed layout, computed once and
// synchronously (no animation-frame loop needed — these graphs are tiny,
// 8-16 nodes) rather than pulling in a graph-visualization library just
// for this one feature. Node radius scales with label length, and a final
// overlap-resolution pass (radius-aware, unlike the point-charge repulsion
// used during the main simulation) makes sure two big labels never render
// on top of each other.
function layoutGraph(nodes, edges) {
  const withMeta = nodes.map((n) => {
    const lines = wrapLabel(n.label);
    return { ...n, lines, r: radiusFor(lines) };
  });

  const area = WIDTH * HEIGHT;
  const k = Math.sqrt(area / Math.max(withMeta.length, 1)) * 1.15;
  const positioned = withMeta.map((n, i) => {
    const angle = (i / withMeta.length) * 2 * Math.PI;
    const spread = Math.min(WIDTH, HEIGHT) / 2 - 70;
    return { ...n, x: WIDTH / 2 + Math.cos(angle) * spread * 0.6, y: HEIGHT / 2 + Math.sin(angle) * spread * 0.6, vx: 0, vy: 0 };
  });
  const byId = Object.fromEntries(positioned.map((n) => [n.id, n]));
  const validEdges = edges.filter((e) => byId[e.source] && byId[e.target]);

  let temperature = WIDTH / 10;
  const iterations = 300;

  for (let iter = 0; iter < iterations; iter++) {
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
    for (const n of positioned) {
      const disp = Math.max(Math.sqrt(n.vx * n.vx + n.vy * n.vy), 0.01);
      n.x += (n.vx / disp) * Math.min(disp, temperature);
      n.y += (n.vy / disp) * Math.min(disp, temperature);
      n.x = Math.min(WIDTH - n.r - 10, Math.max(n.r + 10, n.x));
      n.y = Math.min(HEIGHT - n.r - 10, Math.max(n.r + 10, n.y));
    }
    temperature *= 0.97;
  }

  // Radius-aware overlap resolution — the simulation above treats every
  // node as a point charge, so two nodes with large radii (long labels)
  // can still end up closer than the sum of their radii. Nudge them apart.
  for (let pass = 0; pass < 40; pass++) {
    let moved = false;
    for (let i = 0; i < positioned.length; i++) {
      for (let j = i + 1; j < positioned.length; j++) {
        const a = positioned[i];
        const b = positioned[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 0.01);
        const minDist = a.r + b.r + 18;
        if (dist < minDist) {
          const overlap = (minDist - dist) / 2;
          const ux = dx / dist;
          const uy = dy / dist;
          a.x -= ux * overlap;
          a.y -= uy * overlap;
          b.x += ux * overlap;
          b.y += uy * overlap;
          moved = true;
        }
      }
    }
    for (const n of positioned) {
      n.x = Math.min(WIDTH - n.r - 10, Math.max(n.r + 10, n.x));
      n.y = Math.min(HEIGHT - n.r - 10, Math.max(n.r + 10, n.y));
    }
    if (!moved) break;
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
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto bg-white rounded-xl2 shadow-card">
        {layout.edges.map((e, i) => {
          const a = layout.nodes.find((n) => n.id === e.source);
          const b = layout.nodes.find((n) => n.id === e.target);
          const isActive = activeEdgeSet?.has(`${e.source}|${e.target}`);
          const midX = (a.x + b.x) / 2;
          const midY = (a.y + b.y) / 2;
          return (
            <g key={i} opacity={activeId && !isActive ? 0.12 : 1}>
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={isActive ? "#7C5CFC" : "#B8A9FF"}
                strokeWidth={isActive ? 2.5 : 1.5}
              />
              {e.relation && (
                <>
                  <rect
                    x={midX - (e.relation.length * 3 + 6)}
                    y={midY - 8}
                    width={e.relation.length * 6 + 12}
                    height={14}
                    rx={7}
                    className="fill-white"
                    opacity={0.92}
                  />
                  <text
                    x={midX}
                    y={midY}
                    fontSize="9.5"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="font-bold select-none fill-[#2d2a3d]/70"
                  >
                    {e.relation}
                  </text>
                </>
              )}
            </g>
          );
        })}
        {layout.nodes.map((n) => {
          const isActive = n.id === activeId;
          const isNeighbor = neighborIds?.has(n.id);
          const dim = activeId && !isActive && !isNeighbor;
          const lineHeight = 11;
          const startY = -((n.lines.length - 1) * lineHeight) / 2;
          return (
            <g
              key={n.id}
              transform={`translate(${n.x}, ${n.y})`}
              onClick={() => setActiveId(activeId === n.id ? null : n.id)}
              className="cursor-pointer"
              opacity={dim ? 0.3 : 1}
            >
              <circle
                r={n.r}
                className={isActive ? "fill-primary-500" : "fill-primary-50"}
                stroke="#7C5CFC"
                strokeWidth={isActive ? 3 : 2}
              />
              {n.lines.map((line, li) => (
                <text
                  key={li}
                  y={startY + li * lineHeight}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="10"
                  fontWeight="700"
                  className={isActive ? "fill-white select-none" : "fill-[#2d2a3d] select-none"}
                >
                  {line}
                </text>
              ))}
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
