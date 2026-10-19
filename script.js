
"use strict";

// ---------- DOM ELEMENTS ----------
const notesGrid = document.getElementById("notesGrid");
const emptyState = document.getElementById("emptyState");
const emptyTitle = document.getElementById("emptyTitle");
const emptyMessage = document.getElementById("emptyMessage");
const searchInput = document.getElementById("searchInput");
const folderFilter = document.getElementById("folderFilter");
const sortSelect = document.getElementById("sortSelect");
const folderList = document.getElementById("folderList");
const noteDialog = document.getElementById("noteDialog");
const noteForm = document.getElementById("noteForm");
const toast = document.getElementById("toast");

const noteIdInput = document.getElementById("noteId");
const noteTitleInput = document.getElementById("noteTitle");
const noteContentInput = document.getElementById("noteContent");
const noteFolderInput = document.getElementById("noteFolder");
const noteTagsInput = document.getElementById("noteTags");
const notePinnedInput = document.getElementById("notePinned");

// ---------- STORAGE KEYS ----------
const NOTES_KEY = "notenest_notes_v1";
const FOLDERS_KEY = "notenest_folders_v1";

// ---------- APPLICATION STATE ----------
let notes = [];
let folders = ["Personal", "Study", "Projects", "Work"];
let currentView = "all";
let currentFolder = "all";
let searchQuery = "";
let toastTimer;

// ---------- HELPER FUNCTIONS ----------

// Create a unique ID for each note.
function createId() {
  if (window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return Date.now().toString(36) +
    Math.random().toString(36).slice(2);
}

// Safely display user-entered text inside HTML.
function escapeHTML(value) {
  const characters = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  };

  return String(value ?? "").replace(
    /[&<>"']/g,
    character => characters[character]
  );
}

// Save data in the browser.
function saveData() {
  try {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
    return true;
  } catch (error) {
    console.error("Could not save application data:", error);
    showToast("Unable to save. Check browser storage.");
    return false;
  }
}

// Load notes and folders from localStorage.
function loadData() {
  try {
    const storedNotes = localStorage.getItem(NOTES_KEY);
    const storedFolders = localStorage.getItem(FOLDERS_KEY);

    if (storedNotes !== null) {
      const parsedNotes = JSON.parse(storedNotes);
      if (Array.isArray(parsedNotes)) {
        notes = parsedNotes.filter(note =>
          note && typeof note === "object" &&
          typeof note.id === "string" &&
          typeof note.title === "string" &&
          typeof note.content === "string"
        ).map(note => ({
          ...note,
          folder: typeof note.folder === "string"
            ? note.folder : "Personal",
          tags: Array.isArray(note.tags)
            ? note.tags.filter(tag => typeof tag === "string")
            : [],
          pinned: note.pinned === true,
          createdAt: Number(note.createdAt) || Date.now(),
          updatedAt: Number(note.updatedAt) || Date.now()
        }));
      }
    } else {
      // Sample notes are added only on the first visit.
      notes = [
        {
          id: createId(),
          title: "Welcome to NoteNest!",
          content:
            "This is your smart note-taking application. " +
            "You can create, edit, search, pin, and organize notes. " +
            "Your changes are saved in your browser automatically.",
          folder: "Personal",
          tags: ["welcome", "guide"],
          pinned: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        {
          id: createId(),
          title: "Generative AI Study Notes",
          content:
            "Generative AI creates new content such as text, " +
            "images, music, and code. Examples include ChatGPT " +
            "and image-generation tools. Add your own study notes here.",
          folder: "Study",
          tags: ["MCA", "AI", "study"],
          pinned: false,
          createdAt: Date.now() - 60000,
          updatedAt: Date.now() - 60000
        }
      ];
    }

    if (storedFolders !== null) {
      const parsedFolders = JSON.parse(storedFolders);
      if (Array.isArray(parsedFolders)) {
        folders = [
          ...new Set(
            parsedFolders.filter(folder =>
              typeof folder === "string" &&
              folder.trim() !== ""
            )
          )
        ];
      }
    }

    // Ensure every note's folder exists.
    notes.forEach(note => {
      if (!folders.includes(note.folder)) {
        note.folder = "Personal";
      }
    });

    if (!folders.includes("Personal")) {
      folders.unshift("Personal");
    }

    saveData();
  } catch (error) {
    console.error("Could not load saved data:", error);
    notes = [];
    folders = ["Personal", "Study", "Projects", "Work"];
    showToast("Saved data could not be read. Starting fresh.");
  }
}

// Format timestamps for note cards.
function formatDate(timestamp) {
  return new Date(timestamp).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

// Show a small message on the screen.
function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("show");

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
}

// ---------- FOLDERS ----------

function renderFolders() {
  folderList.innerHTML = folders.map(folder => {
    const count = notes.filter(note =>
      note.folder === folder
    ).length;

    return `
      <div class="folder-item">
        <button class="folder-select ${
          currentView === "folder" && currentFolder === folder
            ? "active" : ""
        }" data-folder="${escapeHTML(folder)}"
          title="Open ${escapeHTML(folder)} folder">
          <span>📁</span>
          <span>${escapeHTML(folder)}</span>
          <span class="nav-count">${count}</span>
        </button>
        ${
          folder !== "Personal"
            ? `<button class="folder-delete"
                data-delete-folder="${escapeHTML(folder)}"
                title="Delete folder"
                aria-label="Delete ${escapeHTML(folder)} folder">×</button>`
            : ""
        }
      </div>
    `;
  }).join("");

  folderFilter.innerHTML =
    '<option value="all">All folders</option>' +
    folders.map(folder =>
      `<option value="${escapeHTML(folder)}">${
        escapeHTML(folder)
      }</option>`
    ).join("");

  if (currentView === "folder") {
    folderFilter.value = currentFolder;
  } else {
    folderFilter.value = currentFolder === "all"
      ? "all" : currentFolder;
  }

  noteFolderInput.innerHTML = folders.map(folder =>
    `<option value="${escapeHTML(folder)}">${
      escapeHTML(folder)
    }</option>`
  ).join("");
}

// ---------- RENDER NOTES ----------

function getVisibleNotes() {
  let result = [...notes];

  // Filter by sidebar view.
  if (currentView === "pinned") {
    result = result.filter(note => note.pinned);
  } else if (currentView === "folder") {
    result = result.filter(note =>
      note.folder === currentFolder
    );
  }

  // Apply folder dropdown filter.
  if (currentFolder !== "all" && currentView !== "folder") {
    result = result.filter(note =>
      note.folder === currentFolder
    );
  }

  // Search both title and content.
  if (searchQuery) {
    result = result.filter(note =>
      note.title.toLowerCase().includes(searchQuery) ||
      note.content.toLowerCase().includes(searchQuery) ||
      note.tags.some(tag => tag.toLowerCase().includes(searchQuery)) ||
      note.folder.toLowerCase().includes(searchQuery)
    );
  }

  // Sorting.
  if (sortSelect.value === "title") {
    result.sort((a, b) =>
      a.title.localeCompare(b.title)
    );
  } else if (sortSelect.value === "created") {
    result.sort((a, b) => b.createdAt - a.createdAt);
  } else {
    result.sort((a, b) => {
      if (a.pinned !== b.pinned) {
        return Number(b.pinned) - Number(a.pinned);
      }
      return b.updatedAt - a.updatedAt;
    });
  }

  return result;
}

function renderNotes() {
  renderFolders();

  const visibleNotes = getVisibleNotes();

  document.getElementById("allCount").textContent = notes.length;
  document.getElementById("visibleCount").textContent =
    visibleNotes.length;

  const titles = {
    all: ["All Notes", "Capture your thoughts and keep everything organized."],
    pinned: ["Pinned Notes", "Your most important notes, all in one place."],
    folder: [currentFolder, "Browse the notes in this folder."]
  };

  document.getElementById("viewTitle").textContent =
    titles[currentView][0];
  document.getElementById("viewDescription").textContent =
    titles[currentView][1];

  document.querySelectorAll(".nav-item").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.view === currentView
    );
  });

  notesGrid.innerHTML = visibleNotes.map(note => {
    const tagsHTML = note.tags.map(tag =>
      `<span class="tag">#${escapeHTML(tag)}</span>`
    ).join("");

    return `
      <article class="note-card ${note.pinned ? "pinned" : ""}">
        <div class="card-top">
          <span class="folder-badge">
            📁 ${escapeHTML(note.folder)}
          </span>
          ${note.pinned
            ? '<span class="pin-indicator" title="Pinned">📌 Pinned</span>'
            : ""}
        </div>

        <h3>${escapeHTML(note.title)}</h3>
        <p class="note-content">${escapeHTML(note.content)}</p>

        ${tagsHTML ? `<div class="tag-list">${tagsHTML}</div>` : ""}

        <div class="card-footer">
          <span class="note-date">
            Updated<br>${formatDate(note.updatedAt)}
          </span>

          <div class="card-actions">
            <button class="card-action" data-action="pin"
              data-id="${escapeHTML(note.id)}"
              title="${note.pinned ? "Unpin" : "Pin"} note"
              aria-label="${note.pinned ? "Unpin" : "Pin"} note">
              ${note.pinned ? "📌" : "📍"}
            </button>

            <button class="card-action" data-action="edit"
              data-id="${escapeHTML(note.id)}"
              title="Edit note" aria-label="Edit note">✎</button>

            <button class="card-action delete" data-action="delete"
              data-id="${escapeHTML(note.id)}"
              title="Delete note" aria-label="Delete note">🗑</button>
          </div>
        </div>
      </article>
    `;
  }).join("");

  // Show an appropriate empty state.
  if (visibleNotes.length === 0) {
    emptyState.classList.remove("hidden");
    notesGrid.classList.add("hidden");

    if (searchQuery) {
      emptyTitle.textContent = "No matching notes";
      emptyMessage.textContent =
        "Try another search term or clear your search.";
    } else if (currentView === "pinned") {
      emptyTitle.textContent = "No pinned notes yet";
      emptyMessage.textContent =
        "Pin important notes to find them quickly.";
    } else {
      emptyTitle.textContent = "Your space is waiting";
      emptyMessage.textContent = notes.length === 0
        ? "Create your first note and start collecting your ideas."
        : "This view has no notes yet. Create a note to get started.";
    }

    document.getElementById("emptyCreateBtn").textContent =
      "＋ Create a note";
  } else {
    emptyState.classList.add("hidden");
    notesGrid.classList.remove("hidden");
  }
}

// ---------- CREATE AND EDIT NOTES ----------

function openNewNote() {
  noteForm.reset();
  noteIdInput.value = "";
  document.getElementById("dialogTitle").textContent =
    "Create a new note";
  document.getElementById("saveNoteBtn").textContent = "Save Note";

  noteFolderInput.value =
    currentView === "folder" ? currentFolder :
    currentFolder !== "all" ? currentFolder : "Personal";

  noteDialog.showModal();
  noteTitleInput.focus();
}

function openEditNote(id) {
  const note = notes.find(item => item.id === id);
  if (!note) return;

  noteIdInput.value = note.id;
  noteTitleInput.value = note.title;
  noteContentInput.value = note.content;
  noteFolderInput.value = folders.includes(note.folder)
    ? note.folder : "Personal";
  noteTagsInput.value = note.tags.join(", ");
  notePinnedInput.checked = note.pinned;

  document.getElementById("dialogTitle").textContent =
    "Edit note";
  document.getElementById("saveNoteBtn").textContent =
    "Update Note";

  noteDialog.showModal();
  noteTitleInput.focus();
}

noteForm.addEventListener("submit", event => {
  event.preventDefault();

  const title = noteTitleInput.value.trim();
  const content = noteContentInput.value.trim();

  if (!title || !content) {
    showToast("Please enter a title and note content.");
    return;
  }

  const id = noteIdInput.value;
  const now = Date.now();

  const tags = [...new Set(
    noteTagsInput.value
      .split(",")
      .map(tag => tag.trim().replace(/^#+/, ""))
      .filter(Boolean)
  )];

  const folder = folders.includes(noteFolderInput.value)
    ? noteFolderInput.value : "Personal";

  if (id) {
    // Update an existing note.
    const index = notes.findIndex(note => note.id === id);
    if (index === -1) {
      showToast("Note not found.");
      return;
    }

    notes[index] = {
      ...notes[index],
      title,
      content,
      folder,
      tags,
      pinned: notePinnedInput.checked,
      updatedAt: now
    };

    if (!saveData()) return;

    noteDialog.close();
    renderNotes();
    showToast("Note updated successfully!");
  } else {
    // Create a new note.
    const newNote = {
      id: createId(),
      title,
      content,
      folder,
      tags,
      pinned: notePinnedInput.checked,
      createdAt: now,
      updatedAt: now
    };

    notes.unshift(newNote);

    if (!saveData()) {
      notes = notes.filter(note => note.id !== newNote.id);
      return;
    }

    // Show the newly created note.
    currentView = "all";
    currentFolder = "all";
    searchQuery = "";
    searchInput.value = "";

    noteDialog.close();
    renderNotes();
    showToast("Note created successfully!");
  }
});

// ---------- DELETE AND PIN NOTES ----------

function deleteNote(id) {
  const note = notes.find(item => item.id === id);
  if (!note) return;

  const confirmed = window.confirm(
    `Are you sure you want to delete "${note.title}"?`
  );

  if (!confirmed) return;

  const previousNotes = notes;
  notes = notes.filter(item => item.id !== id);

  if (!saveData()) {
    notes = previousNotes;
    return;
  }

  renderNotes();
  showToast("Note deleted successfully.");
}

function togglePin(id) {
  const note = notes.find(item => item.id === id);
  if (!note) return;

  const previousValue = note.pinned;
  note.pinned = !note.pinned;
  note.updatedAt = Date.now();

  if (!saveData()) {
    note.pinned = previousValue;
    return;
  }

  renderNotes();
  showToast(note.pinned ? "Note pinned!" : "Note unpinned!");
}

// ---------- FOLDER MANAGEMENT ----------

function addFolder() {
  const name = window.prompt("Enter a name for the new folder:");
  if (name === null) return;

  const folder = name.trim();

  if (!folder) {
    showToast("Folder name cannot be empty.");
    return;
  }

  if (folder.length > 40) {
    showToast("Folder name must be 40 characters or less.");
    return;
  }

  if (folders.some(item =>
    item.toLowerCase() === folder.toLowerCase()
  )) {
    showToast("This folder already exists.");
    return;
  }

  folders.push(folder);

  if (!saveData()) {
    folders.pop();
    return;
  }

  currentView = "folder";
  currentFolder = folder;
  renderNotes();
  showToast("Folder created successfully!");
}

function deleteFolder(folder) {
  if (folder === "Personal") {
    showToast("The Personal folder cannot be deleted.");
    return;
  }

  const confirmed = window.confirm(
    `Delete the "${folder}" folder? Its notes will be moved to Personal.`
  );

  if (!confirmed) return;

  const previousFolders = [...folders];
  const previousNotes = notes.map(note => ({ ...note }));

  folders = folders.filter(item => item !== folder);

  notes.forEach(note => {
    if (note.folder === folder) {
      note.folder = "Personal";
      note.updatedAt = Date.now();
    }
  });

  if (!saveData()) {
    folders = previousFolders;
    notes = previousNotes;
    return;
  }

  if (currentFolder === folder) {
    currentFolder = "all";
    currentView = "all";
  }

  renderNotes();
  showToast("Folder deleted. Its notes were preserved.");
}

// ---------- EVENT LISTENERS ----------

// Both New Note buttons open the same form.
document.getElementById("newNoteBtn")
  .addEventListener("click", openNewNote);

document.getElementById("headerNewBtn")
  .addEventListener("click", openNewNote);

document.getElementById("emptyCreateBtn")
  .addEventListener("click", openNewNote);

document.getElementById("addFolderBtn")
  .addEventListener("click", addFolder);

// Close or cancel the note dialog.
document.getElementById("closeDialogBtn")
  .addEventListener("click", () => noteDialog.close());

document.getElementById("cancelBtn")
  .addEventListener("click", () => noteDialog.close());

// Close dialog by clicking outside it.
noteDialog.addEventListener("click", event => {
  if (event.target === noteDialog) {
    noteDialog.close();
  }
});

// Search notes while typing.
searchInput.addEventListener("input", () => {
  searchQuery = searchInput.value.trim().toLowerCase();
  renderNotes();
});

// Folder dropdown.
folderFilter.addEventListener("change", () => {
  currentFolder = folderFilter.value;

  if (currentView === "folder") {
    currentView = currentFolder === "all" ? "all" : "folder";
  }

  renderNotes();
});

// Sort notes.
sortSelect.addEventListener("change", renderNotes);

// Sidebar navigation.
document.querySelectorAll(".nav-item").forEach(button => {
  button.addEventListener("click", () => {
    currentView = button.dataset.view;
    currentFolder = "all";
    renderNotes();
  });
});

// Use event delegation for note actions and folders.
document.addEventListener("click", event => {
  const actionButton = event.target.closest("[data-action]");

  if (actionButton) {
    const id = actionButton.dataset.id;
    const action = actionButton.dataset.action;

    if (action === "edit") openEditNote(id);
    if (action === "delete") deleteNote(id);
    if (action === "pin") togglePin(id);

    return;
  }

  const folderButton = event.target.closest("[data-folder]");

  if (folderButton) {
    currentView = "folder";
    currentFolder = folderButton.dataset.folder;
    renderNotes();
    return;
  }

  const deleteFolderButton =
    event.target.closest("[data-delete-folder]");

  if (deleteFolderButton) {
    deleteFolder(deleteFolderButton.dataset.deleteFolder);
  }
});

// ---------- START APPLICATION ----------

loadData();
renderNotes();
