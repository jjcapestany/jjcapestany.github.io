export class Input {
  keys = new Set<string>();
  mouseX = 480;
  mouseY = 300;
  mouseDown = false;
  private clicked = false;
  private consumed = new Set<string>(); // keys already reported by consumeKey this press

  constructor(canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.key.toLowerCase());
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      this.keys.delete(k);
      this.consumed.delete(k);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.consumed.clear();
    });

    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = ((e.clientX - r.left) / r.width) * canvas.width;
      this.mouseY = ((e.clientY - r.top) / r.height) * canvas.height;
    });
    canvas.addEventListener('mousedown', () => {
      this.mouseDown = true;
      this.clicked = true;
    });
    window.addEventListener('mouseup', () => (this.mouseDown = false));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  isDown(...keys: string[]): boolean {
    return keys.some((k) => this.keys.has(k));
  }

  consumeClick(): boolean {
    const c = this.clicked;
    this.clicked = false;
    return c;
  }

  // Edge-triggered key: true once per physical press, not every frame it's held.
  consumeKey(...keys: string[]): boolean {
    for (const k of keys) {
      if (this.keys.has(k) && !this.consumed.has(k)) {
        this.consumed.add(k);
        return true;
      }
    }
    return false;
  }
}
