/* =========================================================
   MIFA MUSIC — APP
   Lecteur + bibliothèque + favoris + recherche
   ========================================================= */

const audio = document.getElementById("audioPlayer");

const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const clearSearch = document.getElementById("clearSearch");
const searchStatus = document.getElementById("searchStatus");
const results = document.getElementById("results");
const resultsTitle = document.getElementById("resultsTitle");

const downloads = document.getElementById("downloads");
const homeMusic = document.getElementById("homeMusic");
const favoritesList = document.getElementById("favoritesList");
const downloadHistory = document.getElementById("downloadHistory");

const librarySearch = document.getElementById("librarySearch");
const libraryFilter = document.getElementById("libraryFilter");
const libraryCount = document.getElementById("libraryCount");

const playerTitle = document.getElementById("playerTitle");
const playerArtist = document.getElementById("playerArtist");
const playerCover = document.getElementById("playerCover");

const playBtn = document.getElementById("playBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const shuffleBtn = document.getElementById("shuffleBtn");
const repeatBtn = document.getElementById("repeatBtn");
const playerFavorite = document.getElementById("playerFavorite");

const progress = document.getElementById("progress");
const currentTime = document.getElementById("currentTime");
const duration = document.getElementById("duration");
const volume = document.getElementById("volume");

const miniPlayer = document.getElementById("miniPlayer");
const miniCover = document.getElementById("miniCover");
const miniTitle = document.getElementById("miniTitle");
const miniArtist = document.getElementById("miniArtist");
const miniProgress = document.getElementById("miniProgress");
const miniPlay = document.getElementById("miniPlay");
const miniPrev = document.getElementById("miniPrev");
const miniNext = document.getElementById("miniNext");

const closePlayer = document.getElementById("closePlayer");
const openFullPlayer = document.getElementById("openFullPlayer");

let library = [];
let searchResults = [];
let queue = [];
let currentIndex = -1;

let isShuffle = false;
let repeatMode = false;
let currentTrack = null;

let searchTimer = null;
let searchController = null;


/* =========================================================
   UTILITAIRES
   ========================================================= */

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }

  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);

  return `${min}:${String(sec).padStart(2, "0")}`;
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getCover(track) {
  return (
    track?.image ||
    track?.artwork?.["480x480"] ||
    track?.artwork?.["1000x1000"] ||
    track?.artwork?.["150x150"] ||
    null
  );
}


/* =========================================================
   NAVIGATION
   ========================================================= */

function showPage(pageName) {
  document.querySelectorAll(".page").forEach(page => {
    page.classList.remove("active-page");
  });

  const page = document.getElementById(`page-${pageName}`);

  if (page) {
    page.classList.add("active-page");
  }

  document.querySelectorAll(".nav-item").forEach(item => {
    item.classList.toggle(
      "active",
      item.dataset.page === pageName
    );
  });

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

document.querySelectorAll("[data-page]").forEach(button => {
  button.addEventListener("click", () => {
    showPage(button.dataset.page);
  });
});

document.querySelectorAll("[data-page-target]").forEach(button => {
  button.addEventListener("click", () => {
    showPage(button.dataset.pageTarget);
  });
});

if (closePlayer) {
  closePlayer.addEventListener("click", () => {
    showPage("home");
  });
}

if (openFullPlayer) {
  openFullPlayer.addEventListener("click", () => {
    showPage("player");
  });
}


/* =========================================================
   STOCKAGE LOCAL
   ========================================================= */

function getFavorites() {
  try {
    return JSON.parse(localStorage.getItem("mifa_favorites") || "[]");
  } catch {
    return [];
  }
}

function saveFavorites(items) {
  localStorage.setItem(
    "mifa_favorites",
    JSON.stringify(items)
  );
}

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem("mifa_history") || "[]");
  } catch {
    return [];
  }
}

function saveHistory(items) {
  localStorage.setItem(
    "mifa_history",
    JSON.stringify(items)
  );
}


/* =========================================================
   FAVORIS
   ========================================================= */

function favoriteKey(track) {
  return String(
    track?.id ||
    track?.track_id ||
    track?.url ||
    track?.audio ||
    track?.download ||
    track?.file ||
    track?.title
  );
}

function isFavorite(track) {
  const key = favoriteKey(track);

  return getFavorites().some(
    item => favoriteKey(item) === key
  );
}

function toggleFavorite(track) {
  let favorites = getFavorites();

  const key = favoriteKey(track);

  const exists = favorites.some(
    item => favoriteKey(item) === key
  );

  if (exists) {
    favorites = favorites.filter(
      item => favoriteKey(item) !== key
    );
  } else {
    favorites.unshift(track);
  }

  saveFavorites(favorites);

  renderFavorites();

  if (
    currentTrack &&
    favoriteKey(currentTrack) === key
  ) {
    updateFavoriteButton();
  }
}

function updateFavoriteButton() {
  if (!playerFavorite || !currentTrack) return;

  playerFavorite.textContent =
    isFavorite(currentTrack) ? "♥" : "♡";
}

playerFavorite?.addEventListener("click", () => {
  if (currentTrack) {
    toggleFavorite(currentTrack);
  }
});


/* =========================================================
   BIBLIOTHÈQUE LOCALE
   ========================================================= */

async function loadLibrary() {
  try {
    const response = await fetch("/api/music", {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("Erreur bibliothèque");
    }

    const data = await response.json();

    library =
      Array.isArray(data)
        ? data
        : Array.isArray(data.music)
          ? data.music
          : Array.isArray(data.files)
            ? data.files
            : [];

    renderLibrary();
    renderHomeLibrary();
  } catch (error) {
    console.error("Bibliothèque:", error);

    library = [];

    renderLibrary();
    renderHomeLibrary();
  }
}


/* =========================================================
   CARTE MUSIQUE
   ========================================================= */

function createMusicCard(track) {
  const card = document.createElement("article");

  card.className = "music-card";

  const title =
    track.title ||
    track.name ||
    track.filename ||
    track.file ||
    "Musique inconnue";

  const artist =
    track.artist ||
    track.artist_name ||
    track.artistName ||
    "Artiste inconnu";

  const cover = getCover(track);

  const audioUrl =
    track.audio ||
    track.url ||
    track.audio_url ||
    track.stream ||
    track.fileUrl ||
    track.path;

  const downloadUrl =
    track.download ||
    track.download_url ||
    track.downloadUrl ||
    null;

  card.innerHTML = `
    ${
      cover
        ? `<img class="music-cover" src="${escapeHtml(cover)}" alt="">`
        : `<div class="music-cover music-cover-placeholder">🎵</div>`
    }

    <div class="music-info">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(artist)}</p>

      <div class="music-actions">
        <button class="play-card">▶ Écouter</button>
        <button class="favorite-card">
          ${isFavorite(track) ? "♥" : "♡"}
        </button>
        ${
          downloadUrl
            ? `<button class="download-card">↓</button>`
            : ""
        }
      </div>
    </div>
  `;

  card.querySelector(".play-card")?.addEventListener(
    "click",
    () => {
      if (audioUrl) {
        playTrack(track, [track]);
      }
    }
  );

  card.querySelector(".favorite-card")?.addEventListener(
    "click",
    event => {
      toggleFavorite(track);

      event.currentTarget.textContent =
        isFavorite(track) ? "♥" : "♡";
    }
  );

  card.querySelector(".download-card")?.addEventListener(
    "click",
    () => {
      downloadTrack(track);
    }
  );

  return card;
}


/* =========================================================
   BIBLIOTHÈQUE
   ========================================================= */

function renderLibrary() {
  if (!downloads) return;

  let list = [...library];

  const search = normalize(
    librarySearch?.value || ""
  );

  if (search) {
    list = list.filter(track => {
      const text = normalize(`
        ${track.title || ""}
        ${track.name || ""}
        ${track.artist || ""}
        ${track.artist_name || ""}
        ${track.filename || ""}
        ${track.file || ""}
      `);

      return text.includes(search);
    });
  }

  if (libraryFilter?.value === "title") {
    list.sort((a, b) =>
      normalize(a.title || a.name || "")
        .localeCompare(
          normalize(b.title || b.name || "")
        )
    );
  }

  if (libraryFilter?.value === "recent") {
    list.reverse();
  }

  libraryCount.textContent = list.length;

  downloads.innerHTML = "";

  if (!list.length) {
    downloads.innerHTML = `
      <div class="empty-state glass">
        <div>📚</div>
        <h3>Ta bibliothèque est vide</h3>
        <p>Télécharge une musique pour la retrouver ici.</p>
      </div>
    `;

    return;
  }

  list.forEach(track => {
    downloads.appendChild(
      createMusicCard(track)
    );
  });
}

function renderHomeLibrary() {
  if (!homeMusic) return;

  homeMusic.innerHTML = "";

  const list = library.slice(0, 6);

  if (!list.length) {
    homeMusic.innerHTML = `
      <div class="empty-state glass">
        <div>🎵</div>
        <h3>Aucune musique pour le moment</h3>
        <p>Les morceaux téléchargés apparaîtront ici.</p>
      </div>
    `;

    return;
  }

  list.forEach(track => {
    homeMusic.appendChild(
      createMusicCard(track)
    );
  });
}

librarySearch?.addEventListener(
  "input",
  renderLibrary
);

libraryFilter?.addEventListener(
  "change",
  renderLibrary
);


/* =========================================================
   FAVORIS — AFFICHAGE
   ========================================================= */

function renderFavorites() {
  if (!favoritesList) return;

  const favorites = getFavorites();

  favoritesList.innerHTML = "";

  if (!favorites.length) {
    favoritesList.innerHTML = `
      <div class="empty-state glass">
        <div>♡</div>
        <h3>Aucun favori</h3>
        <p>Ajoute tes morceaux préférés à tes favoris.</p>
      </div>
    `;

    return;
  }

  favorites.forEach(track => {
    favoritesList.appendChild(
      createMusicCard(track)
    );
  });
}


/* =========================================================
   HISTORIQUE
   ========================================================= */

function addToHistory(track) {
  const history = getHistory();

  const key = favoriteKey(track);

  const filtered = history.filter(
    item => favoriteKey(item) !== key
  );

  filtered.unshift({
    ...track,
    playedAt: Date.now()
  });

  saveHistory(filtered.slice(0, 50));

  renderHistory();
}

function renderHistory() {
  if (!downloadHistory) return;

  const history = getHistory();

  downloadHistory.innerHTML = "";

  if (!history.length) {
    downloadHistory.innerHTML = `
      <div class="empty-state glass">
        <div>↓</div>
        <h3>Aucun téléchargement</h3>
        <p>Ton historique apparaîtra ici.</p>
      </div>
    `;

    return;
  }

  history.forEach(track => {
    const item = document.createElement("div");

    item.className = "history-item";

    const cover = getCover(track);

    const title =
      track.title ||
      track.name ||
      track.filename ||
      track.file ||
      "Musique";

    const artist =
      track.artist ||
      track.artist_name ||
      "Artiste inconnu";

    item.innerHTML = `
      ${
        cover
          ? `<img class="history-cover" src="${escapeHtml(cover)}">`
          : `<div class="history-cover">🎵</div>`
      }

      <div class="history-info">
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(artist)}</span>
      </div>

      <button class="round-btn glass">▶</button>
    `;

    item.querySelector("button")
      ?.addEventListener("click", () => {
        playTrack(track, [track]);
      });

    downloadHistory.appendChild(item);
  });
}


/* =========================================================
   LECTEUR
   ========================================================= */

function playTrack(track, newQueue = null) {
  const audioUrl =
    track?.audio ||
    track?.url ||
    track?.audio_url ||
    track?.stream ||
    track?.fileUrl ||
    track?.path;

  if (!audioUrl) {
    console.warn("Aucun fichier audio :", track);
    return;
  }

  if (newQueue) {
    queue = [...newQueue];

    currentIndex = queue.findIndex(
      item =>
        favoriteKey(item) ===
        favoriteKey(track)
    );

    if (currentIndex < 0) {
      currentIndex = 0;
    }
  }

  currentTrack = track;

  audio.src = audioUrl;

  updatePlayer(track);

  audio.play()
    .then(() => {
      updatePlayButtons();
    })
    .catch(error => {
      console.error("Lecture:", error);
    });

  addToHistory(track);

  miniPlayer?.classList.add("visible");

  showPage("player");
}

function updatePlayer(track) {
  const title =
    track?.title ||
    track?.name ||
    track?.filename ||
    track?.file ||
    "Musique inconnue";

  const artist =
    track?.artist ||
    track?.artist_name ||
    "Artiste inconnu";

  const cover = getCover(track);

  playerTitle.textContent = title;
  playerArtist.textContent = artist;

  miniTitle.textContent = title;
  miniArtist.textContent = artist;

  if (cover) {
    playerCover.innerHTML = `
      <img src="${escapeHtml(cover)}" alt="">
    `;

    miniCover.innerHTML = `
      <img src="${escapeHtml(cover)}" alt="">
    `;
  } else {
    playerCover.innerHTML = `
      <div class="cover-placeholder">🎵</div>
    `;

    miniCover.textContent = "🎵";
  }

  updateFavoriteButton();
}


/* =========================================================
   PLAY / PAUSE
   ========================================================= */

function togglePlay() {
  if (!audio.src) {
    if (library.length) {
      playTrack(library[0], library);
    }

    return;
  }

  if (audio.paused) {
    audio.play().catch(console.error);
  } else {
    audio.pause();
  }
}

playBtn?.addEventListener(
  "click",
  togglePlay
);

miniPlay?.addEventListener(
  "click",
  togglePlay
);

audio.addEventListener(
  "play",
  updatePlayButtons
);

audio.addEventListener(
  "pause",
  updatePlayButtons
);

function updatePlayButtons() {
  const icon =
    audio.paused ? "▶" : "Ⅱ";

  if (playBtn) {
    playBtn.textContent = icon;
  }

  if (miniPlay) {
    miniPlay.textContent = icon;
  }
}


/* =========================================================
   PRECEDENT / SUIVANT
   ========================================================= */

function nextTrack() {
  if (!queue.length) return;

  if (isShuffle) {
    let next = Math.floor(
      Math.random() * queue.length
    );

    if (
      queue.length > 1 &&
      next === currentIndex
    ) {
      next = (next + 1) % queue.length;
    }

    currentIndex = next;
  } else {
    currentIndex++;

    if (currentIndex >= queue.length) {
      if (repeatMode) {
        currentIndex = 0;
      } else {
        currentIndex = queue.length - 1;
        audio.pause();
        return;
      }
    }
  }

  playTrack(
    queue[currentIndex],
    queue
  );
}

function previousTrack() {
  if (!queue.length) return;

  if (audio.currentTime > 4) {
    audio.currentTime = 0;
    return;
  }

  currentIndex--;

  if (currentIndex < 0) {
    currentIndex =
      queue.length - 1;
  }

  playTrack(
    queue[currentIndex],
    queue
  );
}

nextBtn?.addEventListener(
  "click",
  nextTrack
);

miniNext?.addEventListener(
  "click",
  nextTrack
);

prevBtn?.addEventListener(
  "click",
  previousTrack
);

miniPrev?.addEventListener(
  "click",
  previousTrack
);

audio.addEventListener(
  "ended",
  () => {
    if (repeatMode && currentTrack) {
      audio.currentTime = 0;
      audio.play().catch(console.error);
      return;
    }

    nextTrack();
  }
);


/* =========================================================
   SHUFFLE
   ========================================================= */

shuffleBtn?.addEventListener(
  "click",
  () => {
    isShuffle = !isShuffle;

    shuffleBtn.style.opacity =
      isShuffle ? "1" : "0.5";
  }
);

document.getElementById(
  "libraryShuffle"
)?.addEventListener(
  "click",
  () => {
    if (!library.length) return;

    isShuffle = true;

    const random =
      Math.floor(
        Math.random() * library.length
      );

    playTrack(
      library[random],
      library
    );
  }
);


/* =========================================================
   REPEAT
   ========================================================= */

repeatBtn?.addEventListener(
  "click",
  () => {
    repeatMode = !repeatMode;

    repeatBtn.style.opacity =
      repeatMode ? "1" : "0.5";
  }
);


/* =========================================================
   PROGRESSION
   ========================================================= */

audio.addEventListener(
  "loadedmetadata",
  () => {
    duration.textContent =
      formatTime(audio.duration);
  }
);

audio.addEventListener(
  "timeupdate",
  () => {
    if (!audio.duration) return;

    const percent =
      (audio.currentTime /
        audio.duration) * 100;

    progress.value = percent;

    currentTime.textContent =
      formatTime(audio.currentTime);

    duration.textContent =
      formatTime(audio.duration);

    if (miniProgress) {
      miniProgress.style.width =
        `${percent}%`;
    }
  }
);

progress?.addEventListener(
  "input",
  () => {
    if (!audio.duration) return;

    audio.currentTime =
      (Number(progress.value) / 100) *
      audio.duration;
  }
);


/* =========================================================
   VOLUME
   ========================================================= */

volume?.addEventListener(
  "input",
  () => {
    audio.volume =
      Number(volume.value);
  }
);


/* =========================================================
   TELECHARGEMENT
   ========================================================= */

function downloadTrack(track) {
  const url =
    track?.download ||
    track?.download_url ||
    track?.downloadUrl;

  if (!url) {
    alert(
      "Le téléchargement n'est pas disponible pour cette musique."
    );

    return;
  }

  const link =
    document.createElement("a");

  link.href = url;
  link.target = "_blank";
  link.rel = "noopener";

  document.body.appendChild(link);
  link.click();
  link.remove();

  addDownloadHistory(track);
}

function addDownloadHistory(track) {
  const history =
    getHistory();

  const key =
    favoriteKey(track);

  const filtered =
    history.filter(
      item =>
        favoriteKey(item) !== key
    );

  filtered.unshift({
    ...track,
    downloadedAt: Date.now()
  });

  saveHistory(
    filtered.slice(0, 50)
  );

  renderHistory();
}


/* =========================================================
   RECHERCHE
   ========================================================= */

async function searchMusic() {
  const query =
    searchInput?.value.trim() || "";

  if (query.length < 2) {
    searchStatus.textContent =
      "Entre au moins 2 caractères.";

    results.innerHTML = `
      <div class="empty-state glass">
        <div>🔎</div>
        <h3>Recherche trop courte</h3>
        <p>Entre le nom d'un artiste ou d'une musique.</p>
      </div>
    `;

    return;
  }

  if (searchController) {
    searchController.abort();
  }

  searchController =
    new AbortController();

  searchStatus.textContent =
    "🔎 Recherche en cours…";

  resultsTitle.textContent =
    `Recherche : ${query}`;

  results.innerHTML = `
    <div class="empty-state glass">
      <div>⏳</div>
      <h3>Recherche en cours</h3>
      <p>MIFA MUSIC cherche ta musique…</p>
    </div>
  `;

  try {
    const response =
      await fetch(
        `/api/audius?q=${encodeURIComponent(query)}`,
        {
          cache: "no-store",
          signal: searchController.signal
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data?.message ||
        "Erreur de recherche"
      );
    }

    searchResults =
      Array.isArray(data.music)
        ? data.music
        : [];

    renderSearchResults(query);

  } catch (error) {

    if (error.name === "AbortError") {
      return;
    }

    console.error(
      "Recherche :",
      error
    );

    searchStatus.textContent =
      "❌ Impossible de faire la recherche.";

    results.innerHTML = `
      <div class="empty-state glass">
        <div>⚠️</div>
        <h3>Recherche indisponible</h3>
        <p>Vérifie que le serveur MIFA MUSIC fonctionne.</p>
      </div>
    `;
  }
}

function renderSearchResults(query) {
  results.innerHTML = "";

  if (!searchResults.length) {
    searchStatus.textContent =
      `Aucun résultat pour « ${query} »`;

    results.innerHTML = `
      <div class="empty-state glass">
        <div>🎵</div>
        <h3>Aucun résultat</h3>
        <p>Essaie un autre titre ou un autre artiste.</p>
      </div>
    `;

    return;
  }

  searchStatus.textContent =
    `${searchResults.length} résultat(s) trouvé(s)`;

  searchResults.forEach(track => {

    const item =
      document.createElement("article");

    item.className =
      "search-result";

    const title =
      track.title ||
      track.name ||
      "Titre inconnu";

    const artist =
      track.artist ||
      track.artist_name ||
      "Artiste inconnu";

    const cover =
      getCover(track);

    const audioUrl =
      track.audio ||
      track.url ||
      track.audio_url;

    const canDownload =
      Boolean(
        track.download ||
        track.download_url
      );

    item.innerHTML = `
      ${
        cover
          ? `<img
              class="search-result-cover"
              src="${escapeHtml(cover)}"
              alt=""
            >`
          : `<div class="search-result-cover">
              🎵
            </div>`
      }

      <div class="search-result-info">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(artist)}</p>
      </div>

      <div class="result-actions">

        <button
          class="result-play"
          title="Écouter"
        >
          ▶
        </button>

        <button
          class="result-favorite"
          title="Favori"
        >
          ${isFavorite(track) ? "♥" : "♡"}
        </button>

        ${
          canDownload
            ? `
              <button
                class="download-action"
                title="Télécharger"
              >
                ↓
              </button>
            `
            : ""
        }

      </div>
    `;

    item.querySelector(
      ".result-play"
    )?.addEventListener(
      "click",
      () => {
        if (audioUrl) {
          playTrack(
            track,
            searchResults
          );
        }
      }
    );

    item.querySelector(
      ".result-favorite"
    )?.addEventListener(
      "click",
      event => {

        toggleFavorite(track);

        event.currentTarget.textContent =
          isFavorite(track)
            ? "♥"
            : "♡";
      }
    );

    item.querySelector(
      ".download-action"
    )?.addEventListener(
      "click",
      () => {
        downloadTrack(track);
      }
    );

    results.appendChild(item);
  });
}


/* =========================================================
   RECHERCHE — BOUTON / ENTRÉE
   ========================================================= */

searchBtn?.addEventListener(
  "click",
  searchMusic
);

searchInput?.addEventListener(
  "keydown",
  event => {
    if (event.key === "Enter") {
      event.preventDefault();
      searchMusic();
    }
  }
);

searchInput?.addEventListener(
  "input",
  () => {
    const query = searchInput.value.trim();

    if (!query) {
      searchStatus.textContent = "";
      resultsTitle.textContent =
        "Découvre de nouvelles musiques";

      results.innerHTML = `
        <div class="empty-state glass">
          <div>🔎</div>
          <h3>Que veux-tu écouter ?</h3>
          <p>Entre le nom d'un artiste ou d'une musique.</p>
        </div>
      `;
    }
  }
);

clearSearch?.addEventListener(
  "click",
  () => {
    searchInput.value = "";

    searchStatus.textContent = "";

    resultsTitle.textContent =
      "Découvre de nouvelles musiques";

    results.innerHTML = `
      <div class="empty-state glass">
        <div>🔎</div>
        <h3>Que veux-tu écouter ?</h3>
        <p>Entre le nom d'un artiste ou d'une musique.</p>
      </div>
    `;

    searchInput.focus();
  }
);


/* =========================================================
   TRI BIBLIOTHÈQUE
   ========================================================= */

document.getElementById(
  "librarySort"
)?.addEventListener(
  "click",
  () => {

    library.reverse();

    renderLibrary();
    renderHomeLibrary();
  }
);


/* =========================================================
   INITIALISATION
   ========================================================= */

audio.volume = 1;

loadLibrary();
renderFavorites();
renderHistory();
updatePlayButtons();

console.log(
  "🎵 MIFA MUSIC — application chargée"
);
