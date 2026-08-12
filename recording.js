/**
 * StudyLumina / Carriv — Enregistrement MP4 universel pour Instagram Reels & TikTok
 *
 * TECHNIQUE (inchangée — validée) :
 *   HTML source 390×693px = ratio 9:16 exact
 *   Viewport Puppeteer 1080×1920, deviceScaleFactor:1
 *   Scale CSS uniforme injecté : 1080/390 = 2.7692× sur X et Y
 *   → AUCUNE déformation, AUCUN écrasement.
 *
 * NOUVEAUTÉS DE CETTE VERSION :
 *   1. CLI — plus besoin d'éditer le fichier :
 *        node recording.js reel_tracker_grid
 *        node recording.js reel_split reel_unboxing        (plusieurs d'affilée)
 *        node recording.js reel_tracker_grid --fps=60 --crf=17
 *   2. DURÉE AUTO — la valeur `const LOOP = …` est lue directement dans le
 *      .html. Plus de désynchro entre le reel et le script.
 *   3. DIMENSIONS AUTO — la taille réelle de #stage est mesurée dans la page
 *      avant le scale ; le script refuse de tourner si le ratio n'est pas 9:16.
 *   4. SYNCHRO PARFAITE — l'enregistreur démarre EN PREMIER, puis on remet
 *      l'animation à la frame 0 (window.startLoop) une fois qu'il tourne
 *      vraiment. La toute première frame de l'animation est donc forcément
 *      capturée (l'ancienne version perdait le début pendant le démarrage
 *      de ffmpeg).
 *   4bis. BOUCLE EXACTE — le décalage entre "ffmpeg tourne" et "frame 0 à
 *      l'écran" est mesuré, puis retiré au montage, tout comme la queue de
 *      l'arrêt : le mp4 final dure EXACTEMENT un LOOP, donc il reboucle
 *      sans couture sur Instagram (--no-trim pour garder le brut).
 *   5. VÉRIF POLICES RÉELLE — on ne se contente pas de document.fonts.ready :
 *      on vérifie que chaque famille utilisée est effectivement chargée
 *      (sinon Chromium peint une police de secours = rendu différent du
 *      navigateur, et on veut le savoir AVANT d'encoder 15 secondes).
 *   6. ffmpeg explicite — chemin du binaire fourni par @ffmpeg-installer,
 *      donc aucune dépendance à un ffmpeg installé sur la machine.
 *   7. CONTRÔLE APRÈS COUP — ffprobe relit le mp4 produit et affiche
 *      résolution / fps / durée / taille réelles.
 *
 * ⚠️  EMOJIS : Chromium headless Linux n'a pas de police emoji par défaut
 *   (petits carrés vides). Une seule fois, sur la machine qui encode :
 *     sudo apt-get install -y fonts-noto-color-emoji
 *   Le script détecte l'absence de cette police et prévient avant d'encoder.
 *
 * Prérequis : npm install puppeteer puppeteer-screen-recorder
 */

const fs        = require('fs');
const path      = require('path');
const os        = require('os');
const { execFileSync } = require('child_process');
const puppeteer = require('puppeteer');
const { PuppeteerScreenRecorder } = require('puppeteer-screen-recorder');

// ── Valeurs par défaut (surchargeables en CLI) ────────────────
const DEFAULTS = {
  fps:    60,
  crf:    18,          // 17–18 = texte net après recompression Instagram
  preset: 'slow',
  bitrate: 8000,
  margin: 400,         // ms enregistrés au-delà de LOOP : matelas pour la
                       // recoupe, entièrement retiré du fichier final
  trim:   true,        // recoupe à la boucle exacte (--no-trim pour désactiver)
  outDir: '.',
};

// Dimensions finales — 9:16 natif Instagram & TikTok (ne pas changer)
const VW = 1080;
const VH = 1920;

// Ratio source attendu (390×693). Tolérance en pixels sur la hauteur.
const RATIO_TOLERANCE_PX = 2;

// Combien de temps on accepte d'attendre les polices avant d'abandonner
const FONT_WAIT_TIMEOUT_MS = 8000;

// Délai laissé à ffmpeg pour être réellement en train de capturer avant
// qu'on relance l'animation à la frame 0.
const RECORDER_WARMUP_MS = 400;

/* ══════════════════════════════════════════════════════════════
   CLI
   ══════════════════════════════════════════════════════════════ */
function parseArgs(argv) {
  const names = [];
  const opts  = { ...DEFAULTS };

  for (const raw of argv) {
    if (raw.startsWith('--')) {
      const [k, v] = raw.slice(2).split('=');
      switch (k) {
        case 'fps':      opts.fps      = Number(v); break;
        case 'crf':      opts.crf      = Number(v); break;
        case 'preset':   opts.preset   = v;         break;
        case 'bitrate':  opts.bitrate  = Number(v); break;
        case 'duration': opts.duration = Number(v); break;   // force la durée totale
        case 'margin':   opts.margin   = Number(v); break;
        case 'trim':     opts.trim     = v !== 'false'; break;
        case 'no-trim':  opts.trim     = false;     break;
        case 'out':      opts.outDir   = v;         break;
        case 'help':     opts.help     = true;      break;
        default:
          console.error(`⚠️  Option inconnue ignorée : --${k}`);
      }
    } else {
      names.push(raw.replace(/\.html$/i, ''));
    }
  }
  return { names, opts };
}

function usage() {
  console.log(`
Usage :
  node recording.js <nom-du-reel> [autres-reels...] [options]

Exemples :
  node recording.js reel_tracker_grid
  node recording.js reel_split reel_unboxing
  node recording.js reel_tracker_grid --crf=17 --out=exports

Options :
  --fps=60          images par seconde
  --crf=18          qualité x264 (plus bas = meilleure qualité, fichier plus lourd)
  --preset=slow     preset x264
  --bitrate=8000    débit cible (kb/s)
  --duration=15400  force la durée totale en ms (sinon : LOOP lu dans le .html)
  --margin=400      ms enregistrés en plus, retirés à la recoupe
  --no-trim         garde le brut (avec lead-in/queue) au lieu de recouper
  --out=.           dossier de sortie
`);
}

/* ══════════════════════════════════════════════════════════════
   Outils
   ══════════════════════════════════════════════════════════════ */

/** Lit `const LOOP = 15400;` (ou `let/var`, avec ou sans espaces) dans le HTML. */
function readLoopFromHtml(html) {
  const m = html.match(/\b(?:const|let|var)\s+LOOP\s*=\s*(\d+)/);
  return m ? Number(m[1]) : null;
}

/** Familles de polices demandées via Google Fonts, extraites du <link>. */
function readFontFamilies(html) {
  const families = new Set();
  const linkRe = /fonts\.googleapis\.com\/css2\?([^"']+)/g;
  let m;
  while ((m = linkRe.exec(html)) !== null) {
    const query = m[1].replace(/&amp;/g, '&');
    for (const part of query.split('&')) {
      if (!part.startsWith('family=')) continue;
      const fam = decodeURIComponent(part.slice(7)).split(':')[0].replace(/\+/g, ' ');
      families.add(fam);
    }
  }
  return [...families];
}

function ffmpegPath() {
  try {
    return require('@ffmpeg-installer/ffmpeg').path;
  } catch {
    return null;                       // on laissera la lib chercher dans le PATH
  }
}

function ffprobePath() {
  try {
    return require('@ffprobe-installer/ffprobe').path;
  } catch { /* pas installé */ }
  const ff = ffmpegPath();
  if (ff) {
    const sibling = path.join(path.dirname(ff), 'ffprobe');
    if (fs.existsSync(sibling)) return sibling;
  }
  return null;
}

/**
 * Résumé du mp4. ffprobe si dispo, sinon on relit la sortie de ffmpeg -i,
 * qui donne les mêmes infos (le binaire embarqué n'inclut pas ffprobe).
 */
function probeSummary(file) {
  const probe = ffprobePath();
  if (probe) {
    try {
      const out = execFileSync(probe, [
        '-v', 'error', '-select_streams', 'v:0',
        '-show_entries', 'stream=width,height,avg_frame_rate,nb_frames:format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=0', file,
      ], { encoding: 'utf8' });
      const get = k => (out.match(new RegExp(`^${k}=(.+)$`, 'm')) || [])[1];
      const [n, d] = (get('avg_frame_rate') || '0/1').split('/').map(Number);
      return {
        width: get('width'), height: get('height'),
        fps: d ? (n / d).toFixed(2) : '?',
        frames: get('nb_frames') || '?',
        duration: Number(get('format.duration') || get('duration') || 0).toFixed(2),
      };
    } catch { /* on retombe sur ffmpeg -i */ }
  }

  const ff = ffmpegPath();
  if (!ff) return null;
  try {
    execFileSync(ff, ['-i', file], { encoding: 'utf8', stdio: 'pipe' });
    return null;
  } catch (e) {
    const out = String(e.stderr || '');
    const dur = out.match(/Duration:\s*(\d+):(\d+):([\d.]+)/);
    const dim = out.match(/Video:.*?,\s*(\d+)x(\d+)/);
    const fps = out.match(/([\d.]+)\s*fps/);
    if (!dim) return null;
    return {
      width:  dim[1],
      height: dim[2],
      fps:    fps ? Number(fps[1]).toFixed(2) : '?',
      frames: '?',
      duration: dur
        ? (Number(dur[1]) * 3600 + Number(dur[2]) * 60 + Number(dur[3])).toFixed(2)
        : '?',
    };
  }
}

/**
 * Recoupe le brut à la milliseconde : on retire le temps de démarrage de
 * l'encodeur (lead-in) et tout ce qui dépasse la boucle. La vidéo finale
 * dure EXACTEMENT un LOOP → elle reboucle sans couture sur Instagram.
 */
function trimExact(rawFile, finalFile, leadInMs, loopMs, opts) {
  const ff = ffmpegPath() || 'ffmpeg';
  execFileSync(ff, [
    '-y',
    '-ss', (leadInMs / 1000).toFixed(3),   // après -i = découpe précise à la frame
    '-i', rawFile,
    '-t', (loopMs / 1000).toFixed(3),
    '-an',
    '-c:v', 'libx264',
    '-preset', opts.preset,
    '-crf', String(opts.crf),
    '-pix_fmt', 'yuv420p',                 // indispensable pour la lecture mobile
    '-r', String(opts.fps),
    '-movflags', '+faststart',             // lecture immédiate au streaming
    finalFile,
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
}

function hasEmojiFont() {
  if (os.platform() !== 'linux') return true;      // macOS/Windows : natif
  try {
    const out = execFileSync('fc-list', [], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return /emoji/i.test(out);
  } catch {
    return true;                                    // fc-list absent : on ne peut rien dire
  }
}

function fmt(ms) { return (ms / 1000).toFixed(1) + 's'; }

/* ══════════════════════════════════════════════════════════════
   Enregistrement d'un reel
   ══════════════════════════════════════════════════════════════ */
async function record(browser, name, opts) {
  const htmlPath = path.resolve(__dirname, `${name}.html`);
  if (!fs.existsSync(htmlPath)) {
    throw new Error(`Fichier introuvable : ${htmlPath}`);
  }

  const html     = fs.readFileSync(htmlPath, 'utf8');
  const loop     = readLoopFromHtml(html);
  const families = readFontFamilies(html);

  if (!opts.duration && !loop) {
    throw new Error(
      `Impossible de lire "const LOOP = …" dans ${name}.html.\n` +
      `   Ajoute la constante dans le reel, ou passe --duration=<ms>.`
    );
  }
  const durationMs = opts.duration || (loop + opts.margin);

  fs.mkdirSync(path.resolve(__dirname, opts.outDir), { recursive: true });
  const outFile = path.join(path.resolve(__dirname, opts.outDir), `${name}.mp4`);
  // On enregistre d'abord un brut, qu'on recoupe ensuite à la boucle exacte.
  const canTrim  = opts.trim && loop && !opts.duration;
  const rawFile  = canTrim ? path.join(os.tmpdir(), `${name}.raw.${process.pid}.mp4`) : outFile;

  console.log(`\n🚀 ${name}`);
  console.log(`   LOOP lu dans le HTML : ${loop ? loop + 'ms' : '—'}` +
              `${opts.duration ? `  (durée forcée : ${opts.duration}ms)` : `  → capture ${durationMs}ms` +
                (canTrim ? `, recoupée à ${loop}ms` : '')}`);

  const page = await browser.newPage();
  page.on('pageerror', e => console.error(`   ❌ Erreur JS dans la page : ${e.message}`));
  page.on('requestfailed', r => console.error(`   ⚠️  Requête échouée : ${r.url().slice(0, 80)}`));

  try {
    await page.setViewport({ width: VW, height: VH, deviceScaleFactor: 1, isMobile: false });

    const fileUrl = `file://${htmlPath}`;
    console.log(`🌍 Chargement : ${fileUrl}`);
    await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 60000 });

    // ── Mesure réelle du #stage AVANT toute transformation ──
    const src = await page.evaluate(() => {
      const stage = document.getElementById('stage');
      if (!stage) return null;
      return { w: stage.offsetWidth, h: stage.offsetHeight };
    });
    if (!src) throw new Error(`#stage introuvable dans ${name}.html — le scale ne peut pas être appliqué.`);

    const scale      = VW / src.w;
    const scaledH    = Math.round(src.h * scale);
    const heightDiff = Math.abs(scaledH - VH);

    console.log(`   Source #stage : ${src.w}×${src.h}px · scale uniforme ${scale.toFixed(4)}× → ${VW}×${scaledH}px`);
    if (heightDiff > RATIO_TOLERANCE_PX) {
      throw new Error(
        `Ratio non conforme : ${src.w}×${src.h} scalé donne ${VW}×${scaledH}, ` +
        `attendu ${VW}×${VH} (écart ${heightDiff}px).\n` +
        `   Le #stage doit faire 390×693px pour un 9:16 exact.`
      );
    }

    // ── Injection CSS : scale uniforme + fond dynamique ──
    await page.evaluate((scale, vw, vh, sw, sh) => {
      const stage = document.getElementById('stage');
      const bg = getComputedStyle(stage).backgroundColor === 'rgba(0, 0, 0, 0)'
        ? getComputedStyle(document.body).backgroundColor
        : getComputedStyle(stage).backgroundColor;

      document.documentElement.style.cssText =
        `width:${vw}px;height:${vh}px;overflow:hidden;background:${bg};`;
      document.body.style.cssText =
        `width:${vw}px;height:${vh}px;overflow:hidden;background:${bg};margin:0;padding:0;`;

      stage.style.position      = 'absolute';
      stage.style.top           = '0';
      stage.style.left          = '0';
      stage.style.width         = sw + 'px';
      stage.style.height        = sh + 'px';
      stage.style.transformOrigin = 'top left';
      stage.style.transform     = `scale(${scale})`;
      stage.style.overflow      = 'hidden';
    }, scale, VW, VH, src.w, src.h);

    // ── Attente + vérification réelle des polices ──
    console.log('🔤 Attente des polices...');
    const fontState = await page.evaluate(async (timeoutMs, families) => {
      const ready = await Promise.race([
        document.fonts.ready.then(() => true),
        new Promise(r => setTimeout(() => r(false), timeoutMs)),
      ]);
      // document.fonts.ready peut se résoudre alors qu'une famille distante
      // a échoué : on vérifie famille par famille.
      const missing = families.filter(f => !document.fonts.check(`700 16px "${f}"`));
      return { ready, missing };
    }, FONT_WAIT_TIMEOUT_MS, families);

    if (!fontState.ready) {
      console.log(`   ⚠️  Timeout ${FONT_WAIT_TIMEOUT_MS}ms sur document.fonts.ready.`);
    }
    if (fontState.missing.length) {
      console.log(`   ⚠️  Police(s) NON chargée(s) : ${fontState.missing.join(', ')}`);
      console.log(`      Chromium va peindre une police de secours — le rendu ne correspondra`);
      console.log(`      pas au navigateur. Vérifie la connexion réseau puis relance.`);
    } else if (families.length) {
      console.log(`   ✓ Polices chargées : ${families.join(', ')}`);
    }

    // Laisser le moteur peindre réellement (fonts.ready se résout parfois
    // un instant avant le vrai repaint) + 2 frames de rendu.
    await page.evaluate(() => new Promise(r =>
      requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 150)))
    ));

    const hasStartLoop = await page.evaluate(() => typeof window.startLoop === 'function');
    if (!hasStartLoop) {
      console.log(`   ⚠️  window.startLoop introuvable — impossible de resynchroniser`);
      console.log(`      l'animation sur le début de l'enregistrement.`);
    }

    // ── Enregistrement ──
    const recorder = new PuppeteerScreenRecorder(page, {
      followNewTab: false,
      fps:          opts.fps,
      videoFrame:   { width: VW, height: VH },
      videoCodec:   'libx264',
      videoPreset:  opts.preset,
      videoCrf:     opts.crf,
      videoBitrate: opts.bitrate,
      ffmpeg_Path:  ffmpegPath(),          // binaire embarqué, pas le PATH
      aspectRatio:  '9:16',
    });

    console.log(`🎥 Enregistrement → ${path.relative(__dirname, outFile)}`);
    await recorder.start(rawFile);
    const recStartedAt = Date.now();

    // ── LE POINT CLÉ ──
    // On laisse ffmpeg réellement démarrer, PUIS on remet l'animation à la
    // frame 0. L'ordre inverse (ce que faisait l'ancienne version) perdait
    // les premières centaines de ms au profit du temps de démarrage de
    // l'encodeur. Ici, la frame 0 est forcément capturée, et la durée
    // enregistrée après resynchro vaut exactement LOOP → boucle sans couture.
    await new Promise(r => setTimeout(r, RECORDER_WARMUP_MS));
    if (hasStartLoop) {
      await page.evaluate(() => window.startLoop());
    }
    // Instant précis où la frame 0 est à l'écran, mesuré et non estimé :
    // c'est lui qui sert de point de coupe.
    const leadInMs = Date.now() - recStartedAt;
    if (hasStartLoop) {
      console.log(`🔄 Animation redémarrée à la frame 0 (lead-in mesuré : ${leadInMs}ms).`);
    }

    const startedAt = Date.now();
    const ticker = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const pct  = Math.min(100, Math.round((elapsed / durationMs) * 100));
      const done = Math.round(pct / 4);
      process.stdout.write(
        `\r   [${'█'.repeat(done)}${'░'.repeat(25 - done)}] ${String(pct).padStart(3)}%  ` +
        `${fmt(Math.min(elapsed, durationMs))} / ${fmt(durationMs)}   `
      );
    }, 200);

    await new Promise(r => setTimeout(r, durationMs));
    clearInterval(ticker);
    process.stdout.write('\n');

    console.log('🛑 Arrêt et finalisation de l\'encodage...');
    await recorder.stop();

    // ── Recoupe à la boucle exacte ──
    // Le brut contient le temps de démarrage de ffmpeg en tête et sa
    // latence d'arrêt en queue. On les enlève : durée finale = LOOP pile.
    if (canTrim) {
      console.log(`✂️  Recoupe : coupe à ${leadInMs}ms, durée finale ${loop}ms (boucle exacte)...`);
      try {
        trimExact(rawFile, outFile, leadInMs, loop, opts);
      } catch (err) {
        console.log(`   ⚠️  Recoupe impossible (${String(err.message).split('\n')[0]}) — on garde le brut.`);
        fs.copyFileSync(rawFile, outFile);
      }
      fs.rmSync(rawFile, { force: true });
    }

    // ── Contrôle du fichier produit ──
    const size  = fs.statSync(outFile).size;
    const probe = probeSummary(outFile);
    console.log(`✅ ${path.relative(__dirname, outFile)}  (${(size / 1048576).toFixed(1)} Mo)`);
    if (probe) {
      console.log(`   Vérifié : ${probe.width}×${probe.height} · ${probe.fps}fps · ` +
                  `${probe.duration}s · ${probe.frames} frames`);
      if (probe.width !== String(VW) || probe.height !== String(VH)) {
        console.log(`   ⚠️  Résolution inattendue (attendu ${VW}×${VH}).`);
      }
      if (canTrim && Math.abs(Number(probe.duration) * 1000 - loop) > 60) {
        console.log(`   ⚠️  Durée ${probe.duration}s ≠ LOOP ${(loop / 1000).toFixed(2)}s — la boucle ne sera pas parfaite.`);
      }
    }
    return { name, outFile, size };

  } finally {
    await page.close().catch(() => {});
  }
}

/* ══════════════════════════════════════════════════════════════
   Main
   ══════════════════════════════════════════════════════════════ */
(async () => {
  const { names, opts } = parseArgs(process.argv.slice(2));

  if (opts.help || names.length === 0) {
    usage();
    process.exit(names.length === 0 ? 1 : 0);
  }

  // Vérifs avant de lancer le navigateur
  const missing = names.filter(n => !fs.existsSync(path.resolve(__dirname, `${n}.html`)));
  if (missing.length) {
    console.error(`❌ Fichier(s) introuvable(s) : ${missing.map(n => n + '.html').join(', ')}`);
    process.exit(1);
  }

  const ff = ffmpegPath();
  console.log(`🎬 ffmpeg : ${ff || 'PATH système'}`);
  if (!hasEmojiFont()) {
    console.log(`⚠️  Aucune police emoji détectée sur ce système — les emojis`);
    console.log(`   sortiront en carrés vides. Correctif (une seule fois) :`);
    console.log(`   sudo apt-get install -y fonts-noto-color-emoji`);
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--font-render-hinting=none',        // rendu de police cohérent en headless
      '--force-color-profile=srgb',        // couleurs identiques à l'écran
      '--disable-lcd-text',                // pas de franges colorées sur le texte
      '--hide-scrollbars',
      '--autoplay-policy=no-user-gesture-required',
      `--window-size=${VW},${VH}`,
    ],
  });

  const results = [];
  let failed = 0;
  try {
    for (const name of names) {
      try {
        results.push(await record(browser, name, opts));
      } catch (err) {
        failed++;
        console.error(`\n❌ ${name} : ${err.message}`);
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`\n🏁 Terminé — ${results.length} vidéo(s) produite(s)` +
              (failed ? `, ${failed} en échec.` : '.'));
  results.forEach(r => console.log(`   • ${path.relative(__dirname, r.outFile)}`));
  process.exit(failed ? 1 : 0);
})();
