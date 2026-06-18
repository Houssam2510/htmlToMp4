# htmlToMp4

Convertit une animation **HTML/CSS/JS** en **vidéo MP4 verticale 1080×1920** (format natif Instagram Reels & TikTok), **sans déformation ni bandes noires**, grâce à Puppeteer.

## Le principe

Le piège classique : un viewport mobile (`393×852` avec `deviceScaleFactor:3`) produit une image de `1179×2556px` que FFmpeg étire ensuite vers `1080×1920` — mais les ratios ne correspondent pas (`1179/2556 ≠ 1080/1920`), d'où un **écrasement** de l'image.

La solution retenue ici :

- Le HTML est conçu en **390×693px** = ratio **9:16 exact** (`390/693 ≈ 0.5628`).
- Le viewport Puppeteer est réglé à **1080×1920** avec `deviceScaleFactor:1`.
- On injecte un **scale CSS uniforme** (`1080/390 ≈ 2.769`) appliqué identiquement sur X et Y.
- Résultat : `390×2.769 = 1080px` et `693×2.769 ≈ 1920px` → **aucune déformation**, **aucune bande noire**.

## Prérequis

- [Node.js](https://nodejs.org/) (v16+)

## Installation

```bash
npm install
```

## Utilisation

1. Place ton animation dans un fichier HTML (ex. `carriv_reel.html`), en respectant le canvas **390×693px** avec un conteneur `#stage`.
2. Configure le script `recordingInsta.js` :

```js
const HTML_FILE   = 'carriv_reel.html';   // ton fichier source
const OUTPUT_FILE = './carriv_reel.mp4';  // la vidéo de sortie
const DURATION_MS = 17000;                // durée de capture (ms)
const FPS         = 60;                    // images par seconde
```

3. Lance l'enregistrement :

```bash
node recordingInsta.js
```

La vidéo MP4 `1080×1920 · 9:16 natif` est générée à l'emplacement défini par `OUTPUT_FILE`.

## Structure du projet

```
.
├── recordingInsta.js          # Script Puppeteer de capture HTML → MP4
├── carriv_reel.html           # Exemple d'animation cinématique
├── studylumina_reel.html      # Exemple d'animation cinématique
├── prompt/
│   └── PROMPT_REEL_MASTER.md  # Prompt maître pour générer de nouveaux reels
├── package.json
└── README.md
```

## Le prompt maître

[`prompt/PROMPT_REEL_MASTER.md`](prompt/PROMPT_REEL_MASTER.md) contient un prompt auto-suffisant pour générer de nouvelles animations cinématiques verticales respectant toutes les contraintes techniques validées (dimensions, ratio, scale, fps).

## Notes

- Les fichiers `.mp4` générés ne sont **pas** versionnés (voir `.gitignore`).
- Dépendances : [`puppeteer`](https://pptr.dev/) et [`puppeteer-screen-recorder`](https://www.npmjs.com/package/puppeteer-screen-recorder).

## Licence

ISC
