import { W, H } from '../constants';
import { ITEMS, type Item } from '../items';
import type { Player, Boss } from '../entities';
import type { Spec } from '../specs';
import type { Room } from '../room';
import { FONT } from './layout';

// Floating damage number (owned by the game; drawn here).
export interface Floater {
  x: number;
  y: number;
  vy: number;
  life: number;
  text: string;
  color: string;
}

// Floating damage numbers (drawn crisp at full res, in world coordinates).
export function drawFloaters(ctx: CanvasRenderingContext2D, floaters: Floater[]): void {
  ctx.textAlign = 'center';
  for (const f of floaters) {
    ctx.globalAlpha = Math.max(0, Math.min(1, f.life / 0.3));
    ctx.fillStyle = f.color;
    ctx.font = `10px ${FONT}`;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

// 5x5 minimap window centred on the player — the rooms currently "live".
export function drawMinimap(ctx: CanvasRenderingContext2D, rooms: Map<string, Room>, rx: number, ry: number): void {
  const span = 2; // 2 each way -> 5x5
  const cell = 14;
  const step = 22;
  const stub = (step - cell) / 2;
  const thick = 2;
  const pad = 9;
  const ox = 18;
  const oy = 18;
  const cx0 = ox + pad;
  const cy0 = oy + pad;
  const panel = (2 * span + 1) * step - (step - cell) + pad * 2;

  ctx.save();
  ctx.fillStyle = 'rgba(8, 6, 14, 0.7)';
  ctx.fillRect(ox, oy, panel, panel);
  ctx.strokeStyle = '#4a4360';
  ctx.lineWidth = 2;
  ctx.strokeRect(ox + 1, oy + 1, panel - 2, panel - 2);

  for (let gy = -span; gy <= span; gy++) {
    for (let gx = -span; gx <= span; gx++) {
      const room = rooms.get(`${rx + gx},${ry + gy}`);
      if (!room) continue;
      const px = cx0 + (gx + span) * step;
      const py = cy0 + (gy + span) * step;
      const midX = px + cell / 2;
      const midY = py + cell / 2;

      // door stubs pointing toward each opening
      ctx.fillStyle = '#8a83a8';
      if (room.doors.east) ctx.fillRect(px + cell, midY - thick / 2, stub, thick);
      if (room.doors.west) ctx.fillRect(px - stub, midY - thick / 2, stub, thick);
      if (room.doors.south) ctx.fillRect(midX - thick / 2, py + cell, thick, stub);
      if (room.doors.north) ctx.fillRect(midX - thick / 2, py - stub, thick, stub);

      const current = gx === 0 && gy === 0;
      ctx.fillStyle = current ? '#ffd23f' : '#8a83a8';
      ctx.fillRect(px, py, cell, cell);
    }
  }
  ctx.restore();
}

// HP + XP bars and the level / spec label, bottom-left.
export function drawStatus(ctx: CanvasRenderingContext2D, player: Player, spec: Spec): void {
  const p = player;
  ctx.textAlign = 'left';

  const bx = 20;
  const bw = 260;
  const bh = 12;

  // HP bar
  const hpY = H - 72;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(bx, hpY, bw, bh);
  ctx.fillStyle = '#5ad36a';
  ctx.fillRect(bx, hpY, bw * Math.max(0, p.hp / p.maxHp), bh);
  ctx.strokeStyle = '#4a4360';
  ctx.lineWidth = 2;
  ctx.strokeRect(bx, hpY, bw, bh);
  ctx.fillStyle = '#ffffff';
  ctx.font = `8px ${FONT}`;
  ctx.fillText(`HP ${Math.ceil(p.hp)}/${p.maxHp}`, bx + 6, hpY + 9);

  // XP bar
  const by = H - 46;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = spec.color;
  ctx.fillRect(bx, by, bw * Math.min(1, p.xp / p.xpToNext), bh);
  ctx.strokeStyle = '#4a4360';
  ctx.lineWidth = 2;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.fillStyle = '#fff3b0';
  ctx.font = `8px ${FONT}`;
  ctx.fillText(`XP ${Math.floor(p.xp)}/${p.xpToNext}`, bx + 6, by + 9);

  // level + spec
  ctx.fillStyle = spec.color;
  ctx.fillRect(20, H - 26, 12, 12);
  ctx.fillStyle = '#fff3b0';
  ctx.font = `12px ${FONT}`;
  ctx.fillText(`LV ${p.level}  ${spec.name.toUpperCase()}`, 38, H - 16);
}

// Bottom-right tray: 3 slots that fill in as you collect unique items.
export function drawItems(ctx: CanvasRenderingContext2D, player: Player, mx: number, my: number): void {
  const slots = 3;
  const box = 44;
  const gap = 8;
  const x0 = W - 18 - (slots * box + (slots - 1) * gap);
  const y0 = H - 18 - box;

  ctx.textAlign = 'left';
  ctx.fillStyle = '#8a83a8';
  ctx.font = `8px ${FONT}`;
  ctx.fillText('ITEMS', x0, y0 - 7);

  let hovered = -1;
  for (let i = 0; i < slots; i++) {
    const eq = player.equipped[i];
    const def = eq ? ITEMS.find((it) => it.id === eq.id) : undefined;
    const bx = x0 + i * (box + gap);
    const over = mx >= bx && mx <= bx + box && my >= y0 && my <= y0 + box;

    ctx.fillStyle = def ? '#171226' : 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(bx, y0, box, box);
    ctx.lineWidth = def && over ? 3 : 2;
    ctx.strokeStyle = def ? def.color : '#3a3a44';
    ctx.strokeRect(bx, y0, box, box);

    if (def && eq) {
      drawItemIcon(ctx, def.id, bx + box / 2, y0 + box / 2 - 1, def.color);
      // level number in the bottom-right corner
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fff3b0';
      ctx.font = `8px ${FONT}`;
      ctx.fillText(String(eq.level), bx + box - 4, y0 + box - 4);
      if (over) hovered = i;
    }
  }

  if (hovered >= 0) {
    const def = ITEMS.find((it) => it.id === player.equipped[hovered].id)!;
    drawItemTooltip(ctx, def, player, y0);
  }
  ctx.textAlign = 'left';
}

// Cheese-themed pixel icons for each attack item.
function drawItemIcon(ctx: CanvasRenderingContext2D, id: string, cx: number, cy: number, color: string): void {
  const wedge = (yColor: string) => {
    ctx.fillStyle = yColor;
    ctx.beginPath();
    ctx.moveTo(cx - 9, cy + 7);
    ctx.lineTo(cx + 9, cy + 7);
    ctx.lineTo(cx + 9, cy - 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#cf8f0c';
    ctx.beginPath();
    ctx.arc(cx + 2, cy + 3, 1.6, 0, Math.PI * 2);
    ctx.fill();
  };

  if (id === 'aura') {
    // cheese wedge with rising stink lines
    wedge('#ffd23f');
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 5, cy - 6);
    ctx.quadraticCurveTo(cx - 2, cy - 9, cx - 5, cy - 12);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 1, cy - 7);
    ctx.quadraticCurveTo(cx + 4, cy - 10, cx + 1, cy - 13);
    ctx.stroke();
  } else if (id === 'wheels') {
    // cheese wheel with a cut slice
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(cx, cy, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#171226';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, 11, -0.5, 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#e0a818';
    ctx.beginPath();
    ctx.arc(cx, cy, 11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#cf8f0c';
    ctx.beginPath();
    ctx.arc(cx - 3, cy - 2, 1.6, 0, Math.PI * 2);
    ctx.fill();
  } else if (id === 'nova') {
    // bursting cheese core
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6);
      ctx.lineTo(cx + Math.cos(a) * 12, cy + Math.sin(a) * 12);
      ctx.stroke();
    }
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (id === 'bolts') {
    // curd glob with a streak
    ctx.strokeStyle = '#e0a818';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy + 7);
    ctx.lineTo(cx - 1, cy + 1);
    ctx.stroke();
    ctx.fillStyle = '#fff3b0';
    ctx.beginPath();
    ctx.arc(cx + 3, cy - 2, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#cf8f0c';
    ctx.beginPath();
    ctx.arc(cx + 1, cy - 3, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 5, cy, 1.3, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // crumbs — scattered cheese bits
    ctx.fillStyle = color;
    ctx.fillRect(cx - 10, cy - 2, 5, 5);
    ctx.fillRect(cx - 2, cy - 7, 6, 6);
    ctx.fillRect(cx + 4, cy + 2, 5, 5);
    ctx.fillRect(cx - 4, cy + 4, 4, 4);
  }
}

function drawItemTooltip(ctx: CanvasRenderingContext2D, def: Item, player: Player, trayY: number): void {
  const lvl = player.getItemLevel(def.id);
  const tw = 250;
  const th = 64;
  const tx = W - 18 - tw;
  const ty = trayY - 12 - th;
  const pad = 12;

  ctx.fillStyle = 'rgba(8, 6, 14, 0.95)';
  ctx.fillRect(tx, ty, tw, th);
  ctx.lineWidth = 2;
  ctx.strokeStyle = def.color;
  ctx.strokeRect(tx, ty, tw, th);

  ctx.textAlign = 'left';
  ctx.fillStyle = def.color;
  ctx.font = `12px ${FONT}`;
  ctx.fillText(def.name, tx + pad, ty + 22);
  ctx.fillStyle = '#8a83a8';
  ctx.font = `9px ${FONT}`;
  ctx.fillText(`LEVEL ${lvl}`, tx + pad, ty + 40);
  ctx.fillStyle = '#fff3b0';
  ctx.font = `10px ${FONT}`;
  ctx.fillText(def.describe(player.level, lvl), tx + pad, ty + 56);
}

// Boss health bar (always) plus the entry-banner fatwa (first seconds).
export function drawBoss(ctx: CanvasRenderingContext2D, boss: Boss): void {
  const bw = W * 0.6;
  const bh = 18;
  const bx = (W - bw) / 2;
  const by = 30;
  ctx.textAlign = 'center';
  ctx.fillStyle = boss.color;
  ctx.font = `13px ${FONT}`;
  ctx.fillText(boss.config.name, W / 2, by - 8);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(bx, by, bw * Math.max(0, boss.hp / boss.maxHp), bh);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#fff3b0';
  ctx.strokeRect(bx, by, bw, bh);

  // entry fatwa, fading out
  if (boss.introT > 0) {
    const a = Math.min(1, boss.introT / 0.6);
    ctx.globalAlpha = a;
    ctx.fillStyle = '#ff3030';
    ctx.font = `28px ${FONT}`;
    ctx.fillText(boss.config.name, W / 2, H / 2 - 30);
    ctx.fillStyle = '#fff3b0';
    ctx.font = `12px ${FONT}`;
    boss.config.taunt.split('\n').forEach((line, i) => ctx.fillText(line, W / 2, H / 2 + 8 + i * 22));
    ctx.globalAlpha = 1;
  }
}
