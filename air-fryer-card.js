class AirFryerCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass = null;
  }

  setConfig(config) {
    this._config = {
      title: 'Φριτέζα Αέρος',

      entity_power: 'switch.air_fryer_power',
      entity_play: 'switch.air_fryer_play',
      entity_status: 'sensor.air_fryer_status',
      entity_time_remaining: 'sensor.air_fryer_time_remaining',
      entity_current_temp: 'sensor.air_fryer_current_temp',
      entity_program: 'select.air_fryer_programma',
      entity_target_temp: 'number.air_fryer_target_temp',
      entity_target_time: 'number.air_fryer_target_time',

      temp_min: 80,
      temp_max: 220,
      temp_step: 5,

      time_min: 1,
      time_max: 60,
      time_step: 1,

      theme: '',

      color_off: 'linear-gradient(135deg, #2114d7, #4682B4)',
      color_on_pause: 'linear-gradient(135deg, #f59e0b, #b45309)',
      color_on_play: 'linear-gradient(135deg, #22c55e, #15803d)',

      color_program: 'linear-gradient(135deg, #2114d7, #4682B4)',
      color_slider: '#4682B4',
      color_play: '#22c55e',

      ...config
    };

    this._renderBase();
  }

  set hass(hass) {
    this._hass = hass;

    if (!this.shadowRoot.querySelector('ha-card')) {
      this._renderBase();
    }

    this._applyTheme();
    this._updateState();
  }

  _applyTheme() {
    const card = this.shadowRoot.querySelector('ha-card');

    if (!card) return;

    const cfg = this._config;

    card.style.setProperty(
      '--af-status-off',
      cfg.color_off ||
      'linear-gradient(135deg, #2114d7, #4682B4)'
    );

    card.style.setProperty(
      '--af-status-pause',
      cfg.color_on_pause ||
      'linear-gradient(135deg, #f59e0b, #b45309)'
    );

    card.style.setProperty(
      '--af-status-play',
      cfg.color_on_play ||
      'linear-gradient(135deg, #22c55e, #15803d)'
    );

    card.style.setProperty(
      '--af-program',
      cfg.color_program ||
      'linear-gradient(135deg, #2114d7, #4682B4)'
    );

    card.style.setProperty(
      '--af-slider',
      cfg.color_slider || '#4682B4'
    );

    card.style.setProperty(
      '--af-play',
      cfg.color_play || '#22c55e'
    );
  }

  _renderBase() {
    const cfg = this._config;

    this.shadowRoot.innerHTML = `
      <style>

        :host {
          display: block;
        }

        /* =================================================
           MAIN CARD
           DARKER TRANSPARENT GLASS
           ================================================= */

        ha-card {
          background: rgba(0, 0, 0, .28) !important;

          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.025),
            0 2px 8px rgba(0,0,0,.12) !important;

          border: 1px solid rgba(255,255,255,.035) !important;

          padding: 7px 9px 8px;

          overflow: hidden;

          color: #fff !important;

          --af-status-off: ${cfg.color_off};
          --af-status-pause: ${cfg.color_on_pause};
          --af-status-play: ${cfg.color_on_play};
          --af-program: ${cfg.color_program};
          --af-slider: ${cfg.color_slider};
          --af-play: ${cfg.color_play};
        }

        .container {
          width: 100%;
          box-sizing: border-box;
          color: #fff !important;
        }

        /* =================================================
           HEADER
           ================================================= */

        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;

          height: 30px;

          margin-bottom: 5px;
        }

        .title-wrap {
          display: flex;
          align-items: center;

          gap: 7px;

          min-width: 0;
        }

        .title-icon {
          width: 18px;
          height: 18px;

          display: flex;
          align-items: center;
          justify-content: center;

          color: #fff !important;

          flex-shrink: 0;
        }

        .title-icon ha-icon {
          --mdc-icon-size: 18px;
          color: #fff !important;
        }

        .title {
          font-size: 14px;
          font-weight: 600;
          line-height: 1;

          color: #fff !important;

          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* =================================================
           POWER BUTTON
           ================================================= */

        .power-btn {
          width: 30px;
          height: 30px;
          min-width: 30px;

          padding: 0;

          border-radius: 50%;

          border: 1px solid rgba(255,255,255,.10);

          background: rgba(8,8,14,.30);

          color: #fff !important;

          display: flex;
          align-items: center;
          justify-content: center;

          cursor: pointer;

          transition:
            background .18s ease,
            color .18s ease,
            transform .12s ease,
            border-color .18s ease;
        }

        .power-btn ha-icon {
          --mdc-icon-size: 17px;
          color: inherit !important;
        }

        .power-btn:hover {
          background: rgba(8,8,14,.45);
        }

        .power-btn:active {
          transform: scale(.92);
        }

        .power-btn.on {
          color: #FF9D79 !important;

          border-color: rgba(255,157,121,.45);

          background: rgba(255,157,121,.10);
        }

        /* =================================================
           CENTRAL STATUS
           ================================================= */

        .status-box {
          min-height: 45px;

          padding: 6px 9px;

          margin-bottom: 5px;

          display: grid;

          grid-template-columns:
            minmax(0, 1fr)
            auto
            auto
            auto;

          align-items: center;

          gap: 8px;

          border-radius: 12px;

          background: var(--af-status-off);

          color: #fff !important;

          box-sizing: border-box;

          transition:
            background .30s ease,
            box-shadow .30s ease;
        }

        .status-box.pause {
          background: var(--af-status-pause);

          box-shadow:
            0 3px 14px rgba(178,34,34,.22);
        }

        .status-box.play {
          background: var(--af-status-play);

          box-shadow:
            0 3px 14px rgba(178,34,34,.22);
        }

        .status-info {
          min-width: 0;
        }

        .status-label {
          font-size: 8px;

          line-height: 1;

          color: #fff !important;

          opacity: .72;

          margin-bottom: 3px;

          text-transform: uppercase;

          letter-spacing: .35px;
        }

        .status {
          font-size: 12px;

          font-weight: 700;

          line-height: 1.05;

          color: #fff !important;

          white-space: nowrap;

          overflow: hidden;

          text-overflow: ellipsis;
        }

        .metric {
          min-width: 42px;

          text-align: center;

          color: #fff !important;
        }

        .metric-value {
          font-size: 13px;

          font-weight: 700;

          line-height: 1;

          color: #fff !important;
        }

        .metric-label {
          margin-top: 3px;

          font-size: 8px;

          line-height: 1;

          color: #fff !important;

          opacity: .7;
        }

        /* =================================================
           PLAY / PAUSE
           ================================================= */

        .play-btn {
          width: 30px;
          height: 30px;
          min-width: 30px;

          padding: 0;

          border: 0;

          border-radius: 50%;

          display: flex;
          align-items: center;
          justify-content: center;

          background: rgba(255,255,255,.17);

          color: #fff !important;

          cursor: pointer;

          transition:
            background .18s ease,
            transform .12s ease;
        }

        .play-btn:hover {
          background: rgba(255,255,255,.28);
        }

        .play-btn:active {
          transform: scale(.92);
        }

        .play-btn ha-icon {
          --mdc-icon-size: 17px;
          color: #fff !important;
        }

        /* =================================================
           PROGRAM BUTTONS
           DARK TRANSPARENT GLASS
           ================================================= */

        .programs {
          display: flex;

          gap: 4px;

          overflow-x: auto;

          scrollbar-width: none;

          padding: 0;

          margin: 0 0 5px;
        }

        .programs::-webkit-scrollbar {
          display: none;
        }

        .program {
          height: 25px;

          padding: 0 9px;

          border: 1px solid rgba(255,255,255,.11);

          border-radius: 8px;

          background: rgba(8,8,14,.42);

          color: #fff !important;

          font-size: 9px;

          font-weight: 600;

          white-space: nowrap;

          display: flex;

          align-items: center;
          justify-content: center;

          cursor: pointer;

          flex-shrink: 0;

          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.035),
            0 1px 4px rgba(0,0,0,.20);

          transition:
            background .18s ease,
            color .18s ease,
            border-color .18s ease,
            transform .12s ease;
        }

        .program:hover {
          background: rgba(8,8,14,.52);

          border-color: rgba(255,255,255,.20);
        }

        .program:active {
          transform: scale(.96);
        }

        .program.active {
          background: var(--af-program);

          color: #fff !important;

          border-color: transparent;

          box-shadow:
            0 2px 7px rgba(33,20,215,.25);
        }

        /* =================================================
           SETTINGS
           DARK TRANSPARENT GLASS
           ================================================= */

        .settings {
          display: grid;

          grid-template-columns: 1fr 1fr;

          gap: 5px;
        }

        .setting {
          min-width: 0;

          padding: 5px 8px 5px;

          border-radius: 10px;

          background: rgba(8,8,14,.42);

          border: 1px solid rgba(255,255,255,.09);

          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.035),
            0 1px 4px rgba(0,0,0,.20);

          box-sizing: border-box;

          color: #fff !important;
        }

        .setting-top {
          display: flex;

          justify-content: space-between;

          align-items: center;

          gap: 5px;

          margin-bottom: 2px;
        }

        .setting-label {
          font-size: 8px;

          color: #fff !important;

          white-space: nowrap;
        }

        .setting-value {
          font-size: 10px;

          font-weight: 700;

          color: #fff !important;

          white-space: nowrap;
        }

        /* =================================================
           SLIDERS
           ================================================= */

        input[type="range"] {
          width: 100%;

          height: 15px;

          margin: 0;

          padding: 0;

          appearance: none;

          -webkit-appearance: none;

          background: transparent;

          cursor: pointer;
        }

        input[type="range"]::-webkit-slider-runnable-track {
          height: 4px;

          border-radius: 4px;

          background: rgba(255,255,255,.14);
        }

        input[type="range"]::-webkit-slider-thumb {
          appearance: none;

          -webkit-appearance: none;

          width: 12px;
          height: 12px;

          margin-top: -4px;

          border-radius: 50%;

          border: 2px solid rgba(8,8,14,.80);

          background: var(--af-slider);

          box-shadow:
            0 1px 3px rgba(0,0,0,.45);
        }

        input[type="range"]::-moz-range-track {
          height: 4px;

          border-radius: 4px;

          background: rgba(255,255,255,.14);
        }

        input[type="range"]::-moz-range-thumb {
          width: 10px;
          height: 10px;

          border-radius: 50%;

          border: 2px solid rgba(8,8,14,.80);

          background: var(--af-slider);
        }

        /* =================================================
           MOBILE
           ================================================= */

        @media (max-width: 420px) {

          ha-card {
            padding: 6px 8px 7px;
          }

          .status-box {
            gap: 5px;
          }

          .metric {
            min-width: 38px;
          }

          .settings {
            gap: 4px;
          }

          .setting {
            padding-left: 7px;
            padding-right: 7px;
          }
        }

      </style>

      <ha-card>

        <div class="container">

          <div class="header">

            <div class="title-wrap">

              <div class="title-icon">
                <ha-icon icon="mdi:air-fryer"></ha-icon>
              </div>

              <div class="title"></div>

            </div>

            <button
              class="power-btn"
              type="button"
            >
              <ha-icon icon="mdi:power"></ha-icon>
            </button>

          </div>


          <div class="status-box">

            <div class="status-info">

              <div class="status-label">
                Κατάσταση
              </div>

              <div class="status">
                —
              </div>

            </div>

            <div class="metric">

              <div class="metric-value remaining">
                --:--
              </div>

              <div class="metric-label">
                ΧΡΟΝΟΣ
              </div>

            </div>

            <div class="metric">

              <div class="metric-value current-temp">
                --°
              </div>

              <div class="metric-label">
                ΘΕΡΜ.
              </div>

            </div>

            <button
              class="play-btn"
              type="button"
            >
              <ha-icon icon="mdi:play"></ha-icon>
            </button>

          </div>


          <div class="programs"></div>


          <div class="settings">

            <div class="setting">

              <div class="setting-top">

                <span class="setting-label">
                  Θερμοκρασία
                </span>

                <span class="setting-value target-temp">
                  --°C
                </span>

              </div>

              <input
                class="temp-slider"
                type="range"
                min="${cfg.temp_min}"
                max="${cfg.temp_max}"
                step="${cfg.temp_step}"
              >

            </div>


            <div class="setting">

              <div class="setting-top">

                <span class="setting-label">
                  Χρόνος
                </span>

                <span class="setting-value target-time">
                  -- min
                </span>

              </div>

              <input
                class="time-slider"
                type="range"
                min="${cfg.time_min}"
                max="${cfg.time_max}"
                step="${cfg.time_step}"
              >

            </div>

          </div>

        </div>

      </ha-card>
    `;

    this._bindEvents();
    this._applyTheme();
  }

  _bindEvents() {
    const root = this.shadowRoot;

    root.querySelector('.power-btn').addEventListener(
      'click',
      () => {
        this._toggleEntity(
          this._config.entity_power
        );
      }
    );

    root.querySelector('.play-btn').addEventListener(
      'click',
      () => {
        this._toggleEntity(
          this._config.entity_play
        );
      }
    );

    const tempSlider =
      root.querySelector('.temp-slider');

    tempSlider.addEventListener(
      'input',
      e => {
        root.querySelector(
          '.target-temp'
        ).textContent =
          `${e.target.value}°C`;
      }
    );

    tempSlider.addEventListener(
      'change',
      e => {
        this._setTargetTemperature(
          Number(e.target.value)
        );
      }
    );

    const timeSlider =
      root.querySelector('.time-slider');

    timeSlider.addEventListener(
      'input',
      e => {
        root.querySelector(
          '.target-time'
        ).textContent =
          `${e.target.value} min`;
      }
    );

    timeSlider.addEventListener(
      'change',
      e => {
        this._setTargetTime(
          Number(e.target.value)
        );
      }
    );
  }

  _toggleEntity(entityId) {
    if (!this._hass || !entityId) {
      return;
    }

    const state =
      this._hass.states[entityId];

    if (!state) {
      return;
    }

    const domain =
      entityId.split('.')[0];

    if (
      domain === 'switch' ||
      domain === 'input_boolean'
    ) {
      this._hass.callService(
        domain,
        state.state === 'on'
          ? 'turn_off'
          : 'turn_on',
        {
          entity_id: entityId
        }
      );
    }
  }

  _setTargetTemperature(value) {
    if (!this._hass) {
      return;
    }

    const entityId =
      this._config.entity_target_temp;

    if (!entityId) {
      return;
    }

    const domain =
      entityId.split('.')[0];

    if (
      domain === 'number' ||
      domain === 'input_number'
    ) {
      this._hass.callService(
        domain,
        'set_value',
        {
          entity_id: entityId,
          value: value
        }
      );
    }

    if (domain === 'climate') {
      this._hass.callService(
        domain,
        'set_temperature',
        {
          entity_id: entityId,
          temperature: value
        }
      );
    }
  }

  _setTargetTime(value) {
    if (!this._hass) {
      return;
    }

    const entityId =
      this._config.entity_target_time;

    if (!entityId) {
      return;
    }

    const domain =
      entityId.split('.')[0];

    if (
      domain === 'number' ||
      domain === 'input_number'
    ) {
      this._hass.callService(
        domain,
        'set_value',
        {
          entity_id: entityId,
          value: value
        }
      );
    }
  }

  _getState(entityId) {
    if (
      !this._hass ||
      !entityId
    ) {
      return null;
    }

    return (
      this._hass.states[entityId] ||
      null
    );
  }

  _formatTime(value) {
    if (
      value === undefined ||
      value === null ||
      value === '' ||
      value === 'unknown' ||
      value === 'unavailable'
    ) {
      return '--:--';
    }

    const str =
      String(value).trim();

    if (str.includes(':')) {
      const parts =
        str.split(':').map(Number);

      if (parts.length === 3) {
        const h =
          String(parts[0]).padStart(2, '0');

        const m =
          String(parts[1]).padStart(2, '0');

        const s =
          String(parts[2]).padStart(2, '0');

        if (Number(parts[0]) > 0) {
          return `${h}:${m}:${s}`;
        }

        return `${m}:${s}`;
      }

      if (parts.length === 2) {
        return (
          `${String(parts[0]).padStart(2, '0')}:` +
          `${String(parts[1]).padStart(2, '0')}`
        );
      }
    }

    const seconds =
      Number(value);

    if (!Number.isNaN(seconds)) {
      const total =
        Math.max(
          0,
          Math.round(seconds)
        );

      const minutes =
        Math.floor(total / 60);

      const secs =
        total % 60;

      if (minutes >= 60) {
        const hours =
          Math.floor(minutes / 60);

        const mins =
          minutes % 60;

        return (
          `${String(hours).padStart(2, '0')}:` +
          `${String(mins).padStart(2, '0')}:` +
          `${String(secs).padStart(2, '0')}`
        );
      }

      return (
        `${String(minutes).padStart(2, '0')}:` +
        `${String(secs).padStart(2, '0')}`
      );
    }

    return str;
  }

  _translateStatus(value) {
    const map = {
      on: 'Ενεργή',
      off: 'Ανενεργή',
      idle: 'Αναμονή',
      standby: 'Αναμονή',
      cooking: 'Μαγείρεμα',
      running: 'Σε λειτουργία',
      paused: 'Παύση',
      ready: 'Έτοιμη',
      preheating: 'Προθέρμανση',
      heating: 'Θέρμανση',
      finished: 'Ολοκληρώθηκε',
      done: 'Ολοκληρώθηκε'
    };

    const key =
      String(value)
        .toLowerCase()
        .trim();

    return map[key] || value;
  }

  _isHeatState(
    powerState,
    statusState,
    playState
  ) {
    const values = [
      powerState,
      statusState,
      playState
    ]
      .filter(Boolean)
      .map(
        value =>
          String(value)
            .toLowerCase()
            .trim()
      );

    return values.some(
      value =>
        [
          'on',
          'cooking',
          'running',
          'heating',
          'preheating'
        ].includes(value)
    );
  }

  _updateState() {
    if (!this._hass) {
      return;
    }

    const root =
      this.shadowRoot;

    const cfg =
      this._config;

    root.querySelector(
      '.title'
    ).textContent =
      cfg.title ||
      'Φριτέζα Αέρος';

    const power =
      this._getState(
        cfg.entity_power
      );

    const powerState =
      power?.state ||
      'off';

    const powerOn =
      powerState === 'on';

    root.querySelector(
      '.power-btn'
    ).classList.toggle(
      'on',
      powerOn
    );

    const play =
      this._getState(
        cfg.entity_play
      );

    const playState =
      play?.state ||
      'off';

    const playOn =
      playState === 'on';

    root.querySelector(
      '.play-btn ha-icon'
    ).setAttribute(
      'icon',
      playOn
        ? 'mdi:pause'
        : 'mdi:play'
    );

    const status =
      this._getState(
        cfg.entity_status
      );

    let statusText =
      status?.state ??
      '—';

    if (
      !statusText ||
      statusText === 'unknown' ||
      statusText === 'unavailable'
    ) {
      statusText =
        powerOn
          ? 'Ενεργή'
          : 'Ανενεργή';
    }

    const statusState =
      status?.state ||
      'off';

    const statusBox =
      root.querySelector(
        '.status-box'
      );

    /* =================================================
       STATUS COLORS

       OFF       -> color_off
       ON PAUSE  -> color_on_pause
       ON PLAY   -> color_on_play
       ================================================= */

    statusBox.classList.remove(
      'pause',
      'play'
    );

    if (!powerOn) {
      // OFF
      // No extra class.
      // Base background = --af-status-off
    } else if (playOn) {
      // ON + PLAY
      statusBox.classList.add(
        'play'
      );
    } else {
      // ON + PAUSE
      statusBox.classList.add(
        'pause'
      );
    }

    root.querySelector(
      '.status'
    ).textContent =
      this._translateStatus(
        statusText
      );

    const remaining =
      this._getState(
        cfg.entity_time_remaining
      );

    root.querySelector(
      '.remaining'
    ).textContent =
      this._formatTime(
        remaining?.state
      );

    const currentTemp =
      this._getState(
        cfg.entity_current_temp
      );

    if (
      currentTemp &&
      currentTemp.state !== 'unknown' &&
      currentTemp.state !== 'unavailable'
    ) {
      const temp =
        Number(
          currentTemp.state
        );

      root.querySelector(
        '.current-temp'
      ).textContent =
        Number.isNaN(temp)
          ? '--°'
          : `${Math.round(temp)}°`;
    } else {
      root.querySelector(
        '.current-temp'
      ).textContent =
        '--°';
    }

    this._updatePrograms();

    const targetTemp =
      this._getState(
        cfg.entity_target_temp
      );

    if (
      targetTemp &&
      targetTemp.state !== 'unknown' &&
      targetTemp.state !== 'unavailable'
    ) {
      const value =
        Number(
          targetTemp.state
        );

      root.querySelector(
        '.temp-slider'
      ).value =
        value;

      root.querySelector(
        '.target-temp'
      ).textContent =
        `${value}°C`;
    }

    const targetTime =
      this._getState(
        cfg.entity_target_time
      );

    if (
      targetTime &&
      targetTime.state !== 'unknown' &&
      targetTime.state !== 'unavailable'
    ) {
      const value =
        Number(
          targetTime.state
        );

      root.querySelector(
        '.time-slider'
      ).value =
        value;

      root.querySelector(
        '.target-time'
      ).textContent =
        `${value} min`;
    }
  }

  _updatePrograms() {
    const container =
      this.shadowRoot.querySelector(
        '.programs'
      );

    const entity =
      this._getState(
        this._config.entity_program
      );

    if (
      !container ||
      !entity
    ) {
      return;
    }

    const options =
      entity.attributes?.options ||
      [];

    const current =
      entity.state;

    if (!options.length) {
      container.innerHTML =
        '';

      return;
    }

    container.innerHTML =
      '';

    options.forEach(option => {
      const button =
        document.createElement(
          'button'
        );

      button.className =
        'program';

      if (option === current) {
        button.classList.add(
          'active'
        );
      }

      button.type =
        'button';

      button.textContent =
        option;

      button.addEventListener(
        'click',
        () => {
          this._hass.callService(
            'select',
            'select_option',
            {
              entity_id:
                this._config.entity_program,

              option:
                option
            }
          );
        }
      );

      container.appendChild(
        button
      );
    });
  }

  getCardSize() {
    return 3;
  }
}

if (
  !customElements.get(
    'air-fryer-card'
  )
) {
  customElements.define(
    'air-fryer-card',
    AirFryerCard
  );
}

window.customCards =
  window.customCards || [];

if (
  !window.customCards.some(
    card =>
      card.type ===
      'air-fryer-card'
  )
) {
  window.customCards.push({
    type:
      'air-fryer-card',

    name:
      'Air Fryer Card',

    description:
      'Compact transparent Air Fryer card',

    preview:
      true
  });
}