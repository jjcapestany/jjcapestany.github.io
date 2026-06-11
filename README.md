# 🧀 Cheese Wizard

A 2D top-down arena shooter for the browser. You are a wizard made of cheese; the mice are coming for you. Zap them with cheese bolts and survive as many waves as you can.

## Controls

- **WASD / arrow keys** — move
- **Mouse** — aim
- **Click / hold** — shoot cheese bolts
- **R** — restart after game over

## Develop

```sh
npm install
npm run dev      # dev server with hot reload
npm run build    # type-check + production build into dist/
npm run preview  # serve the production build locally
```

Built with TypeScript + Vite and the plain Canvas 2D API — no game engine, no assets.

## Deploy to GitHub Pages

1. Create a GitHub repository named **CheeseWizard** (the name must match `base` in [vite.config.ts](vite.config.ts) — if you pick a different repo name, update `base` to `'/<repo-name>/'`).
2. Push this project to it:
   ```sh
   git remote add origin https://github.com/<your-username>/CheeseWizard.git
   git push -u origin main
   ```
3. In the repo on GitHub, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
4. Every push to `main` now builds and deploys automatically. The game will be live at `https://<your-username>.github.io/CheeseWizard/`.
