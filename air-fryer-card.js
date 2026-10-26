/*! Air Fryer Card — compact glass card for an air fryer in Home Assistant · MIT · github.com/stathisktm/air-fryer-card */

const AF_VERSION = "2.0.0";

const AF_DEFAULTS = {
  title: "Φριτέζα Αέρος",

  entity_power: "switch.air_fryer_power",
  entity_play: "switch.air_fryer_play",
  entity_status: "sensor.air_fryer_status",
  entity_time_remaining: "sensor.air_fryer_time_remaining",
  entity_current_temp: "sensor.air_fryer_current_temp",
  entity_program: "select.air_fryer_programma",
  entity_target_temp: "number.air_fryer_target_temp",
  entity_target_time: "number.air_fryer_target_time",

  temp_min: 80,
  temp_max: 220,
  temp_step: 5,

  time_min: 1,
  time_max: 60,
  time_step: 1,

  theme: "",

  color_off: "linear-gradient(135deg, #2114d7, #4682B4)",
  color_on_pause: "linear-gradient(135deg, #f59e0b, #b45309)",
  color_on_play: "linear-gradient(135deg, #22c55e, #15803d)",

  color_program: "linear-gradient(135deg, #2114d7, #4682B4)",
  color_slider: "#4682B4",
  color_play: "#22c55e",
};

const AF_STATUS = {
  on: "Ενεργή", off: "Ανενεργή", idle: "Αναμονή", standby: "Αναμονή",
  cooking: "Μαγείρεμα", running: "Σε λειτουργία", paused: "Παύση", pause: "Παύση",
  ready: "Έτοιμη", preheating: "Προθέρμανση", heating: "Θέρμανση",
  finished: "Ολοκληρώθηκε", done: "Ολοκληρώθηκε", complete: "Ολοκληρώθηκε",
  keep_warm: "Διατήρηση", keepwarm: "Διατήρηση", cooling: "Ψύξη",
};

const afBad = (s) => s === undefined || s === null || s === "" || s === "unknown" || s === "unavailable";

/** Remaining time as seconds, from "HH:MM:SS", "MM:SS" or a number in the sensor's own unit. */
function afSeconds(entity) {
  if (!entity || afBad(entity.state)) return null;
  const str = String(entity.state).trim();
  if (str.includes(":")) {
    const p = str.split(":").map(Number);
    if (p.some(Number.isNaN)) return null;
    return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
  }
  const n = Number(str);
  if (Number.isNaN(n)) return null;
  const unit = String(entity.attributes?.unit_of_measurement || "s").toLowerCase();
  if (unit.startsWith("h")) return n * 3600;
  if (unit.startsWith("min") || unit === "m") return n * 60;
  return n;
}

function afClock(seconds) {
  if (seconds === null || seconds === undefined) return "--:--";
  const t = Math.max(0, Math.round(seconds));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const pad = (v) => String(v).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

class AirFryerCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
    this._dragging = { temp: false, time: false };
    this._programsKey = null;
    this._total = null;
  }

  static getConfigElement() {
    return document.createElement("air-fryer-card-editor");
  }

  /** Picks the first set of entities that look like an air fryer. */
  static getStubConfig(hass) {
    const ids = Object.keys(hass?.states || {});
    const find = (domain, ...words) =>
      ids.find((id) => id.startsWith(`${domain}.`) && words.every((w) => id.includes(w)));
    const base = { ...AF_DEFAULTS };
    const guess = {
      entity_power: find("switch", "fryer", "power"),
      entity_play: find("switch", "fryer", "play") || find("switch", "fryer", "start"),
      entity_status: find("sensor", "fryer", "status"),
      entity_time_remaining: find("sensor", "fryer", "remain"),
      entity_current_temp: find("sensor", "fryer", "temp"),
      entity_program: find("select", "fryer"),
      entity_target_temp: find("number", "fryer", "temp"),
      entity_target_time: find("number", "fryer", "time"),
    };
    Object.entries(guess).forEach(([k, v]) => { if (v) base[k] = v; });
    return { title: base.title, ...Object.fromEntries(Object.entries(base).filter(([k]) => k.startsWith("entity_"))) };
  }

  setConfig(config) {
    if (!config || typeof config !== "object") throw new Error("Λάθος ρυθμίσεις κάρτας");
    this._config = { ...AF_DEFAULTS, ...config };
    this._programsKey = null;
    this._renderBase();
    if (this._hass) this._updateState();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this.shadowRoot.querySelector("ha-card")) this._renderBase();
    this._updateState();
  }

  connectedCallback() {
    // Live countdown between HA updates (the remaining-time sensor often updates once a minute).
    this._tick = setInterval(() => this._updateCountdown(), 1000);
  }

  disconnectedCallback() {
    clearInterval(this._tick);
  }

  getCardSize() {
    return 3;
  }

  getGridOptions() {
    return { columns: 6, min_columns: 4, rows: "auto" };
  }

  /* =================================================
     RENDER
     ================================================= */

  _renderBase() {
    const cfg = this._config;
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }

        /* MAIN CARD — darker transparent glass */
        ha-card {
          display: block;
          background: rgba(0, 0, 0, .28) !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.025), 0 2px 8px rgba(0,0,0,.12) !important;
          border: 1px solid rgba(255,255,255,.035) !important;
          padding: 7px 9px 8px;
          overflow: hidden;
          color: #fff !important;
        }
        .container { width: 100%; box-sizing: border-box; color: #fff; }

        /* HEADER */
        .header { display: flex; align-items: center; justify-content: space-between; height: 30px; margin-bottom: 5px; }
        .title-wrap { display: flex; align-items: center; gap: 7px; min-width: 0; cursor: pointer; }
        .title-icon { width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .title-icon ha-icon { --mdc-icon-size: 18px; color: #fff; }
        .card.cooking .title-icon ha-icon { color: #FF9D79; animation: af-glow 1.6s ease-in-out infinite; }
        @keyframes af-glow { 0%,100% { filter: drop-shadow(0 0 0 rgba(255,157,121,0)); } 50% { filter: drop-shadow(0 0 5px rgba(255,157,121,.9)); } }
        .title { font-size: 14px; font-weight: 600; line-height: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        /* POWER BUTTON */
        .power-btn {
          width: 30px; height: 30px; min-width: 30px; padding: 0; border-radius: 50%;
          border: 1px solid rgba(255,255,255,.10); background: rgba(8,8,14,.30); color: #fff;
          display: flex; align-items: center; justify-content: center; cursor: pointer;
          transition: background .18s ease, color .18s ease, transform .12s ease, border-color .18s ease;
        }
        .power-btn ha-icon { --mdc-icon-size: 17px; color: inherit; }
        .power-btn:hover { background: rgba(8,8,14,.45); }
        .power-btn:active { transform: scale(.92); }
        .power-btn.on { color: #FF9D79; border-color: rgba(255,157,121,.45); background: rgba(255,157,121,.10); }

        /* CENTRAL STATUS */
        .status-box {
          position: relative; overflow: hidden;
          min-height: 45px; padding: 6px 9px; margin-bottom: 5px;
          display: grid; grid-template-columns: minmax(0, 1fr) auto auto auto; align-items: center; gap: 8px;
          border-radius: 12px; background: var(--af-status-off); box-sizing: border-box;
          transition: box-shadow .30s ease;
        }
        .status-box::before {
          /* gradients can't transition, so each state's background fades in on its own layer */
          content: ""; position: absolute; inset: 0; z-index: 0; opacity: 0; transition: opacity .35s ease;
          background: var(--af-status-pause);
        }
        .status-box::after {
          content: ""; position: absolute; inset: 0; z-index: 0; opacity: 0; transition: opacity .35s ease;
          background: var(--af-status-play);
        }
        .status-box.pause::before { opacity: 1; }
        .status-box.play::after { opacity: 1; }
        .status-box.pause, .status-box.play { box-shadow: 0 3px 14px rgba(0,0,0,.22); }
        .status-box > * { position: relative; z-index: 1; }

        .status-info { min-width: 0; }
        .status-label { font-size: 8px; line-height: 1; opacity: .72; margin-bottom: 3px; text-transform: uppercase; letter-spacing: .35px; }
        .status { font-size: 12px; font-weight: 700; line-height: 1.05; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .metric { min-width: 42px; text-align: center; }
        .metric-value { font-size: 13px; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; }
        .metric-value .trend { font-size: 9px; opacity: .85; margin-left: 1px; }
        .metric-label { margin-top: 3px; font-size: 8px; line-height: 1; opacity: .7; }

        /* PROGRESS (remaining vs total) */
        .progress { position: absolute; left: 0; right: 0; bottom: 0; height: 3px; z-index: 1; background: rgba(255,255,255,.12); }
        .progress > i { display: block; height: 100%; width: 0; background: rgba(255,255,255,.85); border-radius: 0 3px 3px 0; transition: width .9s linear; }
        .progress.hidden { display: none; }

        /* PLAY / PAUSE */
        .play-btn {
          width: 30px; height: 30px; min-width: 30px; padding: 0; border: 0; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          background: rgba(255,255,255,.17); color: #fff; cursor: pointer;
          transition: background .18s ease, transform .12s ease;
        }
        .play-btn:hover { background: rgba(255,255,255,.28); }
        .play-btn:active { transform: scale(.92); }
        .play-btn ha-icon { --mdc-icon-size: 17px; color: #fff; }

        /* PROGRAM BUTTONS — dark transparent glass */
        .programs { display: flex; gap: 4px; overflow-x: auto; scrollbar-width: none; padding: 0; margin: 0 0 5px; }
        .programs::-webkit-scrollbar { display: none; }
        .programs:empty { display: none; }
        .program {
          height: 25px; padding: 0 9px; border: 1px solid rgba(255,255,255,.11); border-radius: 8px;
          background: rgba(8,8,14,.42); color: #fff; font: inherit; font-size: 9px; font-weight: 600;
          white-space: nowrap; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.035), 0 1px 4px rgba(0,0,0,.20);
          transition: background .18s ease, border-color .18s ease, transform .12s ease;
        }
        .program:hover { background: rgba(8,8,14,.52); border-color: rgba(255,255,255,.20); }
        .program:active { transform: scale(.96); }
        .program.active { background: var(--af-program); border-color: transparent; box-shadow: 0 2px 7px rgba(33,20,215,.25); }

        /* SETTINGS */
        .settings { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; }
        .setting {
          min-width: 0; padding: 5px 8px; border-radius: 10px; background: rgba(8,8,14,.42);
          border: 1px solid rgba(255,255,255,.09); box-sizing: border-box;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.035), 0 1px 4px rgba(0,0,0,.20);
        }
        .setting.hidden { display: none; }
        .setting-top { display: flex; justify-content: space-between; align-items: center; gap: 5px; margin-bottom: 2px; }
        .setting-label { font-size: 8px; white-space: nowrap; }
        .setting-value { font-size: 10px; font-weight: 700; white-space: nowrap; font-variant-numeric: tabular-nums; }

        /* SLIDERS */
        input[type="range"] { width: 100%; height: 15px; margin: 0; padding: 0; appearance: none; -webkit-appearance: none; background: transparent; cursor: pointer; }
        input[type="range"]::-webkit-slider-runnable-track { height: 4px; border-radius: 4px; background: rgba(255,255,255,.14); }
        input[type="range"]::-webkit-slider-thumb {
          appearance: none; -webkit-appearance: none; width: 12px; height: 12px; margin-top: -4px; border-radius: 50%;
          border: 2px solid rgba(8,8,14,.80); background: var(--af-slider); box-shadow: 0 1px 3px rgba(0,0,0,.45);
        }
        input[type="range"]::-moz-range-track { height: 4px; border-radius: 4px; background: rgba(255,255,255,.14); }
        input[type="range"]::-moz-range-thumb { width: 10px; height: 10px; border-radius: 50%; border: 2px solid rgba(8,8,14,.80); background: var(--af-slider); }

        /* POWERED OFF: everything but the power button rests */
        .card.off .programs, .card.off .settings { opacity: .55; }

        .warning { font-size: 9px; opacity: .75; padding: 2px 2px 0; }

        @media (max-width: 420px) {
          ha-card { padding: 6px 8px 7px; }
          .status-box { gap: 5px; }
          .metric { min-width: 38px; }
          .settings { gap: 4px; }
          .setting { padding-left: 7px; padding-right: 7px; }
        }
      </style>

      <ha-card>
        <div class="container card">

          <div class="header">
            <div class="title-wrap" title="Περισσότερα">
              <div class="title-icon"><ha-icon icon="mdi:air-fryer"></ha-icon></div>
              <div class="title"></div>
            </div>
            <button class="power-btn" type="button" title="Ενεργοποίηση / απενεργοποίηση">
              <ha-icon icon="mdi:power"></ha-icon>
            </button>
          </div>

          <div class="status-box">
            <div class="status-info">
              <div class="status-label">Κατάσταση</div>
              <div class="status">—</div>
            </div>
            <div class="metric">
              <div class="metric-value remaining">--:--</div>
              <div class="metric-label">ΧΡΟΝΟΣ</div>
            </div>
            <div class="metric">
              <div class="metric-value current-temp">--°</div>
              <div class="metric-label">ΘΕΡΜ.</div>
            </div>
            <button class="play-btn" type="button" title="Έναρξη / παύση">
              <ha-icon icon="mdi:play"></ha-icon>
            </button>
            <div class="progress hidden"><i></i></div>
          </div>

          <div class="programs"></div>

          <div class="settings">
            <div class="setting temp-setting">
              <div class="setting-top">
                <span class="setting-label">Θερμοκρασία</span>
                <span class="setting-value target-temp">--°C</span>
              </div>
              <input class="temp-slider" type="range" min="${cfg.temp_min}" max="${cfg.temp_max}" step="${cfg.temp_step}">
            </div>
            <div class="setting time-setting">
              <div class="setting-top">
                <span class="setting-label">Χρόνος</span>
                <span class="setting-value target-time">-- min</span>
              </div>
              <input class="time-slider" type="range" min="${cfg.time_min}" max="${cfg.time_max}" step="${cfg.time_step}">
            </div>
          </div>

          <div class="warning" hidden></div>
        </div>
      </ha-card>
    `;
    this._programsKey = null;
    this._bindEvents();
    this._applyTheme();
  }

  _applyTheme() {
    const card = this.shadowRoot.querySelector("ha-card");
    if (!card) return;
    const cfg = this._config;
    const set = (name, value, fallback) => card.style.setProperty(name, value || fallback);
    set("--af-status-off", cfg.color_off, AF_DEFAULTS.color_off);
    set("--af-status-pause", cfg.color_on_pause, AF_DEFAULTS.color_on_pause);
    set("--af-status-play", cfg.color_on_play, AF_DEFAULTS.color_on_play);
    set("--af-program", cfg.color_program, AF_DEFAULTS.color_program);
    set("--af-slider", cfg.color_slider, AF_DEFAULTS.color_slider);
    set("--af-play", cfg.color_play, AF_DEFAULTS.color_play);
  }

  _bindEvents() {
    const root = this.shadowRoot;
    root.querySelector(".power-btn").addEventListener("click", () => this._toggleEntity(this._config.entity_power));
    root.querySelector(".play-btn").addEventListener("click", () => this._toggleEntity(this._config.entity_play));
    root.querySelector(".title-wrap").addEventListener("click", () =>
      this._moreInfo(this._config.entity_status || this._config.entity_power));

    const slider = (cls, label, key, format, setter) => {
      const el = root.querySelector(cls);
      el.addEventListener("pointerdown", () => { this._dragging[key] = true; });
      el.addEventListener("input", (e) => {
        this._dragging[key] = true;
        root.querySelector(label).textContent = format(e.target.value);
      });
      el.addEventListener("change", (e) => {
        this._dragging[key] = false;
        setter(Number(e.target.value));
        this._haptic();
      });
    };
    slider(".temp-slider", ".target-temp", "temp", (v) => `${v}°C`, (v) => this._setTargetTemperature(v));
    slider(".time-slider", ".target-time", "time", (v) => `${v} min`, (v) => this._setTargetTime(v));
  }

  /* =================================================
     ACTIONS
     ================================================= */

  _haptic(kind = "light") {
    this.dispatchEvent(new CustomEvent("haptic", { detail: kind, bubbles: true, composed: true }));
  }

  _moreInfo(entityId) {
    if (!entityId) return;
    this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
  }

  _toggleEntity(entityId) {
    const state = this._getState(entityId);
    if (!this._hass || !state) return;
    const domain = entityId.split(".")[0];
    if (["switch", "input_boolean", "light", "fan"].includes(domain)) {
      this._hass.callService(domain, state.state === "on" ? "turn_off" : "turn_on", { entity_id: entityId });
    } else if (domain === "button" || domain === "input_button") {
      this._hass.callService(domain, "press", { entity_id: entityId });
    } else if (domain === "script") {
      this._hass.callService("script", "turn_on", { entity_id: entityId });
    }
    this._haptic();
  }

  _setNumber(entityId, value) {
    if (!this._hass || !entityId) return;
    const domain = entityId.split(".")[0];
    if (domain === "number" || domain === "input_number") {
      this._hass.callService(domain, "set_value", { entity_id: entityId, value });
    } else if (domain === "climate") {
      this._hass.callService("climate", "set_temperature", { entity_id: entityId, temperature: value });
    }
  }

  _setTargetTemperature(value) {
    this._setNumber(this._config.entity_target_temp, value);
  }

  _setTargetTime(value) {
    this._setNumber(this._config.entity_target_time, value);
  }

  /* =================================================
     STATE
     ================================================= */

  _getState(entityId) {
    if (!this._hass || !entityId) return null;
    return this._hass.states[entityId] || null;
  }

  _translateStatus(value) {
    const key = String(value).toLowerCase().trim().replace(/\s+/g, "_");
    return AF_STATUS[key] || value;
  }

  _updateState() {
    if (!this._hass || !this.shadowRoot.querySelector("ha-card")) return;
    const root = this.shadowRoot;
    const cfg = this._config;

    root.querySelector(".title").textContent = cfg.title || AF_DEFAULTS.title;

    const power = this._getState(cfg.entity_power);
    const powerOn = power?.state === "on";
    const play = this._getState(cfg.entity_play);
    const playOn = play?.state === "on";
    const status = this._getState(cfg.entity_status);

    const missing = [cfg.entity_power, cfg.entity_play].filter((id) => id && !this._getState(id));
    const warning = root.querySelector(".warning");
    warning.hidden = missing.length === 0;
    warning.textContent = missing.length ? `Δεν βρέθηκε: ${missing.join(", ")}` : "";

    const card = root.querySelector(".card");
    card.classList.toggle("off", !powerOn);
    card.classList.toggle("cooking", powerOn && playOn);

    root.querySelector(".power-btn").classList.toggle("on", powerOn);
    root.querySelector(".play-btn ha-icon").setAttribute("icon", playOn ? "mdi:pause" : "mdi:play");

    let statusText = status?.state;
    if (afBad(statusText)) statusText = powerOn ? (playOn ? "Μαγείρεμα" : "Ενεργή") : "Ανενεργή";
    root.querySelector(".status").textContent = this._translateStatus(statusText);

    // OFF -> color_off · ON + PAUSE -> color_on_pause · ON + PLAY -> color_on_play
    const box = root.querySelector(".status-box");
    box.classList.toggle("pause", powerOn && !playOn);
    box.classList.toggle("play", powerOn && playOn);

    // Current temperature, with an arrow while it's still climbing toward the target.
    const currentTemp = this._getState(cfg.entity_current_temp);
    const targetTemp = this._getState(cfg.entity_target_temp);
    const ct = currentTemp && !afBad(currentTemp.state) ? Number(currentTemp.state) : NaN;
    const tt = targetTemp && !afBad(targetTemp.state) ? Number(targetTemp.state) : NaN;
    const heatingUp = powerOn && playOn && !Number.isNaN(ct) && !Number.isNaN(tt) && ct < tt - 3;
    root.querySelector(".current-temp").innerHTML = Number.isNaN(ct)
      ? "--°"
      : `${Math.round(ct)}°${heatingUp ? '<span class="trend">▲</span>' : ""}`;

    // Remaining time: remember where the sensor stood and when, so the clock can keep ticking.
    const remaining = this._getState(cfg.entity_time_remaining);
    const secs = afSeconds(remaining);
    this._remain = secs === null ? null : { secs, at: new Date(remaining.last_updated || remaining.last_changed).getTime(), running: powerOn && playOn };
    const targetTime = this._getState(cfg.entity_target_time);
    const totalFromTarget = targetTime && !afBad(targetTime.state) ? Number(targetTime.state) * 60 : null;
    if (secs !== null) {
      if (!powerOn || secs <= 0) this._total = null;
      else this._total = Math.max(this._total || 0, totalFromTarget || 0, secs);
    }
    this._updateCountdown();

    this._updatePrograms();

    // Targets — never yank a slider out from under a finger.
    if (!Number.isNaN(tt) && !this._dragging.temp) {
      root.querySelector(".temp-slider").value = tt;
      root.querySelector(".target-temp").textContent = `${tt}°C`;
    }
    root.querySelector(".temp-setting").classList.toggle("hidden", !cfg.entity_target_temp);
    if (targetTime && !afBad(targetTime.state) && !this._dragging.time) {
      const v = Number(targetTime.state);
      root.querySelector(".time-slider").value = v;
      root.querySelector(".target-time").textContent = `${v} min`;
    }
    root.querySelector(".time-setting").classList.toggle("hidden", !cfg.entity_target_time);
  }

  _updateCountdown() {
    const root = this.shadowRoot;
    const el = root.querySelector(".remaining");
    if (!el) return;
    const r = this._remain;
    let secs = r ? r.secs : null;
    if (r && r.running && Number.isFinite(r.at)) {
      // The sensor's own value can lag up to its update interval; never count past the next one.
      secs = Math.max(0, r.secs - (Date.now() - r.at) / 1000);
    }
    el.textContent = afClock(secs);

    const progress = root.querySelector(".progress");
    const total = this._total;
    const show = secs !== null && total && total > 0 && secs < total;
    progress.classList.toggle("hidden", !show);
    if (show) progress.firstElementChild.style.width = `${Math.min(100, Math.max(0, (1 - secs / total) * 100))}%`;
  }

  _updatePrograms() {
    const container = this.shadowRoot.querySelector(".programs");
    const entity = this._getState(this._config.entity_program);
    const options = entity?.attributes?.options || [];
    const key = JSON.stringify([options, entity?.state]);
    // Rebuild only when something actually changed — avoids flicker and lost taps.
    if (key === this._programsKey) return;
    this._programsKey = key;
    container.innerHTML = "";
    options.forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "program" + (option === entity.state ? " active" : "");
      button.textContent = option;
      button.addEventListener("click", () => {
        const domain = this._config.entity_program.split(".")[0];
        this._hass.callService(domain, "select_option", { entity_id: this._config.entity_program, option });
        this._haptic();
      });
      container.appendChild(button);
    });
    container.querySelector(".active")?.scrollIntoView?.({ block: "nearest", inline: "center" });
  }
}

/* =========================================================
   VISUAL EDITOR
   ========================================================= */

const AF_LABELS = {
  title: "Τίτλος",
  entity_power: "Τροφοδοσία (on/off)",
  entity_play: "Έναρξη / παύση",
  entity_status: "Κατάσταση",
  entity_time_remaining: "Χρόνος που απομένει",
  entity_current_temp: "Τρέχουσα θερμοκρασία",
  entity_program: "Πρόγραμμα",
  entity_target_temp: "Θερμοκρασία στόχος",
  entity_target_time: "Χρόνος στόχος (λεπτά)",
  temp_min: "Θερμ. ελάχιστη", temp_max: "Θερμ. μέγιστη", temp_step: "Θερμ. βήμα",
  time_min: "Χρόνος ελάχιστος", time_max: "Χρόνος μέγιστος", time_step: "Χρόνος βήμα",
  color_off: "Κατάσταση: σβηστή", color_on_pause: "Κατάσταση: σε παύση", color_on_play: "Κατάσταση: μαγειρεύει",
  color_program: "Ενεργό πρόγραμμα", color_slider: "Μπάρες", color_play: "Κουμπί play",
};

const afEntity = (name, domains) => ({ name, selector: { entity: { filter: { domain: domains } } } });
const afNumber = (name, max) => ({ name, selector: { number: { min: 0, max, mode: "box" } } });

const AF_SCHEMA = [
  { name: "title", selector: { text: {} } },
  {
    type: "expandable", title: "Οντότητες", icon: "mdi:air-fryer", expanded: true,
    schema: [
      afEntity("entity_power", ["switch", "input_boolean"]),
      afEntity("entity_play", ["switch", "input_boolean", "button", "input_button", "script"]),
      afEntity("entity_status", ["sensor", "select", "input_select"]),
      afEntity("entity_time_remaining", ["sensor", "number", "input_number", "timer"]),
      afEntity("entity_current_temp", ["sensor", "number"]),
      afEntity("entity_program", ["select", "input_select"]),
      afEntity("entity_target_temp", ["number", "input_number", "climate"]),
      afEntity("entity_target_time", ["number", "input_number"]),
    ],
  },
  {
    type: "expandable", title: "Όρια", icon: "mdi:tune-variant",
    schema: [
      { type: "grid", name: "", schema: [afNumber("temp_min", 400), afNumber("temp_max", 400), afNumber("temp_step", 50)] },
      { type: "grid", name: "", schema: [afNumber("time_min", 600), afNumber("time_max", 600), afNumber("time_step", 60)] },
    ],
  },
  {
    type: "expandable", title: "Χρώματα (χρώμα ή CSS gradient)", icon: "mdi:palette",
    schema: ["color_off", "color_on_pause", "color_on_play", "color_program", "color_slider", "color_play"]
      .map((name) => ({ name, selector: { text: {} } })),
  },
];

class AirFryerCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._form) this._form.hass = hass;
  }

  async _render() {
    if (!this._form) {
      // ha-form and the entity picker are lazy-loaded by HA; loading any card editor pulls them in.
      if (!customElements.get("ha-form") && window.loadCardHelpers) {
        const helpers = await window.loadCardHelpers();
        const c = await helpers.createCardElement({ type: "entities", entities: [] });
        await c.constructor.getConfigElement?.();
      }
      this._form = document.createElement("ha-form");
      this._form.computeLabel = (s) => AF_LABELS[s.name] ?? s.name;
      this._form.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        this._config = { ...this._config, ...ev.detail.value };
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this._config }, bubbles: true, composed: true }));
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.schema = AF_SCHEMA;
    this._form.data = { ...AF_DEFAULTS, ...this._config };
  }
}

if (!customElements.get("air-fryer-card")) customElements.define("air-fryer-card", AirFryerCard);
if (!customElements.get("air-fryer-card-editor")) customElements.define("air-fryer-card-editor", AirFryerCardEditor);

window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c.type === "air-fryer-card")) {
  window.customCards.push({
    type: "air-fryer-card",
    name: "Air Fryer Card",
    description: "Συμπαγής κάρτα φριτέζας αέρος: κατάσταση, ζωντανή αντίστροφη μέτρηση, προγράμματα, θερμοκρασία και χρόνος.",
    preview: true,
    documentationURL: "https://github.com/stathisktm/air-fryer-card",
  });
}

console.info(`%c AIR-FRYER-CARD %c ${AF_VERSION} `, "background:#15803d;color:#fff;border-radius:3px 0 0 3px;padding:1px 4px", "background:#222;color:#fff;border-radius:0 3px 3px 0;padding:1px 4px");
