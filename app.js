let allNotes = [];

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeTags(str) {
  if (!str) return [];
  return str.split(",").map(t => t.trim()).filter(Boolean);
}

function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  window.clearTimeout(toast._t);
  toast._t = window.setTimeout(() => el.classList.remove("show"), 1800);
}

// Tabs
function setActiveTab(name) {
  $$(".tab").forEach(btn => {
    const active = btn.dataset.tab === name;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-selected", active ? "true" : "false");
  });

  $$(".panel").forEach(panel => {
    const active = panel.dataset.panel === name;
    panel.classList.toggle("is-active", active);
    panel.setAttribute("aria-hidden", active ? "false" : "true");
  });

  if (name === "browse") {
    loadNotes();
    $("#searchInput").focus();
  }
  if (name === "stats") {
    loadStats();
  }
}

$$(".tab").forEach(btn => btn.addEventListener("click", () => setActiveTab(btn.dataset.tab)));
$("#goBrowseBtn").addEventListener("click", () => setActiveTab("browse"));

// Create
$("#body").addEventListener("input", () => {
  $("#bodyCount").textContent = String($("#body").value.length);
});

$("#noteForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = {
    title: $("#title").value,
    body: $("#body").value,
    tags: normalizeTags($("#tags").value)
  };

  await fetch("/notes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  $("#noteForm").reset();
  $("#bodyCount").textContent = "0";
  toast("Saved");
  setActiveTab("browse");
});

document.addEventListener("keydown", (e) => {
  const activePanel = $(".panel.is-active")?.dataset?.panel;

  // Ctrl+Enter saves in Create tab
  if (activePanel === "create" && (e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    $("#noteForm").requestSubmit();
  }

  // Ctrl+K focuses search in Browse tab
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    const activePanel2 = $(".panel.is-active")?.dataset?.panel;
    if (activePanel2 === "browse") {
      e.preventDefault();
      $("#searchInput").focus();
    }
  }
});

// Browse helpers
function matchesSearch(note, q) {
  if (!q) return true;
  const query = q.toLowerCase();
  const title = (note.title || "").toLowerCase();
  const body = (note.body || "").toLowerCase();
  const tags = (note.tags || []).join(" ").toLowerCase();
  return title.includes(query) || body.includes(query) || tags.includes(query);
}

function matchesTag(note, tag) {
  if (!tag) return true;
  return (note.tags || []).some(t => String(t).toLowerCase() === tag.toLowerCase());
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function computeTagStats(notes) {
  const map = new Map();
  for (const n of notes) {
    for (const t of (n.tags || [])) {
      const tag = String(t || "").trim();
      if (!tag) continue;
      map.set(tag, (map.get(tag) || 0) + 1);
    }
  }
  const entries = Array.from(map.entries()).sort((a,b) => b[1] - a[1]);
  return { map, entries };
}

function renderNotes(notes) {
  const grid = $("#notesGrid");
  grid.innerHTML = "";

  $("#notesCount").textContent = String(notes.length);

  const { entries } = computeTagStats(notes);
  $("#tagCount").textContent = String(entries.length);

  if (!notes.length) {
    const div = document.createElement("div");
    div.className = "empty";
    div.innerHTML = "<strong>No notes found.</strong><div class='muted'>Try refreshing or changing your search.</div>";
    grid.appendChild(div);
    return;
  }

  for (const note of notes) {
    const card = document.createElement("article");
    card.className = "noteCard";
    card.setAttribute("data-id", note._id);

    const tags = Array.isArray(note.tags) ? note.tags.filter(Boolean) : [];
    const chips = tags.slice(0, 6).map(t => `<span class="chip">${escapeHtml(t)}</span>`).join("");
    const more = tags.length > 6 ? `<span class="badge">+${tags.length - 6}</span>` : "";

    card.innerHTML = `
      <div class="noteTop">
        <div>
          <div class="noteTitle">${escapeHtml(note.title || "(Untitled)")}</div>
          <div class="chips">${chips} ${more}</div>
        </div>
        <div class="noteActions">
          <button class="btn danger small" type="button" data-action="delete">Delete</button>
        </div>
      </div>

      <div class="noteBody">${escapeHtml(note.body || "")}</div>

      <div class="noteMeta">
        <span>${note.createdAt ? "Created: " + escapeHtml(formatDate(note.createdAt)) : ""}</span>
        <span class="muted">Click to expand</span>
      </div>
    `;

    card.addEventListener("click", (e) => {
      const action = e.target?.dataset?.action;
      if (action === "delete") return;
      card.classList.toggle("is-open");
    });

    card.querySelector('[data-action="delete"]').addEventListener("click", async (e) => {
      e.stopPropagation();
      await fetch(`/notes/${note._id}`, { method: "DELETE" });
      toast("Deleted");
      await loadNotes();
    });

    grid.appendChild(card);
  }
}

function applyFilters() {
  const q = $("#searchInput").value.trim();
  const tag = $("#tagFilterInput").value.trim();

  const filtered = allNotes
    .filter(n => matchesSearch(n, q))
    .filter(n => matchesTag(n, tag));

  renderNotes(filtered);
}

async function loadNotes() {
  const res = await fetch("/notes");
  allNotes = await res.json();
  applyFilters();
}

$("#refreshBtn").addEventListener("click", loadNotes);
$("#searchInput").addEventListener("input", applyFilters);
$("#tagFilterInput").addEventListener("input", applyFilters);

$("#clearSearchBtn").addEventListener("click", () => {
  $("#searchInput").value = "";
  applyFilters();
  $("#searchInput").focus();
});

// Stats
async function loadStats() {
  const res = await fetch("/notes");
  const notes = await res.json();

  const { entries } = computeTagStats(notes);
  $("#statTotal").textContent = String(notes.length);
  $("#statTags").textContent = String(entries.length);
  $("#statTopTag").textContent = entries.length ? `${entries[0][0]} (${entries[0][1]})` : "—";

  const top = $("#topTags");
  top.innerHTML = "";
  for (const [tag, count] of entries.slice(0, 12)) {
    const el = document.createElement("div");
    el.className = "tagPill";
    el.textContent = `${tag} • ${count}`;
    top.appendChild(el);
  }
}

$("#statsRefreshBtn").addEventListener("click", loadStats);

// initial
setActiveTab("create");