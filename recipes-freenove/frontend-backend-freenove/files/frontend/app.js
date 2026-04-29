/**
 * Freenove Projects Board for Raspberry Pi — Dashboard (PRODUCTION)
 * All components from the FNK0054 board.
 * Connects to Python backend via WebSocket.
 */
const { useState, useEffect, useRef, useCallback } = React;

/* ===================================================================
 *  WebSocket hook
 * =================================================================== */
function useWebSocket(url) {
  const wsRef = useRef(null);
  const idRef = useRef(0);
  const cbMap = useRef({});
  const [ready, setReady] = useState(false);

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

  const send = useCallback((action, params = {}) => {
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
  }, []);

  return { ready, connect, disconnect, send, logsRef, logListeners };
}

/* ===================================================================
 *  HELPERS
 * =================================================================== */
function Card({ icon, title, badge, children }) {
  return (
    <div className="card">
      <div className="card-header">
        <span className="icon">{icon}</span> {title}
        {badge && <span className="pin-badge">{badge}</span>}
      </div>
      <div className="card-body">{children}</div>
    </div>
  );
}
function Section({ title }) {
  return <div className="section-title">{title}</div>;
}

/* ===================================================================
 *  CONNECTION BAR
 * =================================================================== */
function ConnectionBar({ ws }) {
  return (
    <div className="conn-bar">
      <span className={`status-dot ${ws.ready ? "on" : "off"}`} />
      <span
        style={{ fontSize: ".82rem", color: ws.ready ? "#22c55e" : "#ef4444" }}
      >
        WS {ws.ready ? "OK" : "OFF"}
      </span>
      {!ws.ready ? (
        <button className="btn sm" onClick={ws.connect}>
          Connecter WS
        </button>
      ) : (
        <button className="btn sm danger" onClick={ws.disconnect}>
          Deconnecter WS
        </button>
      )}
      <span
        style={{ marginLeft: 8, fontSize: ".78rem", color: "var(--text-dim)" }}
      >
        Commandes materiel via WebSocket
      </span>
    </div>
  );
}

/* ===================================================================
 *  1. BLUE LED (GPIO17)
 * =================================================================== */
function BlueLedPanel({ ws, disabled }) {
  const [on, setOn] = useState(false);
  const [output, setOutput] = useState("");
  const toggle = async () => {
    const nv = on ? 0 : 1;
    const res = await ws.send("gpio_write", { pin: 17, value: nv });
    if (res.status === "ok") setOn(!on);
    setOutput(JSON.stringify(res.data, null, 2));
  };
  return (
    <Card icon="🔵" title="Blue LED" badge="GPIO17">
      <button
        className={`toggle-big${on ? " active" : ""}`}
        onClick={toggle}
        disabled={disabled}
      >
        {on ? "ON — Allumee" : "OFF — Eteinte"}
      </button>
      {output && <div className="output">{output}</div>}
    </Card>
  );
}

/* ===================================================================
 *  2. RGB LED (GPIO5=R, GPIO6=G, GPIO13=B)
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
  return (
    <Card icon="🌈" title="RGB LED" badge="GPIO5/6/13">
      <div
        className="color-preview"
        style={{ background: `rgb(${r},${g},${b})` }}
      />
      <div className="field">
        <label>Rouge: {r}</label>
        <input
          type="range"
          min="0"
          max="255"
          value={r}
          onChange={(e) => setR(+e.target.value)}
        />
      </div>
      <div className="field">
        <label>Vert: {g}</label>
        <input
          type="range"
          min="0"
          max="255"
          value={g}
          onChange={(e) => setG(+e.target.value)}
        />
      </div>
      <div className="field">
        <label>Bleu: {b}</label>
        <input
          type="range"
          min="0"
          max="255"
          value={b}
          onChange={(e) => setB(+e.target.value)}
        />
      </div>
      <button
        className="btn"
        onClick={send}
        disabled={disabled}
        style={{ width: "100%" }}
      >
        Appliquer
      </button>
      {output && <div className="output">{output}</div>}
    </Card>
  );
}

/* ===================================================================
 *  3. WS2812 LED (GPIO18)
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
  return (
    <Card icon="💎" title="WS2812 LED" badge="GPIO18">
      <div className="ws-strip">
        {Array.from({ length: count }, (_, i) => (
          <div
            key={i}
            className="ws-led"
            style={{ background: `rgb(${r},${g},${b})` }}
          />
        ))}
      </div>
      <div className="field">
        <label>Nombre LEDs: {count}</label>
        <input
          type="range"
          min="1"
          max="16"
          value={count}
          onChange={(e) => setCount(+e.target.value)}
        />
      </div>
      <div className="field">
        <label>R: {r}</label>
        <input
          type="range"
          min="0"
          max="255"
          value={r}
          onChange={(e) => setR(+e.target.value)}
        />
      </div>
      <div className="field">
        <label>G: {g}</label>
        <input
          type="range"
          min="0"
          max="255"
          value={g}
          onChange={(e) => setG(+e.target.value)}
        />
      </div>
      <div className="field">
        <label>B: {b}</label>
        <input
          type="range"
          min="0"
          max="255"
          value={b}
          onChange={(e) => setB(+e.target.value)}
        />
      </div>
      <button
        className="btn"
        onClick={send}
        disabled={disabled}
        style={{ width: "100%" }}
      >
        Appliquer
      </button>
      {output && <div className="output">{output}</div>}
    </Card>
  );
}

/* ===================================================================
 *  4. LED MATRIX 8x8 (74HC595)
 * =================================================================== */
function LedMatrixPanel({ ws, disabled }) {
  const [grid, setGrid] = useState(Array(64).fill(false));
  const [output, setOutput] = useState("");
  const toggle = (i) => {
    const g = [...grid];
    g[i] = !g[i];
    setGrid(g);
  };
  const send = async () => {
    const rows = [];
    for (let r = 0; r < 8; r++) {
      let val = 0;
      for (let c = 0; c < 8; c++) if (grid[r * 8 + c]) val |= 1 << (7 - c);
      rows.push(val);
    }
    const res = await ws.send("led_matrix", { pattern: rows });
    setOutput(JSON.stringify(res.data, null, 2));
  };
  const clear = () => setGrid(Array(64).fill(false));
  const presets = {
    smile: [0x3c, 0x42, 0xa5, 0x81, 0xa5, 0x99, 0x42, 0x3c],
    heart: [0x00, 0x66, 0xff, 0xff, 0xff, 0x7e, 0x3c, 0x18],
    arrow: [0x18, 0x3c, 0x7e, 0xff, 0x18, 0x18, 0x18, 0x18],
  };
  const applyPreset = (name) => {
    const pat = presets[name];
    const g = Array(64).fill(false);
    pat.forEach((row, r) => {
      for (let c = 0; c < 8; c++) if (row & (1 << (7 - c))) g[r * 8 + c] = true;
    });
    setGrid(g);
  };
  return (
    <Card icon="⬜" title="LED Matrix 8x8" badge="74HC595">
      <div className="led-matrix">
        {grid.map((on, i) => (
          <div
            key={i}
            className={`led-cell${on ? " on" : ""}`}
            onClick={() => !disabled && toggle(i)}
          />
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
        <button className="btn sm" onClick={() => applyPreset("smile")}>
          Smile
        </button>
        <button className="btn sm" onClick={() => applyPreset("heart")}>
          Coeur
        </button>
        <button className="btn sm" onClick={() => applyPreset("arrow")}>
          Fleche
        </button>
        <button className="btn sm danger" onClick={clear}>
          Effacer
        </button>
      </div>
      <button
        className="btn"
        onClick={send}
        disabled={disabled}
        style={{ width: "100%", marginTop: 8 }}
      >
        Envoyer
      </button>
      {output && <div className="output">{output}</div>}
    </Card>
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
  return (
    <Card icon="🔢" title="Afficheur 7-Segments" badge="74HC595">
      <div className="seg-display">
        {digits.map((d, i) => (
          <span key={i} className={`seg-digit${d === " " ? " dim" : ""}`}>
            {d === " " ? "8" : d}
          </span>
        ))}
      </div>
      <div className="field">
        <label>Valeur (0-9999)</label>
        <input
          type="text"
          maxLength="4"
          value={value}
          onChange={(e) =>
            setValue(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))
          }
        />
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        <button className="btn sm" onClick={() => setValue("1234")}>
          1234
        </button>
        <button
          className="btn sm"
          onClick={() => setValue(String(Math.floor(Math.random() * 10000)))}
        >
          Random
        </button>
        <button className="btn sm danger" onClick={() => setValue("0000")}>
          Reset
        </button>
      </div>
      <button
        className="btn"
        onClick={send}
        disabled={disabled}
        style={{ width: "100%", marginTop: 8 }}
      >
        Afficher
      </button>
      {output && <div className="output">{output}</div>}
    </Card>
  );
}

/* ===================================================================
 *  6. LED BAR GRAPH (74HC595)
 * =================================================================== */
function LedBarPanel({ ws, disabled }) {
  const [level, setLevel] = useState(5);
  const [output, setOutput] = useState("");
  const send = async () => {
    const res = await ws.send("led_bar", { level });
    setOutput(JSON.stringify(res.data, null, 2));
  };
  return (
    <Card icon="📊" title="LED Bar Graph" badge="74HC595">
      <div className="bar-graph">
        {Array.from({ length: 10 }, (_, i) => {
          const on = i < level;
          return (
            <div
              key={i}
              className={`bar-seg${on ? " on" : ""}${i >= 8 && on ? " danger" : i >= 6 && on ? " warn" : ""}`}
              onClick={() => setLevel(i + 1)}
              style={{ flex: 1 }}
            />
          );
        })}
      </div>
      <div className="field" style={{ marginTop: 8 }}>
        <label>Niveau: {level}/10</label>
        <input
          type="range"
          min="0"
          max="10"
          value={level}
          onChange={(e) => setLevel(+e.target.value)}
        />
      </div>
      <button
        className="btn"
        onClick={send}
        disabled={disabled}
        style={{ width: "100%", marginTop: 6 }}
      >
        Appliquer
      </button>
      {output && <div className="output">{output}</div>}
    </Card>
  );
}

/* ===================================================================
 *  7. SERVO (GPIO18)
 * =================================================================== */
function ServoPanel({ ws, disabled }) {
  const [angle, setAngle] = useState(90);
  const [output, setOutput] = useState("");
  const send = async () => {
    const res = await ws.send("servo_set", { pin: 18, angle });
    setOutput(JSON.stringify(res.data, null, 2));
  };
  return (
    <Card icon="🔄" title="Servo Moteur" badge="GPIO18">
      <div className="motor-visual">
        <div
          className="arrow"
          style={{ transform: `rotate(${(angle - 90) * 2}deg)` }}
        />
      </div>
      <div className="field">
        <label>Angle: {angle}°</label>
        <input
          type="range"
          min="0"
          max="180"
          value={angle}
          onChange={(e) => setAngle(+e.target.value)}
        />
      </div>
      <div
        style={{
          display: "flex",
          gap: 6,
          justifyContent: "center",
          marginTop: 4,
        }}
      >
        {[0, 45, 90, 135, 180].map((a) => (
          <button key={a} className="btn sm" onClick={() => setAngle(a)}>
            {a}°
          </button>
        ))}
      </div>
      <button
        className="btn"
        onClick={send}
        disabled={disabled}
        style={{ width: "100%", marginTop: 8 }}
      >
        Appliquer {angle}°
      </button>
      {output && <div className="output">{output}</div>}
    </Card>
  );
}

/* ===================================================================
 *  8. STEPPING MOTOR (GPIO6/13/19/26)
 * =================================================================== */
function StepperPanel({ ws, disabled }) {
  const [steps, setSteps] = useState(100);
  const [speed, setSpeed] = useState(5);
  const [output, setOutput] = useState("");
  const send = async (dir) => {
    const res = await ws.send("stepper_control", {
      direction: dir,
      steps,
      speed,
    });
    setOutput(JSON.stringify(res.data, null, 2));
  };
  return (
    <Card icon="⚙️" title="Moteur Pas-a-Pas" badge="GPIO6/13/19/26">
      <div className="field-row">
        <div className="field" style={{ flex: 1 }}>
          <label>Pas</label>
          <input
            type="number"
            min="1"
            max="2048"
            value={steps}
            onChange={(e) => setSteps(+e.target.value)}
          />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Vitesse (ms)</label>
          <input
            type="number"
            min="1"
            max="50"
            value={speed}
            onChange={(e) => setSpeed(+e.target.value)}
          />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button
          className="btn"
          onClick={() => send("ccw")}
          disabled={disabled}
          style={{ flex: 1 }}
        >
          ↺ Anti-horaire
        </button>
        <button
          className="btn"
          onClick={() => send("cw")}
          disabled={disabled}
          style={{ flex: 1 }}
        >
          ↻ Horaire
        </button>
      </div>
      <button
        className="btn danger"
        onClick={() => send("stop")}
        disabled={disabled}
        style={{ width: "100%", marginTop: 6 }}
      >
        Stop
      </button>
      {output && <div className="output">{output}</div>}
    </Card>
  );
}

/* ===================================================================
 *  9. DC MOTOR (GPIO18=EN, GPIO23=IN1, GPIO24=IN2)
 * =================================================================== */
function MotorPanel({ ws, disabled }) {
  const [speed, setSpeed] = useState(50);
  const [output, setOutput] = useState("");
  const send = async (dir) => {
    const res = await ws.send("motor_control", { speed, direction: dir });
    setOutput(JSON.stringify(res.data, null, 2));
  };
  return (
    <Card icon="🔌" title="Moteur DC" badge="GPIO18/23/24">
      <div className="field">
        <label>Vitesse: {speed}%</label>
        <input
          type="range"
          min="0"
          max="100"
          value={speed}
          onChange={(e) => setSpeed(+e.target.value)}
        />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button
          className="btn success"
          onClick={() => send("forward")}
          disabled={disabled}
          style={{ flex: 1 }}
        >
          ▶ Avant
        </button>
        <button
          className="btn warning"
          onClick={() => send("backward")}
          disabled={disabled}
          style={{ flex: 1 }}
        >
          ◀ Arriere
        </button>
        <button
          className="btn danger"
          onClick={() => send("stop")}
          disabled={disabled}
        >
          Stop
        </button>
      </div>
      {output && <div className="output">{output}</div>}
    </Card>
  );
}

/* ===================================================================
 *  10. ACTIVE BUZZER (GPIO17)
 * =================================================================== */
function ActiveBuzzerPanel({ ws, disabled }) {
  const [on, setOn] = useState(false);
  const [output, setOutput] = useState("");
  const toggle = async () => {
    const st = on ? "off" : "on";
    const res = await ws.send("buzzer", {
      pin: 17,
      state: st,
      frequency: 0,
      duration: 0,
    });
    if (res.status === "ok") setOn(!on);
    setOutput(JSON.stringify(res.data, null, 2));
  };
  return (
    <Card icon="🔔" title="Buzzer Actif" badge="GPIO17">
      <button
        className={`toggle-big${on ? " active" : ""}`}
        onClick={toggle}
        disabled={disabled}
      >
        {on ? "🔊 ON" : "🔇 OFF"}
      </button>
      {output && <div className="output">{output}</div>}
    </Card>
  );
}

/* ===================================================================
 *  11. PASSIVE BUZZER (GPIO4)
 * =================================================================== */
function PassiveBuzzerPanel({ ws, disabled }) {
  const [freq, setFreq] = useState(440);
  const [dur, setDur] = useState(0.5);
  const [output, setOutput] = useState("");
  const tone = async () => {
    const res = await ws.send("buzzer", {
      pin: 4,
      state: "tone",
      frequency: freq,
      duration: dur,
    });
    setOutput(JSON.stringify(res.data, null, 2));
  };
  const off = async () => {
    const res = await ws.send("buzzer", { pin: 4, state: "off" });
    setOutput(JSON.stringify(res.data, null, 2));
  };
  return (
    <Card icon="🔊" title="Buzzer Passif" badge="GPIO4">
      <div className="field-row">
        <div className="field" style={{ flex: 1 }}>
          <label>Frequence (Hz)</label>
          <input
            type="number"
            min="20"
            max="20000"
            value={freq}
            onChange={(e) => setFreq(+e.target.value)}
          />
        </div>
        <div className="field" style={{ width: 80 }}>
          <label>Duree (s)</label>
          <input
            type="number"
            min="0.1"
            max="10"
            step="0.1"
            value={dur}
            onChange={(e) => setDur(+e.target.value)}
          />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button className="btn success" onClick={tone} disabled={disabled}>
          🔊 Jouer
        </button>
        <button className="btn danger" onClick={off} disabled={disabled}>
          🔇 Stop
        </button>
      </div>
      <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
        {[
          { n: "Do", f: 523 },
          { n: "Re", f: 587 },
          { n: "Mi", f: 659 },
          { n: "Fa", f: 698 },
          { n: "Sol", f: 784 },
          { n: "La", f: 880 },
          { n: "Si", f: 988 },
        ].map((note) => (
          <button
            key={note.n}
            className="btn sm"
            style={{ flex: 1, minWidth: 36 }}
            disabled={disabled}
            onClick={async () => {
              setFreq(note.f);
              await ws.send("buzzer", {
                pin: 4,
                state: "tone",
                frequency: note.f,
                duration: 0.3,
              });
            }}
          >
            {note.n}
          </button>
        ))}
      </div>
      {output && <div className="output">{output}</div>}
    </Card>
  );
}

/* ===================================================================
 *  12. RELAY (GPIO12)
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
  return (
    <Card icon="⚡" title="Relais" badge="GPIO12">
      <button
        className={`toggle-big${on ? " active" : ""}`}
        onClick={toggle}
        disabled={disabled}
      >
        {on ? "FERME (ON)" : "OUVERT (OFF)"}
      </button>
      <p style={{ fontSize: ".75rem", color: "var(--text-dim)", marginTop: 6 }}>
        Controle le circuit de puissance via le relais
      </p>
      {output && <div className="output">{output}</div>}
    </Card>
  );
}

/* ===================================================================
 *  13. DHT11 (GPIO23)
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
  return (
    <Card icon="🌡️" title="DHT11 Temp/Humidite" badge="GPIO23">
      {data && (
        <div
          style={{
            display: "flex",
            gap: 16,
            justifyContent: "center",
            marginBottom: 8,
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div className="sensor-value" style={{ color: "#ef4444" }}>
              {data.temperature}
              <span className="sensor-unit"> °C</span>
            </div>
            <div style={{ fontSize: ".75rem", color: "var(--text-dim)" }}>
              Temperature
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div className="sensor-value" style={{ color: "#38bdf8" }}>
              {data.humidity}
              <span className="sensor-unit"> %</span>
            </div>
            <div style={{ fontSize: ".75rem", color: "var(--text-dim)" }}>
              Humidite
            </div>
          </div>
        </div>
      )}
      <button
        className="btn"
        onClick={read}
        disabled={disabled}
        style={{ width: "100%" }}
      >
        Lire capteur
      </button>
      {output && <div className="output">{output}</div>}
    </Card>
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
  return (
    <Card icon="📏" title="Ultrason HC-SR04" badge="GPIO20/21">
      {data && (
        <div className="sensor-value">
          {data.distance_cm}
          <span className="sensor-unit"> cm</span>
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn" onClick={read} disabled={disabled}>
          Mesurer
        </button>
        <button
          className={`btn ${polling ? "danger" : "success"}`}
          onClick={togglePoll}
          disabled={disabled}
        >
          {polling ? "Stop Auto" : "Auto"}
        </button>
      </div>
      {output && <div className="output">{output}</div>}
    </Card>
  );
}

/* ===================================================================
 *  15. MPU6050 (I2C 0x68)
 * =================================================================== */
function Mpu6050Panel({ ws, disabled }) {
  const [data, setData] = useState(null);
  const [output, setOutput] = useState("");
  const read = async () => {
    const res = await ws.send("mpu6050_read");
    setOutput(JSON.stringify(res.data, null, 2));
    if (res.status === "ok" && res.data.stdout)
      try {
        setData(JSON.parse(res.data.stdout));
      } catch {}
  };
  return (
    <Card icon="🎯" title="MPU6050 Accel/Gyro" badge="I2C 0x68">
      {data && (
        <div>
          <div
            style={{
              fontSize: ".75rem",
              color: "var(--text-dim)",
              marginBottom: 4,
            }}
          >
            Accelerometre (g)
          </div>
          <div className="axes-grid">
            {["x", "y", "z"].map((a) => (
              <div key={a} className="axis-item">
                <div className="axis-label">{a.toUpperCase()}</div>
                <div className="axis-val">{data.accel[a]}</div>
              </div>
            ))}
          </div>
          <div
            style={{
              fontSize: ".75rem",
              color: "var(--text-dim)",
              marginBottom: 4,
              marginTop: 8,
            }}
          >
            Gyroscope (°/s)
          </div>
          <div className="axes-grid">
            {["x", "y", "z"].map((a) => (
              <div key={a} className="axis-item">
                <div className="axis-label">{a.toUpperCase()}</div>
                <div className="axis-val">{data.gyro[a]}</div>
              </div>
            ))}
          </div>
          <div
            style={{ textAlign: "center", marginTop: 6, fontSize: ".85rem" }}
          >
            Temp: <strong>{data.temp}°C</strong>
          </div>
        </div>
      )}
      <button
        className="btn"
        onClick={read}
        disabled={disabled}
        style={{ width: "100%", marginTop: 8 }}
      >
        Lire
      </button>
      {output && <div className="output">{output}</div>}
    </Card>
  );
}

/* ===================================================================
 *  16. IR MOTION SENSOR (GPIO14)
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
  return (
    <Card icon="👁️" title="Capteur IR Mouvement" badge="GPIO14">
      <div className={`detect-indicator${detected ? " detected" : ""}`}>
        {detected ? "🟢" : "⚪"}
      </div>
      <div style={{ textAlign: "center", fontSize: ".85rem", marginBottom: 8 }}>
        {detected ? "Mouvement detecte !" : "Aucun mouvement"}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn" onClick={read} disabled={disabled}>
          Lire
        </button>
        <button
          className={`btn ${polling ? "danger" : "success"}`}
          onClick={togglePoll}
          disabled={disabled}
        >
          {polling ? "Stop" : "Auto"}
        </button>
      </div>
      {output && <div className="output">{output}</div>}
    </Card>
  );
}

/* ===================================================================
 *  17. PHOTORESISTOR (ADC)
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
  return (
    <Card icon="☀️" title="Photoresistance" badge="ADC">
      {data && (
        <div className="sensor-value">
          {data.light_percent}
          <span className="sensor-unit"> %</span>
        </div>
      )}
      <button
        className="btn"
        onClick={read}
        disabled={disabled}
        style={{ width: "100%" }}
      >
        Lire luminosite
      </button>
      {output && <div className="output">{output}</div>}
    </Card>
  );
}

/* ===================================================================
 *  18. THERMISTOR (ADC CH0)
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
  return (
    <Card icon="🌡️" title="Thermistance" badge="ADC A0">
      {data && (
        <div className="sensor-value" style={{ color: "#ef4444" }}>
          {data.temperature_c}
          <span className="sensor-unit"> °C</span>
        </div>
      )}
      <button
        className="btn"
        onClick={read}
        disabled={disabled}
        style={{ width: "100%" }}
      >
        Lire temperature
      </button>
      {output && <div className="output">{output}</div>}
    </Card>
  );
}

/* ===================================================================
 *  19. BUTTON (GPIO16)
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
  return (
    <Card icon="🔘" title="Bouton" badge="GPIO16">
      <div
        className={`detect-indicator${pressed ? " detected" : ""}`}
        style={{
          background: pressed ? "rgba(239,68,68,.15)" : "transparent",
          borderColor: pressed ? "var(--red)" : "var(--border)",
        }}
      >
        {pressed ? "🔴" : "⚪"}
      </div>
      <div style={{ textAlign: "center", fontSize: ".85rem", marginBottom: 8 }}>
        {pressed ? "APPUYE" : "Relache"}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn" onClick={read} disabled={disabled}>
          Lire
        </button>
        <button
          className={`btn ${polling ? "danger" : "success"}`}
          onClick={togglePoll}
          disabled={disabled}
        >
          {polling ? "Stop" : "Auto"}
        </button>
      </div>
      {output && <div className="output">{output}</div>}
    </Card>
  );
}

/* ===================================================================
 *  20. JOYSTICK (ADC + button)
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
  return (
    <Card icon="🕹️" title="JoyStick" badge="ADC">
      <div className="joy-container">
        <div className="joy-crosshair-h" />
        <div className="joy-crosshair-v" />
        <div
          className="joy-dot"
          style={{ left: pctX + "%", top: pctY + "%" }}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 16,
          fontSize: ".85rem",
          marginTop: 4,
        }}
      >
        <span>
          X: <strong>{data.x}</strong>
        </span>
        <span>
          Y: <strong>{data.y}</strong>
        </span>
        <span>
          Btn:{" "}
          <strong
            style={{ color: data.button ? "var(--red)" : "var(--green)" }}
          >
            {data.button ? "ON" : "OFF"}
          </strong>
        </span>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button className="btn" onClick={read} disabled={disabled}>
          Lire
        </button>
        <button
          className={`btn ${polling ? "danger" : "success"}`}
          onClick={togglePoll}
          disabled={disabled}
        >
          {polling ? "Stop" : "Auto"}
        </button>
      </div>
      {output && <div className="output">{output}</div>}
    </Card>
  );
}

/* ===================================================================
 *  21. POTENTIOMETER (ADC A2/A3/A4)
 * =================================================================== */
function PotentiometerPanel({ ws, disabled }) {
  const [ch, setCh] = useState(2);
  const [data, setData] = useState(null);
  const [output, setOutput] = useState("");
  const read = async () => {
    const res = await ws.send("adc_read", { channel: ch });
    setOutput(JSON.stringify(res.data, null, 2));
    if (res.status === "ok" && res.data.stdout)
      try {
        setData(JSON.parse(res.data.stdout));
      } catch {}
  };
  return (
    <Card icon="🎛️" title="Potentiometres" badge="ADC A2-A4">
      <div className="field-row">
        <div className="field" style={{ flex: 1 }}>
          <label>Potentiometre</label>
          <select value={ch} onChange={(e) => setCh(+e.target.value)}>
            <option value={2}>RP1 (A2)</option>
            <option value={3}>RP2 (A3)</option>
            <option value={4}>RP3 (A4)</option>
          </select>
        </div>
        <button className="btn" onClick={read} disabled={disabled}>
          Lire
        </button>
      </div>
      {data && (
        <div className="sensor-value">
          {data.percent || data.voltage}
          <span className="sensor-unit">{data.percent ? " %" : " V"}</span>
        </div>
      )}
      {output && <div className="output">{output}</div>}
    </Card>
  );
}

/* ===================================================================
 *  22. RFID-RC522 (SPI)
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
  return (
    <Card icon="💳" title="RFID-RC522" badge="SPI">
      <div
        className={`detect-indicator${data && data.status === "detected" ? " detected" : ""}`}
      >
        {data && data.status === "detected" ? "✅" : "📡"}
      </div>
      {data && (
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          {data.status === "detected" ? (
            <div>
              <div style={{ fontSize: ".85rem" }}>
                UID: <strong>{data.uid}</strong>
              </div>
              <div style={{ fontSize: ".75rem", color: "var(--text-dim)" }}>
                Type: {data.type}
              </div>
            </div>
          ) : (
            <div style={{ color: "var(--text-dim)" }}>
              Aucune carte detectee
            </div>
          )}
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn" onClick={read} disabled={disabled}>
          Lire
        </button>
        <button
          className={`btn ${polling ? "danger" : "success"}`}
          onClick={togglePoll}
          disabled={disabled}
        >
          {polling ? "Stop" : "Scan Auto"}
        </button>
      </div>
      {output && <div className="output">{output}</div>}
    </Card>
  );
}

/* ===================================================================
 *  23. KEYPAD 4x4
 * =================================================================== */
function KeypadPanel({ ws, disabled }) {
  const [lastKey, setLastKey] = useState("");
  const [output, setOutput] = useState("");
  const keys = [
    "1",
    "2",
    "3",
    "A",
    "4",
    "5",
    "6",
    "B",
    "7",
    "8",
    "9",
    "C",
    "*",
    "0",
    "#",
    "D",
  ];
  const read = async () => {
    const res = await ws.send("keypad_read");
    setOutput(JSON.stringify(res.data, null, 2));
    if (res.status === "ok" && res.data.stdout)
      try {
        setLastKey(JSON.parse(res.data.stdout).key);
      } catch {}
  };
  return (
    <Card icon="⌨️" title="Clavier Matriciel 4x4" badge="GPIO">
      <div className="keypad-grid">
        {keys.map((k) => (
          <div key={k} className={`key-btn${lastKey === k ? " pressed" : ""}`}>
            {k}
          </div>
        ))}
      </div>
      <div style={{ textAlign: "center", margin: "8px 0", fontSize: ".85rem" }}>
        Derniere touche: <strong>{lastKey || "—"}</strong>
      </div>
      <button
        className="btn"
        onClick={read}
        disabled={disabled}
        style={{ width: "100%" }}
      >
        Lire touche
      </button>
      {output && <div className="output">{output}</div>}
    </Card>
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
  return (
    <Card icon="📺" title="I2C LCD 1602" badge="I2C 0x27">
      <div className="lcd-screen">
        <div>{(line1 || "").padEnd(16, " ").slice(0, 16)}</div>
        <div>{(line2 || "").padEnd(16, " ").slice(0, 16)}</div>
      </div>
      <div className="field">
        <label>Ligne 1 (max 16 car.)</label>
        <input
          value={line1}
          maxLength="16"
          onChange={(e) => setLine1(e.target.value)}
        />
      </div>
      <div className="field">
        <label>Ligne 2 (max 16 car.)</label>
        <input
          value={line2}
          maxLength="16"
          onChange={(e) => setLine2(e.target.value)}
        />
      </div>
      <button
        className="btn"
        onClick={send}
        disabled={disabled}
        style={{ width: "100%" }}
      >
        Envoyer au LCD
      </button>
      {output && <div className="output">{output}</div>}
    </Card>
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
  return (
    <Card icon="📊" title="ADC (ADS7830)" badge="I2C">
      <div className="field-row">
        <div className="field">
          <label>Canal</label>
          <select value={channel} onChange={(e) => setChannel(+e.target.value)}>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((c) => (
              <option key={c} value={c}>
                CH{c}
              </option>
            ))}
          </select>
        </div>
        <button className="btn" onClick={readOnce} disabled={disabled}>
          Lire
        </button>
        <button
          className={`btn ${polling ? "danger" : "success"}`}
          onClick={togglePoll}
          disabled={disabled}
        >
          {polling ? "Stop" : "Auto"}
        </button>
      </div>
      {output && <div className="output">{output}</div>}
    </Card>
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
  return (
    <Card icon="🔍" title="I2C Scanner" badge="I2C">
      <div className="field-row">
        <div className="field">
          <label>Bus</label>
          <select value={bus} onChange={(e) => setBus(+e.target.value)}>
            <option value={0}>i2c-0</option>
            <option value={1}>i2c-1</option>
          </select>
        </div>
        <button className="btn" onClick={scan} disabled={disabled}>
          Scanner
        </button>
      </div>
      {output && <div className="output">{output}</div>}
    </Card>
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
    if (disabled) return;
    refreshAll(true);
    const timer = setInterval(() => refreshAll(false), 1000);
    return () => clearInterval(timer);
  }, [disabled, refreshAll]);
  return (
    <Card icon="💡" title="GPIO Control" badge="BCM">
      <div className="gpio-grid">
        {pins.map((p) => (
          <div
            key={p}
            className={`gpio-pin${states[p] ? " active" : ""}`}
            onClick={() => !disabled && toggle(p)}
            onContextMenu={(e) => {
              e.preventDefault();
              !disabled && readPin(p);
            }}
          >
            <span className="pin-num">GPIO {p}</span>
            <span className="pin-state">{states[p] ? "HIGH" : "LOW"}</span>
          </div>
        ))}
      </div>
      <p style={{ fontSize: ".72rem", color: "var(--text-dim)", marginTop: 6 }}>
        Clic = toggle | Clic droit = lire
      </p>
      {output && <div className="output">{output}</div>}
    </Card>
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
  return (
    <Card icon="〰️" title="PWM Control" badge="GPIO">
      <div className="field-row">
        <div className="field">
          <label>Pin</label>
          <select value={pin} onChange={(e) => setPin(+e.target.value)}>
            {[12, 13, 18, 19].map((p) => (
              <option key={p} value={p}>
                GPIO {p}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Freq (Hz)</label>
          <input
            type="number"
            min="1"
            max="50000"
            value={freq}
            onChange={(e) => setFreq(+e.target.value)}
          />
        </div>
      </div>
      <div className="field" style={{ marginTop: 8 }}>
        <label>Duty: {duty}%</label>
        <input
          type="range"
          min="0"
          max="100"
          value={duty}
          onChange={(e) => setDuty(+e.target.value)}
        />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button
          className="btn success"
          disabled={disabled}
          onClick={async () =>
            setOutput(
              JSON.stringify(
                (await ws.send("pwm_start", { pin, frequency: freq, duty }))
                  .data,
                null,
                2,
              ),
            )
          }
        >
          Start
        </button>
        <button
          className="btn danger"
          disabled={disabled}
          onClick={async () =>
            setOutput(
              JSON.stringify(
                (await ws.send("pwm_stop", { pin })).data,
                null,
                2,
              ),
            )
          }
        >
          Stop
        </button>
      </div>
      {output && <div className="output">{output}</div>}
    </Card>
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
  return (
    <>
      <Card icon="🖥️" title="Systeme" badge="Info">
        <div className="field" style={{ marginBottom: 8 }}>
          <label>Intervalle de rafraichissement (s)</label>
          <input
            type="number"
            min="1"
            max="3600"
            value={refreshSec}
            onChange={(e) =>
              setRefreshSec(Math.max(1, Math.min(3600, +e.target.value || 1)))
            }
            disabled={disabled}
          />
        </div>
        <div
          style={{
            fontSize: ".78rem",
            color: "var(--text-dim)",
            marginBottom: 8,
          }}
        >
          Auto-refresh actif: toutes les {refreshSec}s
        </div>
        {info && (
          <div className="status-pairs">
            <div className="status-cell">
              <div className="status-label">Hostname</div>
              <div className="status-value">{info.hostname}</div>
            </div>
            <div className="status-cell">
              <div className="status-label">Kernel</div>
              <div className="status-value compact">{info.kernel}</div>
            </div>
            <div className="status-cell">
              <div className="status-label">CPU Temp</div>
              <div
                className="status-value"
                style={{ color: info.cpu_temp_c > 70 ? "#ef4444" : "#22c55e" }}
              >
                {info.cpu_temp_c}°C
              </div>
            </div>
            <div className="status-cell">
              <div className="status-label">CPU Charge</div>
              <div className="status-value">
                {info.cpu_usage_percent != null
                  ? info.cpu_usage_percent + "%"
                  : "—"}
              </div>
            </div>
            <div className="status-cell">
              <div className="status-label">Uptime</div>
              <div className="status-value">{fmtUp(info.uptime_s)}</div>
            </div>
            <div className="status-cell">
              <div className="status-label">RAM Usage</div>
              <div className="status-value">
                {ramUsagePercent != null ? ramUsagePercent + "%" : "—"}
              </div>
            </div>
            <div className="status-cell">
              <div className="status-label">Arch</div>
              <div className="status-value">{info.arch || "—"}</div>
            </div>
            <div className="status-cell">
              <div className="status-label">Boot mode</div>
              <div className="status-value">{bootModeLabel}</div>
            </div>
            <div className="status-cell">
              <div className="status-label">Stockage libre</div>
              <div className="status-value compact">
                {diskFreeGb != null && diskTotalGb != null
                  ? `${diskFreeGb} Go / ${diskTotalGb} Go`
                  : "—"}
              </div>
            </div>
            <div className="status-cell">
              <div className="status-label">Fan</div>
              <div className="status-value" style={{ color: fanColor }}>
                {fanLabel}
              </div>
            </div>
            <div className="status-cell">
              <div className="status-label">Vitesse Fan</div>
              <div className="status-value compact">
                {info.fan_rpm != null ? info.fan_rpm + " RPM" : "—"}
              </div>
            </div>
          </div>
        )}
        {info && (
          <button
            className={`btn ${info.fan_active ? "danger" : "success"}`}
            onClick={toggleFan}
            disabled={disabled || fanBusy || !info.fan_available}
            style={{ width: "100%", marginTop: 10 }}
          >
            {info.fan_active
              ? "Desactiver le ventilateur"
              : "Activer le ventilateur"}
          </button>
        )}
        {output && <div className="output">{output}</div>}
      </Card>

      <Card icon="🕒" title="Status NTP" badge="Chrony">
        <div
          style={{
            fontSize: ".78rem",
            color: "var(--text-dim)",
            marginBottom: 8,
          }}
        >
          Rafraichissement synchronise avec Systeme: toutes les {refreshSec}s
        </div>
        {info && (
          <div className="status-pairs">
            <div className="status-cell">
              <div className="status-label">Status NTP</div>
              <div className="status-value" style={{ color: ntpStatusColor }}>
                {ntpStatusLabel}
              </div>
            </div>
            <div className="status-cell">
              <div className="status-label">Source clock</div>
              <div className="status-value">{ntp?.source_clock || "—"}</div>
            </div>
            <div className="status-cell full">
              <div className="status-label">UTC time carte</div>
              <div className="status-value compact">
                {info.current_utc_time || "—"}
              </div>
            </div>
            <div className="status-cell full">
              <div className="status-label">Derniere synchro NTP (UTC)</div>
              <div className="status-value compact">
                {ntp?.reference_time_utc || "—"}
              </div>
            </div>
            <div className="status-cell">
              <div className="status-label">Update interval</div>
              <div className="status-value">{ntp?.update_interval || "—"}</div>
            </div>
            <div className="status-cell">
              <div className="status-label">Last offset</div>
              <div className="status-value compact">
                {ntp?.last_offset || "—"}
              </div>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}

/* ===================================================================
 *  DEBUG PANEL — bottom log viewer
 * =================================================================== */
function DebugPanel({ ws }) {
  const [logs, setLogs] = useState([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const logsEndRef = useRef(null);

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

  return (
    <div className="debug-panel">
      <div className="debug-header">
        <span>🐛 Debug Console ({logs.length} logs)</span>
        <div className="debug-actions">
          <button onClick={() => setAutoScroll(!autoScroll)}>
            {autoScroll ? "Auto-scroll: ON" : "Auto-scroll: OFF"}
          </button>
          <button onClick={clear}>Effacer</button>
        </div>
      </div>
      <div className="debug-logs">
        {logs.map((l, i) => (
          <div key={i} className="log-entry">
            <span className="log-time">{l.ts}</span>
            {l.dir === "out" && <span className="log-arrow-out">▶ </span>}
            {l.dir === "in" && <span className="log-arrow-in">◀ </span>}
            {l.dir === "err" && <span className="log-error">✖ </span>}
            <span className="log-action">{l.action} </span>
            <span className="log-data">
              {typeof l.data === "string" ? l.data : JSON.stringify(l.data)}
            </span>
          </div>
        ))}
        <div ref={logsEndRef} />
      </div>
    </div>
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
  { id: "active_buzz", icon: "🔔", label: "Buzzer Actif", badge: "GPIO17" },
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
  { id: "keypad", icon: "⌨️", label: "Clavier 4x4", badge: "GPIO" },
  { id: "rfid", icon: "💳", label: "RFID-RC522", badge: "SPI" },

  { section: "📟 Communication" },
  { id: "lcd", icon: "📺", label: "I2C LCD 1602", badge: "I2C" },
  { id: "i2c_scan", icon: "🔍", label: "I2C Scanner", badge: "I2C" },
  { id: "adc", icon: "📊", label: "ADC (ADS7830)", badge: "I2C" },

  { section: "🔧 Systeme" },
  { id: "gpio", icon: "💡", label: "GPIO Control", badge: "BCM" },
  { id: "pwm", icon: "〰️", label: "PWM Control", badge: "GPIO" },
];

/* Panel renderer — returns the component for a given id */
function PanelContent({ id, ws, disabled }) {
  switch (id) {
    case "blue_led":
      return <BlueLedPanel ws={ws} disabled={disabled} />;
    case "rgb_led":
      return <RgbLedPanel ws={ws} disabled={disabled} />;
    case "ws2812":
      return <Ws2812Panel ws={ws} disabled={disabled} />;
    case "led_matrix":
      return <LedMatrixPanel ws={ws} disabled={disabled} />;
    case "seven_seg":
      return <SevenSegPanel ws={ws} disabled={disabled} />;
    case "led_bar":
      return <LedBarPanel ws={ws} disabled={disabled} />;
    case "servo":
      return <ServoPanel ws={ws} disabled={disabled} />;
    case "stepper":
      return <StepperPanel ws={ws} disabled={disabled} />;
    case "motor":
      return <MotorPanel ws={ws} disabled={disabled} />;
    case "active_buzz":
      return <ActiveBuzzerPanel ws={ws} disabled={disabled} />;
    case "passive_buzz":
      return <PassiveBuzzerPanel ws={ws} disabled={disabled} />;
    case "relay":
      return <RelayPanel ws={ws} disabled={disabled} />;
    case "dht":
      return <DhtPanel ws={ws} disabled={disabled} />;
    case "ultrasonic":
      return <UltrasonicPanel ws={ws} disabled={disabled} />;
    case "mpu6050":
      return <Mpu6050Panel ws={ws} disabled={disabled} />;
    case "ir_motion":
      return <IrMotionPanel ws={ws} disabled={disabled} />;
    case "photoresist":
      return <PhotoresistorPanel ws={ws} disabled={disabled} />;
    case "thermistor":
      return <ThermistorPanel ws={ws} disabled={disabled} />;
    case "button":
      return <ButtonPanel ws={ws} disabled={disabled} />;
    case "joystick":
      return <JoystickPanel ws={ws} disabled={disabled} />;
    case "potentiom":
      return <PotentiometerPanel ws={ws} disabled={disabled} />;
    case "keypad":
      return <KeypadPanel ws={ws} disabled={disabled} />;
    case "rfid":
      return <RfidPanel ws={ws} disabled={disabled} />;
    case "lcd":
      return <LcdPanel ws={ws} disabled={disabled} />;
    case "i2c_scan":
      return <I2cPanel ws={ws} disabled={disabled} />;
    case "adc":
      return <AdcPanel ws={ws} disabled={disabled} />;
    case "gpio":
      return <GpioPanel ws={ws} disabled={disabled} />;
    case "pwm":
      return <PwmPanel ws={ws} disabled={disabled} />;
    default:
      return (
        <p style={{ color: "var(--text-dim)" }}>Selectionnez un composant</p>
      );
  }
}

/* ===================================================================
 *  MAIN APP — 3-column layout
 * =================================================================== */
function App() {
  const wsUrl = `ws://${window.location.hostname}:${window.location.port || 8080}/ws`;
  const ws = useWebSocket(wsUrl);
  const [activePanel, setActivePanel] = useState("gpio");
  const [showDebug, setShowDebug] = useState(false);
  const wsOnlyDis = !ws.ready;

  return (
    <div className="app-wrapper">
      <header className="app-header">
        <h1>
          🧪 Freenove <span>Projects Board</span> — Dashboard
        </h1>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <ConnectionBar ws={ws} />
          <button
            className={`debug-toggle${showDebug ? " active" : ""}`}
            onClick={() => setShowDebug(!showDebug)}
          >
            <span className="dt-dot" />
            {showDebug ? "Debug ON" : "Debug"}
          </button>
        </div>
      </header>

      {!ws.ready && (
        <div
          style={{ textAlign: "center", padding: 40, color: "var(--text-dim)" }}
        >
          <p style={{ fontSize: "1.2rem", marginBottom: 12 }}>
            ⚡ Connexion au backend requise
          </p>
          <button className="btn" onClick={ws.connect}>
            Se connecter au WebSocket
          </button>
        </div>
      )}

      {ws.ready && (
        <div className="app-layout">
          {/* --- Left sidebar --- */}
          <nav className="sidebar">
            {NAV_ITEMS.map((item, i) =>
              item.section ? (
                <div key={"s" + i} className="sidebar-section">
                  {item.section}
                </div>
              ) : (
                <div
                  key={item.id}
                  className={`sidebar-item${activePanel === item.id ? " active" : ""}`}
                  onClick={() => setActivePanel(item.id)}
                >
                  <span className="si-icon">{item.icon}</span>
                  {item.label}
                  {item.badge && <span className="si-badge">{item.badge}</span>}
                </div>
              ),
            )}
          </nav>

          {/* --- Center: active panel --- */}
          <div className="center-panel">
            <PanelContent id={activePanel} ws={ws} disabled={wsOnlyDis} />
          </div>

          {/* --- Right: System info + Terminal --- */}
          <div className="right-panel">
            <SystemInfoPanel ws={ws} disabled={wsOnlyDis} />
          </div>
        </div>
      )}

      {/* --- Bottom: Debug panel --- */}
      {showDebug && <DebugPanel ws={ws} />}
    </div>
  );
}

/* Mount */
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(React.createElement(App));
