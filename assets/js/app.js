(function () {
  const STORAGE_KEY = "notes-checklist-v1";
  const manifestUrl = "notes-manifest.json";

  let manifest = null;
  let allNotes = [];

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const els = {
    sidebar: $("#sidebar"),
    navScroll: $("#nav-scroll"),
    search: $("#search"),
    content: $("#content"),
    overlay: $("#sidebar-overlay"),
    menuBtn: $("#menu-btn"),
    toc: $("#toc"),
    tocList: $("#toc-list"),
  };

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function init() {
    try {
      const res = await fetch(manifestUrl);
      if (!res.ok) throw new Error(`Could not load ${manifestUrl}`);
      manifest = await res.json();
      buildNoteIndex();
      renderNav();
      renderWelcome();
      bindGlobalEvents();
      handleRoute();
    } catch (err) {
      showError(err.message);
    }
  }

  function buildNoteIndex() {
    allNotes = [];
    manifest.categories.forEach((cat) => {
      cat.notes.forEach((note) => {
        allNotes.push({
          ...note,
          categoryId: cat.id,
          categoryName: cat.name,
          categoryIcon: cat.icon,
        });
      });
    });
  }

  function getNote(id) {
    return allNotes.find((n) => n.id === id);
  }

  function bindGlobalEvents() {
    window.addEventListener("hashchange", handleRoute);

    els.search?.addEventListener("input", () => {
      const q = els.search.value.trim().toLowerCase();
      $$(".nav-link", els.navScroll).forEach((link) => {
        const text = link.textContent.toLowerCase();
        link.classList.toggle("hidden", q.length > 0 && !text.includes(q));
      });
    });

    els.menuBtn?.addEventListener("click", toggleSidebar);
    els.overlay?.addEventListener("click", closeSidebar);

    $("#brand-home")?.addEventListener("click", (e) => {
      e.preventDefault();
      navigate("");
    });
  }

  function toggleSidebar() {
    els.sidebar?.classList.toggle("open");
    els.overlay?.classList.toggle("open");
  }

  function closeSidebar() {
    els.sidebar?.classList.remove("open");
    els.overlay?.classList.remove("open");
  }

  function navigate(noteId) {
    location.hash = noteId ? `#/${noteId}` : "#/";
    closeSidebar();
  }

  function handleRoute() {
    const hash = location.hash.replace(/^#\/?/, "") || "";
    $$(".nav-link").forEach((l) => l.classList.toggle("active", l.dataset.id === hash));

    if (!hash) {
      renderWelcome();
      hideToc();
      return;
    }

    const note = getNote(hash);
    if (!note) {
      renderWelcome();
      return;
    }
    loadNote(note);
  }

  function renderNav() {
    els.navScroll.innerHTML = manifest.categories
      .map(
        (cat) => `
      <div class="nav-category">
        <div class="nav-category-title">${cat.icon} ${escapeHtml(cat.name)}</div>
        ${cat.notes
          .map(
            (n) => `
          <a class="nav-link" href="#/${n.id}" data-id="${n.id}">${escapeHtml(n.title)}</a>
        `
          )
          .join("")}
      </div>
    `
      )
      .join("");

    els.navScroll.querySelectorAll(".nav-link").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        navigate(link.dataset.id);
      });
    });
  }

  function renderWelcome() {
    hideToc();

    const cards = allNotes
      .map(
        (n) => `
      <button type="button" class="note-card" data-id="${n.id}">
        <div class="cat">${n.categoryIcon} ${escapeHtml(n.categoryName)}</div>
        <h3>${escapeHtml(n.title)}</h3>
        <p>${escapeHtml(n.description || "")}</p>
      </button>
    `
      )
      .join("");

    els.content.innerHTML = `
      <div class="welcome">
        <h2>Your study notes</h2>
        <p>Concepts, checklists, and interactive explainers — pick a topic from the sidebar or below.</p>
        <div class="card-grid">${cards}</div>
      </div>
    `;

    $$(".note-card", els.content).forEach((card) => {
      card.addEventListener("click", () => navigate(card.dataset.id));
    });
  }

  async function loadNote(note) {
    els.content.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        <p>Loading note…</p>
      </div>
    `;

    const fileUrl = encodeURI(note.file).replace(/#/g, "%23");

    try {
      if (note.type === "html") {
        renderHtmlNote(note, fileUrl);
        return;
      }

      const res = await fetch(fileUrl);
      if (!res.ok) throw new Error(`Failed to load ${note.file} (${res.status})`);
      const raw = await res.text();

      if (note.type === "checklist") {
        renderChecklistNote(note, raw);
      } else {
        renderMarkdownNote(note, raw);
      }
    } catch (err) {
      showError(err.message, note.file);
    }
  }

  function renderHtmlNote(note, fileUrl) {
    hideToc();
    els.content.innerHTML = `
      <article class="article">
        <header class="article-header">
          <p class="breadcrumb">${note.categoryIcon} ${escapeHtml(note.categoryName)}</p>
          <h1>${escapeHtml(note.title)}</h1>
          ${note.description ? `<p class="desc">${escapeHtml(note.description)}</p>` : ""}
        </header>
        <iframe class="html-embed" src="${fileUrl}" title="${escapeHtml(note.title)}" loading="lazy"></iframe>
      </article>
    `;
  }

  function renderMarkdownWithEmbeds(raw) {
    const embedRe = /<!--\s*embed:\s*([^\s>]+)\s*-->/gi;
    const chunks = [];
    let lastIndex = 0;
    let match;

    while ((match = embedRe.exec(raw)) !== null) {
      if (match.index > lastIndex) {
        chunks.push({ type: "md", content: raw.slice(lastIndex, match.index) });
      }
      chunks.push({ type: "embed", path: match[1].trim() });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < raw.length) {
      chunks.push({ type: "md", content: raw.slice(lastIndex) });
    }
    if (chunks.length === 0) {
      chunks.push({ type: "md", content: raw });
    }

    return chunks
      .map((chunk) => {
        if (chunk.type === "embed") {
          const url = encodeURI(chunk.path).replace(/#/g, "%23");
          return `<div class="embed-wrap"><iframe class="html-embed" src="${url}" title="Interactive visualizer" loading="lazy"></iframe></div>`;
        }
        const trimmed = chunk.content.trim();
        return trimmed ? marked.parse(trimmed, { gfm: true, breaks: true }) : "";
      })
      .join("");
  }

  function renderMarkdownNote(note, raw) {
    const withoutTitle = raw.replace(/^#\s+.+$/m, "").trim();
    const html = renderMarkdownWithEmbeds(withoutTitle);
    els.content.innerHTML = `
      <article class="article">
        <header class="article-header">
          <p class="breadcrumb">${note.categoryIcon} ${escapeHtml(note.categoryName)}</p>
          <h1>${escapeHtml(note.title)}</h1>
          ${note.description ? `<p class="desc">${escapeHtml(note.description)}</p>` : ""}
        </header>
        <div class="markdown-body">${html}</div>
      </article>
    `;

    const body = $(".markdown-body", els.content);
    enhanceCodeBlocks(body);
    buildToc(body);
    if (typeof hljs !== "undefined") {
      $$("pre code", body).forEach((block) => hljs.highlightElement(block));
    }
  }

  function renderChecklistNote(note, raw) {
    const lines = raw.split("\n");
    const htmlParts = [];
    let checklistIndex = 0;

    for (const line of lines) {
      const checkboxMatch = line.match(/^(\s*)- ☐ (.+)$/);
      if (checkboxMatch) {
        const id = `chk-${checklistIndex++}`;
        const text = checkboxMatch[2];
        const checked = isChecked(id);
        htmlParts.push(`
          <label class="checklist-item${checked ? " checked" : ""}" data-id="${id}">
            <input type="checkbox" ${checked ? "checked" : ""} />
            <span>${escapeHtml(text)}</span>
          </label>
        `);
        continue;
      }
      htmlParts.push(marked.parse(line, { gfm: true, breaks: true }));
    }

    const progress = getChecklistProgress(checklistIndex);

    els.content.innerHTML = `
      <article class="article checklist-section">
        <header class="article-header">
          <p class="breadcrumb">${note.categoryIcon} ${escapeHtml(note.categoryName)}</p>
          <h1>${escapeHtml(note.title)}</h1>
          <p class="desc">Track your prep — progress is saved in this browser.</p>
        </header>
        <div class="progress-bar-wrap">
          <div class="label">
            <span>Overall progress</span>
            <strong id="progress-pct">${progress.pct}%</strong>
          </div>
          <div class="progress-track">
            <div class="progress-fill" id="progress-fill" style="width:${progress.pct}%"></div>
          </div>
        </div>
        <div class="markdown-body">${htmlParts.join("\n")}</div>
      </article>
    `;

    const total = checklistIndex;
    $$(".checklist-item", els.content).forEach((item) => {
      item.addEventListener("click", (e) => {
        if (e.target.tagName === "A") return;
        const cb = $("input", item);
        cb.checked = !cb.checked;
        setChecked(item.dataset.id, cb.checked);
        item.classList.toggle("checked", cb.checked);
        updateProgressUI(total);
      });
    });

    buildToc($(".markdown-body", els.content));
  }

  function getStored() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function setStored(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function isChecked(id) {
    return !!getStored()[id];
  }

  function setChecked(id, value) {
    const data = getStored();
    if (value) data[id] = true;
    else delete data[id];
    setStored(data);
  }

  function getChecklistProgress(total) {
    const data = getStored();
    const done = Object.keys(data).filter((k) => k.startsWith("chk-")).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    return { done, total, pct };
  }

  function updateProgressUI(total) {
    const { pct } = getChecklistProgress(total);
    const fill = $("#progress-fill");
    const pctEl = $("#progress-pct");
    if (fill) fill.style.width = `${pct}%`;
    if (pctEl) pctEl.textContent = `${pct}%`;
  }

  function enhanceCodeBlocks(root) {
    $$("pre", root).forEach((pre) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "copy-btn";
      btn.textContent = "Copy";
      btn.addEventListener("click", async () => {
        const code = $("code", pre)?.textContent || pre.textContent;
        try {
          await navigator.clipboard.writeText(code.trim());
          btn.textContent = "Copied!";
          btn.classList.add("copied");
          setTimeout(() => {
            btn.textContent = "Copy";
            btn.classList.remove("copied");
          }, 1500);
        } catch {
          btn.textContent = "Failed";
        }
      });
      pre.appendChild(btn);
    });
  }

  function buildToc(root) {
    const headings = $$("h2, h3", root);
    if (headings.length < 3) {
      hideToc();
      return;
    }

    headings.forEach((h, i) => {
      if (!h.id) h.id = `section-${i}`;
    });

    els.tocList.innerHTML = headings
      .map((h) => {
        const cls = h.tagName === "H3" ? "toc-h3" : "";
        return `<a href="#${h.id}" class="${cls}" data-target="${h.id}">${escapeHtml(h.textContent)}</a>`;
      })
      .join("");

    els.toc.classList.add("visible");

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            $$(".toc a").forEach((a) => a.classList.toggle("active", a.dataset.target === id));
          }
        });
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );

    headings.forEach((h) => observer.observe(h));

    $$(".toc a").forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        document.getElementById(a.dataset.target)?.scrollIntoView({ behavior: "smooth" });
      });
    });
  }

  function hideToc() {
    els.toc?.classList.remove("visible");
    if (els.tocList) els.tocList.innerHTML = "";
  }

  function showError(message, file) {
    els.content.innerHTML = `
      <div class="error-state">
        <p>Could not load this note.</p>
        <p>${escapeHtml(message)}</p>
        ${file ? `<code>${escapeHtml(file)}</code>` : ""}
        <p style="margin-top:1rem;font-size:0.85rem">Serve this folder over HTTP (e.g. GitHub Pages). Opening <code>index.html</code> directly from disk blocks file loading.</p>
      </div>
    `;
  }

  init();
})();
