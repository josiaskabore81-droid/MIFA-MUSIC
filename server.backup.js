import express from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

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
   RECHERCHE AUDIUS
========================= */

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

app.get("/api/audius", async (req, res) => {
  const query = String(req.query.q || "").trim();

  if (query.length < 2) {
    return res.json({
      success: true,
      source: "Audius",
      music: []
    });
  }

  try {
    const url = new URL(
      "https://api.audius.co/v1/tracks/search"
    );

    url.searchParams.set("query", query);
    url.searchParams.set("limit", "50");

    const response = await fetch(url, {
      headers: {
        "User-Agent": "MIFA-MUSIC/3.0"
      }
    });

    if (!response.ok) {
      throw new Error(`Audius HTTP ${response.status}`);
    }

    const data = await response.json();
    const tracks = Array.isArray(data.data) ? data.data : [];

    const q = normalize(query);
    const words = q.split(/\s+/).filter(Boolean);

    const scored = tracks.map(track => {
      const title = normalize(track.title);
      const artist = normalize(
        track.user?.name || track.user?.handle || ""
      );

      let score = 0;

      if (title === q) score += 100;
      if (artist === q) score += 100;

      if (title.includes(q)) score += 50;
      if (artist.includes(q)) score += 50;

      for (const word of words) {
        if (title.includes(word)) score += 10;
        if (artist.includes(word)) score += 20;
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
      .map(({ track }) => ({
        id: track.id || track.track_id,
        title: track.title || "Titre inconnu",
        artist:
          track.user?.name ||
          track.user?.handle ||
          "Artiste inconnu",

        album: "",
        image:
          track.artwork?.["1000x1000"] ||
          track.artwork?.["480x480"] ||
          track.artwork?.["150x150"] ||
          null,

        audio:
          track.stream?.url ||
          null,

        download:
          track.is_downloadable && track.download
            ? track.download
            : null,

        downloadAllowed:
          Boolean(track.is_downloadable && track.download),

        duration:
          Number(track.duration || 0),

        permalink:
          track.permalink || null,

        genre:
          track.genre || ""
      }));

    console.log(
      `🎧 Audius : "${query}" → ${music.length} résultat(s)`
    );

    res.json({
      success: true,
      source: "Audius",
      query,
      music
    });
  } catch (error) {
    console.error("❌ Audius :", error.message);

    res.status(502).json({
      success: false,
      source: "Audius",
      music: [],
      message: "Impossible de contacter Audius"
    });
  }
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
      .filter(file => /\.(mp3|wav|m4a|ogg|aac)$/i.test(file))
      .filter(file =>
        normalize(file).includes(query)
      )
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
  res.sendFile(path.join(publicDir, "index.html"));
});

/* =========================
   ERREURS
========================= */

app.use((err, req, res, next) => {
  console.error("❌ Serveur :", err.message);

  res.status(500).json({
    success: false,
    message: "Erreur serveur"
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`
╔════════════════════════════════╗
║          🎵 MIFA MUSIC         ║
╠════════════════════════════════╣
║ 🚀 Serveur : http://localhost:${PORT}
║ 🎧 Recherche : Audius
║ 📱 Interface web prête
║ 🎵 Lecteur audio actif
╚════════════════════════════════╝
`);
});
