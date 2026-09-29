(() => {
  "use strict";

  const FIELDS = {
    title: "作品タイトル / Title",
    author: "表記する名前 / Written name",
    fullName: "本名 / Full name",
    university: "所属大学 / University",
    grade: "学年/Grade",
    caption: "キャプション / Caption",
    sns: "SNSアカウントのリンク / Link of social media account *optional",
    location: "撮影場所 / Location",
    camera: "使用機材 / Camera",
    lens: "使用レンズ / Lens",
    shutter: "シャッタースピード / Shutter Speed",
    aperture: "絞り値 / Aperture",
    iso: "ISO感度（使用フィルム） / ISO(Film name)"
  };

  const state = {
    headers: [],
    rows: [],
    selected: -1,
    query: "",
    page: "all",
    fit: false,
    typography: { title: 100, person: 100, caption: 100, tech: 100 },
    stripQuery: false,
    filename: "penelope-captions.csv"
  };

  const els = Object.fromEntries([
    "workspace", "emptyState", "loadedView", "inspector", "workList", "workCount",
    "pageCount", "issueCount", "searchInput", "pages", "pageSelect", "previewTitle",
    "editorForm", "selectedIndex", "moveUpButton", "moveDownButton", "deleteButton",
    "downloadCsvButton", "printButton", "fitButton", "previewScroll", "toast",
    "typographyButton", "typographyPanel", "resetTypographyButton", "stripQueryToggle"
  ].map((id) => [id, document.getElementById(id)]));

  loadPreferences();
  applyTypography();

  document.querySelectorAll('input[type="file"]').forEach((input) => {
    input.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (file) loadFile(file);
      input.value = "";
    });
  });

  els.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    renderList();
  });

  els.pageSelect.addEventListener("change", (event) => {
    state.page = event.target.value;
    renderPages();
  });

  els.fitButton.addEventListener("click", () => {
    state.fit = !state.fit;
    els.previewScroll.classList.toggle("fit", state.fit);
    els.fitButton.textContent = state.fit ? "大きく表示" : "全体表示";
  });

  els.printButton.addEventListener("click", () => {
    const previousPage = state.page;
    state.page = "all";
    renderPages();
    requestAnimationFrame(() => {
      window.print();
      state.page = previousPage;
      setTimeout(renderPages, 100);
    });
  });

  els.downloadCsvButton.addEventListener("click", downloadCsv);
  els.moveUpButton.addEventListener("click", () => moveSelected(-1));
  els.moveDownButton.addEventListener("click", () => moveSelected(1));
  els.deleteButton.addEventListener("click", deleteSelected);
  els.typographyButton.addEventListener("click", () => {
    const willOpen = els.typographyPanel.hidden;
    els.typographyPanel.hidden = !willOpen;
    els.typographyButton.setAttribute("aria-expanded", String(willOpen));
  });
  els.resetTypographyButton.addEventListener("click", () => {
    state.typography = { title: 100, person: 100, caption: 100, tech: 100 };
    syncTypographyControls();
    applyTypography();
    savePreferences();
    showToast("文字サイズを初期値に戻しました");
  });
  els.typographyPanel.querySelectorAll("[data-font-size]").forEach((input) => {
    input.addEventListener("input", () => {
      state.typography[input.dataset.fontSize] = Number(input.value);
      syncTypographyControls();
      applyTypography();
      savePreferences();
    });
  });
  els.stripQueryToggle.addEventListener("change", () => {
    state.stripQuery = els.stripQueryToggle.checked;
    savePreferences();
    renderPages();
    showToast(state.stripQuery ? "QRリンクのクエリを削除します" : "QRリンクをそのまま使用します");
  });
  document.addEventListener("click", (event) => {
    if (els.typographyPanel.hidden || els.typographyPanel.contains(event.target) || els.typographyButton.contains(event.target)) return;
    closeTypographyPanel();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeTypographyPanel();
  });
  syncTypographyControls();

  els.editorForm.addEventListener("input", (event) => {
    if (state.selected < 0) return;
    const input = event.target;
    if (!input.name || !(input.name in FIELDS)) return;
    const row = state.rows[state.selected];
    row[input.name] = input.value;
    row.raw[FIELDS[input.name]] = input.value;
    renderStats();
    renderList();
    renderPages();
    pulseSaved();
  });

  ["dragenter", "dragover"].forEach((name) => document.addEventListener(name, (event) => {
    event.preventDefault();
    document.querySelector(".stage").classList.add("dragging");
  }));
  ["dragleave", "drop"].forEach((name) => document.addEventListener(name, (event) => {
    event.preventDefault();
    if (name === "dragleave" && event.relatedTarget) return;
    document.querySelector(".stage").classList.remove("dragging");
  }));
  document.addEventListener("drop", (event) => {
    const file = [...(event.dataTransfer?.files || [])].find((item) => item.name.toLowerCase().endsWith(".csv"));
    if (file) loadFile(file);
    else showToast("CSVファイルを選んでください");
  });

  async function loadFile(file) {
    try {
      const text = await file.text();
      const table = parseCsv(text.replace(/^\uFEFF/, ""));
      if (table.length < 2) throw new Error("データ行がありません");
      const headers = table[0].map((header) => header.trim());
      if (!headers.includes(FIELDS.title)) throw new Error(`「${FIELDS.title}」列が見つかりません`);
      const rows = table.slice(1)
        .filter((cells) => cells.some((cell) => cell.trim()))
        .map((cells) => {
          const raw = Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
          return normalizeRow(raw);
        })
        .filter((row) => row.title);
      if (!rows.length) throw new Error("作品タイトルが入った行がありません");
      state.headers = headers;
      state.rows = rows;
      state.selected = 0;
      state.page = "all";
      state.filename = file.name;
      state.query = "";
      els.searchInput.value = "";
      activateWorkspace();
      renderAll();
      showToast(`${rows.length}作品を読み込みました`);
    } catch (error) {
      showToast(error.message || "CSVを読み込めませんでした");
    }
  }

  function normalizeRow(raw) {
    const captionValue = clean(raw[FIELDS.caption]);
    return {
      raw,
      title: clean(raw[FIELDS.title]),
      author: clean(raw[FIELDS.author]) || clean(raw[FIELDS.fullName]),
      university: shortBilingual(raw[FIELDS.university]),
      grade: shortBilingual(raw[FIELDS.grade]),
      caption: /^(キャプション無し|キャプションなし|-|なし|無し)$/i.test(captionValue) ? "" : captionValue,
      sns: clean(raw[FIELDS.sns]),
      location: clean(raw[FIELDS.location]),
      camera: clean(raw[FIELDS.camera]),
      lens: clean(raw[FIELDS.lens]),
      shutter: clean(raw[FIELDS.shutter]),
      aperture: clean(raw[FIELDS.aperture]),
      iso: clean(raw[FIELDS.iso])
    };
  }

  function clean(value) {
    return String(value ?? "").replace(/\r\n?/g, "\n").trim();
  }

  function shortBilingual(value) {
    return clean(value).split(" / ")[0];
  }

  function activateWorkspace() {
    els.emptyState.hidden = true;
    els.loadedView.hidden = false;
    els.inspector.hidden = false;
    els.workspace.classList.add("has-data");
    els.downloadCsvButton.disabled = false;
    els.printButton.disabled = false;
  }

  function renderAll() {
    renderStats();
    renderList();
    renderEditor();
    renderPageOptions();
    renderPages();
  }

  function renderStats() {
    const issues = state.rows.filter((row) => !row.title || !row.author).length;
    els.workCount.textContent = state.rows.length;
    els.pageCount.textContent = Math.ceil(state.rows.length / 6);
    els.issueCount.textContent = issues;
  }

  function renderList() {
    els.workList.replaceChildren();
    const fragment = document.createDocumentFragment();
    state.rows.forEach((row, index) => {
      const haystack = `${row.title} ${row.author}`.toLowerCase();
      if (state.query && !haystack.includes(state.query)) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = `work-item${index === state.selected ? " active" : ""}`;
      button.addEventListener("click", () => selectRow(index));
      const number = document.createElement("span");
      number.className = "work-number";
      number.textContent = String(index + 1).padStart(2, "0");
      const meta = document.createElement("span");
      meta.className = "work-meta";
      const title = document.createElement("strong");
      title.textContent = row.title || "タイトル未入力";
      const author = document.createElement("span");
      author.textContent = row.author || "表記名未入力";
      meta.append(title, author);
      button.append(number, meta);
      if (!row.title || !row.author) {
        const issue = document.createElement("span");
        issue.className = "issue-dot";
        issue.title = "必須項目を確認してください";
        button.append(issue);
      }
      fragment.append(button);
    });
    els.workList.append(fragment);
    if (!els.workList.children.length) {
      const empty = document.createElement("p");
      empty.style.cssText = "padding:24px 14px;color:#777;font-size:12px;text-align:center";
      empty.textContent = "一致する作品がありません";
      els.workList.append(empty);
    }
  }

  function renderEditor() {
    const row = state.rows[state.selected];
    if (!row) return;
    els.selectedIndex.textContent = `作品 ${String(state.selected + 1).padStart(2, "0")}`;
    [...els.editorForm.elements].forEach((input) => {
      if (input.name) input.value = row[input.name] ?? "";
    });
    els.moveUpButton.disabled = state.selected === 0;
    els.moveDownButton.disabled = state.selected === state.rows.length - 1;
  }

  function renderPageOptions() {
    const count = Math.ceil(state.rows.length / 6);
    els.pageSelect.replaceChildren();
    const all = new Option(`全${count}ページ`, "all");
    els.pageSelect.add(all);
    for (let index = 0; index < count; index += 1) {
      els.pageSelect.add(new Option(`${index + 1}ページ目`, String(index)));
    }
    if (state.page !== "all" && Number(state.page) >= count) state.page = String(Math.max(0, count - 1));
    els.pageSelect.value = state.page;
  }

  function renderPages() {
    els.pages.replaceChildren();
    const chunks = [];
    for (let index = 0; index < state.rows.length; index += 6) chunks.push(state.rows.slice(index, index + 6));
    const visible = state.page === "all" ? chunks.map((chunk, index) => [chunk, index]) : [[chunks[Number(state.page)], Number(state.page)]];
    els.previewTitle.textContent = state.page === "all" ? `全${chunks.length}ページ` : `${Number(state.page) + 1}ページ目`;
    visible.forEach(([rows, pageIndex]) => {
      if (!rows) return;
      const page = document.createElement("section");
      page.className = "print-page";
      page.setAttribute("aria-label", `${pageIndex + 1}ページ目`);
      for (let slot = 0; slot < 6; slot += 1) {
        const row = rows[slot];
        if (row) page.append(createCard(row, pageIndex * 6 + slot));
        else {
          const blank = document.createElement("div");
          blank.className = "caption-card blank-card";
          page.append(blank);
        }
      }
      els.pages.append(page);
    });
    renderQrCodes();
  }

  function createCard(row, index) {
    const card = document.createElement("article");
    card.className = `caption-card${index === state.selected ? " selected" : ""}`;
    card.tabIndex = 0;
    card.setAttribute("aria-label", `${index + 1}. ${row.title}`);
    const choose = () => selectRow(index);
    card.addEventListener("click", choose);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); choose(); }
    });

    const primary = document.createElement("div");
    primary.className = "card-primary";
    const title = document.createElement("h3");
    title.className = "card-title";
    title.textContent = row.title;
    const person = document.createElement("div");
    person.className = "card-person";
    const affiliation = document.createElement("div");
    affiliation.textContent = [row.university, row.grade].filter(Boolean).join(" ");
    const authorRow = document.createElement("div");
    authorRow.className = "author-row";
    const author = document.createElement("b");
    author.textContent = row.author;
    authorRow.append(author);
    if (row.sns) {
      const qr = document.createElement("div");
      qr.className = "qr-slot";
      qr.dataset.qr = row.sns;
      qr.title = state.stripQuery ? stripUrlQuery(row.sns) : row.sns;
      authorRow.append(qr);
    }
    person.append(affiliation, authorRow);
    primary.append(title, person);
    if (row.caption) {
      const caption = document.createElement("p");
      caption.className = "card-caption";
      caption.textContent = row.caption;
      primary.append(caption);
    }

    const tech = document.createElement("div");
    tech.className = "card-tech";
    [["location", row.location], ["camera", row.camera], ["lens", row.lens]].forEach(([className, value]) => {
      if (!value) return;
      const item = document.createElement("div");
      item.className = className;
      item.textContent = value;
      tech.append(item);
    });
    const settings = document.createElement("div");
    settings.className = "settings";
    const values = [row.aperture, normalizeShutter(row.shutter), row.iso];
    values.filter(Boolean).forEach((value) => {
      const item = document.createElement("span");
      item.textContent = value;
      settings.append(item);
    });
    if (settings.children.length) tech.append(settings);
    card.append(primary, tech);
    return card;
  }

  function normalizeShutter(value) {
    if (!value || /s$/i.test(value) || /不明|おそめ|-/.test(value)) return value;
    return `${value}s`;
  }

  function renderQrCodes() {
    document.querySelectorAll("[data-qr]").forEach((slot) => {
      const originalValue = slot.dataset.qr;
      const value = state.stripQuery ? stripUrlQuery(originalValue) : originalValue;
      if (window.QRCode?.toCanvas) {
        const canvas = document.createElement("canvas");
        slot.append(canvas);
        window.QRCode.toCanvas(canvas, value, { margin: 0, width: 128, color: { dark: "#151817", light: "#ffffff" } }).catch(() => fallbackQr(slot));
      } else if (typeof window.QRCode === "function") {
        try {
          new window.QRCode(slot, {
            text: value,
            width: 128,
            height: 128,
            colorDark: "#151817",
            colorLight: "#ffffff",
            correctLevel: window.QRCode.CorrectLevel.M
          });
        } catch { fallbackQr(slot); }
      } else fallbackQr(slot);
    });
  }

  function stripUrlQuery(value) {
    try {
      const url = new URL(value);
      url.search = "";
      return url.toString();
    } catch {
      const queryIndex = value.indexOf("?");
      return queryIndex >= 0 ? value.slice(0, queryIndex) : value;
    }
  }

  function closeTypographyPanel() {
    els.typographyPanel.hidden = true;
    els.typographyButton.setAttribute("aria-expanded", "false");
  }

  function syncTypographyControls() {
    els.typographyPanel.querySelectorAll("[data-font-size]").forEach((input) => {
      const key = input.dataset.fontSize;
      input.value = state.typography[key];
      const output = els.typographyPanel.querySelector(`[data-output="${key}"]`);
      if (output) output.value = `${state.typography[key]}%`;
    });
    els.stripQueryToggle.checked = state.stripQuery;
  }

  function applyTypography() {
    const definitions = {
      title: [10, 1.25, 20, 5],
      person: [6, .67, 10, 2.55],
      caption: [6, .64, 10, 2.45],
      tech: [6, .67, 10, 2.55]
    };
    Object.entries(definitions).forEach(([key, [minimum, fluid, maximum, print]]) => {
      const scale = state.typography[key] / 100;
      document.documentElement.style.setProperty(`--${key}-font`, `clamp(${formatSize(minimum * scale)}px, ${formatSize(fluid * scale)}vw, ${formatSize(maximum * scale)}px)`);
      document.documentElement.style.setProperty(`--print-${key}-font`, `${formatSize(print * scale)}mm`);
    });
  }

  function formatSize(value) {
    return Number(value.toFixed(3));
  }

  function loadPreferences() {
    try {
      const saved = JSON.parse(localStorage.getItem("penelope-display-preferences") || "{}");
      if (saved.typography) {
        Object.keys(state.typography).forEach((key) => {
          const value = Number(saved.typography[key]);
          if (Number.isFinite(value) && value >= 70 && value <= 150) state.typography[key] = value;
        });
      }
      state.stripQuery = saved.stripQuery === true;
    } catch {}
  }

  function savePreferences() {
    try {
      localStorage.setItem("penelope-display-preferences", JSON.stringify({ typography: state.typography, stripQuery: state.stripQuery }));
    } catch {}
  }

  function fallbackQr(slot) {
    slot.replaceChildren();
    slot.style.cssText = "border:1px solid #151817;display:grid;place-items:center;font:700 7px sans-serif";
    slot.textContent = "LINK";
  }

  function selectRow(index) {
    state.selected = index;
    const pageIndex = Math.floor(index / 6);
    if (state.page !== "all" && Number(state.page) !== pageIndex) state.page = String(pageIndex);
    renderList();
    renderEditor();
    renderPages();
    document.querySelector(`.caption-card[aria-label^="${index + 1}."]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function moveSelected(delta) {
    const next = state.selected + delta;
    if (next < 0 || next >= state.rows.length) return;
    [state.rows[state.selected], state.rows[next]] = [state.rows[next], state.rows[state.selected]];
    state.selected = next;
    renderAll();
    showToast(delta < 0 ? "前へ移動しました" : "後ろへ移動しました");
  }

  function deleteSelected() {
    const row = state.rows[state.selected];
    if (!row || !window.confirm(`「${row.title}」を一覧から削除しますか？`)) return;
    state.rows.splice(state.selected, 1);
    state.selected = Math.min(state.selected, state.rows.length - 1);
    if (!state.rows.length) {
      location.reload();
      return;
    }
    renderAll();
    showToast("作品を削除しました");
  }

  function downloadCsv() {
    state.rows.forEach((row) => {
      Object.entries(FIELDS).forEach(([key, header]) => {
        if (key !== "fullName" && header in row.raw) row.raw[header] = row[key] ?? "";
      });
    });
    const lines = [state.headers, ...state.rows.map((row) => state.headers.map((header) => row.raw[header] ?? ""))];
    const csv = `\uFEFF${lines.map((cells) => cells.map(csvCell).join(",")).join("\r\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    const stem = state.filename.replace(/\.csv$/i, "");
    link.download = `${stem}_edited.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast("編集済みCSVを書き出しました");
  }

  function csvCell(value) {
    const text = String(value ?? "");
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      if (quoted) {
        if (char === '"' && text[index + 1] === '"') { cell += '"'; index += 1; }
        else if (char === '"') quoted = false;
        else cell += char;
      } else if (char === '"') quoted = true;
      else if (char === ",") { row.push(cell); cell = ""; }
      else if (char === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
      else cell += char;
    }
    if (cell.length || row.length) { row.push(cell.replace(/\r$/, "")); rows.push(row); }
    return rows;
  }

  let toastTimer;
  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2600);
  }

  function pulseSaved() {
    const status = document.getElementById("saveStatus");
    status.textContent = "保存済み";
    clearTimeout(pulseSaved.timer);
    pulseSaved.timer = setTimeout(() => { status.textContent = "自動保存"; }, 1000);
  }

  function registerWebMcp() {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const tools = [
      {
        name: "read_caption_summary",
        title: "キャプションの状態を確認",
        description: "現在読み込まれている作品数、ページ数、要確認件数を返します。",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: () => ({ works: state.rows.length, pages: Math.ceil(state.rows.length / 6), issues: state.rows.filter((row) => !row.title || !row.author).length })
      },
      {
        name: "select_caption_work",
        title: "作品を選択",
        description: "番号を指定して作品を選択し、編集画面とプレビューを表示します。",
        inputSchema: { type: "object", properties: { number: { type: "integer", minimum: 1 } }, required: ["number"], additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: ({ number }) => {
          if (!Number.isInteger(number) || number < 1 || number > state.rows.length) throw new Error("存在する作品番号を指定してください");
          selectRow(number - 1);
          return { selected: number, title: state.rows[number - 1].title };
        }
      }
    ];
    tools.forEach((tool) => Promise.resolve(context.registerTool(tool)).catch(() => {}));
  }

  registerWebMcp();
})();
