let weddingData = null;
let currentLang = "en";

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function looksLikeLanguageCode(key) {
  return /^[a-z]{2,3}(?:-[A-Z]{2})?$/i.test(key);
}

function isLocalizedObject(value) {
  if (!isPlainObject(value)) return false;
  const keys = Object.keys(value);
  return keys.length > 0 &&
    keys.every((key) => looksLikeLanguageCode(key)) &&
    Object.values(value).every((entry) => typeof entry === "string");
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function collectLanguageKeys(value, keys = new Set()) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectLanguageKeys(item, keys));
    return keys;
  }

  if (!isPlainObject(value)) {
    return keys;
  }

  if (isLocalizedObject(value)) {
    Object.keys(value).forEach((key) => keys.add(key));
    return keys;
  }

  Object.values(value).forEach((entry) => collectLanguageKeys(entry, keys));
  return keys;
}

function getAvailableLanguagesFromData(data) {
  const explicit = Array.isArray(data.languages) ? data.languages : [];
  const discovered = [
    ...Object.keys(data.ui || {}),
    ...Object.keys(data.languageLabels || {}),
  ];
  const langs = unique([...explicit, ...discovered]);
  return langs.length > 0 ? langs : ["en"];
}

function getFallbackLanguage() {
  if (!weddingData) return "en";
  return weddingData.defaultLanguage || weddingData.availableLanguages?.[0] || "en";
}

function getLocalizedValue(value, lang = currentLang) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value;
  if (!isPlainObject(value)) return String(value);

  if (isLocalizedObject(value)) {
    const fallbacks = unique([
      lang,
      getFallbackLanguage(),
      "en",
      ...Object.keys(value),
    ]);

    for (const key of fallbacks) {
      if (typeof value[key] === "string" && value[key].trim()) {
        return value[key];
      }
    }

    return "";
  }

  return value;
}

function getPrimarySide() {
  return weddingData?.isGroomSide ? "groom" : "bride";
}

function getSecondarySide() {
  return getPrimarySide() === "groom" ? "bride" : "groom";
}

function getOrderedSides() {
  return [getPrimarySide(), getSecondarySide()];
}

function getNestedValue(source, path) {
  return path.split(".").reduce((acc, part) => acc?.[part], source);
}

function setTextContent(selector, value) {
  document.querySelectorAll(selector).forEach((node) => {
    node.textContent = value;
  });
}

function formatDescription(value) {
  return getLocalizedValue(value)
    .split("\n")
    .filter(Boolean)
    .join(" ");
}

function formatCalendarDate(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (num) => String(num).padStart(2, "0");
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    "T",
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
    "Z",
  ].join("");
}

function getCalendarConfigForEvent(event) {
  if (!event) return null;

  const calendar = event.calendar || {};
  const start = calendar.start || event.startDateTime || event.start || null;
  const end = calendar.end || event.endDateTime || event.end || start;
  if (!start || !end) return null;

  return {
    title: getLocalizedValue(calendar.title || event.title),
    details: formatDescription(calendar.description || event.description),
    location: getLocalizedValue(calendar.location || event.venue),
    start,
    end,
  };
}

function buildGoogleCalendarUrl(event) {
  const calendar = getCalendarConfigForEvent(event);
  if (!calendar) return "";

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: calendar.title,
    dates: `${formatCalendarDate(calendar.start)}/${formatCalendarDate(calendar.end)}`,
    details: calendar.details,
    location: calendar.location,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function getLatestEventByCalendar(events = []) {
  return [...events]
    .filter((event) => getCalendarConfigForEvent(event)?.start)
    .sort((a, b) => {
      const aStart = new Date(getCalendarConfigForEvent(a)?.start || 0).getTime();
      const bStart = new Date(getCalendarConfigForEvent(b)?.start || 0).getTime();
      return bStart - aStart;
    })[0];
}

function getCountdownCalendarTarget() {
  const latestEvent = getLatestEventByCalendar(weddingData?.events || []);
  const weddingDate = weddingData?.weddingDate ? new Date(weddingData.weddingDate) : null;

  if (weddingDate && !Number.isNaN(weddingDate.getTime())) {
    const weddingEvent =
      weddingData?.events?.find((event) => event.id === "wedding") ||
      latestEvent;
    const fallbackEnd = new Date(weddingDate.getTime() + 2 * 60 * 60 * 1000);

    return {
      title: weddingEvent?.title || weddingData?.meta?.title || "Wedding Celebration",
      venue: weddingEvent?.venue || "",
      description: weddingEvent?.description || "",
      calendar: {
        start: weddingDate.toISOString(),
        end:
          getCalendarConfigForEvent(weddingEvent)?.end ||
          fallbackEnd.toISOString(),
      },
    };
  }

  return latestEvent || null;
}

function renderLanguageButtons() {
  const wrapper = document.getElementById("lang-toggle-wrapper");
  if (!wrapper || !weddingData) return;

  wrapper.innerHTML = "";

  weddingData.availableLanguages.forEach((lang) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `lang-btn${lang === currentLang ? " active" : ""}`;
    button.dataset.lang = lang;
    button.textContent =
      weddingData.languageLabels?.[lang] ||
      lang.toUpperCase();
    button.addEventListener("click", (event) => {
      event.preventDefault();
      setLanguage(lang);
    });
    wrapper.appendChild(button);
  });
}

function renderCoupleNames() {
  const coupleEl = document.querySelector(".couple-names");
  if (!coupleEl || !weddingData?.couple) return;

  const orderedSides = getOrderedSides();
  const names = orderedSides.map((side) => {
    const key = side === "groom" ? "groomName" : "brideName";
    return getLocalizedValue(weddingData.couple[key]);
  });
  const wedsText =
    getLocalizedValue(weddingData.ui?.[currentLang]?.weds || weddingData.ui?.en?.weds || "Weds");

  coupleEl.innerHTML = `
    <span class="couple-name-line">${names[0]}</span>
    <span class="amp weds-line" data-i18n="weds">${wedsText}</span>
    <span class="couple-name-line">${names[1]}</span>
  `;
}

function renderTagline() {
  const taglineEl = document.querySelector('[data-field="tagline"]');
  if (!taglineEl || !weddingData?.couple?.tagline) return;
  taglineEl.textContent = `"${getLocalizedValue(weddingData.couple.tagline)}"`;
}

function renderFamily() {
  const grid = document.querySelector(".family-grid");
  if (!grid || !weddingData?.family) return;

  const renderFamilyGroup = (side, groupKey, info, fallbackLabel) => {
    const group = info?.[groupKey];
    if (!group) return "";

    const label = getLocalizedValue(group.label || fallbackLabel);
    const members = Array.isArray(group.members)
      ? group.members.map((member) => getLocalizedValue(member)).filter(Boolean)
      : [
          getLocalizedValue(group.father),
          getLocalizedValue(group.mother),
          getLocalizedValue(group.grandfather),
          getLocalizedValue(group.grandmother),
        ].filter(Boolean);

    if (members.length === 0) return "";

    return `
      <section class="family-group family-${groupKey}">
        <p class="family-group-label">${label}</p>
        <div class="family-members">
          ${members
            .map(
              (member, index) => `
                <div class="family-member" data-family="${side}" data-family-field="${groupKey}.${index}">
                  <span class="family-name">${member}</span>
                </div>
              `
            )
            .join("")}
        </div>
      </section>
    `;
  };

  const cards = getOrderedSides()
    .map((side) => {
      const info = weddingData.family?.[side];
      if (!info) return "";

      const parentsMarkup = renderFamilyGroup(
        side,
        "parents",
        info,
        weddingData.ui?.[currentLang]?.parentsLabel || weddingData.ui?.en?.parentsLabel || "Parents"
      );
      const grandparentsMarkup = renderFamilyGroup(
        side,
        "grandparents",
        info,
        weddingData.ui?.[currentLang]?.grandparentsLabel || weddingData.ui?.en?.grandparentsLabel || "Grandparents"
      );

      return `
        <article class="family-column family-card" data-family-side="${side}">
          <div class="family-card-glow"></div>
          <h3 class="family-side-title" data-family="${side}" data-family-field="title">${getLocalizedValue(info.title)}</h3>
          <div class="family-sections">
            ${parentsMarkup}
            ${grandparentsMarkup}
          </div>
        </article>
      `;
    })
    .join("");

  grid.innerHTML = cards;
}

function renderCountdown() {
  const dateEl = document.querySelector('[data-i18n="countdownDate"]');
  if (dateEl) {
    dateEl.textContent = getLocalizedValue(weddingData.ui?.[currentLang]?.countdownDate || weddingData.ui?.en?.countdownDate || "");
  }

  const countdownTarget = getCountdownCalendarTarget();
  const calendarLink = document.getElementById("countdown-calendar-link");
  if (calendarLink) {
    const url = buildGoogleCalendarUrl(countdownTarget);
    if (url) {
      calendarLink.href = url;
      calendarLink.style.display = "inline-flex";
    } else {
      calendarLink.style.display = "none";
    }
  }
}

function renderEvents() {
  const wrapper = document.getElementById("tl-wrapper");
  if (!wrapper || !Array.isArray(weddingData?.events)) return;

  wrapper.innerHTML = `${weddingData.events
    .map((event) => {
      return `
        <div class="tl-row" data-event-id="${event.id}">
          <div class="tl-left">
            <div class="tl-dot-wrap"><div class="tl-dot-outer"><div class="tl-dot-inner"></div></div></div>
            <h3 class="tl-title" data-event-field="title">${getLocalizedValue(event.title)}</h3>
          </div>
          <div class="tl-right">
            <div class="tl-card">
              <h3 class="tl-card-title-mobile" data-event-field="title">${getLocalizedValue(event.title)}</h3>
              <p class="tl-detail"><strong data-event-field="date">${getLocalizedValue(event.date)}</strong></p>
              <p class="tl-detail" data-event-field="time">${getLocalizedValue(event.time)}</p>
              <p class="tl-detail tl-venue">📍 <span data-event-field="venue">${getLocalizedValue(event.venue)}</span></p>
              <p class="tl-desc" data-event-field="description">${getLocalizedValue(event.description)}</p>
            </div>
          </div>
        </div>
      `;
    })
    .join("")}
    <div class="tl-line-bg"><div class="tl-line-progress" id="tl-line-progress"></div></div>`;
}

function populateGallery() {
  const container = document.getElementById("gallery-sticky");
  if (!container || !Array.isArray(weddingData?.gallery) || weddingData.gallery.length === 0) return;

  const centerImg = weddingData.gallery.find((img) => img.center) || weddingData.gallery[0];
  const others = weddingData.gallery.filter((img) => img !== centerImg);

  container.innerHTML = `
    <div class="parallax-element" data-scale-end="4">
      <div class="parallax-img-wrap center-img">
        <img src="${centerImg.src}" alt="${getLocalizedValue(centerImg.alt)}">
      </div>
    </div>
    ${others
      .slice(0, 6)
      .map((img, idx) => {
        const slotNum = idx + 1;
        const scaleEnd = slotNum % 2 === 0 ? 6 : 5;
        return `
          <div class="parallax-element" data-scale-end="${scaleEnd}">
            <div class="parallax-img-wrap img-${slotNum}">
              <img src="${img.src}" alt="${getLocalizedValue(img.alt)}">
            </div>
          </div>
        `;
      })
      .join("")}
  `;
}

function applyUITranslations() {
  const uiStrings = weddingData.ui?.[currentLang] || weddingData.ui?.[getFallbackLanguage()] || {};

  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.getAttribute("data-i18n");
    if (!key) return;
    const value = uiStrings[key] ?? weddingData.ui?.en?.[key];
    if (typeof value === "string") {
      node.textContent = value;
    }
  });
}

function applyRsvpTranslations() {
  const rsvpData = weddingData.rsvp || {};
  document.querySelectorAll("[data-rsvp]").forEach((node) => {
    const field = node.getAttribute("data-rsvp");
    const value = getLocalizedValue(rsvpData[field]);
    if (!value) return;

    if (node.tagName === "INPUT") {
      node.placeholder = value;
      return;
    }

    node.textContent = value;
  });
}

function updateSectionVisibility() {
  const sections = weddingData.sections || {};
  const mappings = [
    [".family-section", sections.family],
    [".gallery-section", sections.gallery],
    [".countdown-section", sections.countdown],
    [".events-section", sections.events],
    ["#react-map-root", sections.map],
    [".rsvp-section", sections.rsvp],
  ];

  mappings.forEach(([selector, enabled]) => {
    const node = document.querySelector(selector);
    if (node) {
      node.style.display = enabled === false ? "none" : "";
    }
  });
}

function applyThemeFont() {
  const languageFonts = weddingData.languageFonts || {};
  const baseLang = currentLang.split("-")[0];
  const langFont =
    languageFonts[currentLang] ||
    languageFonts[baseLang] ||
    weddingData.defaultFontFamily ||
    "var(--font-body)";
  document.body.style.fontFamily = langFont;
}

function updateMeta() {
  document.documentElement.lang = currentLang;

  const title = getLocalizedValue(weddingData.meta?.title || "");
  if (title) document.title = title;

  const description = getLocalizedValue(weddingData.meta?.description || "");
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc && description) {
    metaDesc.setAttribute("content", description);
  }
}

function dispatchLanguageChange() {
  window.dispatchEvent(
    new CustomEvent("wedding-language-change", {
      detail: {
        lang: currentLang,
      },
    })
  );
}

function renderLocalizedContent() {
  if (!weddingData) return;
  renderLanguageButtons();
  applyUITranslations();
  renderCoupleNames();
  renderTagline();
  renderFamily();
  renderCountdown();
  renderEvents();
  applyRsvpTranslations();
  applyThemeFont();
  updateMeta();
  dispatchLanguageChange();
}

function normalizeData(data) {
  const availableLanguages = getAvailableLanguagesFromData(data);
  return {
    ...data,
    availableLanguages,
    defaultLanguage: data.defaultLanguage || availableLanguages[0] || "en",
    isGroomSide: typeof data.isGroomSide === "boolean" ? data.isGroomSide : true,
    languageFonts: data.languageFonts || {
      hi: "'Noto Sans Devanagari', 'Noto Serif Devanagari', 'Cormorant Garamond', serif",
      te: "'Noto Sans Telugu', 'Cormorant Garamond', serif",
      en: "'Cormorant Garamond', serif",
    },
    calendar: data.calendar || {},
  };
}

export async function loadWeddingData() {
  if (weddingData) return weddingData;
  const response = await fetch("/weddingData.json");
  const data = await response.json();
  weddingData = normalizeData(data);
  currentLang = weddingData.defaultLanguage;
  return weddingData;
}

export function getData() {
  return weddingData;
}

export function getCurrentLang() {
  return currentLang;
}

export function setLanguage(lang) {
  if (!weddingData) return;
  currentLang = weddingData.availableLanguages.includes(lang) ? lang : getFallbackLanguage();
  renderLocalizedContent();
}

export function populateFromData() {
  if (!weddingData) return;
  updateSectionVisibility();
  populateGallery();
  renderLocalizedContent();
}
