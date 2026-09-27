// One-tap poster/infographic export — combines a note's key terms and its
// mind map (concept connections) into one colorful, printable one-page
// study poster, the kind of thing a student could actually stick on their
// wall before an exam. Built the same way as achievementCard.js (plain
// Canvas API, no image library, no server call) — reusing that tech for a
// different, much more shareable output shape.
const WIDTH = 1080;
const HEIGHT = 1400;

const PALETTE = ["#7C5CFC", "#22C99A", "#FFB020", "#FF5C5C", "#3FE0B0", "#FFC940"];

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapLines(ctx, text, maxWidth, maxLines = 3) {
  const words = (text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
    if (lines.length === maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines && ctx.measureText(line).width > maxWidth) {
    while (ctx.measureText(`${lines[maxLines - 1]}…`).width > maxWidth && lines[maxLines - 1].length > 1) {
      lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1);
    }
    lines[maxLines - 1] += "…";
  }
  return lines;
}

export function renderInfographic({ title, subject, keyTerms = [], mindMap = null }) {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");

  // Page background.
  ctx.fillStyle = "#FBFAFF";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Header band.
  const headerH = 220;
  const grad = ctx.createLinearGradient(0, 0, WIDTH, headerH);
  grad.addColorStop(0, "#7C5CFC");
  grad.addColorStop(1, "#5230D6");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, headerH);

  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath();
  ctx.arc(WIDTH - 60, 40, 140, 0, Math.PI * 2);
  ctx.fill();

  if (subject) {
    ctx.font = "bold 30px 'Arial'";
    ctx.textAlign = "left";
    const pillText = subject.toUpperCase();
    const pillW = ctx.measureText(pillText).width + 48;
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    roundRect(ctx, 64, 44, pillW, 52, 26);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillText(pillText, 64 + 24, 80);
  }

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.font = "bold 56px 'Arial'";
  const titleLines = wrapLines(ctx, title || "Study Poster", WIDTH - 128, 2);
  titleLines.forEach((line, i) => ctx.fillText(line, 64, 155 + i * 60));

  let y = headerH + 60;

  // Key terms grid.
  const terms = keyTerms.slice(0, 6);
  if (terms.length) {
    ctx.fillStyle = "#151429";
    ctx.font = "bold 34px 'Arial'";
    ctx.fillText("Key terms", 64, y);
    y += 30;

    const cols = 2;
    const gap = 24;
    const cardW = (WIDTH - 128 - gap) / cols;
    const cardH = 150;
    terms.forEach((t, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = 64 + col * (cardW + gap);
      const cy = y + 20 + row * (cardH + gap);
      const color = PALETTE[i % PALETTE.length];

      ctx.fillStyle = `${color}1A`;
      roundRect(ctx, x, cy, cardW, cardH, 20);
      ctx.fill();
      ctx.strokeStyle = `${color}55`;
      ctx.lineWidth = 2;
      roundRect(ctx, x, cy, cardW, cardH, 20);
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.font = "bold 30px 'Arial'";
      const termLines = wrapLines(ctx, t.term || "", cardW - 40, 1);
      ctx.fillText(termLines[0] || "", x + 20, cy + 42);

      ctx.fillStyle = "#3a3752";
      ctx.font = "500 22px 'Arial'";
      const defLines = wrapLines(ctx, t.definition || "", cardW - 40, 3);
      defLines.forEach((line, li) => ctx.fillText(line, x + 20, cy + 76 + li * 27));
    });

    const rows = Math.ceil(terms.length / cols);
    y += 20 + rows * (cardH + gap);
  }

  // Concept connections, from the mind map already generated for this note
  // — root at top, branches as colored pills below it, each branch's
  // children listed as small chips underneath. No force-layout math
  // needed since a mind map is already a clean tree.
  if (mindMap?.branches?.length) {
    y += 20;
    ctx.fillStyle = "#151429";
    ctx.font = "bold 34px 'Arial'";
    ctx.fillText("How it connects", 64, y);
    y += 50;

    // Root pill, centered.
    ctx.font = "bold 30px 'Arial'";
    const rootText = mindMap.root || "";
    const rootW = ctx.measureText(rootText).width + 56;
    const rootX = WIDTH / 2 - rootW / 2;
    ctx.fillStyle = "#151429";
    roundRect(ctx, rootX, y, rootW, 58, 29);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText(rootText, WIDTH / 2, y + 39);
    ctx.textAlign = "left";
    y += 90;

    const branches = mindMap.branches.slice(0, 4);
    for (const branch of branches) {
      const color = PALETTE[branches.indexOf(branch) % PALETTE.length];
      ctx.font = "bold 26px 'Arial'";
      const label = branch.label || "";
      const labelW = ctx.measureText(label).width + 44;
      ctx.fillStyle = color;
      roundRect(ctx, 64, y, labelW, 46, 23);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.fillText(label, 64 + 22, y + 31);

      // Children chips, wrapped onto the same row(s) to the right.
      let chipX = 64 + labelW + 16;
      let chipY = y;
      ctx.font = "600 22px 'Arial'";
      for (const child of branch.children || []) {
        const chipW = ctx.measureText(child).width + 32;
        if (chipX + chipW > WIDTH - 64) {
          chipX = 64 + labelW + 16;
          chipY += 52;
        }
        ctx.fillStyle = `${color}1A`;
        roundRect(ctx, chipX, chipY, chipW, 40, 20);
        ctx.fill();
        ctx.fillStyle = "#3a3752";
        ctx.fillText(child, chipX + 16, chipY + 27);
        chipX += chipW + 12;
      }
      y = chipY + 62;
    }
  }

  // Footer / branding.
  ctx.fillStyle = "#B8A9FF";
  ctx.fillRect(0, HEIGHT - 4, WIDTH, 4);
  ctx.fillStyle = "#9691AD";
  ctx.font = "600 24px 'Arial'";
  ctx.textAlign = "center";
  ctx.fillText("✨ Made with NoteBuddy", WIDTH / 2, HEIGHT - 30);

  return canvas;
}

// Shares (Web Share API with a file, when supported) or falls back to
// downloading the PNG directly — same fallback pattern as
// shareAchievementCard.
export async function shareInfographic(options) {
  const canvas = renderInfographic(options);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Couldn't generate the poster image.");

  const safeName = (options.title || "study-poster").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50);
  const file = new File([blob], `${safeName}-poster.png`, { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: options.title });
    return "shared";
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeName}-poster.png`;
  a.click();
  URL.revokeObjectURL(url);
  return "downloaded";
}
