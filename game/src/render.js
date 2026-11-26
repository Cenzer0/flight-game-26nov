// The painter: sky, sea, islands, runway, rings, the courier plane and its
// lit instruments, then the title, pause and end screens. The canvas is a
// fixed 1280x800 stage; everything is drawn in stage pixels.
import {
  H, INK, LAND, LANDING, LIT_AMBER, LIT_CYAN, LIT_GREEN, LIT_RED,
  PANEL, PANEL_EDGE, RUNWAY, SEA, SKY, W,
} from './config.js';
import { horizonY, makeCamera, onScreen, project } from './project.js';
import { shrinkOutline } from './terrain.js';
import { nextRing, MISSIONS } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_LANDED = 'landed';
export const SCREEN_CRASHED = 'crashed';

// Clickable rects, shared with the loop's hit test.
export const TITLE_CARDS = [
  { x: 140, y: 470, w: 320, h: 170 },
  { x: 480, y: 470, w: 320, h: 170 },
  { x: 820, y: 470, w: 320, h: 170 },
];
export const OVER_BUTTON = { x: 490, y: 560, w: 300, h: 64 };

export function createRenderer(canvas) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  function sky(camera, dusk) {
    const pal = dusk ? SKY.dusk : SKY.day;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, pal.top);
    g.addColorStop(0.45, pal.mid);
    g.addColorStop(0.62, pal.horizon);
    g.addColorStop(0.621, pal.horizon);
    g.addColorStop(1, pal.horizon);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // Sun with a soft halo, high on the right.
    const sx = W * 0.8;
    const sy = H * 0.13;
    const halo = ctx.createRadialGradient(sx, sy, 4, sx, sy, 110);
    halo.addColorStop(0, pal.sun);
    halo.addColorStop(0.25, pal.sun + 'aa');
    halo.addColorStop(1, pal.sun + '00');
    ctx.fillStyle = halo;
    ctx.fillRect(sx - 110, sy - 110, 220, 220);
    ctx.fillStyle = pal.sun;
    ctx.beginPath();
    ctx.arc(sx, sy, 26, 0, Math.PI * 2);
    ctx.fill();
  }

  function sea(camera, dusk) {
    const pal = dusk ? SEA.dusk : SEA.day;
    const hy = horizonY(camera);
    const g = ctx.createLinearGradient(0, hy, 0, H);
    g.addColorStop(0, pal.far);
    g.addColorStop(1, pal.near);
    ctx.fillStyle = g;
    ctx.fillRect(0, hy, W, H - hy);
  }

  function polygon(points, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    ctx.fill();
  }

  function drawIslands(world, camera) {
    const sorted = [...world.islands].sort((a, b) => {
      const da = (a.cx - camera.x) ** 2 + (a.cz - camera.z) ** 2;
      const db = (b.cx - camera.x) ** 2 + (b.cz - camera.z) ** 2;
      return db - da;
    });
    for (const island of sorted) {
      const outline = island.outline
        .map((p) => project(camera, p.x, island.height, p.z))
        .filter(Boolean);
      if (outline.length < 3) continue;
      polygon(outline, LAND.sand);
      const inner = shrinkOutline(island.outline, island.cx, island.cz, 0.8)
        .map((p) => project(camera, p.x, island.height + 1, p.z))
        .filter(Boolean);
      if (inner.length >= 3) polygon(inner, island.kind === 'volcano' ? LAND.hill : LAND.grass);
      // Jungle heart.
      const core = shrinkOutline(island.outline, island.cx, island.cz, 0.45)
        .map((p) => project(camera, p.x, island.height + 2, p.z))
        .filter(Boolean);
      if (core.length >= 3) polygon(core, LAND.jungle);

      if (island.kind === 'volcano' && island.volcano) {
        drawVolcano(camera, island.volcano);
      }
      if (island.kind === 'terraces' && island.terraces) {
        drawTerraces(camera, island);
      }
      for (const village of island.villages) drawVillage(camera, village, island.height);
      for (const palm of island.palmSpots) drawPalm(camera, palm, island.height);
      if (island.kind === 'home') drawRunway(camera);
    }
  }

  function drawVolcano(camera, volcano) {
    const baseL = project(camera, volcano.x - volcano.base, 14, volcano.z);
    const baseR = project(camera, volcano.x + volcano.base, 14, volcano.z);
    const apex = project(camera, volcano.x, 14 + volcano.height, volcano.z);
    if (!baseL || !baseR || !apex) return;
    ctx.fillStyle = LAND.volcano;
    ctx.beginPath();
    ctx.moveTo(baseL.x, baseL.y);
    ctx.lineTo(apex.x, apex.y);
    ctx.lineTo(baseR.x, baseR.y);
    ctx.closePath();
    ctx.fill();
    // Sunlit slope and the glowing crater.
    ctx.fillStyle = '#7a5f52';
    ctx.beginPath();
    ctx.moveTo(apex.x, apex.y);
    ctx.lineTo(baseR.x, baseR.y);
    ctx.lineTo((apex.x + baseR.x) / 2, (apex.y + baseR.y) / 2 + 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = LAND.lava;
    ctx.beginPath();
    ctx.ellipse(apex.x, apex.y + 4, Math.max(3, apex.scale * 26), Math.max(2, apex.scale * 7), 0, 0, Math.PI * 2);
    ctx.fill();
    // A lazy smoke curl above the crater.
    ctx.fillStyle = 'rgba(240,240,240,0.75)';
    ctx.beginPath();
    ctx.ellipse(apex.x + apex.scale * 18, apex.y - apex.scale * 42, apex.scale * 30, apex.scale * 12, -0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawTerraces(camera, island) {
    const t = island.terraces;
    ctx.strokeStyle = LAND.terrace;
    ctx.lineWidth = 2;
    for (let i = 1; i <= t.rings; i += 1) {
      const r = t.step * i;
      ctx.beginPath();
      let started = false;
      for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.3) {
        const p = project(camera, t.x + Math.cos(a) * r, island.height + 3 + i * 2, t.z + Math.sin(a) * r * 0.8);
        if (!p) continue;
        if (!started) { ctx.moveTo(p.x, p.y); started = true; }
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
  }

  function drawVillage(camera, village, groundY) {
    for (let i = 0; i < village.houses; i += 1) {
      const hx = village.x + (i % 3) * 46 - 46;
      const hz = village.z + Math.floor(i / 3) * 52;
      const p = project(camera, hx, groundY + 4, hz);
      if (!p || !onScreen(p, 20)) continue;
      const s = Math.max(2.5, p.scale * 16);
      ctx.fillStyle = LAND.village;
      ctx.fillRect(p.x - s / 2, p.y - s, s, s);
      ctx.fillStyle = LAND.roof;
      ctx.beginPath();
      ctx.moveTo(p.x - s / 2 - 1, p.y - s);
      ctx.lineTo(p.x, p.y - s * 1.7);
      ctx.lineTo(p.x + s / 2 + 1, p.y - s);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawPalm(camera, palm, groundY) {
    const p = project(camera, palm.x, groundY + 4, palm.z);
    if (!p || !onScreen(p, 10)) return;
    const s = Math.max(2, p.scale * 14);
    ctx.strokeStyle = '#5d4a2f';
    ctx.lineWidth = Math.max(1, s * 0.14);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x, p.y - s);
    ctx.stroke();
    ctx.fillStyle = '#2f8f3e';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - s, s * 0.9, s * 0.35, -0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawRunway(camera) {
    const y = 11;
    const corners = [
      project(camera, RUNWAY.x - RUNWAY.halfWidth, y, RUNWAY.zNorth),
      project(camera, RUNWAY.x + RUNWAY.halfWidth, y, RUNWAY.zNorth),
      project(camera, RUNWAY.x + RUNWAY.halfWidth, y, RUNWAY.zSouth),
      project(camera, RUNWAY.x - RUNWAY.halfWidth, y, RUNWAY.zSouth),
    ];
    if (corners.some((p) => !p)) return;
    polygon(corners, LAND.runway);
    // Centreline dashes and threshold bars.
    ctx.fillStyle = LAND.runwayLine;
    for (let z = RUNWAY.zNorth + 60; z < RUNWAY.zSouth - 40; z += 90) {
      const a = project(camera, RUNWAY.x, y + 0.3, z);
      const b = project(camera, RUNWAY.x, y + 0.3, z + 42);
      if (!a || !b) continue;
      ctx.fillRect(Math.min(a.x, b.x) - 1.5, Math.min(a.y, b.y), 3, Math.abs(b.y - a.y) + 2);
    }
    // Edge lights.
    ctx.fillStyle = LIT_AMBER;
    for (let z = RUNWAY.zNorth; z <= RUNWAY.zSouth; z += 105) {
      for (const side of [-1, 1]) {
        const p = project(camera, RUNWAY.x + side * (RUNWAY.halfWidth + 3), y + 1, z);
        if (p && onScreen(p, 10)) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(1.5, p.scale * 4), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  function drawSparkles(world, camera, dusk) {
    ctx.strokeStyle = dusk ? SEA.dusk.sparkle : SEA.day.sparkle;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1.5;
    for (const s of world.sparkles) {
      const p = project(camera, s.x, 0.5, s.z);
      if (!p || !onScreen(p, 10) || p.depth > 2600) continue;
      ctx.beginPath();
      ctx.moveTo(p.x - p.scale * s.len * 0.5, p.y);
      ctx.lineTo(p.x + p.scale * s.len * 0.5, p.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawClouds(world, camera) {
    const sorted = [...world.clouds].sort((a, b) => {
      const da = (a.x - camera.x) ** 2 + (a.z - camera.z) ** 2;
      const db = (b.x - camera.x) ** 2 + (b.z - camera.z) ** 2;
      return db - da;
    });
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    for (const cloud of sorted) {
      const p = project(camera, cloud.x, cloud.y, cloud.z);
      if (!p || !onScreen(p, 160)) continue;
      const s = p.scale * cloud.size;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, s, s * 0.32, 0, 0, Math.PI * 2);
      ctx.ellipse(p.x - s * 0.5, p.y + s * 0.06, s * 0.6, s * 0.26, 0, 0, Math.PI * 2);
      ctx.ellipse(p.x + s * 0.55, p.y + s * 0.05, s * 0.65, s * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** The dotted guide from the plane's nose to the next ring. */
  function drawGuide(world, camera) {
    const ring = nextRing(world.mission, world.ringIndex);
    if (!ring || world.state === 'landed' || world.state === 'crashed') return;
    const plane = world.plane;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (let t = 0.08; t < 1; t += 0.08) {
      const x = plane.x + (ring.x - plane.x) * t;
      const y = plane.alt + (ring.y - plane.alt) * t;
      const z = plane.z + (ring.z - plane.z) * t;
      const p = project(camera, x, y, z);
      if (!p || !onScreen(p, 20)) continue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function ringNormal(world, ring, index) {
    const prev = index === 0
      ? { x: 0, z: 360 }
      : world.mission.rings[index - 1];
    const dx = ring.x - prev.x;
    const dz = ring.z - prev.z;
    const len = Math.hypot(dx, dz) || 1;
    return { x: dx / len, z: dz / len };
  }

  function drawRings(world, camera) {
    const sorted = world.mission.rings
      .map((ring, i) => ({ ring, i }))
      .sort((a, b) => {
        const da = (a.ring.x - camera.x) ** 2 + (a.ring.z - camera.z) ** 2;
        const db = (b.ring.x - camera.x) ** 2 + (b.ring.z - camera.z) ** 2;
        return db - da;
      });
    for (const { ring, i } of sorted) {
      if (i < world.ringIndex) continue; // passed rings vanish
      const isNext = i === world.ringIndex;
      const n = ringNormal(world, ring, i);
      // Ring plane: vertical, facing along its course. Right vector is
      // horizontal and perpendicular to the course; up is world up.
      const rx = -n.z;
      const rz = n.x;
      const R = 30;
      const pts = [];
      for (let k = 0; k <= 24; k += 1) {
        const a = (k / 24) * Math.PI * 2;
        const px = ring.x + rx * Math.cos(a) * R;
        const py = ring.y + Math.sin(a) * R;
        const pz = ring.z + rz * Math.cos(a) * R;
        pts.push(project(camera, px, py, pz));
      }
      ctx.lineWidth = isNext ? 7 : 4;
      ctx.strokeStyle = isNext ? LIT_AMBER : 'rgba(125,227,255,0.75)';
      ctx.beginPath();
      let pen = false;
      for (const p of pts) {
        if (!p) { pen = false; continue; }
        if (!pen) { ctx.moveTo(p.x, p.y); pen = true; }
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      if (isNext) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = LIT_GREEN;
        ctx.beginPath();
        pen = false;
        for (const p of pts) {
          if (!p) { pen = false; continue; }
          if (!pen) { ctx.moveTo(p.x, p.y); pen = true; }
          else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
        // A thin beacon line from the ring down to the ground.
        const top = project(camera, ring.x, ring.y, ring.z);
        const bottom = project(camera, ring.x, 2, ring.z);
        if (top && bottom) {
          ctx.strokeStyle = 'rgba(255,200,87,0.5)';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 8]);
          ctx.beginPath();
          ctx.moveTo(top.x, top.y);
          ctx.lineTo(bottom.x, bottom.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }
  }

  /** The courier plane itself, drawn in screen space, banked with the wing. */
  function drawPlane(world) {
    const plane = world.plane;
    const cx = W / 2;
    const cy = H * 0.66;
    const s = 1 + Math.min(0.12, plane.speed / 800);
    // Shadow on the ground far below, shrinking with altitude.
    const shadow = project(makeCamera(plane), plane.x, 0.5, plane.z);
    if (shadow && plane.alt > 2) {
      const fade = Math.max(0.08, 0.5 - plane.alt / 700);
      ctx.fillStyle = `rgba(10,30,50,${fade})`;
      ctx.beginPath();
      ctx.ellipse(shadow.x, shadow.y, 46 * (1 - Math.min(0.6, plane.alt / 900)), 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(plane.bank * 0.85);
    ctx.scale(s, s);
    // Wings: wide, tapered, cream with teal tips.
    ctx.fillStyle = '#f4ead2';
    ctx.beginPath();
    ctx.moveTo(-150, 6);
    ctx.lineTo(-128, -14);
    ctx.lineTo(128, -14);
    ctx.lineTo(150, 6);
    ctx.lineTo(128, 16);
    ctx.lineTo(-128, 16);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#0f766e';
    ctx.fillRect(-150, 2, 22, 12);
    ctx.fillRect(128, 2, 22, 12);
    // Fuselage: slim and rounded, tapering to the tail at the top.
    const body = ctx.createLinearGradient(-19, 0, 19, 0);
    body.addColorStop(0, '#e8b23c');
    body.addColorStop(0.5, '#f7ecd2');
    body.addColorStop(1, '#e8b23c');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-18, 30);
    ctx.quadraticCurveTo(-22, -26, -12, -70);
    ctx.lineTo(12, -70);
    ctx.quadraticCurveTo(22, -26, 18, 30);
    ctx.quadraticCurveTo(0, 40, -18, 30);
    ctx.closePath();
    ctx.fill();
    // Teal cheatline along the fuselage.
    ctx.fillStyle = '#0f766e';
    ctx.fillRect(-19, -6, 38, 6);
    // Tail fin: red, with the courier's white star.
    ctx.fillStyle = '#c2410c';
    ctx.beginPath();
    ctx.moveTo(-11, -64);
    ctx.lineTo(0, -104);
    ctx.lineTo(11, -64);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    drawStar(0, -78, 6);
    // Tailplane.
    ctx.fillStyle = '#f4ead2';
    ctx.fillRect(-46, -60, 92, 9);
    // Spinning prop: a faint disc ahead of the nose, at the top.
    ctx.fillStyle = 'rgba(60,60,60,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, -82, 24, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Navigation lights: red left, green right, blinking with the clock.
    const blink = Math.floor(performance.now() / 450) % 2 === 0;
    if (blink) {
      ctx.fillStyle = LIT_RED;
      ctx.beginPath(); ctx.arc(-150, 8, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = LIT_GREEN;
      ctx.beginPath(); ctx.arc(150, 8, 5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawStar(x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rad = i % 2 === 0 ? r : r * 0.45;
      const px = x + Math.cos(a) * rad;
      const py = y + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  // ---- Instruments -------------------------------------------------------

  function gauge(x, y, r, label, value, unit, frac, color, warn) {
    ctx.save();
    ctx.translate(x, y);
    // Lit dial face.
    ctx.fillStyle = '#10233c';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = warn ? LIT_RED : PANEL_EDGE;
    ctx.lineWidth = 2;
    ctx.stroke();
    for (let i = 0; i <= 10; i += 1) {
      const a = -Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
      const major = i % 5 === 0;
      ctx.strokeStyle = '#8fb4d6';
      ctx.lineWidth = major ? 2.5 : 1;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (r - (major ? 10 : 6)), Math.sin(a) * (r - (major ? 10 : 6)));
      ctx.lineTo(Math.cos(a) * (r - 2), Math.sin(a) * (r - 2));
      ctx.stroke();
    }
    const a = -Math.PI * 0.75 + frac * Math.PI * 1.5;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * (r - 10), Math.sin(a) * (r - 10));
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#eaf3fb';
    ctx.font = 'bold 19px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(value, 0, r * 0.30);
    ctx.fillStyle = '#9db8cf';
    ctx.font = '11px sans-serif';
    ctx.fillText(`${label} · ${unit}`, 0, r * 0.74);
    ctx.restore();
  }

  function attitudeIndicator(x, y, r, plane) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.rotate(-plane.bank);
    const shift = Math.max(-r, Math.min(r, plane.pitch * r * 1.4));
    ctx.fillStyle = '#3f8fd2';
    ctx.fillRect(-r, -r + shift - r, r * 2, r * 2);
    ctx.fillStyle = '#8a5a33';
    ctx.fillRect(-r, shift, r * 2, r * 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r, shift);
    ctx.lineTo(r, shift);
    ctx.stroke();
    ctx.restore();
    // Fixed wings marker and bezel.
    ctx.strokeStyle = LIT_AMBER;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.55, y);
    ctx.lineTo(x - r * 0.18, y);
    ctx.moveTo(x + r * 0.18, y);
    ctx.lineTo(x + r * 0.55, y);
    ctx.stroke();
    ctx.strokeStyle = PANEL_EDGE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#9db8cf';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SIKAP', x, y + r + 14);
  }

  function compassTape(x, y, w, heading) {
    ctx.save();
    ctx.fillStyle = '#10233c';
    ctx.beginPath();
    ctx.roundRect(x, y, w, 44, 8);
    ctx.fill();
    ctx.strokeStyle = PANEL_EDGE;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(x, y, w, 44);
    ctx.clip();
    // A ±60° window: labels 30° apart get room instead of piling up.
    const deg = ((heading * 180) / Math.PI % 360 + 360) % 360;
    const points = [[0, 'U'], [45, 'TL'], [90, 'T'], [135, 'TG'], [180, 'S'], [225, 'BD'], [270, 'B'], [315, 'BL']];
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    for (let d = -60; d <= 60; d += 15) {
      const a = ((deg + d) % 360 + 360) % 360;
      const px = x + w / 2 + (d / 60) * (w / 2);
      // The heading is a float, so a tick only ever lands *near* a card
      // point or a round number — match within half a tick step.
      const near = (v) => Math.abs((((a - v) % 360) + 540) % 360 - 180) < 8;
      const card = points.find(([v]) => near(v));
      const round30 = !card && [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].some((v) => near(v));
      ctx.strokeStyle = '#8fb4d6';
      ctx.lineWidth = card ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(px, y + 8);
      ctx.lineTo(px, y + (card ? 22 : 16));
      ctx.stroke();
      if (card) {
        ctx.fillStyle = '#eaf3fb';
        ctx.fillText(card[1], px, y + 36);
      } else if (round30) {
        ctx.fillStyle = '#9db8cf';
        ctx.font = '11px sans-serif';
        ctx.fillText(String((Math.round(a / 30) * 30) % 360).padStart(3, '0'), px, y + 36);
        ctx.font = 'bold 13px sans-serif';
      }
    }
    ctx.restore();
    // Centre lubber line and the digital heading.
    ctx.strokeStyle = LIT_AMBER;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y - 4);
    ctx.lineTo(x + w / 2, y + 8);
    ctx.stroke();
    ctx.fillStyle = '#eaf3fb';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${String(Math.round(deg)).padStart(3, '0')}°`, x + w / 2, y + 62);
    ctx.fillStyle = '#9db8cf';
    ctx.font = '11px sans-serif';
    ctx.fillText('HEADING', x + w / 2, y + 76);
  }

  function bar(x, y, w, h, frac, color, label, value) {
    ctx.fillStyle = '#10233c';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 5);
    ctx.fill();
    ctx.fillStyle = color;
    const fh = Math.max(0, Math.min(1, frac)) * h;
    ctx.beginPath();
    ctx.roundRect(x + 2, y + h - fh - 2, w - 4, fh, 4);
    ctx.fill();
    ctx.strokeStyle = PANEL_EDGE;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 5);
    ctx.stroke();
    ctx.fillStyle = '#eaf3fb';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(value, x + w / 2, y + h + 16);
    ctx.fillStyle = '#9db8cf';
    ctx.font = '11px sans-serif';
    ctx.fillText(label, x + w / 2, y + h + 30);
  }

  function hud(world, screen) {
    const plane = world.plane;
    const mission = world.mission;
    // Top bar: mission, ring progress, score, clock.
    ctx.fillStyle = PANEL;
    ctx.fillRect(0, 0, W, 46);
    ctx.fillStyle = '#eaf3fb';
    ctx.font = 'bold 17px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`✈ ${mission.name}`, 18, 29);
    ctx.textAlign = 'center';
    const ring = nextRing(mission, world.ringIndex);
    ctx.fillStyle = ring ? LIT_AMBER : LIT_GREEN;
    ctx.fillText(
      ring ? `RING ${world.ringIndex + 1}/${mission.rings.length} · ${Math.round(Math.hypot(ring.x - plane.x, ring.z - plane.z))} m` : 'SEMUA RING LEWAT — MENDARAT!',
      W / 2, 29,
    );
    ctx.textAlign = 'right';
    ctx.fillStyle = '#eaf3fb';
    const mm = String(Math.floor(world.time / 60)).padStart(2, '0');
    const ss = String(Math.floor(world.time % 60)).padStart(2, '0');
    ctx.fillText(`SKOR ${world.score}   ${mm}:${ss}`, W - 18, 29);

    // Bottom instrument panel.
    ctx.fillStyle = PANEL;
    ctx.fillRect(0, H - 158, W, 158);
    ctx.strokeStyle = PANEL_EDGE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, H - 158);
    ctx.lineTo(W, H - 158);
    ctx.stroke();

    const speedKmh = Math.round(plane.speed * 3.6);
    gauge(92, H - 84, 52, 'KECEPATAN', String(speedKmh), 'km/j', plane.speed / 92, speedKmh < 100 ? LIT_RED : LIT_GREEN, speedKmh < 100 && plane.airborne);
    attitudeIndicator(238, H - 84, 46, plane);
    gauge(392, H - 84, 52, 'KETINGGIAN', String(Math.round(plane.alt)), 'm', Math.min(1, plane.alt / 500), LIT_CYAN, false);
    compassTape(500, H - 128, 300, plane.heading);
    // Vertical speed readout under the compass.
    ctx.fillStyle = plane.verticalSpeed < -4 ? LIT_RED : '#eaf3fb';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    const vs = plane.verticalSpeed >= 0 ? `+${plane.verticalSpeed.toFixed(1)}` : plane.verticalSpeed.toFixed(1);
    ctx.fillText(`V/S ${vs} m/s`, 650, H - 30);
    bar(850, H - 138, 30, 104, plane.throttle, LIT_AMBER, 'GAS', `${Math.round(plane.throttle * 100)}%`);
    bar(905, H - 138, 30, 104, plane.fuel / 100, plane.fuel < 20 ? LIT_RED : LIT_GREEN, 'BBM', `${Math.round(plane.fuel)}`);
    // Score block on the right.
    ctx.textAlign = 'left';
    ctx.fillStyle = '#9db8cf';
    ctx.font = '11px sans-serif';
    ctx.fillText('SKOR', 975, H - 128);
    ctx.fillStyle = '#eaf3fb';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(String(world.score), 975, H - 96);
    ctx.fillStyle = '#9db8cf';
    ctx.font = '11px sans-serif';
    ctx.fillText(`TERBAIK ${Math.max(world.best, world.score)}`, 975, H - 72);
    ctx.fillText('Panah: pitch & belok · W/S gas', 975, H - 48);
    ctx.fillText('P jeda · M suara · R ulang', 975, H - 28);

    // Flash message, centre-top under the bar.
    if (world.time < world.messageUntil && world.message) {
      ctx.font = 'bold 22px sans-serif';
      const tw = ctx.measureText(world.message).width;
      ctx.fillStyle = 'rgba(14,27,46,0.85)';
      ctx.beginPath();
      ctx.roundRect(W / 2 - tw / 2 - 18, 58, tw + 36, 38, 10);
      ctx.fill();
      ctx.fillStyle = LIT_AMBER;
      ctx.textAlign = 'center';
      ctx.fillText(world.message, W / 2, 84);
    }

    // Off-screen target arrow.
    if (ring && screen === SCREEN_PLAY) {
      const cam = makeCamera(plane);
      const p = project(cam, ring.x, ring.y, ring.z);
      if (!p || !onScreen(p, 30)) {
        const want = Math.atan2(ring.x - plane.x, -(ring.z - plane.z));
        const err = ((want - plane.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        const ax = W / 2 + Math.sign(err) * 420;
        const ay = 150;
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(err > 0 ? Math.PI / 2 : -Math.PI / 2);
        ctx.fillStyle = LIT_AMBER;
        ctx.beginPath();
        ctx.moveTo(0, -16);
        ctx.lineTo(14, 10);
        ctx.lineTo(-14, 10);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = LIT_AMBER;
        ctx.font = 'bold 15px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`RING ${Math.round(Math.hypot(ring.x - plane.x, ring.z - plane.z))} m`, ax, ay + 34);
      }
    }
    // Stall warning strip.
    if (plane.airborne && plane.speed < 28) {
      ctx.fillStyle = 'rgba(255,60,40,0.85)';
      ctx.fillRect(W / 2 - 130, 108, 260, 30);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚠ STALL — TAMBAH GAS!', W / 2, 129);
    }
  }

  // ---- Screens -----------------------------------------------------------

  function titleScreen(world) {
    ctx.fillStyle = 'rgba(10,25,45,0.45)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText('LANGIT NUSANTARA', W / 2, 150);
    ctx.fillStyle = LIT_AMBER;
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('KURIR LANGIT — antar surat melintasi kepulauan', W / 2, 192);
    ctx.fillStyle = '#dcebf7';
    ctx.font = '16px sans-serif';
    ctx.fillText('Terbang melewati ring emas, hemat bahan bakar, lalu mendarat mulus di landasan Pulau Bunga.', W / 2, 224);
    ctx.fillText('Terbang: ↑↓ pitch · ←→ belok · W/S gas · tahan klik untuk setir dengan mouse', W / 2, 252);
    ctx.fillText('Klik sebuah misi di bawah, atau tekan 1 / 2 / 3 — Spasi juga bisa.', W / 2, 278);
    for (let i = 0; i < 3; i += 1) {
      const m = MISSIONS[i];
      const card = TITLE_CARDS[i];
      const hover = false;
      ctx.fillStyle = hover ? '#1b3a5c' : PANEL;
      ctx.beginPath();
      ctx.roundRect(card.x, card.y, card.w, card.h, 12);
      ctx.fill();
      ctx.strokeStyle = i === world.missionIndex ? LIT_AMBER : PANEL_EDGE;
      ctx.lineWidth = i === world.missionIndex ? 3 : 1.5;
      ctx.stroke();
      ctx.fillStyle = LIT_AMBER;
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(`MISI ${i + 1}`, card.x + card.w / 2, card.y + 30);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 19px sans-serif';
      ctx.fillText(m.name, card.x + card.w / 2, card.y + 60);
      ctx.fillStyle = '#c8dcee';
      ctx.font = '14px sans-serif';
      wrapText(m.brief, card.x + card.w / 2, card.y + 88, card.w - 28, 20);
      ctx.fillStyle = LIT_GREEN;
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(`${m.rings.length} ring · BBM ${m.fuel}`, card.x + card.w / 2, card.y + 146);
    }
    if (world.best > 0) {
      ctx.fillStyle = LIT_AMBER;
      ctx.font = 'bold 17px sans-serif';
      ctx.fillText(`Skor terbaik: ${world.best}`, W / 2, 690);
    }
  }

  function wrapText(text, cx, y, maxW, lineH) {
    const words = text.split(' ');
    let line = '';
    let ly = y;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, cx, ly);
        line = word;
        ly += lineH;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, cx, ly);
  }

  function pausedScreen() {
    ctx.fillStyle = 'rgba(10,25,45,0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('JEDA', W / 2, 360);
    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#dcebf7';
    ctx.fillText('Tekan P atau Spasi untuk lanjut terbang.', W / 2, 400);
  }

  function overScreen(world, landed) {
    ctx.fillStyle = 'rgba(10,25,45,0.62)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    if (landed) {
      ctx.fillStyle = LIT_GREEN;
      ctx.font = 'bold 52px sans-serif';
      ctx.fillText('MISI SELESAI!', W / 2, 220);
      ctx.fillStyle = '#ffffff';
      ctx.font = '19px sans-serif';
      ctx.fillText(`Surat sampai di Pulau Bunga. Bonus pendaratan +${world.landing.bonus}.`, W / 2, 262);
      ctx.fillText(`Ring ${world.landing.rings}/${world.mission.rings.length} · Waktu ${Math.round(world.landing.time)} dtk · BBM sisa ${world.landing.fuel}`, W / 2, 292);
    } else {
      ctx.fillStyle = LIT_RED;
      ctx.font = 'bold 52px sans-serif';
      ctx.fillText('PESAWAT JATUH', W / 2, 220);
      ctx.fillStyle = '#ffffff';
      ctx.font = '19px sans-serif';
      ctx.fillText(`Pesawat ${world.crashReason}. Ring yang sudah dilewati: ${world.ringsDone}/${world.mission.rings.length}.`, W / 2, 262);
      ctx.fillText('Perhatikan kecepatan saat menukik dan jaga sayap tetap rata saat mendarat.', W / 2, 292);
    }
    ctx.fillStyle = LIT_AMBER;
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(`SKOR ${world.score}   ·   TERBAIK ${Math.max(world.best, world.score)}`, W / 2, 350);
    ctx.fillStyle = '#dcebf7';
    ctx.font = '17px sans-serif';
    ctx.fillText('Tekan R atau klik tombol di bawah untuk terbang lagi.', W / 2, 392);
    ctx.fillStyle = '#1b3a5c';
    ctx.beginPath();
    ctx.roundRect(OVER_BUTTON.x, OVER_BUTTON.y, OVER_BUTTON.w, OVER_BUTTON.h, 12);
    ctx.fill();
    ctx.strokeStyle = LIT_AMBER;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('TERBANG LAGI', W / 2, OVER_BUTTON.y + 40);
  }

  /** Paint one frame. `screen` is one of the SCREEN_* constants. */
  function draw(world, screen) {
    const dusk = world.mission.dusk;
    const camera = makeCamera(world.plane);
    sky(camera, dusk);
    sea(camera, dusk);
    drawSparkles(world, camera, dusk);
    drawIslands(world, camera);
    drawClouds(world, camera);
    drawGuide(world, camera);
    drawRings(world, camera);
    if (screen !== SCREEN_TITLE) drawPlane(world);
    else drawPlane(world); // parked on the runway, nose to the sky
    hud(world, screen);
    if (screen === SCREEN_TITLE) titleScreen(world);
    else if (screen === SCREEN_PAUSED) pausedScreen();
    else if (screen === SCREEN_LANDED) overScreen(world, true);
    else if (screen === SCREEN_CRASHED) overScreen(world, false);
  }

  return { draw };
}
