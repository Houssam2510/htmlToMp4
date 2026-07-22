/**
 * StudyLumina — Enregistrement MP4 universel pour Instagram Reels & TikTok
 *
 * TECHNIQUE (inchangée — validée) :
 *   HTML source 390×693px = ratio 9:16 exact
 *   Viewport Puppeteer 1080×1920, deviceScaleFactor:1
 *   Scale CSS uniforme injecté : 1080/390 = 2.7692× sur X et Y
 *   → AUCUNE déformation, AUCUN écrasement.
 *
 * CE QUI CHANGE DANS CETTE VERSION :
 *   1. NAME unique → HTML_FILE / OUTPUT_FILE en découlent.
 *   2. Attente réelle des polices via document.fonts.ready au lieu
 *      d'un délai fixe à l'aveugle — élimine le "flash" de police
 *      de remplacement en plein milieu de la vidéo.
 *   3. Redémarrage forcé de l'animation à la frame 0 juste avant le
 *      lancement de l'enregistreur (via window.startLoop, exposée
 *      globalement dans tous nos reels) — garantit que le début de
 *      la vidéo n'est JAMAIS perdu, peu importe le temps qu'a pris
 *      l'attente des polices.
 *   4. Couleur de fond détectée dynamiquement depuis #stage.
 *   5. Réglages d'encodage explicites (CRF bas, preset lent) pour
 *      un texte net après compression.
 *   6. Vérification du fichier avant lancement du navigateur.
 *
 * ⚠️  PROBLÈME EMOJIS — CE N'EST PAS RÉPARABLE DEPUIS CE SCRIPT.
 *   Le Chromium headless de Puppeteer sur Linux n'a AUCUNE police
 *   emoji couleur installée par défaut — les emojis s'affichent en
 *   petits carrés vides ("tofu"). C'est un problème de système
 *   d'exploitation, pas de code. Fix (une seule fois, sur la machine
 *   qui exécute ce script) :
 *
 *     Ubuntu / Debian :
 *       sudo apt-get update && sudo apt-get install -y fonts-noto-color-emoji
 *
 *     Docker (dans ton Dockerfile) :
 *       RUN apt-get update && apt-get install -y fonts-noto-color-emoji
 *
 *     macOS / Windows : rien à faire, l'OS a déjà des polices emoji natives.
 *
 *   Après installation, redémarre simplement le script — aucune
 *   modification de code n'est nécessaire une fois la police présente.
 *
 * Usage :
 *   npm install puppeteer puppeteer-screen-recorder
 *   → change NAME et DURATION_MS ci-dessous, puis : node record.js
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { PuppeteerScreenRecorder } = require('puppeteer-screen-recorder');

// ── CONFIG — change ces deux lignes ──────────────────
const NAME         = 'reel_fivesigns';  // ← nom de base, sans extension
const DURATION_MS  = 16150;             // ← LOOP du reel (cherche "const LOOP=" dans le .html) + 1000ms de marge
// ──────────────────────────────────────────────────────

const HTML_FILE   = `${NAME}.html`;
const OUTPUT_FILE = `./${NAME}.mp4`;
const FPS         = 60;

// Combien de temps on accepte d'attendre les polices avant d'abandonner
// et de démarrer quand même (évite un blocage infini si une police
// ne charge jamais, ex. panne réseau)
const FONT_WAIT_TIMEOUT_MS = 5000;

// Dimensions finales — 9:16 natif Instagram & TikTok (ne pas changer)
const VW = 1080;
const VH = 1920;

// Dimensions source du HTML (ratio 9:16 exact — ne pas changer)
const HTML_W = 390;
const HTML_H = 693;
const SCALE  = VW / HTML_W; // 2.7692...

(async () => {
  const htmlPath = path.resolve(__dirname, HTML_FILE);

  if (!fs.existsSync(htmlPath)) {
    console.error(`❌ Fichier introuvable : ${htmlPath}`);
    console.error(`   Vérifie que NAME correspond bien au fichier .html présent dans ce dossier.`);
    process.exit(1);
  }

  const fileUrl = `file://${htmlPath}`;

  console.log(`🚀 ${NAME}`);
  console.log(`   Scale uniforme : ${SCALE.toFixed(4)}× (${HTML_W}×${HTML_H} → ${VW}×${Math.round(HTML_H * SCALE)}px)`);
  console.log(`   Durée : ${DURATION_MS}ms — vérifie que ça correspond au LOOP + marge du fichier`);

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--font-render-hinting=none',   // rendu de police plus cohérent en headless
      `--window-size=${VW},${VH}`,
    ],
  });

  try {
    const page = await browser.newPage();

    await page.setViewport({
      width:             VW,
      height:            VH,
      deviceScaleFactor: 1,
      isMobile:          false,
    });

    console.log(`🌍 Chargement : ${fileUrl}`);
    await page.goto(fileUrl, { waitUntil: 'networkidle0' });

    // ── Injection CSS : scale uniforme + couleur de fond dynamique ──
    // On fait ça AVANT d'attendre les polices, pour que le layout final
    // soit déjà en place pendant le chargement des fonts.
    await page.evaluate((scale, vw, vh) => {
      const stage = document.getElementById('stage');
      const bg = stage
        ? getComputedStyle(stage).backgroundColor
        : getComputedStyle(document.body).backgroundColor;

      document.documentElement.style.cssText =
        `width:${vw}px;height:${vh}px;overflow:hidden;background:${bg};`;
      document.body.style.cssText =
        `width:${vw}px;height:${vh}px;overflow:hidden;background:${bg};margin:0;padding:0;`;

      if (stage) {
        stage.style.cssText = `
          position:absolute;top:0;left:0;
          width:390px;height:693px;
          transform-origin:top left;
          transform:scale(${scale});
          overflow:hidden;
        `;
      }
    }, SCALE, VW, VH);

    // ── Attente réelle des polices (pas un délai à l'aveugle) ──
    console.log('🔤 Attente des polices (document.fonts.ready)...');
    const fontsLoaded = await page.evaluate((timeoutMs) => {
      return Promise.race([
        document.fonts.ready.then(() => true),
        new Promise(resolve => setTimeout(() => resolve(false), timeoutMs)),
      ]);
    }, FONT_WAIT_TIMEOUT_MS);

    if (fontsLoaded) {
      console.log('   ✓ Toutes les polices sont chargées et prêtes.');
    } else {
      console.log(`   ⚠️  Timeout après ${FONT_WAIT_TIMEOUT_MS}ms — certaines polices n'ont peut-être pas fini de charger.`);
    }

    // Petite marge de sécurité supplémentaire pour laisser le moteur de
    // rendu peindre réellement les polices (fonts.ready se résout parfois
    // un instant avant le vrai repaint visuel).
    await new Promise(r => setTimeout(r, 200));

    const recorder = new PuppeteerScreenRecorder(page, {
      followNewTab:  false,
      fps:           FPS,
      videoFrame:    { width: VW, height: VH },
      videoCodec:    'libx264',
      videoPreset:   'slow',
      videoCrf:      18,
      videoBitrate:  8000,
    });

    // ── LE POINT CLÉ : redémarrer l'animation à la frame 0 exactement
    // ici, juste avant de lancer l'enregistreur. Peu importe combien
    // de temps a pris tout ce qui précède (chargement, attente des
    // polices), l'animation repart de zéro pile au bon moment.
    // startLoop() existe déjà dans tous nos reels — elle appelle
    // resetAll() en interne, donc ce redémarrage est propre et sûr.
    const restarted = await page.evaluate(() => {
      if (typeof window.startLoop === 'function') {
        window.startLoop();
        return true;
      }
      return false;
    });

    if (restarted) {
      console.log('🔄 Animation redémarrée à la frame 0 — le début ne sera pas perdu.');
    } else {
      console.log('⚠️  window.startLoop introuvable — l\'enregistrement démarre sans resynchronisation.');
      console.log('   (Vérifie que ton reel expose bien une fonction startLoop() au niveau global.)');
    }

    console.log(`🎥 Enregistrement → ${OUTPUT_FILE}`);
    await recorder.start(OUTPUT_FILE);

    const startedAt = Date.now();
    const ticker = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const pct = Math.min(100, Math.round((elapsed / DURATION_MS) * 100));
      process.stdout.write(`\r   ⏳ ${pct}%  (${(elapsed/1000).toFixed(1)}s / ${(DURATION_MS/1000).toFixed(1)}s)   `);
    }, 250);

    await new Promise(r => setTimeout(r, DURATION_MS));
    clearInterval(ticker);
    process.stdout.write('\n');

    console.log('🛑 Arrêt...');
    await recorder.stop();

    console.log(`\n✅ Vidéo prête : ${OUTPUT_FILE}`);
    console.log(`   ${VW}×${VH}px · ${FPS}fps · CRF 18 · ratio 9:16 natif · aucune déformation`);

  } catch (err) {
    console.error('❌ Erreur :', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await browser.close();
    console.log('🏁 Navigateur fermé.');
  }
})();