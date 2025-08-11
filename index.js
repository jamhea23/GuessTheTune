const STORAGE_KEY = "songGame.drawBag.v1";

let drawBag = []; // remaining indices (persisted)
let songsCache = []; // loaded from JSON
let currentIndex = null;

// Fisher–Yates shuffle
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function saveState(total) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      total,
      drawBag,
    })
  );
}

function loadState(total) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      !Array.isArray(parsed.drawBag) ||
      typeof parsed.total !== "number"
    )
      return false;
    if (parsed.total !== total) return false; // song list changed, reset

    // Validate indices
    const set = new Set(parsed.drawBag);
    if (set.size !== parsed.drawBag.length) return false;
    for (const n of parsed.drawBag) {
      if (!Number.isInteger(n) || n < 0 || n >= total) return false;
    }
    drawBag = parsed.drawBag.slice(); // good to use
    return true;
  } catch {
    return false;
  }
}

function syncNextVisibility(remaining) {
  $("#nextSongBtn").toggle(remaining > 0); // show only if there are songs left
}

function updateCounter(total, remaining) {
  $("#total").text(total);
  $("#remaining").text(remaining);
  syncNextVisibility(remaining);
}

function refillDrawBag(total) {
  drawBag = shuffle([...Array(total).keys()]);
  saveState(total);
  updateCounter(total, drawBag.length);
}

function nextIndex(total) {
  if (drawBag.length === 0) {
    refillDrawBag(total);
  }
  const idx = drawBag.pop(); // consume one
  saveState(total); // persist new state
  updateCounter(total, drawBag.length);
  return idx;
}

function ensureSongs(cb) {
  if (songsCache.length) return cb(songsCache);
  $.getJSON("assets/json/song_entries.json", function (data) {
    songsCache = data.songs || [];
    const total = songsCache.length;

    // Try to restore remaining indices from localStorage; else start fresh
    if (!loadState(total)) {
      refillDrawBag(total);
    } else {
      updateCounter(total, drawBag.length);
    }
    cb(songsCache);
  });
}

function startGame() {
  ensureSongs(function (songs) {
    if (!songs.length) return console.warn("No songs in JSON.");
    const total = songs.length;
    const idx = nextIndex(total);
    const song = songs[idx];
    currentIndex = idx;

    console.log("Picked index:", idx, "Title:", song.title);

    audioSlicer(song.song_link, 5); // loads a 5s slice
  });
}

// Initialize counter on page load (restores state if present)
// ensureSongs(() => {
//   /* counter set via loadState/refillDrawBag */
// });

// $("#playRandomBtn").on("click", startGame);

// Optional: provide a manual reset (uncomment to add a button)
// function resetGame() {
//   if (!songsCache.length) return;
//   refillDrawBag(songsCache.length);
// }

// function audioSlicer(songUrl, seconds = 5) {
//   const player = document.getElementById("songPlayer");

//   fetch(songUrl)
//     .then((res) => res.arrayBuffer())
//     .then((arrayBuffer) => {
//       const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
//       return audioCtx.decodeAudioData(arrayBuffer);
//     })
//     .then((audioBuffer) => {
//       // Slice first `seconds`
//       const cutSamples = Math.min(
//         Math.floor(seconds * audioBuffer.sampleRate),
//         audioBuffer.length
//       );

//       // Keep mono (like your original). If you want stereo, say the word.
//       const channelData = audioBuffer.getChannelData(0).slice(0, cutSamples);
//       const newBuffer = new AudioBuffer({
//         length: channelData.length,
//         numberOfChannels: 1,
//         sampleRate: audioBuffer.sampleRate,
//       });
//       newBuffer.copyToChannel(channelData, 0);

//       // Render to an AudioBuffer we can encode
//       const offlineCtx = new OfflineAudioContext(
//         1,
//         newBuffer.length,
//         newBuffer.sampleRate
//       );
//       const source = offlineCtx.createBufferSource();
//       source.buffer = newBuffer;
//       source.connect(offlineCtx.destination);
//       source.start();
//       return offlineCtx.startRendering();
//     })
//     .then((renderedBuffer) => {
//       // Encode to WAV (same as your function)
//       function encodeWAV(audioBuffer) {
//         const numOfChan = audioBuffer.numberOfChannels;
//         const length = audioBuffer.length * numOfChan * 2 + 44;
//         const buffer = new ArrayBuffer(length);
//         const view = new DataView(buffer);

//         function writeString(view, offset, string) {
//           for (let i = 0; i < string.length; i++)
//             view.setUint8(offset + i, string.charCodeAt(i));
//         }

//         let offset = 0;
//         writeString(view, offset, "RIFF");
//         offset += 4;
//         view.setUint32(offset, length - 8, true);
//         offset += 4;
//         writeString(view, offset, "WAVE");
//         offset += 4;
//         writeString(view, offset, "fmt ");
//         offset += 4;
//         view.setUint32(offset, 16, true);
//         offset += 4;
//         view.setUint16(offset, 1, true);
//         offset += 2;
//         view.setUint16(offset, numOfChan, true);
//         offset += 2;
//         view.setUint32(offset, audioBuffer.sampleRate, true);
//         offset += 4;
//         view.setUint32(offset, audioBuffer.sampleRate * numOfChan * 2, true);
//         offset += 4;
//         view.setUint16(offset, numOfChan * 2, true);
//         offset += 2;
//         view.setUint16(offset, 16, true);
//         offset += 2;
//         writeString(view, offset, "data");
//         offset += 4;
//         view.setUint32(offset, length - offset - 4, true);
//         offset += 4;

//         const channels = [];
//         for (let i = 0; i < numOfChan; i++)
//           channels.push(audioBuffer.getChannelData(i));

//         let pos = offset;
//         for (let i = 0; i < audioBuffer.length; i++) {
//           for (let c = 0; c < numOfChan; c++) {
//             const s = Math.max(-1, Math.min(1, channels[c][i]));
//             view.setInt16(pos, s < 0 ? s * 0x8000 : s * 0x7fff, true);
//             pos += 2;
//           }
//         }
//         return buffer;
//       }

//       const wavBuffer = encodeWAV(renderedBuffer);
//       const blob = new Blob([wavBuffer], { type: "audio/wav" });
//       const url = URL.createObjectURL(blob);

//       // Set sliced audio as the source (no autoplay)
//       player.pause();
//       player.src = url;
//       player.load();
//     })
//     .catch((err) => {
//       console.error("[audioSlicer] Failed to slice:", err);
//     });
// }

function audioSlicer(songUrl, seconds = 5) {
  const player = document.getElementById("songPlayer");
  const AC = window.AudioContext || window.webkitAudioContext;

  // Normalize seconds
  const secondsNum = Math.max(0.001, Number(seconds) || 5); // at least 1ms

  return fetch(songUrl, { cache: "no-store" })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status} fetching audio`);
      return res.arrayBuffer();
    })
    .then((arrayBuffer) => {
      const ctx = new AC();
      return new Promise((resolve, reject) => {
        // Callback form = better browser compatibility
        ctx.decodeAudioData(arrayBuffer, resolve, reject);
      });
    })
    .then((buffer) => {
      if (!buffer || buffer.length === 0) {
        throw new Error("Decoded audio is empty");
      }

      // Compute safe render params
      const srRaw = buffer.sampleRate;
      const sr = Number.isFinite(srRaw) && srRaw > 0 ? srRaw : 44100; // fallback SR
      const maxDur = buffer.duration || buffer.length / sr;
      const safeDur = Math.min(secondsNum, Math.max(0.001, maxDur)); // clamp > 0

      // Make sure frames ≥ 1
      let frames = Math.ceil(safeDur * sr);
      if (!Number.isFinite(frames) || frames <= 0) frames = 1;

      // Channels: keep 1 or 2 (some browsers dislike higher channel counts in OfflineAudioContext)
      const chRaw = buffer.numberOfChannels;
      const channels = Number.isFinite(chRaw)
        ? Math.min(Math.max(chRaw, 1), 2)
        : 1;

      console.debug("[audioSlicer] params", {
        sampleRate: sr,
        maxDur,
        safeDur,
        frames,
        channels,
      });

      // Slice by rendering only the first safeDur seconds
      const offline = new OfflineAudioContext(channels, frames, sr);
      const src = offline.createBufferSource();
      src.buffer = buffer;
      src.connect(offline.destination);
      src.start(0, 0, safeDur);
      return offline.startRendering();
    })
    .then((rendered) => {
      if (!rendered || rendered.length === 0) {
        throw new Error("Rendered buffer is empty");
      }

      const wavBuffer = encodeWAV(rendered); // defined below
      const blob = new Blob([wavBuffer], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);

      // Load slice (no autoplay)
      player.pause();
      player.src = url;
      player.load();

      return url;
    })
    .catch((err) => {
      console.error("[audioSlicer] Failed to slice:", err);
      // Optional fallback: load original if slicing fails
      // player.src = songUrl; player.load();
    });

  // 16-bit PCM WAV encoder (mono/stereo)
  function encodeWAV(buf) {
    const numCh = buf.numberOfChannels;
    const sampleRate = buf.sampleRate;
    const numFrames = buf.length;

    const dataLen = numFrames * numCh * 2;
    const totalLen = 44 + dataLen;
    const out = new ArrayBuffer(totalLen);
    const view = new DataView(out);

    let off = 0;
    wstr("RIFF");
    u32(totalLen - 8);
    wstr("WAVE");
    wstr("fmt ");
    u32(16);
    u16(1);
    u16(numCh);
    u32(sampleRate);
    u32(sampleRate * numCh * 2);
    u16(numCh * 2);
    u16(16);
    wstr("data");
    u32(dataLen);

    const chans = [];
    for (let c = 0; c < numCh; c++) chans.push(buf.getChannelData(c));
    for (let i = 0; i < numFrames; i++) {
      for (let c = 0; c < numCh; c++) {
        const s = Math.max(-1, Math.min(1, chans[c][i]));
        view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        off += 2;
      }
    }
    return out;

    function wstr(s) {
      for (let i = 0; i < s.length; i++) view.setUint8(off++, s.charCodeAt(i));
    }
    function u16(v) {
      view.setUint16(off, v, true);
      off += 2;
    }
    function u32(v) {
      view.setUint32(off, v, true);
      off += 4;
    }
  }
}

function setVolume() {
  const player = document.getElementById("songPlayer");

  // Set volume to 25%
  player.volume = 0.25;
}

// audioSlicer();
setVolume();

function resetGame() {
  // manage buttons
  $("#newGameBtn").hide();
  $("#showAnswerBtn").show();

  ensureSongs(function (songs) {
    if (!songs.length) return;

    // 1) Clear persisted state
    localStorage.removeItem(STORAGE_KEY);

    // 2) Stop and clear the audio (tidy before loading a new one)
    const audio = $("#songPlayer").get(0);
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }

    // 3) Rebuild a fresh shuffled bag
    drawBag = shuffle([...Array(songs.length).keys()]);

    // 4) Immediately pick the first song of the new game
    //    (uses nextIndex to pop, save state, and update the counter)
    const idx = nextIndex(songs.length);
    const song = songs[idx];
    currentIndex = idx;

    // 5) Load the song (NO autoplay)
    // $("#songPlayer").attr("src", song.song_link).trigger("load");
    audioSlicer(song.song_link, 5);

    console.log("Game reset to start. First pick:", idx, song.title);
  });
}

$("#newGameBtn").on("click", resetGame);

function nextSong(sliceSeconds = 5) {
  ensureSongs(function (songs) {
    if (!songs.length) return console.warn("No songs in JSON.");

    const idx = nextIndex(songs.length); // updates counter + saves state
    const song = songs[idx];
    currentIndex = idx;
    console.log("Next index:", idx, "Title:", song.title);

    // Load a slice (no autoplay). If not slicing, do:
    // $("#songPlayer").attr("src", song.song_link).trigger("load");
    audioSlicer(song.song_link, sliceSeconds);
  });
}

$("#nextSongBtn").on("click", nextSong);

function buildAnswerSrc(link) {
  if (!link) return null;
  try {
    const u = new URL(link);
    const host = u.hostname.replace(/^www\./, "");

    // youtu.be/<id>
    if (host === "youtu.be") {
      const id = u.pathname.slice(1);
      return `https://www.youtube.com/embed/${id}?autoplay=0&rel=0&modestbranding=1`;
    }

    // youtube.com or music.youtube.com: watch?v=ID or /shorts/ID
    if (host.endsWith("youtube.com") || host.endsWith("music.youtube.com")) {
      const v = u.searchParams.get("v");
      if (v)
        return `https://www.youtube.com/embed/${v}?autoplay=0&rel=0&modestbranding=1`;
      const m = u.pathname.match(/\/shorts\/([^/?#]+)/);
      if (m)
        return `https://www.youtube.com/embed/${m[1]}?autoplay=0&rel=0&modestbranding=1`;
    }

    // Fallback: use original link (for non-YouTube providers)
    return link;
  } catch {
    return link;
  }
}

function showAnswer() {
  ensureSongs(function (songs) {
    if (currentIndex == null || !songs[currentIndex]) {
      alert("No current song. Pick a song first.");
      return;
    }
    const song = songs[currentIndex];
    const raw = song.answer_link || song.song_link;
    const embedSrc = buildYouTubeEmbed(raw);

    $("#answerTitle").text(song.title || "Answer");
    $("#answerFrame").attr("src", embedSrc || "");
    $("#openInNewTab").attr("href", raw || "#");

    const el = document.getElementById("answerModal");
    const modal = bootstrap.Modal.getOrCreateInstance(el);
    modal.show();
  });
}

// Clear iframe when closing (stops playback)
document
  .getElementById("answerModal")
  ?.addEventListener("hidden.bs.modal", () => {
    $("#answerFrame").attr("src", "");
  });

// Stop playback when modal closes (clear iframe src)
document
  .getElementById("answerModal")
  ?.addEventListener("hidden.bs.modal", () => {
    $("#answerFrame").attr("src", "");
  });

$("#showAnswerBtn").on("click", showAnswer);

function buildYouTubeEmbed(link) {
  if (!link) return null;
  try {
    const u = new URL(link);
    const host = u.hostname.replace(/^www\./, "");

    // If it's a playlist-only link (no v=), use videoseries
    const list = u.searchParams.get("list");
    const hasV = u.searchParams.has("v");

    // Extract start time (?t= or ?start= or #t=1m10s)
    let start = 0;
    const t = u.searchParams.get("t") || u.searchParams.get("start");
    if (t) start = parseTimeToSeconds(t) || 0;
    if (!t && u.hash && u.hash.startsWith("#t=")) {
      start = parseTimeToSeconds(u.hash.slice(3)) || 0;
    }

    // youtu.be/<id>
    if (host === "youtu.be") {
      const id = u.pathname.slice(1);
      return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1${
        start ? `&start=${start}` : ""
      }`;
    }

    // youtube.com / music.youtube.com
    if (host.endsWith("youtube.com") || host.endsWith("music.youtube.com")) {
      // Shorts
      const sm = u.pathname.match(/\/shorts\/([^/?#]+)/);
      if (sm) {
        const id = sm[1];
        return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1${
          start ? `&start=${start}` : ""
        }`;
      }

      // Playlist-only
      if (list && !hasV) {
        return `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(
          list
        )}&rel=0&modestbranding=1&playsinline=1`;
      }

      // Standard watch?v=
      if (hasV) {
        const id = u.searchParams.get("v");
        const pl = list ? `&list=${encodeURIComponent(list)}` : "";
        return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1${
          start ? `&start=${start}` : ""
        }${pl}`;
      }
    }

    // Not YouTube—return original link (may or may not be embeddable)
    return link;
  } catch {
    return link;
  }

  function parseTimeToSeconds(val) {
    // supports "90", "1m30s", "01:30", "1h2m5s"
    if (/^\d+$/.test(val)) return parseInt(val, 10);
    const hms = val.split(":").map(Number);
    if (hms.length === 2) return hms[0] * 60 + hms[1];
    if (hms.length === 3) return hms[0] * 3600 + hms[1] * 60 + hms[2];
    const m = val.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/i);
    if (!m) return 0;
    return (
      parseInt(m[1] || 0) * 3600 +
      parseInt(m[2] || 0) * 60 +
      parseInt(m[3] || 0)
    );
  }
}
