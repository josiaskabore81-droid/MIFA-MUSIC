const API_BASE = 'https://mifa-music.onrender.com';
const state = {
  currentTrack: null,
  tracks: [],
  phoneTracks: [],
  favorites: JSON.parse(localStorage.getItem("mifa_favorites") || "[]"),
  history: JSON.parse(localStorage.getItem("mifa_history") || "[]")
};

const $ = (s) => document.querySelector(s);

function saveFavorites() {
  localStorage.setItem("mifa_favorites", JSON.stringify(state.favorites));
}

function saveHistory() {
  localStorage.setItem("mifa_history", JSON.stringify(state.history));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizePhoneTrack(track) {
  return {
    id: `phone-${track.id}`,
    title: track.title || "Titre inconnu",
    artist: track.artist || "Artiste inconnu",
    album: track.album || "Album inconnu",
    image: "assets/default-cover.png",
    audio: new URL(track.audio, API_BASE).href,
    duration: Number(track.duration || 0),
    local: true,
    source: "Téléphone"
  };
}

function addPhoneMusic(json) {
  try {
    const data = typeof json === "string" ? JSON.parse(json) : json;

    state.phoneTracks = Array.isArray(data)
      ? data.map(normalizePhoneTrack)
      : [];

    state.tracks = [
      ...state.phoneTracks,
      ...state.tracks.filter(t => !t.local)
    ];

    console.log(`🎵 ${state.phoneTracks.length} musique(s) du téléphone`);

    renderLibrary();
    renderHome();

  } catch (error) {
    console.error("Erreur bibliothèque téléphone :", error);
  }
}

window.mifaPhoneMusic = addPhoneMusic;

window.mifaPhoneMusicError = function(error) {
  console.error("MediaStore :", error);
};

function loadPhoneMusic() {
  if (window.MifaMusic && typeof window.MifaMusic.loadMusic === "function") {
    console.log("📱 Chargement des musiques du téléphone...");
    window.MifaMusic.loadMusic();
  } else {
    console.log("🌐 Version navigateur : MediaStore indisponible");
  }
}

function playTrack(track) {
  if (!track || !track.audio) return;

  state.currentTrack = track;

  const audio = $("#audioPlayer");

  if (!audio) {
    console.error("Lecteur audio introuvable");
    return;
  }

  audio.src = new URL(track.audio, API_BASE).href;
  audio.load();

  audio.play().catch(error => {
    console.error("Lecture impossible :", error);
  });

  addHistory(track);
  updatePlayer(track);
}

function addHistory(track) {
  state.history = [
    track,
    ...state.history.filter(t => t.id !== track.id)
  ].slice(0, 50);

  saveHistory();
}

function updatePlayer(track) {
  const title = $("#playerTitle");
  const artist = $("#playerArtist");
  const cover = $("#playerCover");

  if (title) title.textContent = track.title;
  if (artist) artist.textContent = track.artist;

  if (cover && track.image) {
    cover.src = track.image;
  }

  document.title = `${track.title} • MIFA MUSIC`;
}

function toggleFavorite(track) {
  const exists = state.favorites.some(t => t.id === track.id);

  if (exists) {
    state.favorites = state.favorites.filter(t => t.id !== track.id);
  } else {
    state.favorites.push(track);
  }

  saveFavorites();
  renderLibrary();
}

function renderTrackCard(track) {
  const favorite = state.favorites.some(t => t.id === track.id);

  return `
    <div class="music-card" data-id="${escapeHtml(track.id)}">
      <div class="music-cover">
        <img src="${escapeHtml(track.image || "assets/default-cover.png")}"
             onerror="this.src='assets/default-cover.png'">

        <button class="play-card" onclick='playTrack(${JSON.stringify(track)})'>
          ▶
        </button>
      </div>

      <div class="music-info">
        <h3>${escapeHtml(track.title)}</h3>
        <p>${escapeHtml(track.artist)}</p>
      </div>

      <button class="favorite-btn"
              onclick='toggleFavorite(${JSON.stringify(track)})'>
        ${favorite ? "❤️" : "🤍"}
      </button>
    </div>
  `;
}

function renderLibrary() {
  const container =
    $("#libraryGrid") ||
    $("#libraryList") ||
    $("#musicGrid");

  if (!container) return;

  if (!state.tracks.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div style="font-size:45px">🎵</div>
        <h3>Aucune musique trouvée</h3>
        <p>Autorisez MIFA MUSIC à accéder à vos fichiers audio.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = state.tracks
    .map(renderTrackCard)
    .join("");
}

function renderHome() {
  const container =
    $("#homeMusic") ||
    $("#homeGrid") ||
    $("#musicGrid");

  if (!container) return;

  const tracks = state.tracks.slice(0, 20);

  if (!tracks.length) return;

  container.innerHTML = tracks
    .map(renderTrackCard)
    .join("");
}

async function searchMusic(query) {
  query = String(query || "").trim();

  if (!query) return;

  const results =
    $("#searchResults") ||
    $("#results");

  if (results) {
    results.innerHTML = `
      <div class="loading">
        🔎 Recherche de <b>${escapeHtml(query)}</b>...
      </div>
    `;
  }

  try {
    const response = await fetch(
      `https://mifa-music.onrender.com/api/audius?q=${encodeURIComponent(query)}`
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    const tracks = Array.isArray(data)
      ? data
      : Array.isArray(data.results)
        ? data.results
        : [];

    state.tracks = [
      ...state.phoneTracks,
      ...tracks
    ];

    if (results) {
      results.innerHTML = tracks.length
        ? tracks.map(renderTrackCard).join("")
        : `
          <div class="empty-state">
            Aucun résultat trouvé.
          </div>
        `;
    }

  } catch (error) {
    console.error(error);

    if (results) {
      results.innerHTML = `
        <div class="empty-state">
          ❌ Erreur pendant la recherche.
        </div>
      `;
    }
  }
}

function setupAudio() {
  const audio = $("#audioPlayer");

  if (!audio) return;

  audio.addEventListener("ended", () => {
    const index = state.tracks.findIndex(
      t => t.id === state.currentTrack?.id
    );

    if (index >= 0 && state.tracks[index + 1]) {
      playTrack(state.tracks[index + 1]);
    }
  });

  audio.addEventListener("timeupdate", () => {
    const progress = $("#progress");

    if (!progress || !audio.duration) return;

    progress.value =
      (audio.currentTime / audio.duration) * 100;
  });
}

function setupSearch() {
  const input =
    $("#searchInput") ||
    $("#search");

  const button =
    $("#searchButton") ||
    $("#searchBtn");

  if (button && input) {
    button.addEventListener("click", () => {
      searchMusic(input.value);
    });

    input.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        searchMusic(input.value);
      }
    });
  }
}

function setupPlayerControls() {
  const audio = $("#audioPlayer");

  if (!audio) return;

  const play =
    $("#playButton") ||
    $("#playBtn");

  if (play) {
    play.addEventListener("click", () => {
      if (audio.paused) {
        audio.play();
      } else {
        audio.pause();
      }
    });
  }

  const progress = $("#progress");

  if (progress) {
    progress.addEventListener("input", () => {
      if (!audio.duration) return;

      audio.currentTime =
        (Number(progress.value) / 100) * audio.duration;
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("🎧 MIFA MUSIC");

  setupAudio();
  setupSearch();
  setupPlayerControls();

  loadPhoneMusic();
});
