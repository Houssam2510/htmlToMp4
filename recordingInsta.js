/**
 * StudyLumina — Enregistrement MP4 pour Instagram Reels & TikTok
 *
 * POURQUOI ÇA MARCHAIT PAS :
 *   Ancien script → viewport 393×852 + deviceScaleFactor:3
 *   → image réelle capturée = 1179×2556px
 *   → videoFrame 1080×1920 → FFmpeg étire 1179→1080 ET 2556→1920
 *   → ratios différents (1179/2556 ≠ 1080/1920) → ÉCRASEMENT
 *
 * SOLUTION :
 *   Le HTML est désormais 390×693px = ratio 9:16 exact (390/693 = 0.5628 ≈ 9/16)
 *   Viewport Puppeteer = 1080×1920, deviceScaleFactor:1
 *   On injecte un CSS scale uniforme : 1080/390 = 2.769 sur X et Y
 *   Résultat : 390×2.769 = 1080px, 693×2.769 = 1918px ≈ 1920px (2px d'arrondi)
 *   → AUCUNE déformation, AUCUN écrasement, AUCUNE bande noire
 *
 * Usage :
 *   npm install puppeteer puppeteer-screen-recorder
 *   node record_insta.js
 */

const puppeteer = require('puppeteer');
const { PuppeteerScreenRecorder } = require('puppeteer-screen-recorder');
const path = require('path');

// ── CONFIG ──────────────────────────────────────
const HTML_FILE   = 'carriv_reel.html';
const OUTPUT_FILE = './carriv_reel.mp4';
const DURATION_MS = 21500;  // 16s boucle + 1s marge
const FPS         = 60;

// Dimensions finales — 9:16 natif Instagram & TikTok
const VW = 1080;
const VH = 1920;

// Dimensions source du HTML (ratio 9:16 exact)
const HTML_W = 390;
const HTML_H = 693;

// Scale uniforme — même facteur X et Y = zéro déformation
const SCALE = VW / HTML_W; // 2.7692...
// ────────────────────────────────────────────────

(async () => {
  const fileUrl = `file://${path.resolve(__dirname, HTML_FILE)}`;

  console.log('🚀 Lancement Puppeteer...');
  console.log(`   Scale uniforme : ${SCALE.toFixed(4)}× (${HTML_W}×${HTML_H} → ${VW}×${Math.round(HTML_H * SCALE)}px)`);

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      `--window-size=${VW},${VH}`,
    ],
  });

  try {
    const page = await browser.newPage();

    // Viewport = résolution finale exacte, scale:1 → pas de double-scaling
    await page.setViewport({
      width:             VW,
      height:            VH,
      deviceScaleFactor: 1,
      isMobile:          false,
    });

    console.log(`🌍 Chargement : ${fileUrl}`);
    await page.goto(fileUrl, { waitUntil: 'networkidle0' });

    // Injection CSS : scale uniforme, transform-origin top-left,
    // body remplit exactement 1080×1920
    await page.evaluate((scale, vw, vh) => {
      document.documentElement.style.cssText = `
        width:${vw}px; height:${vh}px;
        overflow:hidden; background:#070D1A;
      `;
      document.body.style.cssText = `
        width:${vw}px; height:${vh}px;
        overflow:hidden; background:#070D1A;
        margin:0; padding:0;
      `;
      const stage = document.getElementById('stage');
      if (stage) {
        stage.style.cssText = `
          position:absolute;
          top:0; left:0;
          width:390px; height:693px;
          transform-origin:top left;
          transform:scale(${scale});
          overflow:hidden;
        `;
      }
    }, SCALE, VW, VH);

    // Attendre que les polices Google Fonts soient bien rendues
    await new Promise(r => setTimeout(r, 800));

    const recorder = new PuppeteerScreenRecorder(page, {
      followNewTab: false,
      fps: FPS,
      videoFrame: { width: VW, height: VH },
      // Pas d'aspectRatio — déjà résolu côté DOM
    });

    console.log(`🎥 Enregistrement → ${OUTPUT_FILE}`);
    await recorder.start(OUTPUT_FILE);

    await new Promise(r => setTimeout(r, DURATION_MS));

    console.log('🛑 Arrêt...');
    await recorder.stop();

    console.log(`\n✅ Vidéo prête : ${OUTPUT_FILE}`);
    console.log(`   ${VW}×${VH}px · ${FPS}fps · ratio 9:16 natif · aucune déformation`);

  } catch (err) {
    console.error('❌ Erreur :', err.message);
    console.error(err.stack);
  } finally {
    await browser.close();
    console.log('🏁 Navigateur fermé.');
  }
})();