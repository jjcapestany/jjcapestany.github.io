// A journal page lying on the floor, waiting to be walked over. The Reader's
// lost notes. Bobs and glows so it reads as "pick me up" against the gloom.
export class PagePickup {
  x: number;
  y: number;
  pageId: number;
  radius = 14;
  alive = true;
  private bob = Math.random() * Math.PI * 2;

  constructor(x: number, y: number, pageId: number) {
    this.x = x;
    this.y = y;
    this.pageId = pageId;
  }

  update(dt: number): void {
    this.bob += dt * 3;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const yo = Math.sin(this.bob) * 3; // gentle float
    const x = this.x;
    const y = this.y + yo;

    // glow
    ctx.save();
    ctx.globalAlpha = 0.25 + 0.12 * (0.5 + 0.5 * Math.sin(this.bob));
    ctx.fillStyle = '#ffe27a';
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // parchment page with a folded corner and a couple of ink lines
    const w = 14;
    const h = 18;
    ctx.fillStyle = '#f3ead2';
    ctx.fillRect(x - w / 2, y - h / 2, w, h);
    ctx.fillStyle = '#d8caa0';
    ctx.beginPath();
    ctx.moveTo(x + w / 2 - 5, y - h / 2);
    ctx.lineTo(x + w / 2, y - h / 2 + 5);
    ctx.lineTo(x + w / 2 - 5, y - h / 2 + 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#8a7a52';
    ctx.fillRect(x - w / 2 + 3, y - 4, w - 6, 1.5);
    ctx.fillRect(x - w / 2 + 3, y, w - 6, 1.5);
    ctx.fillRect(x - w / 2 + 3, y + 4, w - 9, 1.5);
  }
}

// The Pilot Light: a single burner somebody left lit. The wizard is cheese, so
// the warmth softens and re-knits it back together. Heals once, then goes cold.
export class HealPickup {
  x: number;
  y: number;
  radius = 18;
  used = false;
  private flicker = Math.random() * Math.PI * 2;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  update(dt: number): void {
    this.flicker += dt * 7;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const x = this.x;
    const y = this.y;

    if (!this.used) {
      // warm glow
      ctx.save();
      ctx.globalAlpha = 0.18 + 0.08 * (0.5 + 0.5 * Math.sin(this.flicker));
      ctx.fillStyle = '#ff9d3f';
      ctx.beginPath();
      ctx.arc(x, y - 4, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // stove body
    ctx.fillStyle = this.used ? '#33323c' : '#4a4452';
    ctx.fillRect(x - 14, y, 28, 16);
    ctx.fillStyle = '#26242e';
    ctx.fillRect(x - 14, y + 12, 28, 5);
    // burner plate
    ctx.fillStyle = '#1a1822';
    ctx.fillRect(x - 12, y - 2, 24, 4);

    if (!this.used) {
      const f = 1 + 0.18 * Math.sin(this.flicker * 1.7);
      // outer flame
      ctx.fillStyle = '#ff7a1f';
      ctx.beginPath();
      ctx.moveTo(x, y - 2 - 22 * f);
      ctx.lineTo(x - 8, y - 2);
      ctx.lineTo(x + 8, y - 2);
      ctx.closePath();
      ctx.fill();
      // inner flame
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.moveTo(x, y - 2 - 13 * f);
      ctx.lineTo(x - 4, y - 2);
      ctx.lineTo(x + 4, y - 2);
      ctx.closePath();
      ctx.fill();
      // blue base
      ctx.fillStyle = '#7fb8ff';
      ctx.fillRect(x - 5, y - 4, 10, 3);
    }
  }
}
