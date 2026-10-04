/* Fabrique les MP4 du film, image par image.

     node marketing/motion/render.mjs                  # 16:9 et 9:16, 60 i/s
     node marketing/motion/render.mjs --format 9x16    # un seul format
     node marketing/motion/render.mjs --still 24.6     # une image PNG
     node marketing/motion/render.mjs --from 12 --to 20 --fps 30   # un extrait
     node marketing/motion/render.mjs --audio-only     # refait le son des MP4 existants

   Chaque image est posée par la même fonction que le lecteur (le moteur est
   déterministe), capturée par Chromium (Playwright, déjà dans le projet),
   puis encodée par ffmpeg en H.264 ; la bande-son est rendue par la page
   elle-même, exportée en WAV et posée sous l'image en AAC.

   ffmpeg doit savoir encoder libx264 et AAC : celui de Playwright ne fait
   que du VP8 muet. Indiquez-le par --ffmpeg ou par la variable FFMPEG, sinon
   « ffmpeg » est cherché dans le PATH. */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const HERE = import.meta.dirname;

function parseArgs(argv) {
  const args = { format: "both", fps: 60, crf: 16, out: path.join(HERE, "out"), ffmpeg: process.env.FFMPEG || "ffmpeg", from: 0, to: null, still: null, audio: true, audioOnly: false };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const next = () => argv[++i];
    if (flag === "--format") args.format = next();
    else if (flag === "--fps") args.fps = Number(next());
    else if (flag === "--crf") args.crf = Number(next());
    else if (flag === "--out") args.out = path.resolve(next());
    else if (flag === "--ffmpeg") args.ffmpeg = next();
    else if (flag === "--from") args.from = Number(next());
    else if (flag === "--to") args.to = Number(next());
    else if (flag === "--still") args.still = next().split(",").map(Number);
    else if (flag === "--no-audio") args.audio = false;
    else if (flag === "--audio-only") args.audioOnly = true;
    else throw new Error(`Option inconnue : ${flag}`);
  }
  return args;
}

/* La page publiée est enveloppée par l'hébergeur dans un squelette HTML ;
   ici, on pose le même, à côté d'index.html pour que les chemins relatifs
   (motion.css, scenes.js…) se résolvent. Sans doctype, Chromium passerait en
   mode de compatibilité. */
function writeShell() {
  const shell = path.join(HERE, ".render.html");
  const body = readFileSync(path.join(HERE, "index.html"), "utf8");
  writeFileSync(
    shell,
    `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>[hidden]{display:none!important}</style></head><body>${body}</body></html>`,
  );
  return shell;
}

async function openFilm(browser, shell, portrait) {
  const size = portrait ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 };
  const page = await browser.newPage({ viewport: size, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.addInitScript((isPortrait) => {
    window.__RENDER__ = { portrait: isPortrait };
  }, portrait);
  await page.goto(pathToFileURL(shell).href);
  await page.waitForFunction(() => window.filmReady === true, null, { timeout: 60000 });
  if (errors.length) throw new Error(`La page a signalé des erreurs :\n${errors.join("\n")}`);
  return { page, size, errors };
}

function encoder(args, size, wav, file) {
  const inputs = ["-f", "image2pipe", "-framerate", String(args.fps), "-c:v", "mjpeg", "-i", "-"];
  if (wav) inputs.push("-i", wav);
  const output = [
    "-vf", "scale=in_range=pc:out_range=tv:out_color_matrix=bt709,format=yuv420p",
    "-c:v", "libx264", "-preset", "slow", "-crf", String(args.crf), "-profile:v", "high",
    "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
    "-r", String(args.fps), "-movflags", "+faststart",
  ];
  if (wav) output.push("-c:a", "aac", "-b:a", "192k", "-shortest");
  const ffmpeg = spawn(args.ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", ...inputs, ...output, file], { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise((resolve, reject) => {
    ffmpeg.on("error", reject);
    ffmpeg.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg s'est arrêté (code ${code})`))));
  });
  /* Un seul écouteur d'erreur pour tout le flux : en poser un par image les
     accumulait (trois mille par format). */
  let failure = null;
  ffmpeg.stdin.on("error", (error) => {
    failure = error;
  });
  const write = (buffer) =>
    new Promise((resolve, reject) => {
      if (failure) {
        reject(failure);
        return;
      }
      if (ffmpeg.stdin.write(buffer)) resolve();
      else ffmpeg.stdin.once("drain", resolve);
    });
  return { write, end: () => ffmpeg.stdin.end(), done, size };
}

function run(command, argv) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, argv, { stdio: ["ignore", "inherit", "inherit"] });
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${command} s'est arrêté (code ${code})`))));
  });
}

async function writeSoundtrack(page, args) {
  const base64 = await page.evaluate(() => window.filmApi.audioBase64());
  const wav = path.join(args.out, "bulktcg-film-son.wav");
  writeFileSync(wav, Buffer.from(base64, "base64"));
  const stats = await page.evaluate(() => window.filmApi.audioStats());
  const loudest = stats.reduce((max, second) => Math.max(max, second.peakDb), -Infinity);
  const quiet = stats.filter((second) => second.rmsDb < -40).map((second) => second.second);
  console.log(`son : crête ${loudest.toFixed(1)} dBFS${quiet.length ? `, secondes presque muettes : ${quiet.join(", ")}` : ""}`);
  return wav;
}

/* Le son seul : la piste est refaite et reposée sous l'image déjà encodée,
   sans réencoder la vidéo. */
async function remuxAudio(browser, shell, args) {
  const { page } = await openFilm(browser, shell, false);
  const wav = await writeSoundtrack(page, args);
  await page.close();
  for (const name of ["bulktcg-film-16x9", "bulktcg-film-9x16"]) {
    const file = path.join(args.out, `${name}.mp4`);
    if (!existsSync(file)) continue;
    const temporary = path.join(args.out, `${name}.remux.mp4`);
    await run(args.ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", "-i", file, "-i", wav, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", temporary]);
    renameSync(temporary, file);
    console.log(`${file} : son remplacé`);
  }
}

async function renderFormat(browser, shell, args, portrait) {
  const name = portrait ? "bulktcg-film-9x16" : "bulktcg-film-16x9";
  const { page, size } = await openFilm(browser, shell, portrait);
  const duration = await page.evaluate(() => window.filmApi.duration);

  if (args.still) {
    for (const t of args.still) {
      await page.evaluate((time) => window.filmApi.seek(time), t);
      const file = path.join(args.out, `${name}-${String(t).replace(".", "_")}s.png`);
      await page.screenshot({ path: file, clip: { x: 0, y: 0, ...size } });
      console.log(file);
    }
    await page.close();
    return;
  }

  const from = Math.max(0, args.from);
  const to = Math.min(duration, args.to ?? duration);
  const partial = from > 0 || to < duration;
  const wav = args.audio && !partial ? await writeSoundtrack(page, args) : null;

  const file = path.join(args.out, partial ? `${name}-${from}-${to}s.mp4` : `${name}.mp4`);
  const encode = encoder(args, size, wav, file);
  const frames = Math.round((to - from) * args.fps);
  const started = Date.now();
  for (let index = 0; index < frames; index++) {
    const t = from + index / args.fps;
    await page.evaluate((time) => window.filmApi.seek(time), t);
    const frame = await page.screenshot({ type: "jpeg", quality: 93, clip: { x: 0, y: 0, ...size } });
    await encode.write(frame);
    if (index % (args.fps * 5) === 0) {
      const elapsed = (Date.now() - started) / 1000;
      console.log(`${name} : ${t.toFixed(1)} s / ${to} s (${elapsed.toFixed(0)} s écoulées)`);
    }
  }
  encode.end();
  await encode.done;
  await page.close();
  console.log(`${file} — ${frames} images en ${((Date.now() - started) / 1000).toFixed(0)} s`);
}

const args = parseArgs(process.argv.slice(2));
mkdirSync(args.out, { recursive: true });
if (!args.still && !existsSync(args.ffmpeg) && args.ffmpeg !== "ffmpeg") {
  throw new Error(`ffmpeg introuvable : ${args.ffmpeg}`);
}
const shell = writeShell();
const browser = await chromium.launch();
try {
  if (args.audioOnly) {
    await remuxAudio(browser, shell, args);
  } else {
    const formats = args.format === "both" ? [false, true] : [args.format === "9x16"];
    for (const portrait of formats) await renderFormat(browser, shell, args, portrait);
  }
} finally {
  await browser.close();
  rmSync(shell, { force: true });
}
