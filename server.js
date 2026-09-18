import express from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const publicDir = path.join(__dirname, "public");
const musicDir = path.join(publicDir, "music");

if (!fs.existsSync(musicDir)) {
  fs.mkdirSync(musicDir, { recursive: true });
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(publicDir));

const upload = multer({ dest: musicDir });

/* =========================
   MUSIQUE LOCALE
========================= */

app.get("/api/music", (req, res) => {
  try {
    const files = fs.readdirSync(musicDir);

    const music = files
      .filter(file => /\.(mp3|wav|m4a|ogg|aac)$/i.test(file))
      .map(file => ({
        file,
        title: path.parse(file).name,
        artist: "MIFA MUSIC",
        audio: `/music/${encodeURIComponent(file)}`,
        download: `/api/download/${encodeURIComponent(file)}`
      }));

    res.json({
      success: true,
      music
    });
  } catch (error) {
    console.error("❌ Musique locale :", error.message);

    res.status(500).json({
      success: false,
      music: [],
      message: "Impossible de charger la bibliothèque"
    });
  }
});

/* =========================
   UPLOAD
========================= */

app.post("/api/upload", upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Aucun fichier"
      });
    }

    const oldPath = req.file.path;
    const ext = path.extname(req.file.originalname);
    const newName = `${Date.now()}${ext}`;
    const newPath = path.join(musicDir, newName);

    fs.renameSync(oldPath, newPath);

    res.json({
      success: true,
      file: newName,
      title: path.parse(req.file.originalname).name,
      audio: `/music/${encodeURIComponent(newName)}`,
      download: `/api/download/${encodeURIComponent(newName)}`
    });
  } catch (error) {
    console.error("❌ Upload :", error.message);

    res.status(500).json({
      success: false,
      message: "Erreur pendant l'upload"
    });
  }
});

/* =========================
   TÉLÉCHARGEMENT LOCAL
========================= */

app.get("/api/download/:file", (req, res) => {
  try {
    const file = path.basename(req.params.file);
    const filePath = path.join(musicDir, file);

    if (!fs.existsSync(filePath)) {
      return res.status(404).send("Fichier introuvable");
    }

    res.download(filePath);
  } catch (error) {
    console.error("❌ Download :", error.message);
    res.status(500).send("Erreur téléchargement");
  }
});

/* =========================
   UTILITAIRE YOUTUBE
========================= */

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function youtubeSearch(query, limit = 20) {
  return new Promise((resolve, reject) => {
    const search = `ytsearch${limit}:${query}`;

    const process = spawn("yt-dlp", [
      "--flat-playlist",
      "--dump-single-json",
      "--no-warnings",
      "--skip-download",
      search
    ]);

    let stdout = "";
    let stderr = "";

    process.stdout.on("data", data => {
      stdout += data.toString();
    });

    process.stderr.on("data", data => {
      stderr += data.toString();
    });

    process.on("error", error => {
      reject(error);
    });

    process.on("close", code => {
      if (code !== 0) {
        reject(
          new Error(
            stderr.trim() || `yt-dlp terminé avec le code ${code}`
          )
        );
        return;
      }

      try {
        const data = JSON.parse(stdout);

        resolve(
          Array.isArray(data.entries)
            ? data.entries.filter(Boolean)
            : []
        );
      } catch (error) {
        reject(
          new Error("Réponse YouTube invalide : " + error.message)
        );
      }
    });
  });
}

/* =========================
   RECHERCHE YOUTUBE
========================= */

app.get("/api/audius", async (req, res) => {
  const query = String(req.query.q || "").trim();

  if (query.length < 2) {
    return res.json({
      success: true,
      source: "YouTube",
      music: []
    });
  }

  try {
    console.log(`🔎 YouTube : "${query}"`);

    const tracks = await youtubeSearch(query, 20);

    const q = normalize(query);
    const words = q.split(/\s+/).filter(Boolean);

    const scored = tracks.map(track => {
      const title = normalize(track.title || "");
      const artist = normalize(
        track.channel ||
        track.uploader ||
        ""
      );

      let score = 0;

      if (title === q) score += 100;
      if (artist === q) score += 100;

      if (title.includes(q)) score += 60;
      if (artist.includes(q)) score += 70;

      for (const word of words) {
        if (title.includes(word)) score += 10;
        if (artist.includes(word)) score += 25;
      }

      /* Favoriser les chaînes officielles */
      const officialText = normalize(
        `${track.channel || ""} ${track.title || ""}`
      );

      if (officialText.includes("officiel")) {
        score += 15;
      }

      if (officialText.includes("official")) {
        score += 15;
      }

      return {
        track,
        score
      };
    });

    const music = scored
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map(({ track }) => {
        const videoId = track.id;

        const thumbnail =
          track.thumbnails?.[track.thumbnails.length - 1]?.url ||
          (videoId
            ? `https://i.ytimg.com/vi/${videoId}/hq720.jpg`
            : null);

        const youtubeUrl =
          track.url ||
          `https://www.youtube.com/watch?v=${videoId}`;

        return {
          id: videoId,
          title: track.title || "Titre inconnu",

          artist:
            track.channel ||
            track.uploader ||
            "Artiste inconnu",

          album: "YouTube",

          image: thumbnail,

          audio:
            `/api/youtube/stream?url=${encodeURIComponent(
              youtubeUrl
            )}`,

          download:
            `/api/youtube/download?url=${encodeURIComponent(
              youtubeUrl
            )}`,

          downloadAllowed: true,

          duration:
            Number(track.duration || 0),

          permalink: youtubeUrl,

          youtube: youtubeUrl,

          genre: "YouTube"
        };
      });

    console.log(
      `🎧 YouTube : "${query}" → ${music.length} résultat(s)`
    );

    res.json({
      success: true,
      source: "YouTube",
      query,
      music
    });

  } catch (error) {
    console.error(
      "❌ YouTube :",
      error.message
    );

    res.status(502).json({
      success: false,
      source: "YouTube",
      music: [],
      message:
        "Impossible de rechercher sur YouTube"
    });
  }
});

/* =========================
   STREAM AUDIO YOUTUBE
========================= */

app.get("/api/youtube/stream", (req, res) => {
  const url = String(req.query.url || "").trim();

  if (!url) {
    return res.status(400).send("URL YouTube manquante");
  }

  console.log(`▶️ Lecture YouTube : ${url}`);

  res.setHeader("Content-Type", "audio/mpeg");
  res.setHeader("Transfer-Encoding", "chunked");
  res.setHeader("Cache-Control", "no-cache");

  const ytdlp = spawn("yt-dlp", [
    "-f",
    "bestaudio/best",
    "--no-warnings",
    "--no-playlist",
    "-o",
    "-",
    url
  ]);

  const ffmpeg = spawn("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    "pipe:0",
    "-vn",
    "-acodec",
    "libmp3lame",
    "-b:a",
    "192k",
    "-f",
    "mp3",
    "pipe:1"
  ]);

  ytdlp.stdout.pipe(ffmpeg.stdin);
  ffmpeg.stdout.pipe(res);

  ytdlp.stderr.on("data", data => {
    const message = data.toString().trim();

    if (message) {
      console.log("yt-dlp:", message);
    }
  });

  ffmpeg.stderr.on("data", data => {
    const message = data.toString().trim();

    if (message) {
      console.log("ffmpeg:", message);
    }
  });

  const cleanup = () => {
    if (!ytdlp.killed) {
      ytdlp.kill("SIGTERM");
    }

    if (!ffmpeg.killed) {
      ffmpeg.kill("SIGTERM");
    }
  };

  req.on("close", cleanup);
  res.on("close", cleanup);

  ytdlp.on("error", error => {
    console.error("❌ yt-dlp stream :", error.message);

    if (!res.headersSent) {
      res.status(500).send("Erreur lecture YouTube");
    }
  });

  ffmpeg.on("error", error => {
    console.error("❌ FFmpeg stream :", error.message);
  });
});

/* =========================
   TÉLÉCHARGEMENT MP3 YOUTUBE
========================= */

app.get("/api/youtube/download", (req, res) => {
  const url = String(req.query.url || "").trim();

  if (!url) {
    return res.status(400).send("URL YouTube manquante");
  }

  console.log(`⬇️ Téléchargement YouTube : ${url}`);

  const safeName = `MIFA-${Date.now()}.mp3`;
  const outputPath = path.join(musicDir, safeName);

  const process = spawn("yt-dlp", [
    "-x",
    "--audio-format",
    "mp3",
    "--audio-quality",
    "192K",
    "--no-playlist",
    "--no-warnings",
    "-o",
    outputPath,
    url
  ]);

  let errorOutput = "";

  process.stderr.on("data", data => {
    errorOutput += data.toString();
  });

  process.on("error", error => {
    console.error("❌ yt-dlp download :", error.message);

    if (!res.headersSent) {
      res.status(500).send(
        "yt-dlp est introuvable ou ne peut pas être lancé"
      );
    }
  });

  process.on("close", code => {
    if (code !== 0) {
      console.error(
        "❌ Téléchargement YouTube :",
        errorOutput
      );

      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }

      if (!res.headersSent) {
        res.status(500).send(
          "Impossible de télécharger cette vidéo"
        );
      }

      return;
    }

    if (!fs.existsSync(outputPath)) {
      return res.status(500).send(
        "Le fichier MP3 n'a pas été créé"
      );
    }

    res.download(
      outputPath,
      safeName,
      error => {
        if (error) {
          console.error(
            "❌ Envoi MP3 :",
            error.message
          );
        }
      }
    );
  });
});

/* =========================
   RECHERCHE LOCALE
========================= */

app.get("/api/search", (req, res) => {
  const query = normalize(req.query.q || "");

  if (!query) {
    return res.json({
      success: true,
      music: []
    });
  }

  try {
    const files = fs.readdirSync(musicDir);

    const music = files
      .filter(file =>
        /\.(mp3|wav|m4a|ogg|aac)$/i.test(file)
      )
      .filter(file =>
        normalize(file).includes(query)
      )
      .map(file => ({
        file,
        title: path.parse(file).name,
        artist: "MIFA MUSIC",
        audio:
          `/music/${encodeURIComponent(file)}`,
        download:
          `/api/download/${encodeURIComponent(file)}`
      }));

    res.json({
      success: true,
      music
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      music: []
    });
  }
});

/* =========================
   PAGE PRINCIPALE
========================= */

app.use((req, res) => {
  res.sendFile(
    path.join(publicDir, "index.html")
  );
});

/* =========================
   ERREURS
========================= */

app.use((err, req, res, next) => {
  console.error(
    "❌ Serveur :",
    err.message
  );

  res.status(500).json({
    success: false,
    message: "Erreur serveur"
  });
});

/* =========================
   DÉMARRAGE
========================= */

app.listen(PORT, "0.0.0.0", () => {
  console.log(`
╔════════════════════════════════╗
║          🎵 MIFA MUSIC         ║
╠════════════════════════════════╣
║ 🚀 Serveur : http://localhost:${PORT}
║ 🎧 Recherche : YouTube
║ ⚡ Moteur : yt-dlp
║ 🎵 Audio : FFmpeg
║ 📱 Interface web prête
╚════════════════════════════════╝
`);
});
