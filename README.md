<div align="center">

# htmlToMp4

### Une animation HTML devient un Reel 9:16, sans déformation et sans couture

**Puppeteer enregistre une page HTML/CSS/JS en MP4 vertical 1080×1920 — au ratio natif d'Instagram et TikTok, avec une boucle recoupée à la milliseconde.**

<br/>

[![Node](https://img.shields.io/badge/Node-16%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Puppeteer](https://img.shields.io/badge/Puppeteer-headless-40B5A4?logo=puppeteer&logoColor=white)](https://pptr.dev/)
[![Format](https://img.shields.io/badge/sortie-1080%C3%971920%20%C2%B7%209%3A16-E4405F?logo=instagram&logoColor=white)](#)
[![x264](https://img.shields.io/badge/x264-CRF%2018-007808)](#)
[![License](https://img.shields.io/badge/licence-ISC-blue.svg)](#licence)

[🇫🇷 Français](#-français) · [🇬🇧 English](#-english)

</div>

---

<details open>
<summary><h2 id="-français">&nbsp;🇫🇷&nbsp;&nbsp;Français</h2></summary>

<br/>

## Le problème que ça résout

**1. La déformation.** Le réflexe naturel est de prendre un viewport mobile — `393×852` avec `deviceScaleFactor: 3` — ce qui produit une image de `1179×2556`. FFmpeg l'étire ensuite vers `1080×1920`, mais les ratios ne correspondent pas (`1179/2556 ≠ 1080/1920`) : l'image est **écrasée**.

La solution retenue ici ne redimensionne jamais après coup :

```
#stage conçu en 390×693px         →  ratio 9:16 exact (390/693 ≈ 0,5628)
viewport Puppeteer 1080×1920      →  deviceScaleFactor: 1
scale CSS uniforme 1080/390       ≈  2,7692× appliqué identiquement sur X et Y

390 × 2,7692 = 1080px   ·   693 × 2,7692 ≈ 1920px
→ aucune déformation, aucune bande noire
```

Le script **mesure `#stage` dans la page** avant d'appliquer la transformation, et **refuse de tourner** si le ratio dévie de plus de 2 px. Une erreur de géométrie est attrapée avant d'encoder quinze secondes, pas après.

**2. La boucle qui ne boucle pas.** FFmpeg met quelques centaines de millisecondes à réellement démarrer. Enregistrer puis lancer l'animation perd donc le début ; l'inverse laisse un bout de queue à l'arrêt. Dans les deux cas, le Reel a une couture visible à chaque répétition.

Ici, l'ordre est inversé et le décalage est **mesuré, pas estimé** :

```
1. l'enregistreur démarre     → ffmpeg est réellement en train de capturer
2. window.startLoop()         → l'animation repart à la frame 0
3. lead-in = Date.now() − t0  → l'instant exact où la frame 0 est à l'écran
4. ffmpeg -ss <lead-in> -t <LOOP>   → le MP4 final dure EXACTEMENT un LOOP
```

Résultat : la vidéo reboucle sans couture sur Instagram.

## ✦ Ce que le script garantit

| Garantie | Comment |
| --- | --- |
| 📐 **Géométrie exacte** | `#stage` est mesuré dans la page ; un ratio non conforme fait échouer le run avec un message précis, tolérance 2 px. |
| ⏱ **Durée automatique** | La constante `const LOOP = …` est lue **directement dans le `.html`**. Plus de désynchronisation entre le reel et le script. |
| 🔁 **Boucle au millième** | Lead-in mesuré et retiré au montage, queue d'arrêt retirée aussi. `--no-trim` garde le brut. |
| 🔤 **Polices vraiment chargées** | `document.fonts.ready` peut se résoudre alors qu'une famille distante a échoué. Chaque famille extraite du `<link>` Google Fonts est donc revérifiée via `document.fonts.check()`, et l'absence est signalée **avant** d'encoder. |
| 🎨 **Rendu déterministe** | Chromium lancé avec `--font-render-hinting=none`, `--force-color-profile=srgb`, `--disable-lcd-text` : pas de franges colorées, couleurs identiques à l'écran. |
| 📦 **ffmpeg embarqué** | Le binaire vient de `@ffmpeg-installer/ffmpeg` (installé avec les dépendances), pas du `PATH` système. |
| 🔍 **Contrôle après coup** | Le MP4 produit est relu (ffprobe, sinon `ffmpeg -i`) et résolution / fps / durée / nombre de frames sont affichés — avec un avertissement si la durée ne colle pas au `LOOP`. |
| 🧯 **Emojis sous Linux** | Chromium headless Linux n'a pas de police emoji par défaut. L'absence est détectée et annoncée, avec le correctif, avant l'encodage. |

## 🚀 Utilisation

```bash
npm install
```

Pas de constante à éditer : tout passe par la ligne de commande.

```bash
node recording.js carriv_reel                       # → ./carriv_reel.mp4
node recording.js carriv_reel studylumina_reel      # plusieurs d'affilée
node recording.js carriv_reel --crf=17 --out=exports
node recording.js --help
```

Le nom est celui du fichier, avec ou sans `.html`.

| Option | Défaut | Rôle |
| --- | --- | --- |
| `--fps=` | `60` | images par seconde |
| `--crf=` | `18` | qualité x264 — 17-18 garde le texte net après la recompression d'Instagram |
| `--preset=` | `slow` | preset x264 |
| `--bitrate=` | `8000` | débit cible (kb/s) |
| `--duration=` | — | force la durée totale en ms (sinon : `LOOP` lu dans le `.html`) |
| `--margin=` | `400` | ms enregistrés au-delà du `LOOP`, entièrement retirés à la recoupe |
| `--no-trim` | — | garde le brut, avec le lead-in et la queue |
| `--out=` | `.` | dossier de sortie |

## Écrire un reel compatible

Trois conditions, et c'est tout :

1. Un conteneur **`<div id="stage">` de 390×693 px** — le ratio 9:16 exact.
2. Une constante **`const LOOP = <ms>`** dans le script de la page : c'est la durée d'un cycle, et c'est elle qui devient la durée du MP4. (À défaut, passez `--duration=`.)
3. Une fonction **`window.startLoop()`** qui remet l'animation à la frame 0 — c'est ce qui permet la synchronisation exacte. Sans elle, le script prévient et enregistre quand même, mais la boucle ne sera pas parfaite.

Les deux exemples du dépôt, [`carriv_reel.html`](carriv_reel.html) et [`studylumina_reel.html`](studylumina_reel.html), sont des reels complets et réels — à lire plutôt qu'un hello-world.

## 📁 Structure

```
.
├── recording.js               le script : CLI, mesure, enregistrement, recoupe, contrôle
├── carriv_reel.html           exemple complet (LOOP = 21 000 ms)
├── studylumina_reel.html      exemple complet (LOOP = 19 000 ms)
├── prompt/
│   └── PROMPT_REEL_MASTER.md  prompt auto-suffisant pour générer de nouveaux reels
└── package.json
```

[`prompt/PROMPT_REEL_MASTER.md`](prompt/PROMPT_REEL_MASTER.md) contient un prompt auto-suffisant pour produire de nouvelles animations verticales respectant toutes les contraintes ci-dessus — dimensions, ratio, scale, fps, `LOOP`, `startLoop`.

## Notes

- Les `.mp4` générés ne sont **pas** versionnés (voir `.gitignore`).
- Emojis sous Linux, une seule fois sur la machine qui encode : `sudo apt-get install -y fonts-noto-color-emoji`.
- `ffprobe` n'est pas installé par défaut ; le script retombe alors sur `ffmpeg -i`, qui donne les mêmes informations.

</details>

<details>
<summary><h2 id="-english">&nbsp;🇬🇧&nbsp;&nbsp;English</h2></summary>

<br/>

## The problems it solves

**1. Distortion.** The natural instinct is to use a mobile viewport — `393×852` at `deviceScaleFactor: 3` — which produces a `1179×2556` image. FFmpeg then stretches it to `1080×1920`, but the ratios don't match (`1179/2556 ≠ 1080/1920`): the image is **squashed**.

The approach here never resizes after the fact:

```
#stage authored at 390×693px      →  exact 9:16 ratio (390/693 ≈ 0.5628)
Puppeteer viewport 1080×1920      →  deviceScaleFactor: 1
uniform CSS scale 1080/390        ≈  2.7692× applied identically on X and Y

390 × 2.7692 = 1080px   ·   693 × 2.7692 ≈ 1920px
→ no distortion, no letterboxing
```

The script **measures `#stage` inside the page** before applying the transform, and **refuses to run** if the ratio is off by more than 2 px. A geometry mistake is caught before encoding fifteen seconds, not after.

**2. The loop that doesn't loop.** FFmpeg takes a few hundred milliseconds to actually start capturing. Recording first and then starting the animation loses the opening; doing it the other way round leaves a tail at the stop. Either way the Reel shows a visible seam on every repeat.

Here the order is inverted and the offset is **measured, not estimated**:

```
1. recorder starts           → ffmpeg is genuinely capturing
2. window.startLoop()        → the animation restarts at frame 0
3. lead-in = Date.now() − t0 → the exact instant frame 0 is on screen
4. ffmpeg -ss <lead-in> -t <LOOP>   → the final MP4 lasts EXACTLY one LOOP
```

The result loops seamlessly on Instagram.

## ✦ What the script guarantees

| Guarantee | How |
| --- | --- |
| 📐 **Exact geometry** | `#stage` is measured in the page; a non-conforming ratio fails the run with a precise message, 2 px tolerance. |
| ⏱ **Automatic duration** | The `const LOOP = …` constant is read **straight out of the `.html`**. No more drift between the reel and the script. |
| 🔁 **Millisecond-exact loop** | The measured lead-in is trimmed off, and so is the stop tail. `--no-trim` keeps the raw capture. |
| 🔤 **Fonts actually loaded** | `document.fonts.ready` can resolve even when a remote family failed. So every family extracted from the Google Fonts `<link>` is re-checked with `document.fonts.check()`, and a miss is reported **before** encoding. |
| 🎨 **Deterministic rendering** | Chromium launched with `--font-render-hinting=none`, `--force-color-profile=srgb`, `--disable-lcd-text`: no colour fringing, colours identical to the screen. |
| 📦 **Bundled ffmpeg** | The binary comes from `@ffmpeg-installer/ffmpeg` (installed with the dependencies), not from the system `PATH`. |
| 🔍 **Post-hoc verification** | The produced MP4 is read back (ffprobe, else `ffmpeg -i`) and resolution / fps / duration / frame count are printed — with a warning if the duration doesn't match `LOOP`. |
| 🧯 **Emoji on Linux** | Headless Chromium on Linux ships no emoji font. Its absence is detected and announced, with the fix, before encoding. |

## 🚀 Usage

```bash
npm install
```

No constant to edit: everything goes through the command line.

```bash
node recording.js carriv_reel                       # → ./carriv_reel.mp4
node recording.js carriv_reel studylumina_reel      # several in a row
node recording.js carriv_reel --crf=17 --out=exports
node recording.js --help
```

The name is the file's, with or without `.html`.

| Option | Default | Purpose |
| --- | --- | --- |
| `--fps=` | `60` | frames per second |
| `--crf=` | `18` | x264 quality — 17-18 keeps text crisp through Instagram's recompression |
| `--preset=` | `slow` | x264 preset |
| `--bitrate=` | `8000` | target bitrate (kb/s) |
| `--duration=` | — | force the total duration in ms (otherwise: `LOOP`, read from the `.html`) |
| `--margin=` | `400` | ms recorded beyond `LOOP`, entirely removed by the trim |
| `--no-trim` | — | keep the raw capture, lead-in and tail included |
| `--out=` | `.` | output directory |

## Authoring a compatible reel

Three conditions, and that's all:

1. A **`<div id="stage">` container of 390×693 px** — the exact 9:16 ratio.
2. A **`const LOOP = <ms>`** constant in the page's script: the length of one cycle, which becomes the MP4's duration. (Failing that, pass `--duration=`.)
3. A **`window.startLoop()`** function that resets the animation to frame 0 — this is what makes exact synchronisation possible. Without it the script warns and still records, but the loop won't be perfect.

The repo's two examples, [`carriv_reel.html`](carriv_reel.html) and [`studylumina_reel.html`](studylumina_reel.html), are complete, real reels — there to be read instead of a hello-world.

## 📁 Project structure

```
.
├── recording.js               the script: CLI, measurement, recording, trim, verification
├── carriv_reel.html           complete example (LOOP = 21,000 ms)
├── studylumina_reel.html      complete example (LOOP = 19,000 ms)
├── prompt/
│   └── PROMPT_REEL_MASTER.md  self-contained prompt for generating new reels
└── package.json
```

[`prompt/PROMPT_REEL_MASTER.md`](prompt/PROMPT_REEL_MASTER.md) holds a self-contained prompt for producing new vertical animations that respect every constraint above — dimensions, ratio, scale, fps, `LOOP`, `startLoop`.

## Notes

- Generated `.mp4` files are **not** versioned (see `.gitignore`).
- Emoji on Linux, once per encoding machine: `sudo apt-get install -y fonts-noto-color-emoji`.
- `ffprobe` isn't installed by default; the script then falls back to `ffmpeg -i`, which reports the same information.

</details>

---

## Licence

ISC.
