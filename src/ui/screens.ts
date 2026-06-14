import { W, H } from '../constants';
import { SPECS } from '../specs';
import { totalRuns, type SaveData } from '../save';
import type { Item } from '../items';
import type { Player } from '../entities';
import { FONT, cardRect, confirmRect, journalButtonRect, pointIn, wrapText } from './layout';
import { TOTAL_PAGES } from '../journal';

// --- spec select -------------------------------------------------------------
export interface SelectView {
  time: number;
  save: SaveData;
  mx: number;
  my: number;
}

export function drawSelect(ctx: CanvasRenderingContext2D, v: SelectView): void {
  ctx.fillStyle = '#100c1c';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23f';
  ctx.font = `40px ${FONT}`;
  ctx.fillText('CHEESE WIZARD', W / 2, 110);
  ctx.fillStyle = '#fff3b0';
  ctx.font = `16px ${FONT}`;
  ctx.fillText('CHOOSE YOUR PATH', W / 2, 174);

  for (let i = 0; i < SPECS.length; i++) {
    const spec = SPECS[i];
    const r = cardRect(i);
    const hot = pointIn(r, v.mx, v.my);
    const cx = r.x + r.w / 2;

    // hard-edged panel with a double border
    ctx.fillStyle = hot ? '#241a36' : '#1a1428';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = spec.color;
    ctx.fillRect(r.x, r.y, r.w, 6); // top accent bar
    ctx.lineWidth = hot ? 4 : 2;
    ctx.strokeStyle = hot ? spec.color : '#4a4360';
    ctx.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);

    ctx.fillStyle = spec.color;
    ctx.font = `16px ${FONT}`;
    wrapText(ctx, spec.name.toUpperCase(), cx, r.y + 48, r.w - 24, 24);
    ctx.fillStyle = '#b8b0d0';
    ctx.font = `11px ${FONT}`;
    ctx.fillText(spec.title.toUpperCase(), cx, r.y + 98);

    ctx.fillStyle = '#fff3b0';
    ctx.font = `12px ${FONT}`;
    spec.perks.forEach((perk, p) => ctx.fillText(perk.toUpperCase(), cx, r.y + 142 + p * 30));

    ctx.fillStyle = hot ? spec.color : '#6a6388';
    ctx.font = `12px ${FONT}`;
    ctx.fillText(`PRESS ${i + 1}`, cx, r.y + r.h - 20);

    // marker on the spec you played last time
    if (spec.id === v.save.lastSpec) {
      ctx.fillStyle = spec.color;
      ctx.font = `10px ${FONT}`;
      ctx.fillText('LAST PICK', cx, r.y - 14);
    }
  }

  if (Math.floor(v.time * 2) % 2 === 0) {
    ctx.fillStyle = '#ffd23f';
    ctx.font = `14px ${FONT}`;
    ctx.fillText('CLICK A CARD OR PRESS 1-3', W / 2, H - 52);
  }

  // persisted stats — proof it remembers you across visits
  ctx.fillStyle = '#6a6388';
  ctx.font = `10px ${FONT}`;
  ctx.fillText(`VISITS ${v.save.visits}    RUNS ${totalRuns(v.save)}`, W / 2, H - 22);

  // journal button (top-left) with a found-pages count
  const jb = journalButtonRect();
  const jhot = pointIn(jb, v.mx, v.my);
  ctx.fillStyle = jhot ? '#241a36' : '#1a1428';
  ctx.fillRect(jb.x, jb.y, jb.w, jb.h);
  ctx.lineWidth = 2;
  ctx.strokeStyle = jhot ? '#ffd23f' : '#4a4360';
  ctx.strokeRect(jb.x, jb.y, jb.w, jb.h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff3b0';
  ctx.font = `12px ${FONT}`;
  ctx.fillText('JOURNAL', jb.x + jb.w / 2, jb.y + 18);
  ctx.fillStyle = '#8a83a8';
  ctx.font = `8px ${FONT}`;
  ctx.fillText(`${v.save.pages.length}/${TOTAL_PAGES}`, jb.x + jb.w / 2, jb.y + 32);
}

// --- milestone / boss-reward powerup ----------------------------------------
export interface PowerupView {
  options: Item[];
  selected: number;
  milestoneLevel: number;
  title: string; // overrides the LEVEL header (e.g. boss rewards)
  player: Player;
  mx: number;
  my: number;
}

export function drawPowerup(ctx: CanvasRenderingContext2D, v: PowerupView): void {
  ctx.fillStyle = 'rgba(16, 12, 28, 0.82)';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23f';
  ctx.font = `30px ${FONT}`;
  ctx.fillText(v.title || `LEVEL ${v.milestoneLevel}`, W / 2, 110);
  ctx.fillStyle = '#fff3b0';
  ctx.font = `14px ${FONT}`;
  ctx.fillText('CHOOSE A POWER', W / 2, 158);
  ctx.fillStyle = '#8a83a8';
  ctx.font = `9px ${FONT}`;
  ctx.fillText('SELECT A CARD, THEN CONFIRM', W / 2, 188);

  for (let i = 0; i < v.options.length; i++) {
    const item = v.options[i];
    const r = cardRect(i);
    const selected = i === v.selected;
    const hot = selected || pointIn(r, v.mx, v.my);
    const cx = r.x + r.w / 2;
    const owned = v.player.getItemLevel(item.id);
    const nextLevel = owned + 1;

    ctx.fillStyle = selected ? '#1f2e1f' : hot ? '#241a36' : '#1a1428';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = selected ? '#5ad36a' : item.color;
    ctx.fillRect(r.x, r.y, r.w, 6);
    ctx.lineWidth = selected || hot ? 4 : 2;
    ctx.strokeStyle = selected ? '#5ad36a' : hot ? '#ffd23f' : '#4a4360';
    ctx.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);

    ctx.fillStyle = '#ffd23f';
    ctx.font = `16px ${FONT}`;
    wrapText(ctx, item.name, cx, r.y + 52, r.w - 24, 24);
    ctx.fillStyle = owned > 0 ? '#5ad36a' : '#8a83a8';
    ctx.font = `10px ${FONT}`;
    ctx.fillText(owned > 0 ? `LVL ${owned} -> ${nextLevel}` : 'NEW ITEM', cx, r.y + 104);
    ctx.fillStyle = '#fff3b0';
    ctx.font = `12px ${FONT}`;
    wrapText(ctx, item.describe(v.player.level, nextLevel), cx, r.y + 140, r.w - 28, 24);

    ctx.fillStyle = selected ? '#5ad36a' : hot ? '#ffd23f' : '#6a6388';
    ctx.font = `12px ${FONT}`;
    ctx.fillText(selected ? 'SELECTED' : `PRESS ${i + 1}`, cx, r.y + r.h - 20);
  }

  // confirm button — only active once a card is selected
  const cr = confirmRect();
  const ready = v.selected >= 0;
  const chot = ready && pointIn(cr, v.mx, v.my);
  ctx.fillStyle = ready ? (chot ? '#5ad36a' : '#243524') : '#161620';
  ctx.fillRect(cr.x, cr.y, cr.w, cr.h);
  ctx.lineWidth = 3;
  ctx.strokeStyle = ready ? '#5ad36a' : '#3a3a44';
  ctx.strokeRect(cr.x, cr.y, cr.w, cr.h);
  ctx.fillStyle = ready ? (chot ? '#0d1a0d' : '#ffffff') : '#55556a';
  ctx.font = `16px ${FONT}`;
  ctx.fillText('CONFIRM', cr.x + cr.w / 2, cr.y + cr.h / 2 + 6);
}

// --- victory -----------------------------------------------------------------
export interface WonView {
  roomsExplored: number;
  level: number;
  time: number;
}

// --- game over --------------------------------------------------------------
export interface GameOverView {
  enemies: number;
  rooms: number;
  level: number;
  bosses: number;
  pages: number; // pages found this run
  seconds: number; // time survived
  bestRooms: number;
  newBest: boolean;
  ready: boolean; // input unlocked yet (brief lock after death)
  time: number; // for the blinking prompt
}

export function drawGameOver(ctx: CanvasRenderingContext2D, v: GameOverView): void {
  ctx.fillStyle = '#0a0710';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';

  ctx.fillStyle = '#ff5a5a';
  ctx.font = `40px ${FONT}`;
  ctx.fillText('GAME OVER', W / 2, 120);
  ctx.fillStyle = '#8a83a8';
  ctx.font = `12px ${FONT}`;
  ctx.fillText('THE WIZARD HAS MELTED', W / 2, 156);

  const mins = Math.floor(v.seconds / 60);
  const secs = Math.floor(v.seconds % 60);
  const rows: [string, string][] = [
    ['ENEMIES DEFEATED', String(v.enemies)],
    ['ROOMS EXPLORED', String(v.rooms)],
    ['LEVEL REACHED', String(v.level)],
    ['MELTS CORRECTED', String(v.bosses)],
    ['PAGES FOUND', String(v.pages)],
    ['TIME SURVIVED', `${mins}:${String(secs).padStart(2, '0')}`],
  ];

  const lx = W / 2 - 200;
  const rx = W / 2 + 200;
  let y = 220;
  ctx.font = `13px ${FONT}`;
  for (const [label, value] of rows) {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#8a83a8';
    ctx.fillText(label, lx, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff3b0';
    ctx.fillText(value, rx, y);
    y += 34;
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = v.newBest ? '#5ad36a' : '#6a6388';
  ctx.font = `11px ${FONT}`;
  ctx.fillText(v.newBest ? `NEW BEST!  ${v.bestRooms} ROOMS` : `BEST RUN  ${v.bestRooms} ROOMS`, W / 2, y + 14);

  // prompt only appears once input is unlocked, so a fast click can't skip this
  if (!v.ready) {
    ctx.fillStyle = '#3a3450';
    ctx.font = `11px ${FONT}`;
    ctx.fillText('...', W / 2, H - 60);
  } else if (Math.floor(v.time * 2) % 2 === 0) {
    ctx.fillStyle = '#ffd23f';
    ctx.font = `13px ${FONT}`;
    ctx.fillText('CLICK TO RETURN', W / 2, H - 60);
  }
}

export function drawWon(ctx: CanvasRenderingContext2D, v: WonView): void {
  ctx.fillStyle = '#0c0a16';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23f';
  ctx.font = `34px ${FONT}`;
  ctx.fillText('THE ARGUMENT', W / 2, 200);
  ctx.fillText('IS WON', W / 2, 250);
  ctx.fillStyle = '#fff3b0';
  ctx.font = `13px ${FONT}`;
  ctx.fillText('EVERY MELT, CORRECTED.', W / 2, 320);
  ctx.fillStyle = '#8a83a8';
  ctx.font = `11px ${FONT}`;
  ctx.fillText(`ROOMS PURGED ${v.roomsExplored}   LEVEL ${v.level}`, W / 2, 372);
  if (Math.floor(v.time * 2) % 2 === 0) {
    ctx.fillStyle = '#ffd23f';
    ctx.font = `13px ${FONT}`;
    ctx.fillText('CLICK TO RETURN', W / 2, H - 80);
  }
}
