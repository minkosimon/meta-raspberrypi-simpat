/**
 * Freenove Projects Board for Raspberry Pi — Dashboard
 * Browser-ready bundle without JSX build step.
 */
const { useState, useEffect, useRef, useCallback } = React;
const h = React.createElement;

function buildWebSocketUrl() {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const host = window.location.host || `${window.location.hostname}:8080`;
  return `${protocol}://${host}/ws`;
}

/* ===================================================================
 *  WebSocket hook
 * =================================================================== */
function useWebSocket(url) {
  const [ready, setReady] = useState(false);
  const wsRef = useRef(null);
  const idRef = useRef(0);
  const cbMap = useRef({});

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState <= 1) return;
    const ws = new WebSocket(url);
    ws.onopen = () => setReady(true);
    ws.onclose = () => setReady(false);
    ws.onerror = () => ws.close();
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        const cb = cbMap.current[msg.id];
        if (cb) {
          cb(msg);
          delete cbMap.current[msg.id];
        }
      } catch {}
    };
    wsRef.current = ws;
  }, [url]);

  const disconnect = useCallback(() => {
    if (wsRef.current) wsRef.current.close();
  }, []);

  const logsRef = useRef([]);
  const logListeners = useRef(new Set());
  const addLog = useCallback((entry) => {
    logsRef.current = [...logsRef.current.slice(-499), entry];
    logListeners.current.forEach((fn) => fn(logsRef.current));
  }, []);

  const send = useCallback(
    (action, params = {}) => {
      return new Promise((resolve) => {
        const ts = new Date().toISOString().slice(11, 23);
        addLog({ ts, dir: "out", action, data: params });
        if (!wsRef.current || wsRef.current.readyState !== 1) {
          addLog({
            ts: new Date().toISOString().slice(11, 23),
            dir: "err",
            action,
            data: "not connected",
          });
          resolve({ status: "error", message: "not connected" });
          return;
        }
        const id = String(++idRef.current);
        cbMap.current[id] = (msg) => {
          addLog({
            ts: new Date().toISOString().slice(11, 23),
            dir: msg.status === "ok" ? "in" : "err",
            action,
            data: msg.data || msg.message,
          });
          resolve(msg);
        };
        wsRef.current.send(JSON.stringify({ id, action, params }));
        setTimeout(() => {
          if (cbMap.current[id]) {
            addLog({
              ts: new Date().toISOString().slice(11, 23),
              dir: "err",
              action,
              data: "timeout",
            });
            cbMap.current[id]({ status: "error", message: "timeout" });
            delete cbMap.current[id];
          }
        }, 30000);
      });
    },
    [addLog],
  );

  return { ready, connect, disconnect, send, logsRef, logListeners };
}

/* ===================================================================
 *  HELPERS
 * =================================================================== */
function Card({ icon, title, badge, children }) {
  return h(
    "div",
    { className: "card" },
    h(
      "div",
      { className: "card-header" },
      h("span", { className: "icon" }, icon),
      " " + title,
      badge && h("span", { className: "pin-badge" }, badge),
    ),
    h("div", { className: "card-body" }, children),
  );
}
function Section({ title }) {
  return h("div", { className: "section-title" }, title);
}

/* ===================================================================
 *  CONNECTION BAR
 * =================================================================== */
function ConnectionBar({ ws }) {
  return h(
    "div",
    { className: "conn-bar" },
    h("span", { className: "status-dot " + (ws.ready ? "on" : "off") }),
    h(
      "span",
      {
        style: { fontSize: ".82rem", color: ws.ready ? "#22c55e" : "#ef4444" },
      },
      "WS " + (ws.ready ? "OK" : "OFF"),
    ),
    !ws.ready
      ? h(
          "button",
          { className: "btn sm", onClick: ws.connect },
          "Connecter WS",
        )
      : h(
          "button",
          { className: "btn sm danger", onClick: ws.disconnect },
          "Deconnecter WS",
        ),
    h(
      "span",
      {
        style: { marginLeft: 8, fontSize: ".78rem", color: "var(--text-dim)" },
      },
      "Commandes materiel via WebSocket",
    ),
  );
}

/* ===================================================================
 *  1. BLUE LED  (GPIO17)
 * =================================================================== */
function BlueLedPanel({ ws, disabled }) {
  const [led, setLed] = useState(0);
  const [on, setOn] = useState(false);
  const [lastCmd, setLastCmd] = useState("");
  const [output, setOutput] = useState("");

  const refreshStatus = async (ledIndex = led) => {
    const res = await ws.send("freenove_led_status", { led: ledIndex });
    if (res.status === "ok" && res.data) {
      setLastCmd(res.data.command || "");
      const result = res.data.result || {};
      if (typeof result.stdout === "string") {
        const m = result.stdout.match(/brightness=(\d+)/);
        if (m) setOn(m[1] === "1");
      }
      setOutput(JSON.stringify(result, null, 2));
    } else {
      setOutput(JSON.stringify(res, null, 2));
    }
  };

  const setLedValue = async (value) => {
    const res = await ws.send("freenove_led_set", { led, value });
    if (res.status === "ok" && res.data) {
      setLastCmd(res.data.command || "");
      const result = res.data.result || {};
      if (result.returncode === 0) setOn(value === 1);
      setOutput(JSON.stringify(result, null, 2));
      await refreshStatus(led);
      return;
    }
    setOutput(JSON.stringify(res, null, 2));
  };

  const setTrigger = async (trigger) => {
    const res = await ws.send("freenove_led_trigger", { led, trigger });
    if (res.status === "ok" && res.data) {
      setLastCmd(res.data.command || "");
      setOutput(JSON.stringify(res.data.result || res.data, null, 2));
      await refreshStatus(led);
      return;
    }
    setOutput(JSON.stringify(res, null, 2));
  };

  useEffect(() => {
    if (ws.ready) refreshStatus(led);
  }, [ws.ready, led]);

  return h(
    Card,
    { icon: "🔵", title: "Blue LED", badge: "GPIO17" },
    h(
      "div",
      { className: "field-row" },
      h(
        "div",
        { className: "field", style: { flex: 1 } },
        h("label", null, "LED index (freenove:ledX)"),
        h("input", {
          type: "number",
          min: 0,
          max: 31,
          value: led,
          onChange: (e) =>
            setLed(Math.max(0, Math.min(31, +e.target.value || 0))),
        }),
      ),
      h(
        "button",
        { className: "btn sm", onClick: () => refreshStatus(led), disabled },
        "Status",
      ),
    ),
    h(
      "div",
      { style: { display: "flex", gap: 8, marginBottom: 8 } },
      h(
        "button",
        { className: "btn success", onClick: () => setLedValue(1), disabled },
        "Allumer",
      ),
      h(
        "button",
        { className: "btn danger", onClick: () => setLedValue(0), disabled },
        "Eteindre",
      ),
    ),
    h(
      "div",
      { style: { display: "flex", gap: 8 } },
      h(
        "button",
        { className: "btn sm", onClick: () => setTrigger("timer"), disabled },
        "Trigger timer",
      ),
      h(
        "button",
        { className: "btn sm", onClick: () => setTrigger("none"), disabled },
        "Trigger none",
      ),
    ),
    h(
      "div",
      { style: { marginTop: 8, fontSize: ".8rem", color: "var(--text-dim)" } },
      "Etat courant: ",
      h(
        "strong",
        { style: { color: on ? "#22c55e" : "#ef4444" } },
        on ? "ON" : "OFF",
      ),
    ),
    lastCmd &&
      h(
        "div",
        { className: "output", style: { marginTop: 8 } },
        "$ " + lastCmd,
      ),
    output && h("div", { className: "output" }, output),
  );
}

/* ===================================================================
 *  2. RGB LED  (GPIO5=R, GPIO6=G, GPIO13=B)
 * =================================================================== */
function RgbLedPanel({ ws, disabled }) {
  const [r, setR] = useState(0);
  const [g, setG] = useState(0);
  const [b, setB] = useState(0);
  const [output, setOutput] = useState("");
  const send = async () => {
    const res = await ws.send("led_rgb", {
      r_pin: 5,
      g_pin: 6,
      b_pin: 13,
      r,
      g,
      b,
    });
    setOutput(JSON.stringify(res.data, null, 2));
  };
  return h(
    Card,
    { icon: "🌈", title: "RGB LED", badge: "GPIO5/6/13" },
    h("div", {
      className: "color-preview",
      style: { background: "rgb(" + r + "," + g + "," + b + ")" },
    }),
    h(
      "div",
      { className: "field" },
      h("label", null, "Rouge: " + r),
      h("input", {
        type: "range",
        min: 0,
        max: 255,
        value: r,
        onChange: (e) => setR(+e.target.value),
      }),
    ),
    h(
      "div",
      { className: "field" },
      h("label", null, "Vert: " + g),
      h("input", {
        type: "range",
        min: 0,
        max: 255,
        value: g,
        onChange: (e) => setG(+e.target.value),
      }),
    ),
    h(
      "div",
      { className: "field" },
      h("label", null, "Bleu: " + b),
      h("input", {
        type: "range",
        min: 0,
        max: 255,
        value: b,
        onChange: (e) => setB(+e.target.value),
      }),
    ),
    h(
      "button",
      { className: "btn", onClick: send, disabled, style: { width: "100%" } },
      "Appliquer",
    ),
    output && h("div", { className: "output" }, output),
  );
}

/* ===================================================================
 *  3. WS2812 LED  (GPIO18)
 * =================================================================== */
function Ws2812Panel({ ws, disabled }) {
  const [count, setCount] = useState(8);
  const [r, setR] = useState(0);
  const [g, setG] = useState(128);
  const [b, setB] = useState(255);
  const [output, setOutput] = useState("");
  const send = async () => {
    const res = await ws.send("ws2812_set", { count, r, g, b });
    setOutput(JSON.stringify(res.data, null, 2));
  };
  return h(
    Card,
    { icon: "💎", title: "WS2812 LED", badge: "GPIO18" },
    h(
      "div",
      { className: "ws-strip" },
      Array.from({ length: count }, (_, i) =>
        h("div", {
          key: i,
          className: "ws-led",
          style: { background: "rgb(" + r + "," + g + "," + b + ")" },
        }),
      ),
    ),
    h(
      "div",
      { className: "field" },
      h("label", null, "Nombre LEDs: " + count),
      h("input", {
        type: "range",
        min: 1,
        max: 16,
        value: count,
        onChange: (e) => setCount(+e.target.value),
      }),
    ),
    h(
      "div",
      { className: "field" },
      h("label", null, "R: " + r),
      h("input", {
        type: "range",
        min: 0,
        max: 255,
        value: r,
        onChange: (e) => setR(+e.target.value),
      }),
    ),
    h(
      "div",
      { className: "field" },
      h("label", null, "G: " + g),
      h("input", {
        type: "range",
        min: 0,
        max: 255,
        value: g,
        onChange: (e) => setG(+e.target.value),
      }),
    ),
    h(
      "div",
      { className: "field" },
      h("label", null, "B: " + b),
      h("input", {
        type: "range",
        min: 0,
        max: 255,
        value: b,
        onChange: (e) => setB(+e.target.value),
      }),
    ),
    h(
      "button",
      { className: "btn", onClick: send, disabled, style: { width: "100%" } },
      "Appliquer",
    ),
    output && h("div", { className: "output" }, output),
  );
}

/* ===================================================================
 *  4. LED MATRIX 8x8  (74HC595: GPIO17/GPIO27/GPIO22)
 * =================================================================== */
function LedMatrixPanel({ ws, disabled }) {
  const [grid, setGrid] = useState(Array(64).fill(false));
  const [output, setOutput] = useState("");
  const [presetKey, setPresetKey] = useState("smile");
  const [scrollText, setScrollText] = useState("HELLO");
  const [scrollSpeed, setScrollSpeed] = useState(180);
  const [scrolling, setScrolling] = useState(false);
  const scrollStopRef = useRef(false);
  const presets = [
    {
      key: "smile",
      label: "Smile",
      rows: [0x3c, 0x42, 0xa5, 0x81, 0xa5, 0x99, 0x42, 0x3c],
    },
    {
      key: "heart",
      label: "Coeur",
      rows: [0x00, 0x66, 0xff, 0xff, 0xff, 0x7e, 0x3c, 0x18],
    },
    {
      key: "arrow",
      label: "Fleche",
      rows: [0x18, 0x3c, 0x7e, 0xff, 0x18, 0x18, 0x18, 0x18],
    },
    {
      key: "cross",
      label: "Croix",
      rows: [0x81, 0x42, 0x24, 0x18, 0x18, 0x24, 0x42, 0x81],
    },
    {
      key: "plus",
      label: "Plus",
      rows: [0x18, 0x18, 0x18, 0xff, 0xff, 0x18, 0x18, 0x18],
    },
    {
      key: "triangle",
      label: "Triangle",
      rows: [0x18, 0x3c, 0x66, 0xc3, 0xff, 0x81, 0x81, 0x00],
    },
    {
      key: "diamond",
      label: "Losange",
      rows: [0x18, 0x3c, 0x66, 0xc3, 0xc3, 0x66, 0x3c, 0x18],
    },
    {
      key: "star",
      label: "Etoile",
      rows: [0x18, 0x99, 0x5a, 0x3c, 0x3c, 0x5a, 0x99, 0x18],
    },
    {
      key: "circle",
      label: "Cercle",
      rows: [0x3c, 0x42, 0x81, 0x81, 0x81, 0x81, 0x42, 0x3c],
    },
    {
      key: "house",
      label: "Maison",
      rows: [0x18, 0x3c, 0x66, 0xc3, 0xff, 0xdb, 0xdb, 0x00],
    },
    {
      key: "check",
      label: "Check",
      rows: [0x00, 0x01, 0x03, 0x86, 0xcc, 0x78, 0x30, 0x00],
    },
    {
      key: "checker",
      label: "Damier",
      rows: [0xaa, 0x55, 0xaa, 0x55, 0xaa, 0x55, 0xaa, 0x55],
    },
    {
      key: "frame",
      label: "Cadre",
      rows: [0xff, 0x81, 0x81, 0x81, 0x81, 0x81, 0x81, 0xff],
    },
    {
      key: "wave",
      label: "Vague",
      rows: [0x80, 0xc1, 0x63, 0x36, 0x1c, 0x36, 0x63, 0xc1],
    },
    {
      key: "digit0",
      label: "0",
      rows: [0x3c, 0x66, 0xc3, 0xdb, 0xdb, 0xc3, 0x66, 0x3c],
    },
    {
      key: "digit1",
      label: "1",
      rows: [0x18, 0x38, 0x18, 0x18, 0x18, 0x18, 0x3c, 0x3c],
    },
    {
      key: "digit2",
      label: "2",
      rows: [0x3c, 0x66, 0x06, 0x0c, 0x18, 0x30, 0x7e, 0x7e],
    },
    {
      key: "digit3",
      label: "3",
      rows: [0x3c, 0x66, 0x06, 0x1c, 0x06, 0x06, 0x66, 0x3c],
    },
    {
      key: "digit4",
      label: "4",
      rows: [0x0c, 0x1c, 0x3c, 0x6c, 0xcc, 0xfe, 0x0c, 0x0c],
    },
    {
      key: "digit5",
      label: "5",
      rows: [0x7e, 0x60, 0x60, 0x7c, 0x06, 0x06, 0x66, 0x3c],
    },
    {
      key: "digit6",
      label: "6",
      rows: [0x1c, 0x30, 0x60, 0x7c, 0x66, 0x66, 0x66, 0x3c],
    },
    {
      key: "digit7",
      label: "7",
      rows: [0x7e, 0x66, 0x06, 0x0c, 0x18, 0x18, 0x18, 0x18],
    },
    {
      key: "digit8",
      label: "8",
      rows: [0x3c, 0x66, 0x66, 0x3c, 0x66, 0x66, 0x66, 0x3c],
    },
    {
      key: "digit9",
      label: "9",
      rows: [0x3c, 0x66, 0x66, 0x66, 0x3e, 0x06, 0x0c, 0x38],
    },
    {
      key: "letterA",
      label: "A",
      rows: [0x18, 0x24, 0x42, 0x7e, 0x42, 0x42, 0x42, 0x00],
    },
    {
      key: "letterB",
      label: "B",
      rows: [0x7c, 0x42, 0x42, 0x7c, 0x42, 0x42, 0x7c, 0x00],
    },
    {
      key: "letterC",
      label: "C",
      rows: [0x3c, 0x42, 0x40, 0x40, 0x40, 0x42, 0x3c, 0x00],
    },
    {
      key: "letterD",
      label: "D",
      rows: [0x78, 0x44, 0x42, 0x42, 0x42, 0x44, 0x78, 0x00],
    },
    {
      key: "letterE",
      label: "E",
      rows: [0x7e, 0x40, 0x40, 0x7c, 0x40, 0x40, 0x7e, 0x00],
    },
    {
      key: "letterF",
      label: "F",
      rows: [0x7e, 0x40, 0x40, 0x7c, 0x40, 0x40, 0x40, 0x00],
    },
    {
      key: "letterG",
      label: "G",
      rows: [0x3c, 0x42, 0x40, 0x4e, 0x42, 0x42, 0x3c, 0x00],
    },
    {
      key: "letterH",
      label: "H",
      rows: [0x42, 0x42, 0x42, 0x7e, 0x42, 0x42, 0x42, 0x00],
    },
    {
      key: "letterI",
      label: "I",
      rows: [0x3c, 0x18, 0x18, 0x18, 0x18, 0x18, 0x3c, 0x00],
    },
    {
      key: "letterJ",
      label: "J",
      rows: [0x1e, 0x04, 0x04, 0x04, 0x44, 0x44, 0x38, 0x00],
    },
    {
      key: "letterK",
      label: "K",
      rows: [0x42, 0x44, 0x48, 0x70, 0x48, 0x44, 0x42, 0x00],
    },
    {
      key: "letterL",
      label: "L",
      rows: [0x40, 0x40, 0x40, 0x40, 0x40, 0x40, 0x7e, 0x00],
    },
    {
      key: "letterM",
      label: "M",
      rows: [0x42, 0x66, 0x5a, 0x5a, 0x42, 0x42, 0x42, 0x00],
    },
    {
      key: "letterN",
      label: "N",
      rows: [0x42, 0x62, 0x52, 0x4a, 0x46, 0x42, 0x42, 0x00],
    },
    {
      key: "letterO",
      label: "O",
      rows: [0x3c, 0x42, 0x42, 0x42, 0x42, 0x42, 0x3c, 0x00],
    },
    {
      key: "letterP",
      label: "P",
      rows: [0x7c, 0x42, 0x42, 0x7c, 0x40, 0x40, 0x40, 0x00],
    },
    {
      key: "letterQ",
      label: "Q",
      rows: [0x3c, 0x42, 0x42, 0x42, 0x4a, 0x44, 0x3a, 0x00],
    },
    {
      key: "letterR",
      label: "R",
      rows: [0x7c, 0x42, 0x42, 0x7c, 0x48, 0x44, 0x42, 0x00],
    },
    {
      key: "letterS",
      label: "S",
      rows: [0x3c, 0x42, 0x40, 0x3c, 0x02, 0x42, 0x3c, 0x00],
    },
    {
      key: "letterT",
      label: "T",
      rows: [0x7e, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x00],
    },
    {
      key: "letterU",
      label: "U",
      rows: [0x42, 0x42, 0x42, 0x42, 0x42, 0x42, 0x3c, 0x00],
    },
    {
      key: "letterV",
      label: "V",
      rows: [0x42, 0x42, 0x42, 0x42, 0x42, 0x24, 0x18, 0x00],
    },
    {
      key: "letterW",
      label: "W",
      rows: [0x42, 0x42, 0x42, 0x5a, 0x5a, 0x66, 0x42, 0x00],
    },
    {
      key: "letterX",
      label: "X",
      rows: [0x42, 0x42, 0x24, 0x18, 0x24, 0x42, 0x42, 0x00],
    },
    {
      key: "letterY",
      label: "Y",
      rows: [0x42, 0x42, 0x24, 0x18, 0x18, 0x18, 0x18, 0x00],
    },
    {
      key: "letterZ",
      label: "Z",
      rows: [0x7e, 0x02, 0x04, 0x18, 0x20, 0x40, 0x7e, 0x00],
    },
  ];
  const presetMap = Object.fromEntries(
    presets.map((preset) => [preset.key, preset.rows]),
  );
  const toggle = (i) => {
    const g = [...grid];
    g[i] = !g[i];
    setGrid(g);
  };
  const sendPattern = async (rows, options = {}) => {
    const { silent = false } = options;
    const res = await ws.send("led_matrix", { pattern: rows });
    if (!silent) setOutput(JSON.stringify(res.data, null, 2));
    return res;
  };
  const send = async () => {
    const rows = [];
    for (let r = 0; r < 8; r++) {
      let val = 0;
      for (let c = 0; c < 8; c++) if (grid[r * 8 + c]) val |= 1 << (7 - c);
      rows.push(val);
    }
    await sendPattern(rows);
  };
  const clear = () => setGrid(Array(64).fill(false));
  const applyPreset = (rows) => {
    const g = Array(64).fill(false);
    rows.forEach((row, r) => {
      for (let c = 0; c < 8; c++) if (row & (1 << (7 - c))) g[r * 8 + c] = true;
    });
    setGrid(g);
  };
  const glyphRowsForChar = (char) => {
    if (char === " ") return Array(8).fill(0);
    if (/^[0-9]$/.test(char))
      return presetMap[`digit${char}`] || Array(8).fill(0);
    if (/^[A-Z]$/.test(char))
      return presetMap[`letter${char}`] || Array(8).fill(0);
    return Array(8).fill(0);
  };
  const rowsToColumns = (rows) =>
    Array.from({ length: 8 }, (_, col) => {
      let bits = 0;
      for (let row = 0; row < 8; row++) {
        if (rows[row] & (1 << (7 - col))) bits |= 1 << (7 - row);
      }
      return bits;
    });
  const columnsToRows = (columns) =>
    Array.from({ length: 8 }, (_, row) => {
      let bits = 0;
      for (let col = 0; col < 8; col++) {
        if (columns[col] & (1 << (7 - row))) bits |= 1 << (7 - col);
      }
      return bits;
    });
  const buildScrollFrames = (text) => {
    const message = (text || "").toUpperCase();
    const columns = Array(8).fill(0);
    for (const char of message) {
      columns.push(...rowsToColumns(glyphRowsForChar(char)), 0x00);
    }
    columns.push(...Array(8).fill(0));
    const frames = [];
    for (let start = 0; start <= columns.length - 8; start++) {
      frames.push(columnsToRows(columns.slice(start, start + 8)));
    }
    return frames;
  };
  const stopScroll = () => {
    scrollStopRef.current = true;
    setScrolling(false);
  };
  const startScroll = async () => {
    const frames = buildScrollFrames(scrollText);
    if (!frames.length || scrolling) return;
    scrollStopRef.current = false;
    setScrolling(true);
    setOutput(`Defilement en cours: ${frames.length} trames`);
    try {
      for (const frame of frames) {
        if (scrollStopRef.current) break;
        applyPreset(frame);
        await sendPattern(frame, { silent: true });
        await new Promise((resolve) =>
          setTimeout(resolve, Math.max(60, scrollSpeed)),
        );
      }
      setOutput(
        scrollStopRef.current ? "Defilement interrompu" : "Defilement termine",
      );
    } finally {
      setScrolling(false);
    }
  };
  useEffect(
    () => () => {
      scrollStopRef.current = true;
    },
    [],
  );
  const selectedPreset =
    presets.find((preset) => preset.key === presetKey) || presets[0];
  return h(
    Card,
    { icon: "⬜", title: "LED Matrix 8x8", badge: "74HC595" },
    h(
      "div",
      { className: "led-matrix" },
      grid.map((on, i) =>
        h("div", {
          key: i,
          className: "led-cell" + (on ? " on" : ""),
          onClick: () => !disabled && toggle(i),
        }),
      ),
    ),
    h(
      "div",
      { className: "field", style: { marginTop: 8 } },
      h("label", null, "Motif predefini"),
      h(
        "select",
        { value: presetKey, onChange: (e) => setPresetKey(e.target.value) },
        ...presets.map((preset) =>
          h("option", { key: preset.key, value: preset.key }, preset.label),
        ),
      ),
    ),
    h(
      "div",
      { style: { display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" } },
      h(
        "button",
        {
          className: "btn sm",
          onClick: () => applyPreset(selectedPreset.rows),
          disabled: scrolling,
        },
        "Charger",
      ),
      h(
        "button",
        { className: "btn sm danger", onClick: clear, disabled: scrolling },
        "Effacer",
      ),
    ),
    h(
      "div",
      { className: "field-row", style: { marginTop: 8 } },
      h(
        "div",
        { className: "field", style: { flex: 2 } },
        h("label", null, "Texte defilant"),
        h("input", {
          value: scrollText,
          onChange: (e) => setScrollText(e.target.value.toUpperCase()),
          placeholder: "HELLO",
          maxLength: 24,
          disabled: disabled || scrolling,
        }),
      ),
      h(
        "div",
        { className: "field", style: { flex: 1 } },
        h("label", null, "Vitesse (ms)"),
        h("input", {
          type: "number",
          min: 60,
          max: 1000,
          step: 20,
          value: scrollSpeed,
          onChange: (e) => setScrollSpeed(Number(e.target.value) || 180),
          disabled: disabled || scrolling,
        }),
      ),
    ),
    h(
      "div",
      { style: { display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" } },
      h(
        "button",
        {
          className: "btn sm",
          onClick: startScroll,
          disabled: disabled || scrolling,
        },
        "Defiler",
      ),
      h(
        "button",
        {
          className: "btn sm danger",
          onClick: stopScroll,
          disabled: !scrolling,
        },
        "Stop",
      ),
    ),
    h(
      "button",
      {
        className: "btn",
        onClick: send,
        disabled: disabled || scrolling,
        style: { width: "100%", marginTop: 8 },
      },
      "Envoyer",
    ),
    output && h("div", { className: "output" }, output),
  );
}

/* ===================================================================
 *  5. 7-SEGMENT DISPLAY (4 digits, 74HC595)
 * =================================================================== */
function SevenSegPanel({ ws, disabled }) {
  const [value, setValue] = useState("0000");
  const [output, setOutput] = useState("");
  const send = async () => {
    const res = await ws.send("seven_segment", { value });
    setOutput(JSON.stringify(res.data, null, 2));
  };
  const digits = value.padStart(4, " ").slice(-4).split("");
  return h(
    Card,
    { icon: "🔢", title: "Afficheur 7-Segments", badge: "74HC595" },
    h(
      "div",
      { className: "seg-display" },
      digits.map((d, i) =>
        h(
          "span",
          { key: i, className: "seg-digit" + (d === " " ? " dim" : "") },
          d === " " ? "8" : d,
        ),
      ),
    ),
    h(
      "div",
      { className: "field" },
      h("label", null, "Valeur (0-9999)"),
      h("input", {
        type: "text",
        maxLength: 4,
        value,
        onChange: (e) =>
          setValue(e.target.value.replace(/[^0-9]/g, "").slice(0, 4)),
      }),
    ),
    h(
      "div",
      { style: { display: "flex", gap: 6, marginTop: 6 } },
      h(
        "button",
        { className: "btn sm", onClick: () => setValue("1234") },
        "1234",
      ),
      h(
        "button",
        {
          className: "btn sm",
          onClick: () => setValue(String(Math.floor(Math.random() * 10000))),
        },
        "Random",
      ),
      h(
        "button",
        { className: "btn sm danger", onClick: () => setValue("0000") },
        "Reset",
      ),
    ),
    h(
      "button",
      {
        className: "btn",
        onClick: send,
        disabled,
        style: { width: "100%", marginTop: 8 },
      },
      "Afficher",
    ),
    output && h("div", { className: "output" }, output),
  );
}

/* ===================================================================
 *  6. LED BAR GRAPH (74HC595)
 * =================================================================== */
function LedBarPanel({ ws, disabled }) {
  const [level, setLevel] = useState(5);
  const [output, setOutput] = useState("");
  const [oscillating, setOscillating] = useState(false);
  const timerRef = useRef(null);
  const levelRef = useRef(level);
  const directionRef = useRef(1);

  useEffect(() => {
    levelRef.current = level;
  }, [level]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const send = async (nextLevel = level, options = {}) => {
    const { silent = false } = options;
    const res = await ws.send("led_bar", { level: nextLevel });
    if (!silent) setOutput(JSON.stringify(res.data, null, 2));
    return res;
  };

  const stopOscillation = (message = "Oscillation arretee") => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setOscillating(false);
    setOutput(message);
  };

  const scheduleNextStep = () => {
    timerRef.current = setTimeout(async () => {
      let nextLevel = levelRef.current + directionRef.current;

      if (nextLevel >= 10) {
        nextLevel = 10;
        directionRef.current = -1;
      } else if (nextLevel <= 0) {
        nextLevel = 0;
        directionRef.current = 1;
      }

      setLevel(nextLevel);
      levelRef.current = nextLevel;

      try {
        await send(nextLevel, { silent: true });
        setOutput("Oscillation en cours: niveau " + nextLevel + "/10");
      } catch (error) {
        stopOscillation("Erreur pendant l'oscillation");
        return;
      }

      if (timerRef.current) scheduleNextStep();
    }, 250);
  };

  const startOscillation = async () => {
    if (disabled || oscillating) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    directionRef.current = 1;
    levelRef.current = 0;
    setLevel(0);
    setOscillating(true);

    try {
      await send(0, { silent: true });
      setOutput("Oscillation en cours: niveau 0/10");
      scheduleNextStep();
    } catch (error) {
      stopOscillation("Erreur au demarrage de l'oscillation");
    }
  };

  return h(
    Card,
    { icon: "📊", title: "LED Bar Graph", badge: "74HC595" },
    h(
      "div",
      { className: "bar-graph" },
      Array.from({ length: 10 }, (_, i) => {
        const on = i < level;
        const cls =
          "bar-seg" +
          (on ? " on" : "") +
          (i >= 8 && on ? " danger" : i >= 6 && on ? " warn" : "");
        return h("div", {
          key: i,
          className: cls,
          onClick: () => {
            if (!oscillating) setLevel(i + 1);
          },
          style: { flex: 1 },
        });
      }),
    ),
    h(
      "div",
      { className: "field", style: { marginTop: 8 } },
      h("label", null, "Niveau: " + level + "/10"),
      h("input", {
        type: "range",
        min: 0,
        max: 10,
        value: level,
        disabled: disabled || oscillating,
        onChange: (e) => setLevel(+e.target.value),
      }),
    ),
    h(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          marginTop: 6,
        },
      },
      h(
        "button",
        {
          className: "btn",
          onClick: send,
          disabled: disabled || oscillating,
        },
        "Appliquer",
      ),
      h(
        "button",
        {
          className: "btn",
          onClick: startOscillation,
          disabled: disabled || oscillating,
        },
        "Osciller",
      ),
    ),
    h(
      "button",
      {
        className: "btn danger",
        onClick: () => stopOscillation(),
        disabled: disabled || !oscillating,
        style: { width: "100%", marginTop: 8 },
      },
      "Stop",
    ),
    output && h("div", { className: "output" }, output),
  );
}

/* ===================================================================
 *  7. SERVO  (GPIO18)
 * =================================================================== */
function ServoPanel({ ws, disabled }) {
  const [angle, setAngle] = useState(90);
  const [output, setOutput] = useState("");
  const send = async () => {
    const res = await ws.send("servo_set", { pin: 18, angle });
    setOutput(JSON.stringify(res.data, null, 2));
  };
  return h(
    Card,
    { icon: "🔄", title: "Servo Moteur", badge: "GPIO18" },
    h(
      "div",
      { className: "motor-visual" },
      h("div", {
        className: "arrow",
        style: { transform: "rotate(" + (angle - 90) * 2 + "deg)" },
      }),
    ),
    h(
      "div",
      { className: "field" },
      h("label", null, "Angle: " + angle + "\u00B0"),
      h("input", {
        type: "range",
        min: 0,
        max: 180,
        value: angle,
        onChange: (e) => setAngle(+e.target.value),
      }),
    ),
    h(
      "div",
      {
        style: {
          display: "flex",
          gap: 6,
          justifyContent: "center",
          marginTop: 4,
        },
      },
      [0, 45, 90, 135, 180].map((a) =>
        h(
          "button",
          { key: a, className: "btn sm", onClick: () => setAngle(a) },
          a + "\u00B0",
        ),
      ),
    ),
    h(
      "button",
      {
        className: "btn",
        onClick: send,
        disabled,
        style: { width: "100%", marginTop: 8 },
      },
      "Appliquer " + angle + "\u00B0",
    ),
    output && h("div", { className: "output" }, output),
  );
}

/* ===================================================================
 *  8. STEPPING MOTOR  (GPIO6/13/19/26)
 * =================================================================== */
function StepperPanel({ ws, disabled }) {
  const [steps, setSteps] = useState(100);
  const [speed, setSpeed] = useState(5);
  const [dir, setDir] = useState("cw");
  const [output, setOutput] = useState("");
  const send = async (d) => {
    const res = await ws.send("stepper_control", {
      direction: d || dir,
      steps,
      speed,
    });
    setOutput(JSON.stringify(res.data, null, 2));
  };
  return h(
    Card,
    { icon: "⚙️", title: "Moteur Pas-a-Pas", badge: "GPIO6/13/19/26" },
    h(
      "div",
      { className: "field-row" },
      h(
        "div",
        { className: "field", style: { flex: 1 } },
        h("label", null, "Pas"),
        h("input", {
          type: "number",
          min: 1,
          max: 2048,
          value: steps,
          onChange: (e) => setSteps(+e.target.value),
        }),
      ),
      h(
        "div",
        { className: "field", style: { flex: 1 } },
        h("label", null, "Vitesse (ms)"),
        h("input", {
          type: "number",
          min: 1,
          max: 50,
          value: speed,
          onChange: (e) => setSpeed(+e.target.value),
        }),
      ),
    ),
    h(
      "div",
      { style: { display: "flex", gap: 8, marginTop: 10 } },
      h(
        "button",
        {
          className: "btn",
          onClick: () => send("ccw"),
          disabled,
          style: { flex: 1 },
        },
        "\u21BA Anti-horaire",
      ),
      h(
        "button",
        {
          className: "btn",
          onClick: () => send("cw"),
          disabled,
          style: { flex: 1 },
        },
        "\u21BB Horaire",
      ),
    ),
    h(
      "button",
      {
        className: "btn danger",
        onClick: () => send("stop"),
        disabled,
        style: { width: "100%", marginTop: 6 },
      },
      "Stop",
    ),
    output && h("div", { className: "output" }, output),
  );
}

/* ===================================================================
 *  9. DC MOTOR  (GPIO18=EN, GPIO23=IN1, GPIO24=IN2)
 * =================================================================== */
function MotorPanel({ ws, disabled }) {
  const [speed, setSpeed] = useState(50);
  const [output, setOutput] = useState("");
  const send = async (dir) => {
    const res = await ws.send("motor_control", { speed, direction: dir });
    setOutput(JSON.stringify(res.data, null, 2));
  };
  return h(
    Card,
    { icon: "🔌", title: "Moteur DC", badge: "GPIO18/23/24" },
    h(
      "div",
      { className: "field" },
      h("label", null, "Vitesse: " + speed + "%"),
      h("input", {
        type: "range",
        min: 0,
        max: 100,
        value: speed,
        onChange: (e) => setSpeed(+e.target.value),
      }),
    ),
    h(
      "div",
      { style: { display: "flex", gap: 8, marginTop: 8 } },
      h(
        "button",
        {
          className: "btn success",
          onClick: () => send("forward"),
          disabled,
          style: { flex: 1 },
        },
        "\u25B6 Avant",
      ),
      h(
        "button",
        {
          className: "btn warning",
          onClick: () => send("backward"),
          disabled,
          style: { flex: 1 },
        },
        "\u25C0 Arriere",
      ),
      h(
        "button",
        { className: "btn danger", onClick: () => send("stop"), disabled },
        "Stop",
      ),
    ),
    output && h("div", { className: "output" }, output),
  );
}

/* ===================================================================
 *  10. ACTIVE BUZZER  (GPIO25)
 * =================================================================== */
function ActiveBuzzerPanel({ ws, disabled }) {
  const [on, setOn] = useState(false);
  const [output, setOutput] = useState("");
  const toggle = async () => {
    const st = on ? "off" : "on";
    const res = await ws.send("buzzer", {
      pin: 25,
      state: st,
      frequency: 0,
      duration: 0,
    });
    if (res.status === "ok") setOn(!on);
    setOutput(JSON.stringify(res.data, null, 2));
  };
  return h(
    Card,
    { icon: "🔔", title: "Buzzer Actif", badge: "GPIO25" },
    h(
      "button",
      {
        className: "toggle-big" + (on ? " active" : ""),
        onClick: toggle,
        disabled,
      },
      on ? "\uD83D\uDD0A ON" : "\uD83D\uDD07 OFF",
    ),
    output && h("div", { className: "output" }, output),
  );
}

/* ===================================================================
 *  11. PASSIVE BUZZER  (GPIO4)
 * =================================================================== */
function PassiveBuzzerPanel({ ws, disabled }) {
  const [freq, setFreq] = useState(440);
  const [dur, setDur] = useState(0.5);
  const [output, setOutput] = useState("");
  return h(
    Card,
    { icon: "🔊", title: "Buzzer Passif", badge: "GPIO4" },
    h(
      "div",
      { className: "field-row" },
      h(
        "div",
        { className: "field", style: { flex: 1 } },
        h("label", null, "Frequence (Hz)"),
        h("input", {
          type: "number",
          min: 20,
          max: 20000,
          value: freq,
          onChange: (e) => setFreq(+e.target.value),
        }),
      ),
      h(
        "div",
        { className: "field", style: { width: 80 } },
        h("label", null, "Duree (s)"),
        h("input", {
          type: "number",
          min: 0.1,
          max: 10,
          step: 0.1,
          value: dur,
          onChange: (e) => setDur(+e.target.value),
        }),
      ),
    ),
    h(
      "div",
      { style: { display: "flex", gap: 8, marginTop: 10 } },
      h(
        "button",
        {
          className: "btn success",
          disabled,
          onClick: async () => {
            const res = await ws.send("buzzer", {
              pin: 4,
              state: "tone",
              frequency: freq,
              duration: dur,
            });
            setOutput(JSON.stringify(res.data, null, 2));
          },
        },
        "\uD83D\uDD0A Jouer",
      ),
      h(
        "button",
        {
          className: "btn danger",
          disabled,
          onClick: async () => {
            const res = await ws.send("buzzer", { pin: 4, state: "off" });
            setOutput(JSON.stringify(res.data, null, 2));
          },
        },
        "\uD83D\uDD07 Stop",
      ),
    ),
    h(
      "div",
      { style: { display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" } },
      [
        { n: "Do", f: 523 },
        { n: "Re", f: 587 },
        { n: "Mi", f: 659 },
        { n: "Fa", f: 698 },
        { n: "Sol", f: 784 },
        { n: "La", f: 880 },
        { n: "Si", f: 988 },
      ].map((note) =>
        h(
          "button",
          {
            key: note.n,
            className: "btn sm",
            style: { flex: 1, minWidth: 36 },
            disabled,
            onClick: async () => {
              setFreq(note.f);
              await ws.send("buzzer", {
                pin: 4,
                state: "tone",
                frequency: note.f,
                duration: 0.3,
              });
            },
          },
          note.n,
        ),
      ),
    ),
    output && h("div", { className: "output" }, output),
  );
}

/* ===================================================================
 *  12. RELAY  (GPIO12)
 * =================================================================== */
function RelayPanel({ ws, disabled }) {
  const [on, setOn] = useState(false);
  const [output, setOutput] = useState("");
  const toggle = async () => {
    const res = await ws.send("relay_set", {
      pin: 12,
      state: on ? "off" : "on",
    });
    if (res.status === "ok") setOn(!on);
    setOutput(JSON.stringify(res.data, null, 2));
  };
  return h(
    Card,
    { icon: "\u26A1", title: "Relais", badge: "GPIO12" },
    h(
      "button",
      {
        className: "toggle-big" + (on ? " active" : ""),
        onClick: toggle,
        disabled,
      },
      on ? "FERME (ON)" : "OUVERT (OFF)",
    ),
    h(
      "p",
      { style: { fontSize: ".75rem", color: "var(--text-dim)", marginTop: 6 } },
      "Controle le circuit de puissance via le relais",
    ),
    output && h("div", { className: "output" }, output),
  );
}

/* ===================================================================
 *  13. DHT11  (GPIO23)
 * =================================================================== */
function DhtPanel({ ws, disabled }) {
  const [data, setData] = useState(null);
  const [output, setOutput] = useState("");
  const read = async () => {
    setOutput("Lecture...");
    const res = await ws.send("dht_read", { pin: 23 });
    setOutput(JSON.stringify(res.data, null, 2));
    if (res.status === "ok" && res.data.stdout)
      try {
        setData(JSON.parse(res.data.stdout));
      } catch {}
  };
  return h(
    Card,
    { icon: "🌡️", title: "DHT11 Temp/Humidite", badge: "GPIO23" },
    data &&
      h(
        "div",
        {
          style: {
            display: "flex",
            gap: 16,
            justifyContent: "center",
            marginBottom: 8,
          },
        },
        h(
          "div",
          { style: { textAlign: "center" } },
          h(
            "div",
            { className: "sensor-value", style: { color: "#ef4444" } },
            data.temperature,
            h("span", { className: "sensor-unit" }, " \u00B0C"),
          ),
          h(
            "div",
            { style: { fontSize: ".75rem", color: "var(--text-dim)" } },
            "Temperature",
          ),
        ),
        h(
          "div",
          { style: { textAlign: "center" } },
          h(
            "div",
            { className: "sensor-value", style: { color: "#38bdf8" } },
            data.humidity,
            h("span", { className: "sensor-unit" }, " %"),
          ),
          h(
            "div",
            { style: { fontSize: ".75rem", color: "var(--text-dim)" } },
            "Humidite",
          ),
        ),
      ),
    h(
      "button",
      { className: "btn", onClick: read, disabled, style: { width: "100%" } },
      "Lire capteur",
    ),
    output && h("div", { className: "output" }, output),
  );
}

/* ===================================================================
 *  14. ULTRASONIC HC-SR04
 * =================================================================== */
function UltrasonicPanel({ ws, disabled }) {
  const [data, setData] = useState(null);
  const [output, setOutput] = useState("");
  const [polling, setPolling] = useState(false);
  const timerRef = useRef(null);
  const read = async () => {
    const res = await ws.send("ultrasonic_read", {
      trig_pin: 20,
      echo_pin: 21,
    });
    setOutput(JSON.stringify(res.data, null, 2));
    if (res.status === "ok" && res.data.stdout)
      try {
        setData(JSON.parse(res.data.stdout));
      } catch {}
  };
  const togglePoll = () => {
    if (polling) {
      clearInterval(timerRef.current);
      setPolling(false);
    } else {
      setPolling(true);
      timerRef.current = setInterval(read, 500);
    }
  };
  useEffect(() => () => clearInterval(timerRef.current), []);
  return h(
    Card,
    { icon: "📏", title: "Ultrason HC-SR04", badge: "GPIO20/21" },
    data &&
      h(
        "div",
        { className: "sensor-value" },
        data.distance_cm,
        h("span", { className: "sensor-unit" }, " cm"),
      ),
    h(
      "div",
      { style: { display: "flex", gap: 8 } },
      h("button", { className: "btn", onClick: read, disabled }, "Mesurer"),
      h(
        "button",
        {
          className: "btn " + (polling ? "danger" : "success"),
          onClick: togglePoll,
          disabled,
        },
        polling ? "Stop Auto" : "Auto",
      ),
    ),
    output && h("div", { className: "output" }, output),
  );
}

/* ===================================================================
 *  15. MPU6050  (I2C 0x68)
 * =================================================================== */
function Mpu6050Panel({ ws, disabled }) {
  const [data, setData] = useState(null);
  const [output, setOutput] = useState("");
  const [polling, setPolling] = useState(false);
  const [refreshMs, setRefreshMs] = useState(700);
  const [streamInfo, setStreamInfo] = useState(null);
  const timerRef = useRef(null);

  const formatAxis = (value) =>
    Number.isFinite(value) ? value.toFixed(2) : "--";

  const orientation = data && data.orientation ? data.orientation : null;
  const pitch = orientation ? orientation.pitch : 0;
  const roll = orientation ? orientation.roll : 0;
  const gyroYaw = data && data.gyro ? data.gyro.z : 0;
  const uiRefreshHz = (1000 / refreshMs).toFixed(refreshMs < 1000 ? 2 : 1);
  const globePitch = Math.max(-24, Math.min(24, pitch * 0.72));
  const globeRoll = Math.max(-70, Math.min(70, roll));
  const globeHeading = Math.max(-160, Math.min(160, gyroYaw * 1.8));
  const gimbalPitch = Math.max(-46, Math.min(46, pitch * 1.08));
  const rotorOffset = Math.max(-14, Math.min(14, pitch * 0.34));

  const applyStreamData = (payload, silent = false) => {
    if (!payload) return;
    setStreamInfo(payload);
    if (payload.sample) setData(payload.sample);
    if (!silent) setOutput(JSON.stringify(payload, null, 2));
  };

  const fetchStatus = async (silent = false) => {
    const res = await ws.send("mpu6050_stream_status");
    if (res.status === "ok") applyStreamData(res.data, silent);
    else if (!silent) setOutput(JSON.stringify(res, null, 2));
    return res;
  };

  const read = async () => {
    if (polling) return await fetchStatus();

    const res = await ws.send("mpu6050_read");
    setOutput(JSON.stringify(res.data, null, 2));
    if (res.status === "ok" && res.data.stdout)
      try {
        const sample = JSON.parse(res.data.stdout);
        setData(sample);
        setStreamInfo({
          streaming: false,
          interval_ms: refreshMs,
          actual_hz: 0,
          sample,
          sample_age_ms: 0,
          last_error: "",
        });
      } catch {}
    return res;
  };

  const scheduleStatusPoll = (intervalMs) => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      fetchStatus(true);
    }, intervalMs);
  };

  const stopStream = async (silent = true) => {
    const res = await ws.send("mpu6050_stream_stop");
    if (res.status === "ok") applyStreamData(res.data, silent);
    return res;
  };

  const stopPolling = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setPolling(false);
    await stopStream(true);
  };

  const startPolling = async (nextRefreshMs = refreshMs) => {
    if (disabled || timerRef.current) return;
    const res = await ws.send("mpu6050_stream_start", {
      interval_ms: nextRefreshMs,
    });
    if (res.status !== "ok") {
      setOutput(JSON.stringify(res, null, 2));
      return;
    }
    setPolling(true);
    applyStreamData(res.data, true);
    scheduleStatusPoll(nextRefreshMs);
    await fetchStatus(true);
  };

  const togglePolling = () => {
    if (polling) void stopPolling();
    else void startPolling();
  };

  useEffect(() => {
    if (!disabled) {
      void startPolling(refreshMs);
    } else {
      void stopPolling();
    }

    return () => {
      void stopPolling();
    };
  }, [disabled]);

  useEffect(() => {
    if (!polling || disabled) return;

    scheduleStatusPoll(refreshMs);
    void ws
      .send("mpu6050_stream_start", { interval_ms: refreshMs })
      .then((res) => {
        if (res.status === "ok") applyStreamData(res.data, true);
      });
  }, [refreshMs]);

  return h(
    Card,
    { icon: "🎯", title: "MPU6050 Accel/Gyro", badge: "I2C 0x68" },
    data &&
      h(
        "div",
        null,
        h(
          "div",
          { className: "imu-space-card" },
          h(
            "div",
            { className: "imu-space-header" },
            h("span", null, "Globe gyroscopique"),
            h(
              "span",
              { className: "imu-space-badge" },
              "Pitch ",
              formatAxis(pitch),
              "° • Roll ",
              formatAxis(roll),
              "°",
            ),
          ),
          h(
            "div",
            { className: "imu-space-scene" },
            h("div", { className: "imu-gyro-shadow" }),
            h("div", { className: "imu-gyro-stand" }),
            h(
              "div",
              { className: "imu-gyro-frame" },
              h("div", { className: "imu-gyro-frame-ring" }),
              h("div", { className: "imu-gyro-crossbar" }),
              h("div", { className: "imu-gyro-top-pointer" }),
              h(
                "div",
                {
                  className: "imu-gyro-gimbal",
                  style: {
                    transform:
                      "translate(-50%, -50%) rotate(" + globeRoll + "deg)",
                  },
                },
                h("div", { className: "imu-gyro-gimbal-ring" }),
                h(
                  "div",
                  {
                    className: "imu-gyro-rotor-assembly",
                    style: {
                      transform:
                        "translate(-50%, calc(-50% + " +
                        rotorOffset +
                        "px)) rotate(" +
                        gimbalPitch +
                        "deg)",
                    },
                  },
                  h("div", {
                    className: "imu-gyro-spin-axis",
                    style: {
                      transform:
                        "translate(-50%, -50%) rotate(" + globeHeading + "deg)",
                    },
                  }),
                  h("div", { className: "imu-gyro-inner-ring" }),
                  h("div", { className: "imu-gyro-rotor-disc" }),
                  h("div", { className: "imu-gyro-rotor-hub" }),
                ),
              ),
              h("div", {
                className: "imu-gyro-horizon-line",
                style: {
                  transform:
                    "translate(-50%, calc(-50% + " +
                    globePitch +
                    "px)) rotate(" +
                    globeRoll +
                    "deg)",
                },
              }),
              h("div", { className: "imu-gyro-wing imu-gyro-wing-left" }),
              h("div", { className: "imu-gyro-wing imu-gyro-wing-right" }),
              h("div", { className: "imu-gyro-center" }),
            ),
            h(
              "div",
              {
                className: "imu-globe-angle-chip imu-globe-angle-chip-pitch",
              },
              "Pitch ",
              h("strong", null, formatAxis(pitch) + "°"),
            ),
            h(
              "div",
              {
                className: "imu-globe-angle-chip imu-globe-angle-chip-roll",
              },
              "Roll ",
              h("strong", null, formatAxis(roll) + "°"),
            ),
          ),
          h(
            "div",
            { className: "imu-space-footer" },
            h("span", null, "Representation de la vision dans l'espace"),
            h("span", null, "Rotation Z gyro ", formatAxis(gyroYaw), "°/s"),
          ),
        ),
        h(
          "div",
          {
            style: {
              fontSize: ".75rem",
              color: "var(--text-dim)",
              marginBottom: 4,
            },
          },
          "Accelerometre (g)",
        ),
        h(
          "div",
          { className: "axes-grid" },
          ["x", "y", "z"].map((a) =>
            h(
              "div",
              { key: a, className: "axis-item" },
              h("div", { className: "axis-label" }, a.toUpperCase()),
              h("div", { className: "axis-val" }, formatAxis(data.accel[a])),
            ),
          ),
        ),
        h(
          "div",
          {
            style: {
              fontSize: ".75rem",
              color: "var(--text-dim)",
              marginBottom: 4,
              marginTop: 8,
            },
          },
          "Gyroscope (\u00B0/s)",
        ),
        h(
          "div",
          { className: "axes-grid" },
          ["x", "y", "z"].map((a) =>
            h(
              "div",
              { key: a, className: "axis-item" },
              h("div", { className: "axis-label" }, a.toUpperCase()),
              h("div", { className: "axis-val" }, formatAxis(data.gyro[a])),
            ),
          ),
        ),
        orientation &&
          h(
            "div",
            { className: "axes-grid", style: { marginTop: 8 } },
            [
              ["Pitch", pitch],
              ["Roll", roll],
              ["Temp", data.temp],
            ].map(([label, value]) =>
              h(
                "div",
                { key: label, className: "axis-item" },
                h("div", { className: "axis-label" }, label),
                h(
                  "div",
                  { className: "axis-val" },
                  formatAxis(value),
                  label === "Temp" ? "°C" : "°",
                ),
              ),
            ),
          ),
        h(
          "div",
          { className: "axes-grid", style: { marginTop: 8 } },
          [
            ["UI", uiRefreshHz + " Hz"],
            [
              "Backend",
              streamInfo && streamInfo.actual_hz
                ? formatAxis(streamInfo.actual_hz) + " Hz"
                : "--",
            ],
            [
              "Age",
              streamInfo && streamInfo.sample_age_ms != null
                ? Math.round(streamInfo.sample_age_ms) + " ms"
                : "--",
            ],
          ].map(([label, value]) =>
            h(
              "div",
              { key: label, className: "axis-item" },
              h("div", { className: "axis-label" }, label),
              h("div", { className: "axis-val" }, value),
            ),
          ),
        ),
        h(
          "label",
          {
            style: {
              display: "block",
              marginTop: 10,
              fontSize: ".75rem",
              color: "var(--text-dim)",
            },
          },
          "Frequence de rafraichissement frontend",
          h(
            "select",
            {
              className: "input",
              value: String(refreshMs),
              onChange: (event) => setRefreshMs(Number(event.target.value)),
              disabled,
              style: { width: "100%", marginTop: 6 },
            },
            [150, 300, 500, 700, 1000, 1500, 2000].map((value) =>
              h(
                "option",
                { key: value, value: String(value) },
                value,
                " ms (",
                (1000 / value).toFixed(value < 1000 ? 2 : 1),
                " Hz)",
              ),
            ),
          ),
        ),
        streamInfo &&
          streamInfo.last_error &&
          h(
            "div",
            { className: "output", style: { marginTop: 8 } },
            streamInfo.last_error,
          ),
        h(
          "div",
          { style: { textAlign: "center", marginTop: 6, fontSize: ".85rem" } },
          "Temp: ",
          h("strong", null, formatAxis(data.temp) + "\u00B0C"),
        ),
      ),
    h(
      "div",
      { style: { display: "flex", gap: 8, marginTop: 8 } },
      h(
        "button",
        {
          className: "btn",
          onClick: read,
          disabled,
          style: { flex: 1 },
        },
        "Lire",
      ),
      h(
        "button",
        {
          className: "btn " + (polling ? "danger" : "success"),
          onClick: togglePolling,
          disabled,
          style: { flex: 1 },
        },
        polling ? "Stop Auto" : "Auto",
      ),
    ),
    output && h("div", { className: "output" }, output),
  );
}

/* ===================================================================
 *  16. IR MOTION SENSOR  (GPIO14)
 * =================================================================== */
function IrMotionPanel({ ws, disabled }) {
  const [detected, setDetected] = useState(false);
  const [output, setOutput] = useState("");
  const [polling, setPolling] = useState(false);
  const timerRef = useRef(null);
  const read = async () => {
    const res = await ws.send("ir_motion_read", { pin: 14 });
    setOutput(JSON.stringify(res.data, null, 2));
    if (res.status === "ok" && res.data.stdout)
      try {
        setDetected(JSON.parse(res.data.stdout).detected);
      } catch {}
  };
  const togglePoll = () => {
    if (polling) {
      clearInterval(timerRef.current);
      setPolling(false);
    } else {
      setPolling(true);
      timerRef.current = setInterval(read, 800);
    }
  };
  useEffect(() => () => clearInterval(timerRef.current), []);
  return h(
    Card,
    { icon: "👁️", title: "Capteur IR Mouvement", badge: "GPIO14" },
    h(
      "div",
      { className: "detect-indicator" + (detected ? " detected" : "") },
      detected ? "\uD83D\uDFE2" : "\u26AA",
    ),
    h(
      "div",
      { style: { textAlign: "center", fontSize: ".85rem", marginBottom: 8 } },
      detected ? "Mouvement detecte !" : "Aucun mouvement",
    ),
    h(
      "div",
      { style: { display: "flex", gap: 8 } },
      h("button", { className: "btn", onClick: read, disabled }, "Lire"),
      h(
        "button",
        {
          className: "btn " + (polling ? "danger" : "success"),
          onClick: togglePoll,
          disabled,
        },
        polling ? "Stop" : "Auto",
      ),
    ),
    output && h("div", { className: "output" }, output),
  );
}

/* ===================================================================
 *  17. PHOTORESISTOR  (ADC)
 * =================================================================== */
function PhotoresistorPanel({ ws, disabled }) {
  const [data, setData] = useState(null);
  const [output, setOutput] = useState("");
  const read = async () => {
    const res = await ws.send("photoresistor_read");
    setOutput(JSON.stringify(res.data, null, 2));
    if (res.status === "ok" && res.data.stdout)
      try {
        setData(JSON.parse(res.data.stdout));
      } catch {}
  };
  return h(
    Card,
    { icon: "☀️", title: "Photoresistance", badge: "ADC" },
    data &&
      h(
        "div",
        { className: "sensor-value" },
        data.light_percent,
        h("span", { className: "sensor-unit" }, " %"),
      ),
    h(
      "button",
      { className: "btn", onClick: read, disabled, style: { width: "100%" } },
      "Lire luminosite",
    ),
    output && h("div", { className: "output" }, output),
  );
}

/* ===================================================================
 *  18. THERMISTOR  (ADC CH0)
 * =================================================================== */
function ThermistorPanel({ ws, disabled }) {
  const [data, setData] = useState(null);
  const [output, setOutput] = useState("");
  const read = async () => {
    const res = await ws.send("thermistor_read");
    setOutput(JSON.stringify(res.data, null, 2));
    if (res.status === "ok" && res.data.stdout)
      try {
        setData(JSON.parse(res.data.stdout));
      } catch {}
  };
  return h(
    Card,
    { icon: "🌡️", title: "Thermistance", badge: "ADC A0" },
    data &&
      h(
        "div",
        { className: "sensor-value", style: { color: "#ef4444" } },
        data.temperature_c,
        h("span", { className: "sensor-unit" }, " \u00B0C"),
      ),
    h(
      "button",
      { className: "btn", onClick: read, disabled, style: { width: "100%" } },
      "Lire temperature",
    ),
    output && h("div", { className: "output" }, output),
  );
}

/* ===================================================================
 *  19. BUTTON  (GPIO16)
 * =================================================================== */
function ButtonPanel({ ws, disabled }) {
  const [pressed, setPressed] = useState(false);
  const [output, setOutput] = useState("");
  const [polling, setPolling] = useState(false);
  const timerRef = useRef(null);
  const read = async () => {
    const res = await ws.send("gpio_read", { pin: 16 });
    setOutput(JSON.stringify(res.data, null, 2));
    if (res.status === "ok" && res.data.stdout)
      try {
        setPressed(JSON.parse(res.data.stdout).value === 1);
      } catch {}
  };
  const togglePoll = () => {
    if (polling) {
      clearInterval(timerRef.current);
      setPolling(false);
    } else {
      setPolling(true);
      timerRef.current = setInterval(read, 300);
    }
  };
  useEffect(() => () => clearInterval(timerRef.current), []);
  return h(
    Card,
    { icon: "🔘", title: "Bouton", badge: "GPIO16" },
    h(
      "div",
      {
        className: "detect-indicator" + (pressed ? " detected" : ""),
        style: {
          background: pressed ? "rgba(239,68,68,.15)" : "transparent",
          borderColor: pressed ? "var(--red)" : "var(--border)",
        },
      },
      pressed ? "\uD83D\uDD34" : "\u26AA",
    ),
    h(
      "div",
      { style: { textAlign: "center", fontSize: ".85rem", marginBottom: 8 } },
      pressed ? "APPUYE" : "Relache",
    ),
    h(
      "div",
      { style: { display: "flex", gap: 8 } },
      h("button", { className: "btn", onClick: read, disabled }, "Lire"),
      h(
        "button",
        {
          className: "btn " + (polling ? "danger" : "success"),
          onClick: togglePoll,
          disabled,
        },
        polling ? "Stop" : "Auto",
      ),
    ),
    output && h("div", { className: "output" }, output),
  );
}

/* ===================================================================
 *  20. JOYSTICK  (ADC + GPIO16)
 * =================================================================== */
function JoystickPanel({ ws, disabled }) {
  const [data, setData] = useState({ x: 128, y: 128, button: 0 });
  const [output, setOutput] = useState("");
  const [polling, setPolling] = useState(false);
  const timerRef = useRef(null);
  const read = async () => {
    const res = await ws.send("joystick_read");
    setOutput(JSON.stringify(res.data, null, 2));
    if (res.status === "ok" && res.data.stdout)
      try {
        setData(JSON.parse(res.data.stdout));
      } catch {}
  };
  const togglePoll = () => {
    if (polling) {
      clearInterval(timerRef.current);
      setPolling(false);
    } else {
      setPolling(true);
      timerRef.current = setInterval(read, 200);
    }
  };
  useEffect(() => () => clearInterval(timerRef.current), []);
  const pctX = ((data.x / 255) * 100).toFixed(0);
  const pctY = ((data.y / 255) * 100).toFixed(0);
  return h(
    Card,
    { icon: "🕹️", title: "JoyStick", badge: "ADC" },
    h(
      "div",
      { className: "joy-container" },
      h("div", { className: "joy-crosshair-h" }),
      h("div", { className: "joy-crosshair-v" }),
      h("div", {
        className: "joy-dot",
        style: { left: pctX + "%", top: pctY + "%" },
      }),
    ),
    h(
      "div",
      {
        style: {
          display: "flex",
          justifyContent: "center",
          gap: 16,
          fontSize: ".85rem",
          marginTop: 4,
        },
      },
      h("span", null, "X: ", h("strong", null, data.x)),
      h("span", null, "Y: ", h("strong", null, data.y)),
      h(
        "span",
        null,
        "Btn: ",
        h(
          "strong",
          { style: { color: data.button ? "var(--red)" : "var(--green)" } },
          data.button ? "ON" : "OFF",
        ),
      ),
    ),
    h(
      "div",
      { style: { display: "flex", gap: 8, marginTop: 8 } },
      h("button", { className: "btn", onClick: read, disabled }, "Lire"),
      h(
        "button",
        {
          className: "btn " + (polling ? "danger" : "success"),
          onClick: togglePoll,
          disabled,
        },
        polling ? "Stop" : "Auto",
      ),
    ),
    output && h("div", { className: "output" }, output),
  );
}

/* ===================================================================
 *  21. POTENTIOMETER  (ADC A2/A3/A4)
 * =================================================================== */
function PotentiometerPanel({ ws, disabled }) {
  const [ch, setCh] = useState(2);
  const [data, setData] = useState(null);
  const [output, setOutput] = useState("");
  const [scanData, setScanData] = useState(null);
  const [refreshMs, setRefreshMs] = useState(500);
  const timerRef = useRef(null);
  const errorText = data?.error || "";
  const errorHint = data?.hint || "";
  const percent = Math.max(0, Math.min(100, Number(data?.percent ?? 0)));
  const voltage = Number(data?.voltage ?? 0);
  const raw = Number(data?.raw ?? 0);
  const read = async () => {
    const res = await ws.send("adc_read", { channel: ch });
    setOutput(JSON.stringify(res.data, null, 2));
    if (res.status === "ok" && res.data.stdout)
      try {
        setData(JSON.parse(res.data.stdout));
      } catch {}
  };
  const scanBus = async () => {
    const res = await ws.send("i2c_scan", { bus: 1 });
    if (res.status === "ok" && res.data.stdout)
      try {
        setScanData(JSON.parse(res.data.stdout));
      } catch {
        setScanData(null);
      }
  };

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (disabled) return;

    void read();
    timerRef.current = setInterval(() => {
      void read();
    }, refreshMs);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [ch, refreshMs, disabled]);

  return h(
    Card,
    { icon: "🎛️", title: "Potentiometres", badge: "ADC A2-A4" },
    h(
      "div",
      { className: "field-row" },
      h(
        "div",
        { className: "field", style: { flex: 1 } },
        h("label", null, "Potentiometre"),
        h(
          "select",
          { value: ch, onChange: (e) => setCh(+e.target.value) },
          h("option", { value: 2 }, "RP1 (A2)"),
          h("option", { value: 3 }, "RP2 (A3)"),
          h("option", { value: 4 }, "RP3 (A4)"),
        ),
      ),
      h("button", { className: "btn", onClick: read, disabled }, "Lire"),
    ),
    h(
      "div",
      { className: "field-row", style: { marginTop: 10 } },
      h(
        "div",
        { className: "field", style: { flex: 1 } },
        h("label", null, "Rafraichissement"),
        h(
          "select",
          {
            value: refreshMs,
            onChange: (e) => setRefreshMs(+e.target.value),
          },
          h("option", { value: 250 }, "250 ms"),
          h("option", { value: 500 }, "500 ms"),
          h("option", { value: 1000 }, "1 s"),
        ),
      ),
    ),
    h(
      "div",
      { className: "diag-row" },
      h(
        "button",
        { className: "btn ghost", onClick: scanBus, disabled },
        "Diagnostic I2C",
      ),
    ),
    data &&
      !data.error &&
      h(
        React.Fragment,
        null,
        h(
          "div",
          { className: "sensor-value" },
          percent.toFixed(1),
          h("span", { className: "sensor-unit" }, " %"),
        ),
        h(
          "div",
          { className: "adc-conversion-card" },
          h(
            "div",
            { className: "adc-conversion-header" },
            h("span", null, "Conversion ADC 8 bits"),
            h("span", null, data.address || "ADS7830"),
          ),
          h(
            "div",
            { className: "adc-conversion-formula" },
            "V = brut × 3.3 / 255",
          ),
          h(
            "div",
            {
              className: "adc-conversion-graph",
              "aria-label": "Graphe de conversion du potentiometre",
            },
            h(
              "div",
              { className: "adc-conversion-track" },
              h("div", {
                className: "adc-conversion-fill",
                style: { width: `${percent}%` },
              }),
              h("div", {
                className: "adc-conversion-marker",
                style: { left: `${percent}%` },
              }),
            ),
            h(
              "div",
              { className: "adc-conversion-scale" },
              h("span", null, "0 / 0.0V"),
              h("span", null, "128 / 1.65V"),
              h("span", null, "255 / 3.3V"),
            ),
          ),
          h(
            "div",
            { className: "adc-conversion-stats" },
            h(
              "div",
              { className: "adc-stat" },
              h("span", { className: "adc-stat-label" }, "Brut"),
              h("strong", null, raw),
            ),
            h(
              "div",
              { className: "adc-stat" },
              h("span", { className: "adc-stat-label" }, "Tension"),
              h("strong", null, `${voltage.toFixed(3)} V`),
            ),
            h(
              "div",
              { className: "adc-stat" },
              h("span", { className: "adc-stat-label" }, "Canal"),
              h("strong", null, `A${ch}`),
            ),
          ),
        ),
      ),
    data?.error &&
      h(
        "div",
        { className: "sensor-alert" },
        h(
          "div",
          { className: "sensor-alert-title" },
          "ADC ADS7830 non detecte",
        ),
        h("div", { className: "sensor-alert-body" }, errorText),
        errorHint && h("div", { className: "sensor-alert-hint" }, errorHint),
      ),
    scanData &&
      h(
        "div",
        { className: "diag-result" },
        h("div", { className: "diag-result-title" }, "Scan bus I2C 1"),
        h(
          "div",
          { className: "diag-result-body" },
          scanData.count > 0
            ? scanData.devices.map((device) => device.hex).join(", ")
            : "Aucun peripherique detecte",
        ),
      ),
    output && h("div", { className: "output" }, output),
  );
}

/* ===================================================================
 *  22. RFID-RC522  (SPI)
 * =================================================================== */
function RfidPanel({ ws, disabled }) {
  const [data, setData] = useState(null);
  const [output, setOutput] = useState("");
  const [polling, setPolling] = useState(false);
  const timerRef = useRef(null);
  const read = async () => {
    const res = await ws.send("rfid_read");
    setOutput(JSON.stringify(res.data, null, 2));
    if (res.status === "ok" && res.data.stdout)
      try {
        setData(JSON.parse(res.data.stdout));
      } catch {}
  };
  const togglePoll = () => {
    if (polling) {
      clearInterval(timerRef.current);
      setPolling(false);
    } else {
      setPolling(true);
      timerRef.current = setInterval(read, 1000);
    }
  };
  useEffect(() => () => clearInterval(timerRef.current), []);
  return h(
    Card,
    { icon: "💳", title: "RFID-RC522", badge: "SPI" },
    h(
      "div",
      {
        className:
          "detect-indicator" +
          (data && data.status === "detected" ? " detected" : ""),
      },
      data && data.status === "detected" ? "✅" : "📡",
    ),
    data &&
      h(
        "div",
        { style: { textAlign: "center", marginBottom: 8 } },
        data.status === "detected"
          ? h(
              "div",
              null,
              h(
                "div",
                { style: { fontSize: ".85rem" } },
                "UID: ",
                h("strong", null, data.uid),
              ),
              h(
                "div",
                { style: { fontSize: ".75rem", color: "var(--text-dim)" } },
                "Type: " + data.type,
              ),
            )
          : h(
              "div",
              { style: { color: "var(--text-dim)" } },
              "Aucune carte detectee",
            ),
      ),
    h(
      "div",
      { style: { display: "flex", gap: 8 } },
      h("button", { className: "btn", onClick: read, disabled }, "Lire"),
      h(
        "button",
        {
          className: "btn " + (polling ? "danger" : "success"),
          onClick: togglePoll,
          disabled,
        },
        polling ? "Stop" : "Scan Auto",
      ),
    ),
    output && h("div", { className: "output" }, output),
  );
}

/* ===================================================================
 *  23. KEYPAD 4x4
 * =================================================================== */
function KeypadPanel({ ws, disabled }) {
  const [lastKey, setLastKey] = useState("");
  const [lastPosition, setLastPosition] = useState(null);
  const [history, setHistory] = useState([]);
  const [output, setOutput] = useState("");
  const [reading, setReading] = useState(false);
  const [polling, setPolling] = useState(true);
  const [refreshMs, setRefreshMs] = useState(180);
  const [lastScanAt, setLastScanAt] = useState("");
  const timerRef = useRef(null);
  const inFlightRef = useRef(false);
  const keys = [
    ["1", "2", "3", "A"],
    ["4", "5", "6", "B"],
    ["7", "8", "9", "C"],
    ["*", "0", "#", "D"],
  ];
  const rowPins = [16, 20, 21, 26];
  const colPins = [19, 13, 6, 5];
  const readKey = async ({ timeoutMs, showOutput }) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    if (showOutput) setReading(true);

    try {
      const res = await ws.send("keypad_read", {
        timeout_ms: timeoutMs,
        debounce_ms: 50,
      });

      let nextKey = "";
      let nextPosition = null;
      if (res.status === "ok" && res.data && res.data.stdout) {
        try {
          const parsed = JSON.parse(res.data.stdout);
          nextKey = typeof parsed.key === "string" ? parsed.key.trim() : "";
          if (parsed && parsed.pressed) {
            nextPosition = {
              rowIndex: parsed.row_index,
              colIndex: parsed.col_index,
              rowPin: parsed.row_pin,
              colPin: parsed.col_pin,
            };
          }
        } catch {
          nextKey = String(res.data.stdout).trim();
        }
      }

      if (showOutput || res.status !== "ok" || nextKey) {
        setOutput(JSON.stringify(res.data, null, 2));
      }

      if (nextKey) {
        setLastKey(nextKey);
        setHistory((prev) => [...prev, nextKey].slice(-12));
        setLastPosition(nextPosition);
      }

      setLastScanAt(new Date().toLocaleTimeString("fr-FR"));
    } finally {
      if (showOutput) setReading(false);
      inFlightRef.current = false;
    }
  };
  const read = async () => {
    await readKey({ timeoutMs: 900, showOutput: true });
  };
  const stopPolling = () => {
    clearInterval(timerRef.current);
    timerRef.current = null;
    setPolling(false);
  };
  const togglePolling = () => {
    setPolling((prev) => !prev);
  };
  const clear = () => {
    setLastKey("");
    setLastPosition(null);
    setHistory([]);
    setOutput("");
  };
  useEffect(() => {
    if (!polling || disabled) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }

    void readKey({ timeoutMs: 70, showOutput: false });
    timerRef.current = setInterval(() => {
      void readKey({ timeoutMs: 70, showOutput: false });
    }, refreshMs);

    return () => {
      clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [polling, refreshMs, disabled]);

  useEffect(() => {
    if (disabled && polling) stopPolling();
  }, [disabled, polling]);

  useEffect(
    () => () => {
      clearInterval(timerRef.current);
      timerRef.current = null;
    },
    [],
  );
  return h(
    Card,
    {
      icon: "⌨️",
      title: "Clavier Matriciel 4x4",
      badge: "R16/20/21/26 C19/13/6/5",
    },
    h(
      "div",
      { className: "keypad-summary" },
      h("span", { className: "keypad-code-pill" }, "keys[4][4]"),
      h("span", { className: "keypad-code-pill" }, "keypad.getKey()"),
      h("span", { className: "keypad-code-pill" }, "debounce 50 ms"),
    ),
    h(
      "div",
      { className: "keypad-display" },
      h("div", { className: "keypad-display-label" }, "Derniere touche"),
      h("div", { className: "keypad-display-value" }, lastKey || "—"),
    ),
    h(
      "div",
      { className: "keypad-display keypad-display-secondary" },
      h("div", { className: "keypad-display-label" }, "Sequence lue"),
      h(
        "div",
        { className: "keypad-display-value keypad-sequence" },
        history.length ? history.join(" ") : "En attente d'une touche",
      ),
    ),
    h(
      "div",
      { className: "keypad-position-grid" },
      h(
        "div",
        { className: "keypad-position-card" },
        h("div", { className: "keypad-display-label" }, "Position matrice"),
        h(
          "div",
          { className: "keypad-position-value" },
          lastPosition
            ? `row ${lastPosition.rowIndex + 1} / col ${lastPosition.colIndex + 1}`
            : "—",
        ),
      ),
      h(
        "div",
        { className: "keypad-position-card" },
        h("div", { className: "keypad-display-label" }, "GPIO actifs"),
        h(
          "div",
          { className: "keypad-position-value keypad-position-gpio" },
          lastPosition
            ? `R${lastPosition.rowPin} / C${lastPosition.colPin}`
            : "—",
        ),
      ),
    ),
    h(
      "div",
      { className: "keypad-meta-row" },
      h(
        "span",
        {
          className: "keypad-status-chip " + (polling ? "live" : "idle"),
        },
        polling ? `Auto ${refreshMs} ms` : "Lecture manuelle",
      ),
      h(
        "span",
        { className: "keypad-status-chip" },
        "Dernier scan: ",
        lastScanAt || "—",
      ),
    ),
    h(
      "div",
      { className: "keypad-wire-grid" },
      h(
        "div",
        { className: "keypad-wire-card" },
        h("span", null, "Lignes"),
        h("strong", null, "GPIO16, GPIO20, GPIO21, GPIO26"),
      ),
      h(
        "div",
        { className: "keypad-wire-card" },
        h("span", null, "Colonnes"),
        h("strong", null, "GPIO19, GPIO13, GPIO6, GPIO5"),
      ),
    ),
    h(
      "div",
      { className: "keypad-matrix-shell" },
      h(
        "div",
        { className: "keypad-axis keypad-axis-top" },
        h("span", { className: "keypad-axis-label" }, "COL"),
        colPins.map((pin) =>
          h("span", { key: pin, className: "keypad-axis-pin" }, pin),
        ),
      ),
      h(
        "div",
        { className: "keypad-matrix-body" },
        h(
          "div",
          { className: "keypad-axis keypad-axis-side" },
          h("span", { className: "keypad-axis-label" }, "ROW"),
          rowPins.map((pin) =>
            h("span", { key: pin, className: "keypad-axis-pin" }, pin),
          ),
        ),
        h(
          "div",
          { className: "keypad-grid" },
          keys.flat().map((key) =>
            h(
              "div",
              {
                key,
                className: "key-btn" + (lastKey === key ? " pressed" : ""),
              },
              key,
            ),
          ),
        ),
      ),
    ),
    h(
      "div",
      { className: "keypad-toolbar" },
      h(
        "label",
        { className: "keypad-refresh" },
        "Auto scan",
        h(
          "select",
          {
            value: refreshMs,
            onChange: (e) => setRefreshMs(Number(e.target.value)),
            disabled,
          },
          h("option", { value: 120 }, "120 ms"),
          h("option", { value: 180 }, "180 ms"),
          h("option", { value: 250 }, "250 ms"),
          h("option", { value: 400 }, "400 ms"),
        ),
      ),
    ),
    h(
      "div",
      { className: "keypad-actions" },
      h(
        "button",
        {
          className: "btn",
          onClick: read,
          disabled: disabled || reading,
          style: { flex: 1.2 },
        },
        reading ? "Lecture..." : "Lire touche",
      ),
      h(
        "button",
        {
          className: "btn " + (polling ? "danger" : "success"),
          onClick: togglePolling,
          disabled,
          style: { flex: 1 },
        },
        polling ? "Stop Auto" : "Auto",
      ),
      h(
        "button",
        { className: "btn secondary", onClick: clear, style: { flex: 1 } },
        "Effacer",
      ),
    ),
    h(
      "div",
      { className: "hint", style: { marginTop: 10 } },
      "Exemple Freenove: lecture continue via keypad.getKey() avec anti-rebond a 50 ms.",
    ),
    output && h("div", { className: "output" }, output),
  );
}

/* ===================================================================
 *  24. I2C LCD 1602
 * =================================================================== */
function LcdPanel({ ws, disabled }) {
  const [line1, setLine1] = useState("Hello Freenove!");
  const [line2, setLine2] = useState("RPi5 Dashboard");
  const [output, setOutput] = useState("");
  const send = async () => {
    const res = await ws.send("lcd_write", { line1, line2 });
    setOutput(JSON.stringify(res.data, null, 2));
  };
  return h(
    Card,
    { icon: "📺", title: "I2C LCD 1602", badge: "I2C 0x27" },
    h(
      "div",
      { className: "lcd-screen" },
      h("div", null, (line1 || "").padEnd(16, " ").slice(0, 16)),
      h("div", null, (line2 || "").padEnd(16, " ").slice(0, 16)),
    ),
    h(
      "div",
      { className: "field" },
      h("label", null, "Ligne 1 (max 16 car.)"),
      h("input", {
        value: line1,
        maxLength: 16,
        onChange: (e) => setLine1(e.target.value),
      }),
    ),
    h(
      "div",
      { className: "field" },
      h("label", null, "Ligne 2 (max 16 car.)"),
      h("input", {
        value: line2,
        maxLength: 16,
        onChange: (e) => setLine2(e.target.value),
      }),
    ),
    h(
      "button",
      { className: "btn", onClick: send, disabled, style: { width: "100%" } },
      "Envoyer au LCD",
    ),
    output && h("div", { className: "output" }, output),
  );
}

/* ===================================================================
 *  25. ADC (ADS7830)
 * =================================================================== */
function AdcPanel({ ws, disabled }) {
  const [channel, setChannel] = useState(0);
  const [output, setOutput] = useState("");
  const [polling, setPolling] = useState(false);
  const timerRef = useRef(null);
  const readOnce = async () => {
    const res = await ws.send("adc_read", { channel });
    setOutput(JSON.stringify(res.data, null, 2));
  };
  const togglePoll = () => {
    if (polling) {
      clearInterval(timerRef.current);
      setPolling(false);
    } else {
      setPolling(true);
      timerRef.current = setInterval(readOnce, 1000);
    }
  };
  useEffect(() => () => clearInterval(timerRef.current), []);
  return h(
    Card,
    { icon: "📊", title: "ADC (ADS7830)", badge: "I2C" },
    h(
      "div",
      { className: "field-row" },
      h(
        "div",
        { className: "field" },
        h("label", null, "Canal"),
        h(
          "select",
          { value: channel, onChange: (e) => setChannel(+e.target.value) },
          [0, 1, 2, 3, 4, 5, 6, 7].map((c) =>
            h("option", { key: c, value: c }, "CH" + c),
          ),
        ),
      ),
      h("button", { className: "btn", onClick: readOnce, disabled }, "Lire"),
      h(
        "button",
        {
          className: "btn " + (polling ? "danger" : "success"),
          onClick: togglePoll,
          disabled,
        },
        polling ? "Stop" : "Auto",
      ),
    ),
    output && h("div", { className: "output" }, output),
  );
}

/* ===================================================================
 *  26. I2C SCANNER
 * =================================================================== */
function I2cPanel({ ws, disabled }) {
  const [bus, setBus] = useState(1);
  const [output, setOutput] = useState("");
  const scan = async () => {
    setOutput("Scan en cours...");
    const res = await ws.send("i2c_scan", { bus });
    setOutput(JSON.stringify(res.data, null, 2));
  };
  return h(
    Card,
    { icon: "🔍", title: "I2C Scanner", badge: "I2C" },
    h(
      "div",
      { className: "field-row" },
      h(
        "div",
        { className: "field" },
        h("label", null, "Bus"),
        h(
          "select",
          { value: bus, onChange: (e) => setBus(+e.target.value) },
          h("option", { value: 0 }, "i2c-0"),
          h("option", { value: 1 }, "i2c-1"),
        ),
      ),
      h("button", { className: "btn", onClick: scan, disabled }, "Scanner"),
    ),
    output && h("div", { className: "output" }, output),
  );
}

/* ===================================================================
 *  27. GPIO CONTROL (general)
 * =================================================================== */
function GpioPanel({ ws, disabled }) {
  const pins = [4, 5, 6, 12, 13, 17, 18, 22, 23, 24, 25, 26, 27];
  const [states, setStates] = useState({});
  const [output, setOutput] = useState("");
  const refreshAll = useCallback(
    async (showResult = false) => {
      const res = await ws.send("gpio_read_many", { pins });
      if (res.status === "ok" && res.data.stdout) {
        try {
          const payload = JSON.parse(res.data.stdout);
          if (payload.pins) setStates((prev) => ({ ...prev, ...payload.pins }));
        } catch {}
        if (showResult) setOutput(JSON.stringify(res.data, null, 2));
        return;
      }
      setOutput(JSON.stringify(res.data || res, null, 2));
    },
    [ws],
  );

  const toggle = async (pin) => {
    const nv = states[pin] || 0 ? 0 : 1;
    const res = await ws.send("gpio_write", { pin, value: nv });
    if (res.status === "ok") {
      setStates((s) => ({ ...s, [pin]: nv }));
      setOutput(JSON.stringify(res.data, null, 2));
      await refreshAll();
      return;
    }
    setOutput(JSON.stringify(res.data || res, null, 2));
  };
  const readPin = async (pin) => {
    const res = await ws.send("gpio_read", { pin });
    if (res.status === "ok" && res.data.stdout)
      try {
        setStates((s) => ({ ...s, [pin]: JSON.parse(res.data.stdout).value }));
      } catch {}
    setOutput(JSON.stringify(res.data || res, null, 2));
  };
  useEffect(() => {
    if (disabled) return undefined;
    refreshAll(true);
    const timer = setInterval(() => refreshAll(false), 1000);
    return () => clearInterval(timer);
  }, [disabled, refreshAll]);
  return h(
    Card,
    { icon: "💡", title: "GPIO Control", badge: "BCM" },
    h(
      "div",
      { className: "gpio-grid" },
      pins.map((p) =>
        h(
          "div",
          {
            key: p,
            className: "gpio-pin" + (states[p] ? " active" : ""),
            onClick: () => !disabled && toggle(p),
            onContextMenu: (e) => {
              e.preventDefault();
              !disabled && readPin(p);
            },
          },
          h("span", { className: "pin-num" }, "GPIO " + p),
          h("span", { className: "pin-state" }, states[p] ? "HIGH" : "LOW"),
        ),
      ),
    ),
    h(
      "p",
      { style: { fontSize: ".72rem", color: "var(--text-dim)", marginTop: 6 } },
      "Clic = toggle | Clic droit = lire",
    ),
    output && h("div", { className: "output" }, output),
  );
}

/* ===================================================================
 *  28. PWM CONTROL
 * =================================================================== */
function PwmPanel({ ws, disabled }) {
  const [pin, setPin] = useState(18);
  const [freq, setFreq] = useState(1000);
  const [duty, setDuty] = useState(50);
  const [output, setOutput] = useState("");
  return h(
    Card,
    { icon: "〰️", title: "PWM Control", badge: "GPIO" },
    h(
      "div",
      { className: "field-row" },
      h(
        "div",
        { className: "field" },
        h("label", null, "Pin"),
        h(
          "select",
          { value: pin, onChange: (e) => setPin(+e.target.value) },
          [12, 13, 18, 19].map((p) =>
            h("option", { key: p, value: p }, "GPIO " + p),
          ),
        ),
      ),
      h(
        "div",
        { className: "field" },
        h("label", null, "Freq (Hz)"),
        h("input", {
          type: "number",
          min: 1,
          max: 50000,
          value: freq,
          onChange: (e) => setFreq(+e.target.value),
        }),
      ),
    ),
    h(
      "div",
      { className: "field", style: { marginTop: 8 } },
      h("label", null, "Duty: " + duty + "%"),
      h("input", {
        type: "range",
        min: 0,
        max: 100,
        value: duty,
        onChange: (e) => setDuty(+e.target.value),
      }),
    ),
    h(
      "div",
      { style: { display: "flex", gap: 8, marginTop: 8 } },
      h(
        "button",
        {
          className: "btn success",
          disabled,
          onClick: async () =>
            setOutput(
              JSON.stringify(
                (await ws.send("pwm_start", { pin, frequency: freq, duty }))
                  .data,
                null,
                2,
              ),
            ),
        },
        "Start",
      ),
      h(
        "button",
        {
          className: "btn danger",
          disabled,
          onClick: async () =>
            setOutput(
              JSON.stringify(
                (await ws.send("pwm_stop", { pin })).data,
                null,
                2,
              ),
            ),
        },
        "Stop",
      ),
    ),
    output && h("div", { className: "output" }, output),
  );
}

/* ===================================================================
 *  29. SYSTEM INFO
 * =================================================================== */
function SystemInfoPanel({ ws, disabled }) {
  const [info, setInfo] = useState(null);
  const [output, setOutput] = useState("");
  const [refreshSec, setRefreshSec] = useState(1);
  const [fanBusy, setFanBusy] = useState(false);
  const pollTimeoutRef = useRef(null);
  const requestPendingRef = useRef(false);

  const refresh = useCallback(
    async (silent = false) => {
      if (requestPendingRef.current) return;
      requestPendingRef.current = true;
      if (!silent) setOutput("Chargement...");
      try {
        const res = await ws.send("system_info");
        if (res.status === "ok" && res.data.stdout) {
          try {
            setInfo(JSON.parse(res.data.stdout));
          } catch {}
        }
        if (!silent || res.status !== "ok") {
          setOutput(JSON.stringify(res.data || res, null, 2));
        }
      } finally {
        requestPendingRef.current = false;
      }
    },
    [ws],
  );

  useEffect(() => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
    if (disabled) return undefined;

    let cancelled = false;
    const delayMs = Math.max(1, refreshSec) * 1000;

    const scheduleNext = () => {
      if (cancelled) return;
      pollTimeoutRef.current = setTimeout(async () => {
        await refresh(true);
        scheduleNext();
      }, delayMs);
    };

    refresh(true).finally(scheduleNext);

    return () => {
      cancelled = true;
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
    };
  }, [disabled, refreshSec, refresh]);

  const fmtUp = (s) => {
    if (!s || s < 0) return "—";
    return Math.floor(s / 3600) + "h " + Math.floor((s % 3600) / 60) + "m";
  };
  const fanLabel = !info?.fan_available
    ? "Indisponible"
    : info.fan_active
      ? "Actif"
      : "Arrete";
  const fanColor = !info?.fan_available
    ? "var(--text-dim)"
    : info.fan_active
      ? "#22c55e"
      : "#f59e0b";
  const diskFreeGb =
    info?.disk?.free_mb != null ? (info.disk.free_mb / 1024).toFixed(1) : null;
  const diskTotalGb =
    info?.disk?.total_mb != null
      ? (info.disk.total_mb / 1024).toFixed(1)
      : null;
  const ramUsagePercent =
    info?.memory_kb?.MemTotal && info?.memory_kb?.MemAvailable != null
      ? Math.round(
          ((info.memory_kb.MemTotal - info.memory_kb.MemAvailable) /
            info.memory_kb.MemTotal) *
            1000,
        ) / 10
      : null;
  const bootModeLabel = info?.boot_mode?.mode
    ? info.boot_mode.mode.toUpperCase()
    : "—";
  const ntp = info?.ntp;
  const ntpStatusLabel = !ntp?.available
    ? "Indisponible"
    : ntp.sync_state === "OK"
      ? "Synchro"
      : ntp.sync_state === "KO"
        ? "Non synchro"
        : ntp.sync_state;
  const ntpStatusColor = !ntp?.available
    ? "var(--text-dim)"
    : ntp.sync_state === "OK"
      ? "#22c55e"
      : "#ef4444";
  const toggleFan = async () => {
    if (!info?.fan_available) return;
    setFanBusy(true);
    try {
      setOutput("Mise a jour du ventilateur...");
      const res = await ws.send("fan_set", { enabled: !info.fan_active });
      setOutput(JSON.stringify(res.data || res, null, 2));
      await refresh(true);
    } finally {
      setFanBusy(false);
    }
  };
  return h(
    React.Fragment,
    null,
    h(
      Card,
      { icon: "🖥️", title: "Systeme", badge: "Info" },
      h(
        "div",
        { className: "field", style: { marginBottom: 8 } },
        h("label", null, "Intervalle de rafraichissement (s)"),
        h("input", {
          type: "number",
          min: 1,
          max: 3600,
          value: refreshSec,
          onChange: (e) =>
            setRefreshSec(Math.max(1, Math.min(3600, +e.target.value || 1))),
          disabled: disabled,
        }),
      ),
      h(
        "div",
        {
          style: {
            fontSize: ".78rem",
            color: "var(--text-dim)",
            marginBottom: 8,
          },
        },
        "Auto-refresh actif: toutes les " + refreshSec + "s",
      ),
      info &&
        h(
          "div",
          { className: "status-pairs" },
          h(
            "div",
            { className: "status-cell" },
            h("div", { className: "status-label" }, "Hostname"),
            h("div", { className: "status-value" }, info.hostname),
          ),
          h(
            "div",
            { className: "status-cell" },
            h("div", { className: "status-label" }, "Kernel"),
            h("div", { className: "status-value compact" }, info.kernel),
          ),
          h(
            "div",
            { className: "status-cell" },
            h("div", { className: "status-label" }, "CPU Temp"),
            h(
              "div",
              {
                className: "status-value",
                style: { color: info.cpu_temp_c > 70 ? "#ef4444" : "#22c55e" },
              },
              info.cpu_temp_c + "\u00B0C",
            ),
          ),
          h(
            "div",
            { className: "status-cell" },
            h("div", { className: "status-label" }, "CPU Charge"),
            h(
              "div",
              { className: "status-value" },
              info.cpu_usage_percent != null
                ? info.cpu_usage_percent + "%"
                : "—",
            ),
          ),
          h(
            "div",
            { className: "status-cell" },
            h("div", { className: "status-label" }, "Uptime"),
            h("div", { className: "status-value" }, fmtUp(info.uptime_s)),
          ),
          h(
            "div",
            { className: "status-cell" },
            h("div", { className: "status-label" }, "RAM Usage"),
            h(
              "div",
              { className: "status-value" },
              ramUsagePercent != null ? ramUsagePercent + "%" : "—",
            ),
          ),
          h(
            "div",
            { className: "status-cell" },
            h("div", { className: "status-label" }, "Arch"),
            h("div", { className: "status-value" }, info.arch || "—"),
          ),
          h(
            "div",
            { className: "status-cell" },
            h("div", { className: "status-label" }, "Boot mode"),
            h("div", { className: "status-value" }, bootModeLabel),
          ),
          h(
            "div",
            { className: "status-cell" },
            h("div", { className: "status-label" }, "Stockage libre"),
            h(
              "div",
              { className: "status-value compact" },
              diskFreeGb != null && diskTotalGb != null
                ? diskFreeGb + " Go / " + diskTotalGb + " Go"
                : "—",
            ),
          ),
          h(
            "div",
            { className: "status-cell" },
            h("div", { className: "status-label" }, "Fan"),
            h(
              "div",
              { className: "status-value", style: { color: fanColor } },
              fanLabel,
            ),
          ),
          h(
            "div",
            { className: "status-cell" },
            h("div", { className: "status-label" }, "Vitesse Fan"),
            h(
              "div",
              { className: "status-value compact" },
              info.fan_rpm != null ? info.fan_rpm + " RPM" : "—",
            ),
          ),
        ),
      info &&
        h(
          "button",
          {
            className: "btn " + (info.fan_active ? "danger" : "success"),
            onClick: toggleFan,
            disabled: disabled || fanBusy || !info.fan_available,
            style: { width: "100%", marginTop: 10 },
          },
          info.fan_active
            ? "Desactiver le ventilateur"
            : "Activer le ventilateur",
        ),
      output && h("div", { className: "output" }, output),
    ),
    h(
      Card,
      { icon: "🕒", title: "Status NTP", badge: "Chrony" },
      h(
        "div",
        {
          style: {
            fontSize: ".78rem",
            color: "var(--text-dim)",
            marginBottom: 8,
          },
        },
        "Rafraichissement synchronise avec Systeme: toutes les " +
          refreshSec +
          "s",
      ),
      info &&
        h(
          "div",
          { className: "status-pairs" },
          h(
            "div",
            { className: "status-cell" },
            h("div", { className: "status-label" }, "Status NTP"),
            h(
              "div",
              { className: "status-value", style: { color: ntpStatusColor } },
              ntpStatusLabel,
            ),
          ),
          h(
            "div",
            { className: "status-cell" },
            h("div", { className: "status-label" }, "Source clock"),
            h(
              "div",
              { className: "status-value" },
              (ntp && ntp.source_clock) || "—",
            ),
          ),
          h(
            "div",
            { className: "status-cell full" },
            h("div", { className: "status-label" }, "UTC time carte"),
            h(
              "div",
              { className: "status-value compact" },
              info.current_utc_time || "—",
            ),
          ),
          h(
            "div",
            { className: "status-cell full" },
            h(
              "div",
              { className: "status-label" },
              "Derniere synchro NTP (UTC)",
            ),
            h(
              "div",
              { className: "status-value compact" },
              (ntp && ntp.reference_time_utc) || "—",
            ),
          ),
          h(
            "div",
            { className: "status-cell" },
            h("div", { className: "status-label" }, "Update interval"),
            h(
              "div",
              { className: "status-value" },
              (ntp && ntp.update_interval) || "—",
            ),
          ),
          h(
            "div",
            { className: "status-cell" },
            h("div", { className: "status-label" }, "Last offset"),
            h(
              "div",
              { className: "status-value compact" },
              (ntp && ntp.last_offset) || "—",
            ),
          ),
        ),
    ),
  );
}
/* ===================================================================
 *  DEBUG PANEL — bottom log viewer
 * =================================================================== */
function DebugPanel({ ws }) {
  const [logs, setLogs] = useState([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const logsEndRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    const listener = (newLogs) => setLogs([...newLogs]);
    ws.logListeners.current.add(listener);
    setLogs([...ws.logsRef.current]);
    return () => ws.logListeners.current.delete(listener);
  }, [ws]);

  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  const clear = () => {
    ws.logsRef.current = [];
    setLogs([]);
  };

  return h(
    "div",
    { className: "debug-panel" },
    h(
      "div",
      { className: "debug-header" },
      h("span", null, "\uD83D\uDC1B Debug Console (", logs.length, " logs)"),
      h(
        "div",
        { className: "debug-actions" },
        h(
          "button",
          { onClick: () => setAutoScroll(!autoScroll) },
          autoScroll ? "Auto-scroll: ON" : "Auto-scroll: OFF",
        ),
        h("button", { onClick: clear }, "Effacer"),
      ),
    ),
    h(
      "div",
      { className: "debug-logs", ref: panelRef },
      logs.map((l, i) =>
        h(
          "div",
          { key: i, className: "log-entry" },
          h("span", { className: "log-time" }, l.ts),
          l.dir === "out" &&
            h("span", { className: "log-arrow-out" }, "\u25B6 "),
          l.dir === "in" && h("span", { className: "log-arrow-in" }, "\u25C0 "),
          l.dir === "err" && h("span", { className: "log-error" }, "\u2716 "),
          h("span", { className: "log-action" }, l.action, " "),
          h(
            "span",
            { className: "log-data" },
            typeof l.data === "string" ? l.data : JSON.stringify(l.data),
          ),
        ),
      ),
      h("div", { ref: logsEndRef }),
    ),
  );
}

/* ===================================================================
 *  SIDEBAR NAV ITEMS
 * =================================================================== */
const NAV_ITEMS = [
  { section: "💡 LEDs & Affichage" },
  { id: "blue_led", icon: "🔵", label: "Blue LED", badge: "GPIO17" },
  { id: "rgb_led", icon: "🌈", label: "LED RGB", badge: "GPIO5/6/13" },
  { id: "ws2812", icon: "💎", label: "WS2812 LED", badge: "GPIO18" },
  { id: "led_matrix", icon: "⬜", label: "LED Matrix 8x8", badge: "74HC595" },
  { id: "seven_seg", icon: "🔢", label: "Afficheur 7-Seg", badge: "74HC595" },
  { id: "led_bar", icon: "📊", label: "LED Bar Graph", badge: "74HC595" },

  { section: "⚙️ Moteurs & Actionneurs" },
  { id: "servo", icon: "🔄", label: "Servo Moteur", badge: "GPIO18" },
  { id: "stepper", icon: "⚙️", label: "Moteur Pas-a-Pas", badge: "GPIO" },
  { id: "motor", icon: "🔌", label: "Moteur DC", badge: "GPIO18/23/24" },
  { id: "active_buzz", icon: "🔔", label: "Buzzer Actif", badge: "GPIO25" },
  { id: "passive_buzz", icon: "🔊", label: "Buzzer Passif", badge: "GPIO4" },
  { id: "relay", icon: "⚡", label: "Relais", badge: "GPIO12" },

  { section: "📡 Capteurs" },
  { id: "dht", icon: "🌡️", label: "DHT11", badge: "GPIO23" },
  {
    id: "ultrasonic",
    icon: "📏",
    label: "Ultrason HC-SR04",
    badge: "GPIO20/21",
  },
  { id: "mpu6050", icon: "🎯", label: "MPU6050", badge: "I2C" },
  { id: "ir_motion", icon: "👁️", label: "Capteur IR", badge: "GPIO14" },
  { id: "photoresist", icon: "☀️", label: "Photoresistance", badge: "ADC" },
  { id: "thermistor", icon: "🌡️", label: "Thermistance", badge: "ADC" },

  { section: "🕹️ Entrees" },
  { id: "button", icon: "🔘", label: "Bouton", badge: "GPIO16" },
  { id: "joystick", icon: "🕹️", label: "JoyStick", badge: "ADC" },
  { id: "potentiom", icon: "🎛️", label: "Potentiometres", badge: "ADC" },
  {
    id: "keypad",
    icon: "⌨️",
    label: "Clavier 4x4",
    badge: "R16/20/21/26 C19/13/6/5",
  },
  { id: "rfid", icon: "💳", label: "RFID-RC522", badge: "SPI" },

  { section: "📟 Communication" },
  { id: "lcd", icon: "📺", label: "I2C LCD 1602", badge: "I2C" },
  { id: "i2c_scan", icon: "🔍", label: "I2C Scanner", badge: "I2C" },
  { id: "adc", icon: "📊", label: "ADC (ADS7830)", badge: "I2C" },

  { section: "🔧 Systeme" },
  { id: "gpio", icon: "💡", label: "GPIO Control", badge: "BCM" },
  { id: "pwm", icon: "〰️", label: "PWM Control", badge: "GPIO" },
];

/* ===================================================================
 *  MAIN APP — 3-column layout
 * =================================================================== */
function App() {
  const wsUrl = buildWebSocketUrl();
  const ws = useWebSocket(wsUrl);
  const [activePanel, setActivePanel] = useState("gpio");
  const [showDebug, setShowDebug] = useState(false);
  const previousPanelRef = useRef(activePanel);
  const wsOnlyDis = !ws.ready;

  useEffect(() => {
    const previousPanel = previousPanelRef.current;

    if (ws.ready && previousPanel && previousPanel !== activePanel) {
      ws.send("panel_change", {
        previous_panel: previousPanel,
        panel: activePanel,
      });
    }

    previousPanelRef.current = activePanel;
  }, [activePanel, ws.ready, ws.send]);

  /* Map panel id -> component */
  const PANELS = {
    blue_led: h(BlueLedPanel, { ws, disabled: wsOnlyDis }),
    rgb_led: h(RgbLedPanel, { ws, disabled: wsOnlyDis }),
    ws2812: h(Ws2812Panel, { ws, disabled: wsOnlyDis }),
    led_matrix: h(LedMatrixPanel, { ws, disabled: wsOnlyDis }),
    seven_seg: h(SevenSegPanel, { ws, disabled: wsOnlyDis }),
    led_bar: h(LedBarPanel, { ws, disabled: wsOnlyDis }),
    servo: h(ServoPanel, { ws, disabled: wsOnlyDis }),
    stepper: h(StepperPanel, { ws, disabled: wsOnlyDis }),
    motor: h(MotorPanel, { ws, disabled: wsOnlyDis }),
    active_buzz: h(ActiveBuzzerPanel, { ws, disabled: wsOnlyDis }),
    passive_buzz: h(PassiveBuzzerPanel, { ws, disabled: wsOnlyDis }),
    relay: h(RelayPanel, { ws, disabled: wsOnlyDis }),
    dht: h(DhtPanel, { ws, disabled: wsOnlyDis }),
    ultrasonic: h(UltrasonicPanel, { ws, disabled: wsOnlyDis }),
    mpu6050: h(Mpu6050Panel, { ws, disabled: wsOnlyDis }),
    ir_motion: h(IrMotionPanel, { ws, disabled: wsOnlyDis }),
    photoresist: h(PhotoresistorPanel, { ws, disabled: wsOnlyDis }),
    thermistor: h(ThermistorPanel, { ws, disabled: wsOnlyDis }),
    button: h(ButtonPanel, { ws, disabled: wsOnlyDis }),
    joystick: h(JoystickPanel, { ws, disabled: wsOnlyDis }),
    potentiom: h(PotentiometerPanel, { ws, disabled: wsOnlyDis }),
    keypad: h(KeypadPanel, { ws, disabled: wsOnlyDis }),
    rfid: h(RfidPanel, { ws, disabled: wsOnlyDis }),
    lcd: h(LcdPanel, { ws, disabled: wsOnlyDis }),
    i2c_scan: h(I2cPanel, { ws, disabled: wsOnlyDis }),
    adc: h(AdcPanel, { ws, disabled: wsOnlyDis }),
    gpio: h(GpioPanel, { ws, disabled: wsOnlyDis }),
    pwm: h(PwmPanel, { ws, disabled: wsOnlyDis }),
  };

  return h(
    "div",
    { className: "app-wrapper" },
    h(
      "header",
      { className: "app-header" },
      h(
        "h1",
        null,
        "\uD83E\uDDEA Freenove ",
        h("span", null, "Projects Board"),
        " \u2014 Dashboard",
      ),
      h(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          },
        },
        h(ConnectionBar, { ws }),
        h(
          "button",
          {
            className: "debug-toggle" + (showDebug ? " active" : ""),
            onClick: () => setShowDebug(!showDebug),
          },
          h("span", { className: "dt-dot" }),
          showDebug ? "Debug ON" : "Debug",
        ),
      ),
    ),

    !ws.ready &&
      h(
        "div",
        {
          style: { textAlign: "center", padding: 40, color: "var(--text-dim)" },
        },
        h(
          "p",
          { style: { fontSize: "1.2rem", marginBottom: 12 } },
          "\u26A1 Connexion au backend requise",
        ),
        h(
          "button",
          { className: "btn", onClick: ws.connect },
          "Se connecter au WebSocket",
        ),
      ),

    ws.ready &&
      h(
        "div",
        { className: "app-layout" },

        /* --- Left sidebar --- */
        h(
          "nav",
          { className: "sidebar" },
          NAV_ITEMS.map((item, i) =>
            item.section
              ? h(
                  "div",
                  { key: "s" + i, className: "sidebar-section" },
                  item.section,
                )
              : h(
                  "div",
                  {
                    key: item.id,
                    className:
                      "sidebar-item" +
                      (activePanel === item.id ? " active" : ""),
                    onClick: () => setActivePanel(item.id),
                  },
                  h("span", { className: "si-icon" }, item.icon),
                  item.label,
                  item.badge &&
                    h("span", { className: "si-badge" }, item.badge),
                ),
          ),
        ),

        /* --- Center: active panel --- */
        h(
          "div",
          { className: "center-panel" },
          PANELS[activePanel] ||
            h(
              "p",
              { style: { color: "var(--text-dim)" } },
              "Selectionnez un composant",
            ),
        ),

        /* --- Right: System info + Terminal --- */
        h(
          "div",
          { className: "right-panel" },
          h(SystemInfoPanel, { ws, disabled: wsOnlyDis }),
        ),
      ),

    /* --- Bottom: Debug panel --- */
    showDebug && h(DebugPanel, { ws }),
  );
}

/* Mount */
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(h(App));
