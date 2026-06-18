# PROMPT MAÎTRE — Cinematic Vertical Reel (TikTok / Instagram Reels)
> Version validée sur StudyLumina · Juin 2025
> Produit : 1 fichier HTML + 1 script Puppeteer → MP4 1080×1920 sans déformation

---

## COMMENT UTILISER CE PROMPT

Copie tout ce qui suit dans un nouveau chat et remplace les variables en `[MAJUSCULES]`.
Le prompt est auto-suffisant — il contient toutes les contraintes techniques validées.

---

## LE PROMPT

Tu es un expert en motion design, storytelling publicitaire et développement front-end.
Crée-moi deux fichiers :

1. `[NOM_FICHIER].html` — l'animation cinématique complète
2. `record_insta.js` — le script Puppeteer pour capturer en MP4 1080×1920

---

### PARTIE 1 — LE FICHIER HTML

#### DIMENSIONS — RÈGLE ABSOLUE

- Canvas HTML : **390×693px** (ratio 9:16 exact : 390/693 = 0.5628 ≈ 9/16)
- `html, body, #stage` : tous les trois en `width:390px; height:693px; overflow:hidden`
- Canvas particles JS : `cvs.width=390; cvs.height=693`
- Boundary particles : `if(p.y<0) p.y=693; if(p.y>693) p.y=0`
- **Ne jamais utiliser 844px** — c'est l'ancienne valeur, ratio incorrect (0.462 ≠ 0.5625)
- Pourquoi : à ce ratio, le scale Puppeteer `1080/390 = 2.769` appliqué uniformément
  donne exactement `390×2.769 = 1080px` et `693×2.769 = 1918px ≈ 1920px` — zéro déformation

#### FOND

- Couleur de fond : `[COULEUR_FOND]` (ex: `#070D1A` pour dark luxe)
- Appliquer sur : `html`, `body`, `#stage`, et dans l'injection CSS Puppeteer

#### POLICES

Charger via Google Fonts @import dans le `<style>` :
```
https://fonts.googleapis.com/css2?family=[FONT_DISPLAY]:wght@400;600;700&family=[FONT_SANS]:wght@400;500;600;700&family=[FONT_MONO]:wght@400;500&display=swap
```
- `--font-display` → [FONT_DISPLAY] (ex: `Fraunces` avec italic pour les titres)
- `--font-sans`    → [FONT_SANS] (ex: `DM Sans` pour le corps)
- `--font-mono`    → [FONT_MONO] (ex: `DM Mono` pour métriques, eyebrows, URLs)

#### PALETTE

- Couleur primaire/fond      : `[COULEUR_PRIMAIRE]`   (ex: `#1A3D6B` Oxford Blue)
- Couleur accent/or          : `[COULEUR_ACCENT]`     (ex: `#D4982A` Brass Gold)
- Texte principal            : `[COULEUR_TEXTE]`      (ex: `#E8E0D0` Parchemin clair)
- Texte secondaire           : `[COULEUR_SECONDAIRE]` (ex: `#8CA3BC` bleu-gris)
- Fond des cartes            : `rgba([R],[G],[B], 0.65)` — toujours semi-transparent

#### STRUCTURE HTML OBLIGATOIRE

```html
<div id="stage">
  <!-- Ambient orbs ×3 (blur 72px, animations lentes 9/11/13s alternate) -->
  <!-- Vignette radiale (z-index:1, pointer-events:none) -->
  <!-- Canvas particles (z-index:0) -->
  <!-- Progress bar #pbar (z-index:20, top:0, h:2px, gradient primaire→accent) -->
  <!-- Logo lockup #logo (position:absolute, bottom:0, height:64px, z-index:10) -->
  <!-- Act 1 #act1 -->
  <!-- Act 2 #act2 -->
  <!-- Act 3 #act3 -->
  <!-- Act 4 #act4 -->
</div>
```

#### LOGO LOCKUP (toujours visible en bas, z-index:10)

```html
<div id="logo">
  <!-- SVG inline du logo, width/height 28px -->
  <div class="logo-right">
    <div class="logo-name">[NOM_COURT]<b>[NOM_SUITE]</b></div>
    <div class="logo-url">[URL_APP]</div>  <!-- DM Mono, 9.5px, accent 55% opacity -->
  </div>
</div>
```
- Fond dégradé `linear-gradient(to top, [FOND] 0%, transparent 100%)`
- `opacity:0` par défaut, `transition:opacity 0.55s ease`
- Apparaît/disparaît avec chaque acte via `showLogo()` / `hideLogo()`

#### EFFETS DE FOND CONSTANTS

**Particles (canvas requestAnimationFrame) :**
- 26 particules, vitesse `±0.32`, rayon `0.4–1.5px`
- Connexions si distance < 82px : `rgba([primaire], 0.16 * (1 - d/82))`
- Couleur fill : `rgba([primaire], 0.48)`
- Jamais de clearRect sur toute la hauteur — utiliser `cx.clearRect(0,0,390,693)`

**Scanline overlay (#stage::after) :**
```css
background: repeating-linear-gradient(0deg,
  transparent, transparent 3px,
  rgba(0,0,0,0.025) 3px, rgba(0,0,0,0.025) 6px);
```

**Vignette (#vignette) :**
```css
background: radial-gradient(ellipse 85% 95% at 50% 50%,
  transparent 35%, rgba([R_fond],[G_fond],[B_fond], 0.9) 100%);
```

**Ambient orbs (3 divs .orb) :**
- filter: blur(72px), border-radius:50%, will-change:transform
- Animations `od1`/`od2` : translate(0,0) → translate(18px,14px) en 9s/11s/13s alternate
- orb-1 : 300×300px, couleur primaire 26% opacité, top:-100px right:-80px
- orb-2 : 220×220px, couleur accent 10% opacité, bottom:-80px left:-60px
- orb-3 : 140×140px, couleur primaire 13% opacité, top:42% left:-50px

#### ANIMATIONS CSS STANDARDS

Toutes les animations d'entrée utilisent exclusivement `transform` et `opacity`.
Jamais de `width`, `height`, `top`, `left` animés directement.

**Spring effect (entrées) :** `cubic-bezier(0.16, 1, 0.3, 1)` — variable `SP` en JS
**Sorties :** `ease-in`
**`will-change: transform, opacity`** sur tous les éléments très animés

Animations perpétuelles (CSS @keyframes) :
- `float-card` : translateY 0 → -6px → 0, 3.8s ease-in-out infinite (cards métriques)
- `float-feat` : translateY 0 → -4px → 0, 4.2s (features)
- `float-pillar` : translateY 0 → -5px → 0, 4s (pillars)
- `pulse-dot` : scale 1 → 1.45 + opacity 1 → 0.35, 1.9s (dot pulsant)
- `pulse-cta` : scale 1 → 1.022 + box-shadow, 2.4s (bouton CTA)
- `blink-urgency` : opacity 0.5 → 1, 2s (ligne d'urgence)

Toutes ces animations ont `animation-play-state: paused` par défaut,
passent à `running` uniquement quand l'acte est visible.

#### ÉLÉMENTS UI RÉCURRENTS

**Cards/Pillars :**
```css
background: rgba([primaire_r],[primaire_g],[primaire_b], 0.65);
border: 1px solid rgba([primaire_r],[primaire_g],[primaire_b], 0.38);
border-radius: 16px;
position: relative; overflow: hidden;
/* Top accent line via ::before */
::before { height:1px; background: linear-gradient(90deg, transparent, [accent] 35%, transparent); }
```

**Pills/Badges :**
```css
border: 1px solid rgba([accent_r],[accent_g],[accent_b], 0.28);
border-radius: 40px;
background: rgba([accent_r],[accent_g],[accent_b], 0.06);
```

**Barres de progression :**
```css
.track { height:3px; background: rgba([primaire],0.22); border-radius:3px; overflow:hidden; }
.fill  { background: linear-gradient(90deg, [primaire], [accent]);
         box-shadow: 0 0 6px rgba([accent],0.3);
         transition: width 1.4s cubic-bezier(0.4,0,0.2,1); }
```

---

### PARTIE 2 — LES 4 ACTES

#### TIMELINE GLOBALE — BOUCLE DE 16 SECONDES

```
Acte 1 :  0.0s – 4.0s  (4s   visibles) → transition à 4.5s
Acte 2 :  4.5s – 9.0s  (4.5s visibles) → transition à 9.5s
Acte 3 :  9.5s – 13.5s (4s   visibles) → transition à 14.0s
Acte 4 : 14.0s – 16.0s (2s   visibles) → boucle repart
```

Constante JS : `const LOOP = 16000;`
Transitions entre actes : `hideAct()` (300ms ease-in) + `setTimeout(showAct, 360ms)`

#### ACTE 1 — HOOK (4s)

Objectif : stopper le scroll en < 1s, cibler un pain point émotionnel.

Éléments et timings :
- `0.1s` — Eyebrow (DM Mono, 10px, letter-spacing 0.22em, accent, uppercase)
- `0.34s` — Titre principal (display 62px, font-weight 700, line-height 0.96, letter-spacing -0.02em)
  — entre depuis `translateY(40px)`, transition 0.7s spring
  — contient un `<em id="mEl">` en accent italique pour le wordMorph
- `0.76s` — Règle horizontale 36px (scaleX 0→1, transform-origin left)
- `1.0s`  — Sous-titre (DM Sans 17px, couleur secondaire, `<strong>` en texte principal)
- `1.36s` — Pill/badge avec dot pulsant
- `1.7s`  — ERS Ring SVG (scale 0.86→1) + animation arc strokeDashoffset
- `2.4s`  — wordMorph démarre (setInterval 1800ms)

WordMorph : 3 mots qui s'enchaînent (sortent par le haut translateY(-20px), entrent par le bas)
ERS Ring : cercle SVG, r=46, strokeDasharray=289.0, strokeDashoffset animé vers `289 * (1 - pct/100)`
Contenu : [HOOK_TITRE_LIGNE1] / [HOOK_TITRE_LIGNE2] / [HOOK_SOUS_TITRE]
Morph words : [[MOT1], [MOT2], [MOT3]]

#### ACTE 2 — CONCEPT/PREUVE (4.5s)

Objectif : expliquer les 2-3 idées clés du produit sans chiffres inventés.

Structure recommandée : **3 pillar cards** empilées + **notification strip** en bas

Pillar card :
```html
<div class="pillar" id="p1">
  <div class="pillar-head">
    <div class="pillar-ic">[EMOJI]</div>
    <div class="pillar-title">[TITRE] <em>[MOT_ACCENT]</em></div>
  </div>
  <div class="pillar-body">[DESCRIPTION 1-2 lignes max]</div>
</div>
```

Timings piliers : stagger 240ms (p1@200ms, p2@440ms, p3@680ms depuis showAct)
Notifications : démarrent à 1.6s dans l'acte, cycle toutes les 2600ms
3 notifs avec : emoji icon + titre + sous-titre + timestamp

Notification structure :
```html
<div class="notif-item" id="nt0">
  <div class="ni-ic">[EMOJI]</div>
  <div class="ni-body">
    <div class="ni-main">[TITRE_NOTIF]</div>
    <div class="ni-sub">[SOUS_TITRE_NOTIF]</div>
  </div>
  <div class="ni-ts">[TIMESTAMP]</div>
</div>
```

Contenu : [PILIER_1_TITRE / DESC], [PILIER_2_TITRE / DESC], [PILIER_3_TITRE / DESC]
Notifs : [NOTIF_1], [NOTIF_2], [NOTIF_3]

#### ACTE 3 — FEATURES (4s)

Objectif : montrer concrètement ce qu'on obtient.

Structure : **4 feature items** qui entrent de gauche (translateX -26px → 0), stagger 200ms

Feature item :
```html
<div class="feat" id="f1">
  <div class="feat-ic">[EMOJI]</div>
  <div class="feat-body">
    <div class="feat-name">[FEATURE_NOM]</div>
    <div class="feat-desc">[FEATURE_DESC]</div>
    <div class="feat-track">
      <div class="feat-fill" data-t="[0-100]" id="ff1"></div>
    </div>
  </div>
</div>
```

Barres : `fillBars()` à 500ms dans l'acte, `transition: width 1.4s cubic-bezier(0.4,0,0.2,1)`
Float loop : animation `fflt` (translateY 0→-4px), animationPlayState paused→running à l'entrée

Contenu : [FEATURE_1_NOM / DESC / BARRE%], [FEATURE_2], [FEATURE_3], [FEATURE_4]

#### ACTE 4 — CTA (2s)

Objectif : convertir avec urgence/rareté. Bouton pulsant, URL visible.

Timings :
- `0ms`    — Tag eyebrow
- `200ms`  — Titre principal (display 46px italic accent)
- `520ms`  — Sous-titre
- `840ms`  — Bouton CTA (pulsecta animation, scale 1→1.022)
- `1200ms` — Ligne d'urgence (blink animation)
- `1450ms` — URL pill

Bouton CTA :
```html
<div class="cta-btn" id="ctab">
  <div class="cta-left">
    <div class="cta-main">[CTA_PRINCIPAL]</div>
    <div class="cta-url-line">[URL]</div>
  </div>
  <div class="cta-arrow"><!-- SVG flèche → --></div>
</div>
```

Contenu : [CTA_TITRE], [CTA_SOUS_TITRE], [CTA_BOUTON], [URGENCE_LINE], [URL]

---

### PARTIE 3 — LE SCRIPT PUPPETEER

#### PRINCIPE TECHNIQUE (critique — ne pas modifier)

```
HTML source  : 390×693px
Viewport     : 1080×1920px, deviceScaleFactor:1
Scale injecté: 1080/390 = 2.769 (uniforme X et Y)
Résultat     : 390×2.769=1080px, 693×2.769=1918px ≈ 1920px
Déformation  : ZÉRO (même facteur X et Y)
```

**Pourquoi deviceScaleFactor:1 et pas 3 :**
`scale:3` sur viewport `393×852` = image capturée `1179×2556px`.
FFmpeg doit ensuite compresser vers `1080×1920` avec des facteurs différents
(1179/1080=1.09 vs 2556/1920=1.33) → déformation asymétrique → écrasement.
Avec `scale:1` + viewport `1080×1920` : FFmpeg ne redimensionne rien.

#### CODE DU SCRIPT

```javascript
const puppeteer = require('puppeteer');
const { PuppeteerScreenRecorder } = require('puppeteer-screen-recorder');
const path = require('path');

const HTML_FILE   = '[NOM_FICHIER].html';
const OUTPUT_FILE = './[NOM_SORTIE].mp4';
const DURATION_MS = 17000;   // durée boucle (16s) + 1s marge
const FPS         = 60;

const VW      = 1080;
const VH      = 1920;
const HTML_W  = 390;
const HTML_H  = 693;
const SCALE   = VW / HTML_W; // 2.7692...

(async () => {
  const fileUrl = `file://${path.resolve(__dirname, HTML_FILE)}`;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-gpu',
           `--window-size=${VW},${VH}`],
  });

  const page = await browser.newPage();

  await page.setViewport({
    width: VW, height: VH,
    deviceScaleFactor: 1,   // ← CRITIQUE : pas de double-scaling
    isMobile: false,
  });

  await page.goto(fileUrl, { waitUntil: 'networkidle0' });

  // Injection CSS : scale uniforme, pas de letterbox, pas de déformation
  await page.evaluate((scale, vw, vh, htmlH) => {
    document.documentElement.style.cssText =
      `width:${vw}px;height:${vh}px;overflow:hidden;background:#[COULEUR_FOND];`;
    document.body.style.cssText =
      `width:${vw}px;height:${vh}px;overflow:hidden;background:#[COULEUR_FOND];margin:0;padding:0;`;
    const stage = document.getElementById('stage');
    if (stage) {
      stage.style.cssText =
        `position:absolute;top:0;left:0;width:390px;height:${htmlH}px;
         transform-origin:top left;transform:scale(${scale});overflow:hidden;`;
    }
  }, SCALE, VW, VH, HTML_H);

  // Laisser les polices Google Fonts se charger
  await new Promise(r => setTimeout(r, 800));

  const recorder = new PuppeteerScreenRecorder(page, {
    followNewTab: false,
    fps: FPS,
    videoFrame: { width: VW, height: VH },
  });

  await recorder.start(OUTPUT_FILE);
  await new Promise(r => setTimeout(r, DURATION_MS));
  await recorder.stop();
  await browser.close();

  console.log(`✅ ${OUTPUT_FILE} — ${VW}×${VH}px @ ${FPS}fps — ratio 9:16 natif`);
})();
```

---

### PARTIE 4 — VARIABLES À REMPLIR

```
[NOM_FICHIER]        → nom du fichier HTML (ex: studylumina_reel)
[NOM_SORTIE]         → nom du MP4 de sortie (ex: studylumina_insta)
[NOM_COURT]          → première partie du nom (ex: Study)
[NOM_SUITE]          → deuxième partie en accent (ex: Lumina)
[URL_APP]            → URL complète (ex: app.studylumina.com)

[COULEUR_FOND]       → hex fond (ex: 070D1A)
[COULEUR_PRIMAIRE]   → hex couleur principale (ex: #1A3D6B)
[COULEUR_ACCENT]     → hex couleur accent (ex: #D4982A)
[COULEUR_TEXTE]      → hex texte principal (ex: #E8E0D0)
[COULEUR_SECONDAIRE] → hex texte secondaire (ex: #8CA3BC)

[FONT_DISPLAY]       → police titres (ex: Fraunces — supporte italic)
[FONT_SANS]          → police corps (ex: DM Sans)
[FONT_MONO]          → police métriques/mono (ex: DM Mono)

[HOOK_TITRE_LIGNE1]  → 2-3 mots choc, pain point (ex: "Tu [VERBE]")
[HOOK_TITRE_LIGNE2]  → suite du titre (ex: "dans le noir.")
[HOOK_SOUS_TITRE]    → bénéfice en 1 ligne, <strong> sur les mots clés
[MOT1/2/3]           → 3 verbes/mots pour le wordMorph

[PILIER_1_TITRE]     → titre de l'idée clé 1
[PILIER_1_MOT]       → mot mis en accent dans le titre
[PILIER_1_DESC]      → description 1-2 lignes max
(idem PILIER_2 et PILIER_3)

[NOTIF_1/2/3]        → 3 notifications : emoji, titre, sous-titre, timestamp
  Format : "Verbe + résultat concret", "Nom · Contexte", "Xm"

[FEATURE_1/2/3/4]    → nom, description 1 ligne, % barre (ex: 91)
  Les % ne sont pas affichés mais servent de longueur visuelle relative

[CTA_TITRE]          → question ou affirmation (ex: "Sais-tu vraiment si tu es prêt·e ?")
[CTA_SOUS_TITRE]     → titre display 46px (ex: "Ton ERS\nen 3 minutes.")
[CTA_BOUTON]         → texte du bouton (ex: "Essai gratuit · 14 jours")
[URGENCE_LINE]       → ligne blink (ex: "🔒 Accès bêta · Rejoins les premiers")
[URL]                → URL dans le bouton (ex: app.studylumina.com)

[LOGO_SVG]           → SVG inline du logo (viewBox, paths, gradients)
                       Placer dans #logo, width/height: 28px
```

---

### PARTIE 5 — RÈGLES DE QUALITÉ MARKETING

1. **Le hook cible une douleur** — pas une feature. "Tu révises dans le noir" > "Découvrez notre app"
2. **Le wordMorph choisit des verbes émotionnels** — galères / devines / stresses
3. **Les piliers = 3 idées du produit** — pas des fonctionnalités, des promesses
4. **Les notifications simulent la vraie vie de l'app** — elles rendent le produit désirable
5. **Les % des barres sont relatifs entre eux** — pas des vraies stats. La barre la plus haute = feature principale
6. **Le CTA crée urgence ou rareté** — "bêta limité", "14 jours gratuits", "premiers X"
7. **Jamais plus de 3 éléments animés simultanément** — ratio signal/bruit élevé
8. **La police display est italique sur le mot fort** — jamais sur toute une ligne

---

### PARTIE 6 — CHECKLIST AVANT LIVRAISON

```
HTML
□ html,body,#stage tous les 3 à 390×693px
□ canvas particles : cvs.width=390, cvs.height=693
□ boundary particles : p.y < 0 → p.y = 693 (pas 844)
□ Toutes les animations CSS utilisent transform/opacity uniquement
□ animation-play-state: paused par défaut sur les floats/pulse
□ resetAll() remet bien chaque état initial (opacity:0, transform reset)
□ LOOP = 16000ms, actes à 4500 / 9500 / 14000ms
□ Logo SVG inline (pas une img src externe)
□ URL visible dans logo ET dans le bouton CTA

SCRIPT
□ deviceScaleFactor: 1 (jamais 2 ou 3)
□ viewport: width:1080, height:1920
□ SCALE = 1080/390 (uniforme, même valeur pour X et Y)
□ injection CSS sur #stage : transform-origin top left, scale(SCALE)
□ DURATION_MS = durée_boucle + 1000ms de marge
□ 800ms d'attente avant recorder.start() (polices Google Fonts)
□ Pas d'aspectRatio dans PuppeteerScreenRecorder options
□ videoFrame.width = 1080, videoFrame.height = 1920
```

---

*Prompt conçu et validé sur StudyLumina — Exam Readiness OS*
*Stack : HTML/CSS/JS vanilla · Puppeteer · puppeteer-screen-recorder*
