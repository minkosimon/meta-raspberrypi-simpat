/**
 * Freenove Projects Board for Raspberry Pi — Dashboard (PREVIEW MODE)
 * All components from the FNK0054 board.
 * Simulates WebSocket responses with mock data (no backend needed).
 */
const { useState, useEffect, useRef, useCallback } = React;
const h = React.createElement;

/* ===================================================================
 *  MOCK WebSocket hook
 * =================================================================== */
function useMockWebSocket() {
  const [ready, setReady] = useState(false);
  const [sshOk, setSshOk] = useState(false);
  const connect    = useCallback(() => setReady(true), []);
  const disconnect = useCallback(() => { setReady(false); setSshOk(false); }, []);

  const MOCK = {
    connect:      () => { setSshOk(true); return { status:'connected', host:'192.168.10.22' }; },
    disconnect:   () => { setSshOk(false); return { status:'disconnected' }; },
    gpio_write:   (p) => ({ stdout: JSON.stringify({ pin:p.pin, value:p.value }) }),
    gpio_read:    (p) => ({ stdout: JSON.stringify({ pin:p.pin, value:Math.round(Math.random()) }) }),
    pwm_start:    (p) => ({ stdout: JSON.stringify({ pin:p.pin, frequency:p.frequency, duty:p.duty, state:'running' }) }),
    pwm_stop:     (p) => ({ stdout: JSON.stringify({ pin:p.pin, state:'stopped' }) }),
    servo_set:    (p) => ({ stdout: JSON.stringify({ pin:p.pin, angle:p.angle }) }),
    led_rgb:      (p) => ({ stdout: JSON.stringify({ r:p.r, g:p.g, b:p.b }) }),
    i2c_scan:     ()  => ({ stdout: JSON.stringify({ devices:[{address:75,hex:'0x4b'},{address:39,hex:'0x27'},{address:104,hex:'0x68'}], count:3 }) }),
    adc_read:     (p) => { const raw=Math.floor(Math.random()*256); return { stdout: JSON.stringify({ channel:p.channel, raw, voltage:(raw*3.3/255).toFixed(3), percent:(raw*100/255).toFixed(1) }) }; },
    dht_read:     ()  => ({ stdout: JSON.stringify({ temperature:(20+Math.random()*10).toFixed(1), humidity:(40+Math.random()*30).toFixed(1) }) }),
    ultrasonic_read:() => ({ stdout: JSON.stringify({ distance_cm:(5+Math.random()*200).toFixed(2) }) }),
    buzzer:       (p) => ({ stdout: JSON.stringify({ pin:p.pin, state:p.state, frequency:p.frequency }) }),
    system_info:  ()  => ({ stdout: JSON.stringify({ hostname:'raspberrypi5', kernel:'6.1.63-v8+', arch:'aarch64', cpu_temp_c:(40+Math.random()*20).toFixed(1), memory_kb:{MemTotal:8288256,MemAvailable:6122480}, uptime_s:86423, disk:{total_mb:29440,free_mb:21504} }) }),
    run_command:  (p) => ({ stdout:'[mock] $ '+p.command+'\nOK\n', stderr:'', returncode:0 }),
    relay_set:    (p) => ({ stdout: JSON.stringify({ pin:p.pin, state:p.state }) }),
    led_matrix:   (p) => ({ stdout: JSON.stringify({ pattern:'applied', status:'ok' }) }),
    seven_segment:(p) => ({ stdout: JSON.stringify({ value:p.value, status:'ok' }) }),
    led_bar:      (p) => ({ stdout: JSON.stringify({ level:p.level, status:'ok' }) }),
    ws2812_set:   (p) => ({ stdout: JSON.stringify({ count:p.count, r:p.r, g:p.g, b:p.b, status:'ok' }) }),
    stepper_control:(p) => ({ stdout: JSON.stringify({ direction:p.direction, steps:p.steps, speed:p.speed, status:'done' }) }),
    motor_control:(p) => ({ stdout: JSON.stringify({ speed:p.speed, direction:p.direction, status:'ok' }) }),
    mpu6050_read: ()  => ({ stdout: JSON.stringify({ accel:{x:(Math.random()*2-1).toFixed(3),y:(Math.random()*2-1).toFixed(3),z:(9.8+Math.random()*.2).toFixed(3)}, gyro:{x:(Math.random()*10-5).toFixed(2),y:(Math.random()*10-5).toFixed(2),z:(Math.random()*10-5).toFixed(2)}, temp:(25+Math.random()*5).toFixed(1) }) }),
    joystick_read:()  => { const x=Math.floor(Math.random()*256),y=Math.floor(Math.random()*256); return { stdout: JSON.stringify({ x, y, button:Math.random()>.8?1:0 }) }; },
    rfid_read:    ()  => ({ stdout: JSON.stringify({ uid:'A3:B4:C5:D6', type:'MIFARE 1K', status:Math.random()>.5?'detected':'no_card' }) }),
    keypad_read:  ()  => ({ stdout: JSON.stringify({ key:['1','2','3','A','4','5','6','B','7','8','9','C','*','0','#','D'][Math.floor(Math.random()*16)] }) }),
    lcd_write:    (p) => ({ stdout: JSON.stringify({ line1:p.line1||'', line2:p.line2||'', status:'ok' }) }),
    ir_motion_read:(p)=> ({ stdout: JSON.stringify({ pin:p.pin, detected:Math.random()>.5 }) }),
    photoresistor_read:() => { const raw=Math.floor(Math.random()*256); return { stdout: JSON.stringify({ raw, light_percent:(raw*100/255).toFixed(1) }) }; },
    thermistor_read:() => ({ stdout: JSON.stringify({ raw:Math.floor(Math.random()*256), temperature_c:(20+Math.random()*15).toFixed(1) }) }),
  };

  const logsRef = useRef([]);
  const logListeners = useRef(new Set());
  const addLog = useCallback((entry) => {
    logsRef.current = [...logsRef.current.slice(-499), entry];
    logListeners.current.forEach(fn => fn(logsRef.current));
  }, []);

  const send = useCallback(async (action, params={}) => {
    const ts = new Date().toISOString().slice(11,23);
    addLog({ ts, dir:'out', action, data:params });
    await new Promise(r => setTimeout(r, 80+Math.random()*150));
    const fn = MOCK[action];
    let result;
    if (fn) {
      result = { status:'ok', action, data:fn(params) };
      addLog({ ts:new Date().toISOString().slice(11,23), dir:'in', action, data:result.data });
    } else {
      result = { status:'error', message:'unknown: '+action };
      addLog({ ts:new Date().toISOString().slice(11,23), dir:'err', action, data:result.message });
    }
    return result;
  }, [sshOk]);

  return { ready, connect, disconnect, send, sshOk, setSshOk, logsRef, logListeners };
}

/* ===================================================================
 *  HELPERS
 * =================================================================== */
function Card({ icon, title, badge, children }) {
  return h('div', { className:'card' },
    h('div', { className:'card-header' },
      h('span', { className:'icon' }, icon), ' '+title,
      badge && h('span', { className:'pin-badge' }, badge)),
    h('div', { className:'card-body' }, children));
}
function Section({ title }) {
  return h('div', { className:'section-title' }, title);
}

/* ===================================================================
 *  CONNECTION BAR
 * =================================================================== */
function ConnectionBar({ ws, sshConnected, setSshConnected }) {
  const [host, setHost] = useState('192.168.10.22');
  const [user, setUser] = useState('root');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSSH = async () => {
    setBusy(true);
    if (sshConnected) {
      await ws.send('disconnect');
      setSshConnected(false);
    } else {
      const res = await ws.send('connect', { host, user, password: pass||undefined });
      if (res.status==='ok') setSshConnected(true);
    }
    setBusy(false);
  };

  return h('div', { className:'conn-bar' },
    h('span', { className:'status-dot '+(ws.ready?'on':'off') }),
    h('span', { style:{fontSize:'.82rem',color:ws.ready?'#22c55e':'#ef4444'} }, 'WS '+(ws.ready?'OK':'OFF')),
    !ws.ready
      ? h('button', { className:'btn sm', onClick:ws.connect }, 'Connecter WS')
      : h('button', { className:'btn sm danger', onClick:ws.disconnect }, 'Deconnecter WS'),
    h('span', { style:{margin:'0 6px',color:'var(--border)'} }, '|'),
    h('input', { placeholder:'IP carte', value:host, onChange:e=>setHost(e.target.value) }),
    h('input', { placeholder:'User', value:user, onChange:e=>setUser(e.target.value), style:{width:80} }),
    h('input', { placeholder:'Password', type:'password', value:pass, onChange:e=>setPass(e.target.value), style:{width:100} }),
    h('button', { className:'btn sm '+(sshConnected?'danger':'success'), onClick:handleSSH, disabled:!ws.ready||busy },
      sshConnected ? 'Deconnecter SSH' : 'Connecter SSH'),
    h('span', { className:'status-dot '+(sshConnected?'on':'off') }),
    h('span', { style:{marginLeft:8,fontSize:'.72rem',padding:'2px 8px',background:'#f59e0b',color:'#000',borderRadius:4,fontWeight:600} }, 'PREVIEW')
  );
}

/* ===================================================================
 *  1. BLUE LED  (GPIO17)
 * =================================================================== */
function BlueLedPanel({ ws, disabled }) {
  const [on, setOn] = useState(false);
  const [output, setOutput] = useState('');
  const toggle = async () => {
    const nv = on ? 0 : 1;
    const res = await ws.send('gpio_write', { pin:17, value:nv });
    if (res.status==='ok') setOn(!on);
    setOutput(JSON.stringify(res.data,null,2));
  };
  return h(Card, { icon:'🔵', title:'Blue LED', badge:'GPIO17' },
    h('button', { className:'toggle-big'+(on?' active':''), onClick:toggle, disabled }, on?'ON — Allumee':'OFF — Eteinte'),
    output && h('div', { className:'output' }, output));
}

/* ===================================================================
 *  2. RGB LED  (GPIO5=R, GPIO6=G, GPIO13=B)
 * =================================================================== */
function RgbLedPanel({ ws, disabled }) {
  const [r, setR] = useState(0);
  const [g, setG] = useState(0);
  const [b, setB] = useState(0);
  const [output, setOutput] = useState('');
  const send = async () => {
    const res = await ws.send('led_rgb', { r_pin:5, g_pin:6, b_pin:13, r, g, b });
    setOutput(JSON.stringify(res.data,null,2));
  };
  return h(Card, { icon:'🌈', title:'RGB LED', badge:'GPIO5/6/13' },
    h('div', { className:'color-preview', style:{background:'rgb('+r+','+g+','+b+')'} }),
    h('div',{className:'field'}, h('label',null,'Rouge: '+r), h('input',{type:'range',min:0,max:255,value:r,onChange:e=>setR(+e.target.value)})),
    h('div',{className:'field'}, h('label',null,'Vert: '+g), h('input',{type:'range',min:0,max:255,value:g,onChange:e=>setG(+e.target.value)})),
    h('div',{className:'field'}, h('label',null,'Bleu: '+b), h('input',{type:'range',min:0,max:255,value:b,onChange:e=>setB(+e.target.value)})),
    h('button', { className:'btn', onClick:send, disabled, style:{width:'100%'} }, 'Appliquer'),
    output && h('div',{className:'output'},output));
}

/* ===================================================================
 *  3. WS2812 LED  (GPIO18)
 * =================================================================== */
function Ws2812Panel({ ws, disabled }) {
  const [count, setCount] = useState(8);
  const [r, setR] = useState(0);
  const [g, setG] = useState(128);
  const [b, setB] = useState(255);
  const [output, setOutput] = useState('');
  const send = async () => {
    const res = await ws.send('ws2812_set', { count, r, g, b });
    setOutput(JSON.stringify(res.data,null,2));
  };
  return h(Card, { icon:'💎', title:'WS2812 LED', badge:'GPIO18' },
    h('div',{className:'ws-strip'},
      Array.from({length:count},(_,i)=>h('div',{key:i,className:'ws-led',style:{background:'rgb('+r+','+g+','+b+')'}}))),
    h('div',{className:'field'}, h('label',null,'Nombre LEDs: '+count), h('input',{type:'range',min:1,max:16,value:count,onChange:e=>setCount(+e.target.value)})),
    h('div',{className:'field'}, h('label',null,'R: '+r), h('input',{type:'range',min:0,max:255,value:r,onChange:e=>setR(+e.target.value)})),
    h('div',{className:'field'}, h('label',null,'G: '+g), h('input',{type:'range',min:0,max:255,value:g,onChange:e=>setG(+e.target.value)})),
    h('div',{className:'field'}, h('label',null,'B: '+b), h('input',{type:'range',min:0,max:255,value:b,onChange:e=>setB(+e.target.value)})),
    h('button',{className:'btn',onClick:send,disabled,style:{width:'100%'}},'Appliquer'),
    output && h('div',{className:'output'},output));
}

/* ===================================================================
 *  4. LED MATRIX 8x8  (74HC595: GPIO17/GPIO27/GPIO22)
 * =================================================================== */
function LedMatrixPanel({ ws, disabled }) {
  const [grid, setGrid] = useState(Array(64).fill(false));
  const [output, setOutput] = useState('');
  const toggle = (i) => { const g=[...grid]; g[i]=!g[i]; setGrid(g); };
  const send = async () => {
    const rows = [];
    for (let r=0;r<8;r++) {
      let val=0;
      for (let c=0;c<8;c++) if (grid[r*8+c]) val|=(1<<(7-c));
      rows.push(val);
    }
    const res = await ws.send('led_matrix', { pattern:rows });
    setOutput(JSON.stringify(res.data,null,2));
  };
  const clear = () => setGrid(Array(64).fill(false));
  const presets = {
    smile: [0x3C,0x42,0xA5,0x81,0xA5,0x99,0x42,0x3C],
    heart: [0x00,0x66,0xFF,0xFF,0xFF,0x7E,0x3C,0x18],
    arrow: [0x18,0x3C,0x7E,0xFF,0x18,0x18,0x18,0x18],
  };
  const applyPreset = (name) => {
    const pat = presets[name];
    const g = Array(64).fill(false);
    pat.forEach((row,r) => { for(let c=0;c<8;c++) if(row&(1<<(7-c))) g[r*8+c]=true; });
    setGrid(g);
  };
  return h(Card, { icon:'⬜', title:'LED Matrix 8x8', badge:'74HC595' },
    h('div',{className:'led-matrix'},
      grid.map((on,i) => h('div',{key:i,className:'led-cell'+(on?' on':''),onClick:()=>!disabled&&toggle(i)}))),
    h('div',{style:{display:'flex',gap:6,marginTop:8,flexWrap:'wrap'}},
      h('button',{className:'btn sm',onClick:()=>applyPreset('smile')},'Smile'),
      h('button',{className:'btn sm',onClick:()=>applyPreset('heart')},'Coeur'),
      h('button',{className:'btn sm',onClick:()=>applyPreset('arrow')},'Fleche'),
      h('button',{className:'btn sm danger',onClick:clear},'Effacer')),
    h('button',{className:'btn',onClick:send,disabled,style:{width:'100%',marginTop:8}},'Envoyer'),
    output && h('div',{className:'output'},output));
}

/* ===================================================================
 *  5. 7-SEGMENT DISPLAY (4 digits, 74HC595)
 * =================================================================== */
function SevenSegPanel({ ws, disabled }) {
  const [value, setValue] = useState('0000');
  const [output, setOutput] = useState('');
  const send = async () => {
    const res = await ws.send('seven_segment', { value });
    setOutput(JSON.stringify(res.data,null,2));
  };
  const digits = value.padStart(4,' ').slice(-4).split('');
  return h(Card, { icon:'🔢', title:'Afficheur 7-Segments', badge:'74HC595' },
    h('div',{className:'seg-display'},
      digits.map((d,i)=>h('span',{key:i,className:'seg-digit'+(d===' '?' dim':'')},d===' '?'8':d))),
    h('div',{className:'field'},
      h('label',null,'Valeur (0-9999)'),
      h('input',{type:'text',maxLength:4,value,onChange:e=>setValue(e.target.value.replace(/[^0-9]/g,'').slice(0,4))})),
    h('div',{style:{display:'flex',gap:6,marginTop:6}},
      h('button',{className:'btn sm',onClick:()=>setValue('1234')},'1234'),
      h('button',{className:'btn sm',onClick:()=>setValue(String(Math.floor(Math.random()*10000)))},'Random'),
      h('button',{className:'btn sm danger',onClick:()=>setValue('0000')},'Reset')),
    h('button',{className:'btn',onClick:send,disabled,style:{width:'100%',marginTop:8}},'Afficher'),
    output && h('div',{className:'output'},output));
}

/* ===================================================================
 *  6. LED BAR GRAPH (74HC595)
 * =================================================================== */
function LedBarPanel({ ws, disabled }) {
  const [level, setLevel] = useState(5);
  const [output, setOutput] = useState('');
  const send = async () => {
    const res = await ws.send('led_bar', { level });
    setOutput(JSON.stringify(res.data,null,2));
  };
  return h(Card, { icon:'📊', title:'LED Bar Graph', badge:'74HC595' },
    h('div',{className:'bar-graph'},
      Array.from({length:10},(_,i)=>{
        const on = i < level;
        const cls = 'bar-seg'+(on?' on':'')+(i>=8&&on?' danger':i>=6&&on?' warn':'');
        return h('div',{key:i,className:cls,onClick:()=>setLevel(i+1),style:{flex:1}});
      })),
    h('div',{className:'field',style:{marginTop:8}},
      h('label',null,'Niveau: '+level+'/10'),
      h('input',{type:'range',min:0,max:10,value:level,onChange:e=>setLevel(+e.target.value)})),
    h('button',{className:'btn',onClick:send,disabled,style:{width:'100%',marginTop:6}},'Appliquer'),
    output && h('div',{className:'output'},output));
}

/* ===================================================================
 *  7. SERVO  (GPIO18)
 * =================================================================== */
function ServoPanel({ ws, disabled }) {
  const [angle, setAngle] = useState(90);
  const [output, setOutput] = useState('');
  const send = async () => {
    const res = await ws.send('servo_set', { pin:18, angle });
    setOutput(JSON.stringify(res.data,null,2));
  };
  return h(Card, { icon:'🔄', title:'Servo Moteur', badge:'GPIO18' },
    h('div',{className:'motor-visual'},
      h('div',{className:'arrow',style:{transform:'rotate('+((angle-90)*2)+'deg)'}})),
    h('div',{className:'field'},
      h('label',null,'Angle: '+angle+'\u00B0'),
      h('input',{type:'range',min:0,max:180,value:angle,onChange:e=>setAngle(+e.target.value)})),
    h('div',{style:{display:'flex',gap:6,justifyContent:'center',marginTop:4}},
      [0,45,90,135,180].map(a=>h('button',{key:a,className:'btn sm',onClick:()=>setAngle(a)},a+'\u00B0'))),
    h('button',{className:'btn',onClick:send,disabled,style:{width:'100%',marginTop:8}},'Appliquer '+angle+'\u00B0'),
    output && h('div',{className:'output'},output));
}

/* ===================================================================
 *  8. STEPPING MOTOR  (GPIO6/13/19/26)
 * =================================================================== */
function StepperPanel({ ws, disabled }) {
  const [steps, setSteps] = useState(100);
  const [speed, setSpeed] = useState(5);
  const [dir, setDir] = useState('cw');
  const [output, setOutput] = useState('');
  const send = async (d) => {
    const res = await ws.send('stepper_control', { direction:d||dir, steps, speed });
    setOutput(JSON.stringify(res.data,null,2));
  };
  return h(Card, { icon:'⚙️', title:'Moteur Pas-a-Pas', badge:'GPIO6/13/19/26' },
    h('div',{className:'field-row'},
      h('div',{className:'field',style:{flex:1}},
        h('label',null,'Pas'),
        h('input',{type:'number',min:1,max:2048,value:steps,onChange:e=>setSteps(+e.target.value)})),
      h('div',{className:'field',style:{flex:1}},
        h('label',null,'Vitesse (ms)'),
        h('input',{type:'number',min:1,max:50,value:speed,onChange:e=>setSpeed(+e.target.value)}))),
    h('div',{style:{display:'flex',gap:8,marginTop:10}},
      h('button',{className:'btn',onClick:()=>send('ccw'),disabled,style:{flex:1}},'\u21BA Anti-horaire'),
      h('button',{className:'btn',onClick:()=>send('cw'),disabled,style:{flex:1}},'\u21BB Horaire')),
    h('button',{className:'btn danger',onClick:()=>send('stop'),disabled,style:{width:'100%',marginTop:6}},'Stop'),
    output && h('div',{className:'output'},output));
}

/* ===================================================================
 *  9. DC MOTOR  (GPIO18=EN, GPIO23=IN1, GPIO24=IN2)
 * =================================================================== */
function MotorPanel({ ws, disabled }) {
  const [speed, setSpeed] = useState(50);
  const [output, setOutput] = useState('');
  const send = async (dir) => {
    const res = await ws.send('motor_control', { speed, direction:dir });
    setOutput(JSON.stringify(res.data,null,2));
  };
  return h(Card, { icon:'🔌', title:'Moteur DC', badge:'GPIO18/23/24' },
    h('div',{className:'field'},
      h('label',null,'Vitesse: '+speed+'%'),
      h('input',{type:'range',min:0,max:100,value:speed,onChange:e=>setSpeed(+e.target.value)})),
    h('div',{style:{display:'flex',gap:8,marginTop:8}},
      h('button',{className:'btn success',onClick:()=>send('forward'),disabled,style:{flex:1}},'\u25B6 Avant'),
      h('button',{className:'btn warning',onClick:()=>send('backward'),disabled,style:{flex:1}},'\u25C0 Arriere'),
      h('button',{className:'btn danger',onClick:()=>send('stop'),disabled},'Stop')),
    output && h('div',{className:'output'},output));
}

/* ===================================================================
 *  10. ACTIVE BUZZER  (GPIO17 via switch)
 * =================================================================== */
function ActiveBuzzerPanel({ ws, disabled }) {
  const [on, setOn] = useState(false);
  const [output, setOutput] = useState('');
  const toggle = async () => {
    const st = on ? 'off' : 'on';
    const res = await ws.send('buzzer', { pin:17, state:st, frequency:0, duration:0 });
    if (res.status==='ok') setOn(!on);
    setOutput(JSON.stringify(res.data,null,2));
  };
  return h(Card, { icon:'🔔', title:'Buzzer Actif', badge:'GPIO17' },
    h('button', { className:'toggle-big'+(on?' active':''), onClick:toggle, disabled },
      on ? '\uD83D\uDD0A ON' : '\uD83D\uDD07 OFF'),
    output && h('div',{className:'output'},output));
}

/* ===================================================================
 *  11. PASSIVE BUZZER  (GPIO4)
 * =================================================================== */
function PassiveBuzzerPanel({ ws, disabled }) {
  const [freq, setFreq] = useState(440);
  const [dur, setDur] = useState(0.5);
  const [output, setOutput] = useState('');
  return h(Card, { icon:'🔊', title:'Buzzer Passif', badge:'GPIO4' },
    h('div',{className:'field-row'},
      h('div',{className:'field',style:{flex:1}},
        h('label',null,'Frequence (Hz)'),
        h('input',{type:'number',min:20,max:20000,value:freq,onChange:e=>setFreq(+e.target.value)})),
      h('div',{className:'field',style:{width:80}},
        h('label',null,'Duree (s)'),
        h('input',{type:'number',min:0.1,max:10,step:0.1,value:dur,onChange:e=>setDur(+e.target.value)}))),
    h('div',{style:{display:'flex',gap:8,marginTop:10}},
      h('button',{className:'btn success',disabled,onClick:async()=>{
        const res=await ws.send('buzzer',{pin:4,state:'tone',frequency:freq,duration:dur});
        setOutput(JSON.stringify(res.data,null,2));
      }},'\uD83D\uDD0A Jouer'),
      h('button',{className:'btn danger',disabled,onClick:async()=>{
        const res=await ws.send('buzzer',{pin:4,state:'off'});
        setOutput(JSON.stringify(res.data,null,2));
      }},'\uD83D\uDD07 Stop')),
    h('div',{style:{display:'flex',gap:4,marginTop:8,flexWrap:'wrap'}},
      [{n:'Do',f:523},{n:'Re',f:587},{n:'Mi',f:659},{n:'Fa',f:698},{n:'Sol',f:784},{n:'La',f:880},{n:'Si',f:988}].map(note=>
        h('button',{key:note.n,className:'btn sm',style:{flex:1,minWidth:36},disabled,onClick:async()=>{
          setFreq(note.f);
          await ws.send('buzzer',{pin:4,state:'tone',frequency:note.f,duration:0.3});
        }},note.n))),
    output && h('div',{className:'output'},output));
}

/* ===================================================================
 *  12. RELAY  (GPIO12)
 * =================================================================== */
function RelayPanel({ ws, disabled }) {
  const [on, setOn] = useState(false);
  const [output, setOutput] = useState('');
  const toggle = async () => {
    const res = await ws.send('relay_set', { pin:12, state:on?'off':'on' });
    if (res.status==='ok') setOn(!on);
    setOutput(JSON.stringify(res.data,null,2));
  };
  return h(Card, { icon:'\u26A1', title:'Relais', badge:'GPIO12' },
    h('button', { className:'toggle-big'+(on?' active':''), onClick:toggle, disabled },
      on ? 'FERME (ON)' : 'OUVERT (OFF)'),
    h('p',{style:{fontSize:'.75rem',color:'var(--text-dim)',marginTop:6}},'Controle le circuit de puissance via le relais'),
    output && h('div',{className:'output'},output));
}

/* ===================================================================
 *  13. DHT11  (GPIO23)
 * =================================================================== */
function DhtPanel({ ws, disabled }) {
  const [data, setData] = useState(null);
  const [output, setOutput] = useState('');
  const read = async () => {
    setOutput('Lecture...');
    const res = await ws.send('dht_read', { pin:23 });
    setOutput(JSON.stringify(res.data,null,2));
    if (res.status==='ok'&&res.data.stdout) try{setData(JSON.parse(res.data.stdout));}catch{}
  };
  return h(Card, { icon:'🌡️', title:'DHT11 Temp/Humidite', badge:'GPIO23' },
    data && h('div',{style:{display:'flex',gap:16,justifyContent:'center',marginBottom:8}},
      h('div',{style:{textAlign:'center'}},
        h('div',{className:'sensor-value',style:{color:'#ef4444'}},data.temperature,h('span',{className:'sensor-unit'},' \u00B0C')),
        h('div',{style:{fontSize:'.75rem',color:'var(--text-dim)'}},'Temperature')),
      h('div',{style:{textAlign:'center'}},
        h('div',{className:'sensor-value',style:{color:'#38bdf8'}},data.humidity,h('span',{className:'sensor-unit'},' %')),
        h('div',{style:{fontSize:'.75rem',color:'var(--text-dim)'}},'Humidite'))),
    h('button',{className:'btn',onClick:read,disabled,style:{width:'100%'}},'Lire capteur'),
    output && h('div',{className:'output'},output));
}

/* ===================================================================
 *  14. ULTRASONIC HC-SR04
 * =================================================================== */
function UltrasonicPanel({ ws, disabled }) {
  const [data, setData] = useState(null);
  const [output, setOutput] = useState('');
  const [polling, setPolling] = useState(false);
  const timerRef = useRef(null);
  const read = async () => {
    const res = await ws.send('ultrasonic_read', { trig_pin:20, echo_pin:21 });
    setOutput(JSON.stringify(res.data,null,2));
    if (res.status==='ok'&&res.data.stdout) try{setData(JSON.parse(res.data.stdout));}catch{}
  };
  const togglePoll = () => {
    if (polling) { clearInterval(timerRef.current); setPolling(false); }
    else { setPolling(true); timerRef.current=setInterval(read,500); }
  };
  useEffect(()=>()=>clearInterval(timerRef.current),[]);
  return h(Card, { icon:'📏', title:'Ultrason HC-SR04', badge:'GPIO20/21' },
    data && h('div',{className:'sensor-value'},data.distance_cm,h('span',{className:'sensor-unit'},' cm')),
    h('div',{style:{display:'flex',gap:8}},
      h('button',{className:'btn',onClick:read,disabled},'Mesurer'),
      h('button',{className:'btn '+(polling?'danger':'success'),onClick:togglePoll,disabled},polling?'Stop Auto':'Auto')),
    output && h('div',{className:'output'},output));
}

/* ===================================================================
 *  15. MPU6050  (I2C 0x68)
 * =================================================================== */
function Mpu6050Panel({ ws, disabled }) {
  const [data, setData] = useState(null);
  const [output, setOutput] = useState('');
  const read = async () => {
    const res = await ws.send('mpu6050_read');
    setOutput(JSON.stringify(res.data,null,2));
    if (res.status==='ok'&&res.data.stdout) try{setData(JSON.parse(res.data.stdout));}catch{}
  };
  return h(Card, { icon:'🎯', title:'MPU6050 Accel/Gyro', badge:'I2C 0x68' },
    data && h('div',null,
      h('div',{style:{fontSize:'.75rem',color:'var(--text-dim)',marginBottom:4}},'Accelerometre (g)'),
      h('div',{className:'axes-grid'},
        ['x','y','z'].map(a=>h('div',{key:a,className:'axis-item'},
          h('div',{className:'axis-label'},a.toUpperCase()),
          h('div',{className:'axis-val'},data.accel[a])))),
      h('div',{style:{fontSize:'.75rem',color:'var(--text-dim)',marginBottom:4,marginTop:8}},'Gyroscope (\u00B0/s)'),
      h('div',{className:'axes-grid'},
        ['x','y','z'].map(a=>h('div',{key:a,className:'axis-item'},
          h('div',{className:'axis-label'},a.toUpperCase()),
          h('div',{className:'axis-val'},data.gyro[a])))),
      h('div',{style:{textAlign:'center',marginTop:6,fontSize:'.85rem'}},
        'Temp: ',h('strong',null,data.temp+'\u00B0C'))),
    h('button',{className:'btn',onClick:read,disabled,style:{width:'100%',marginTop:8}},'Lire'),
    output && h('div',{className:'output'},output));
}

/* ===================================================================
 *  16. IR MOTION SENSOR  (GPIO14)
 * =================================================================== */
function IrMotionPanel({ ws, disabled }) {
  const [detected, setDetected] = useState(false);
  const [output, setOutput] = useState('');
  const [polling, setPolling] = useState(false);
  const timerRef = useRef(null);
  const read = async () => {
    const res = await ws.send('ir_motion_read', { pin:14 });
    setOutput(JSON.stringify(res.data,null,2));
    if (res.status==='ok'&&res.data.stdout) try{setDetected(JSON.parse(res.data.stdout).detected);}catch{}
  };
  const togglePoll = () => {
    if (polling) { clearInterval(timerRef.current); setPolling(false); }
    else { setPolling(true); timerRef.current=setInterval(read,800); }
  };
  useEffect(()=>()=>clearInterval(timerRef.current),[]);
  return h(Card, { icon:'👁️', title:'Capteur IR Mouvement', badge:'GPIO14' },
    h('div',{className:'detect-indicator'+(detected?' detected':'')}, detected?'\uD83D\uDFE2':'\u26AA'),
    h('div',{style:{textAlign:'center',fontSize:'.85rem',marginBottom:8}},
      detected?'Mouvement detecte !':'Aucun mouvement'),
    h('div',{style:{display:'flex',gap:8}},
      h('button',{className:'btn',onClick:read,disabled},'Lire'),
      h('button',{className:'btn '+(polling?'danger':'success'),onClick:togglePoll,disabled},polling?'Stop':'Auto')),
    output && h('div',{className:'output'},output));
}

/* ===================================================================
 *  17. PHOTORESISTOR  (ADC)
 * =================================================================== */
function PhotoresistorPanel({ ws, disabled }) {
  const [data, setData] = useState(null);
  const [output, setOutput] = useState('');
  const read = async () => {
    const res = await ws.send('photoresistor_read');
    setOutput(JSON.stringify(res.data,null,2));
    if (res.status==='ok'&&res.data.stdout) try{setData(JSON.parse(res.data.stdout));}catch{}
  };
  return h(Card, { icon:'☀️', title:'Photoresistance', badge:'ADC' },
    data && h('div',{className:'sensor-value'},data.light_percent,h('span',{className:'sensor-unit'},' %')),
    h('button',{className:'btn',onClick:read,disabled,style:{width:'100%'}},'Lire luminosite'),
    output && h('div',{className:'output'},output));
}

/* ===================================================================
 *  18. THERMISTOR  (ADC CH0)
 * =================================================================== */
function ThermistorPanel({ ws, disabled }) {
  const [data, setData] = useState(null);
  const [output, setOutput] = useState('');
  const read = async () => {
    const res = await ws.send('thermistor_read');
    setOutput(JSON.stringify(res.data,null,2));
    if (res.status==='ok'&&res.data.stdout) try{setData(JSON.parse(res.data.stdout));}catch{}
  };
  return h(Card, { icon:'🌡️', title:'Thermistance', badge:'ADC A0' },
    data && h('div',{className:'sensor-value',style:{color:'#ef4444'}},data.temperature_c,h('span',{className:'sensor-unit'},' \u00B0C')),
    h('button',{className:'btn',onClick:read,disabled,style:{width:'100%'}},'Lire temperature'),
    output && h('div',{className:'output'},output));
}

/* ===================================================================
 *  19. BUTTON  (GPIO16)
 * =================================================================== */
function ButtonPanel({ ws, disabled }) {
  const [pressed, setPressed] = useState(false);
  const [output, setOutput] = useState('');
  const [polling, setPolling] = useState(false);
  const timerRef = useRef(null);
  const read = async () => {
    const res = await ws.send('gpio_read', { pin:16 });
    setOutput(JSON.stringify(res.data,null,2));
    if (res.status==='ok'&&res.data.stdout) try{setPressed(JSON.parse(res.data.stdout).value===1);}catch{}
  };
  const togglePoll = () => {
    if (polling) { clearInterval(timerRef.current); setPolling(false); }
    else { setPolling(true); timerRef.current=setInterval(read,300); }
  };
  useEffect(()=>()=>clearInterval(timerRef.current),[]);
  return h(Card, { icon:'🔘', title:'Bouton', badge:'GPIO16' },
    h('div',{className:'detect-indicator'+(pressed?' detected':''),style:{background:pressed?'rgba(239,68,68,.15)':'transparent',borderColor:pressed?'var(--red)':'var(--border)'}},
      pressed?'\uD83D\uDD34':'\u26AA'),
    h('div',{style:{textAlign:'center',fontSize:'.85rem',marginBottom:8}},
      pressed?'APPUYE':'Relache'),
    h('div',{style:{display:'flex',gap:8}},
      h('button',{className:'btn',onClick:read,disabled},'Lire'),
      h('button',{className:'btn '+(polling?'danger':'success'),onClick:togglePoll,disabled},polling?'Stop':'Auto')),
    output && h('div',{className:'output'},output));
}

/* ===================================================================
 *  20. JOYSTICK  (ADC + GPIO16)
 * =================================================================== */
function JoystickPanel({ ws, disabled }) {
  const [data, setData] = useState({ x:128, y:128, button:0 });
  const [output, setOutput] = useState('');
  const [polling, setPolling] = useState(false);
  const timerRef = useRef(null);
  const read = async () => {
    const res = await ws.send('joystick_read');
    setOutput(JSON.stringify(res.data,null,2));
    if (res.status==='ok'&&res.data.stdout) try{setData(JSON.parse(res.data.stdout));}catch{}
  };
  const togglePoll = () => {
    if (polling) { clearInterval(timerRef.current); setPolling(false); }
    else { setPolling(true); timerRef.current=setInterval(read,200); }
  };
  useEffect(()=>()=>clearInterval(timerRef.current),[]);
  const pctX = (data.x/255*100).toFixed(0);
  const pctY = (data.y/255*100).toFixed(0);
  return h(Card, { icon:'🕹️', title:'JoyStick', badge:'ADC' },
    h('div',{className:'joy-container'},
      h('div',{className:'joy-crosshair-h'}),
      h('div',{className:'joy-crosshair-v'}),
      h('div',{className:'joy-dot',style:{left:pctX+'%',top:pctY+'%'}})),
    h('div',{style:{display:'flex',justifyContent:'center',gap:16,fontSize:'.85rem',marginTop:4}},
      h('span',null,'X: ',h('strong',null,data.x)),
      h('span',null,'Y: ',h('strong',null,data.y)),
      h('span',null,'Btn: ',h('strong',{style:{color:data.button?'var(--red)':'var(--green)'}},data.button?'ON':'OFF'))),
    h('div',{style:{display:'flex',gap:8,marginTop:8}},
      h('button',{className:'btn',onClick:read,disabled},'Lire'),
      h('button',{className:'btn '+(polling?'danger':'success'),onClick:togglePoll,disabled},polling?'Stop':'Auto')),
    output && h('div',{className:'output'},output));
}

/* ===================================================================
 *  21. POTENTIOMETER  (ADC A2/A3/A4)
 * =================================================================== */
function PotentiometerPanel({ ws, disabled }) {
  const [ch, setCh] = useState(2);
  const [data, setData] = useState(null);
  const [output, setOutput] = useState('');
  const read = async () => {
    const res = await ws.send('adc_read', { channel:ch });
    setOutput(JSON.stringify(res.data,null,2));
    if (res.status==='ok'&&res.data.stdout) try{setData(JSON.parse(res.data.stdout));}catch{}
  };
  return h(Card, { icon:'🎛️', title:'Potentiometres', badge:'ADC A2-A4' },
    h('div',{className:'field-row'},
      h('div',{className:'field',style:{flex:1}},
        h('label',null,'Potentiometre'),
        h('select',{value:ch,onChange:e=>setCh(+e.target.value)},
          h('option',{value:2},'RP1 (A2)'),
          h('option',{value:3},'RP2 (A3)'),
          h('option',{value:4},'RP3 (A4)'))),
      h('button',{className:'btn',onClick:read,disabled},'Lire')),
    data && h('div',{className:'sensor-value'},data.percent||data.voltage,h('span',{className:'sensor-unit'},data.percent?' %':' V')),
    output && h('div',{className:'output'},output));
}

/* ===================================================================
 *  22. RFID-RC522  (SPI)
 * =================================================================== */
function RfidPanel({ ws, disabled }) {
  const [data, setData] = useState(null);
  const [output, setOutput] = useState('');
  const [polling, setPolling] = useState(false);
  const timerRef = useRef(null);
  const read = async () => {
    const res = await ws.send('rfid_read');
    setOutput(JSON.stringify(res.data,null,2));
    if (res.status==='ok'&&res.data.stdout) try{setData(JSON.parse(res.data.stdout));}catch{}
  };
  const togglePoll = () => {
    if (polling) { clearInterval(timerRef.current); setPolling(false); }
    else { setPolling(true); timerRef.current=setInterval(read,1000); }
  };
  useEffect(()=>()=>clearInterval(timerRef.current),[]);
  return h(Card, { icon:'💳', title:'RFID-RC522', badge:'SPI' },
    h('div',{className:'detect-indicator'+(data&&data.status==='detected'?' detected':'')},
      data&&data.status==='detected'?'✅':'📡'),
    data && h('div',{style:{textAlign:'center',marginBottom:8}},
      data.status==='detected'
        ? h('div',null,h('div',{style:{fontSize:'.85rem'}},'UID: ',h('strong',null,data.uid)),
            h('div',{style:{fontSize:'.75rem',color:'var(--text-dim)'}},'Type: '+data.type))
        : h('div',{style:{color:'var(--text-dim)'}},'Aucune carte detectee')),
    h('div',{style:{display:'flex',gap:8}},
      h('button',{className:'btn',onClick:read,disabled},'Lire'),
      h('button',{className:'btn '+(polling?'danger':'success'),onClick:togglePoll,disabled},polling?'Stop':'Scan Auto')),
    output && h('div',{className:'output'},output));
}

/* ===================================================================
 *  23. KEYPAD 4x4
 * =================================================================== */
function KeypadPanel({ ws, disabled }) {
  const [lastKey, setLastKey] = useState('');
  const [output, setOutput] = useState('');
  const keys = ['1','2','3','A','4','5','6','B','7','8','9','C','*','0','#','D'];
  const read = async () => {
    const res = await ws.send('keypad_read');
    setOutput(JSON.stringify(res.data,null,2));
    if (res.status==='ok'&&res.data.stdout) try{setLastKey(JSON.parse(res.data.stdout).key);}catch{}
  };
  return h(Card, { icon:'⌨️', title:'Clavier Matriciel 4x4', badge:'GPIO' },
    h('div',{className:'keypad-grid'},
      keys.map(k=>h('div',{key:k,className:'key-btn'+(lastKey===k?' pressed':'')},k))),
    h('div',{style:{textAlign:'center',margin:'8px 0',fontSize:'.85rem'}},
      'Derniere touche: ',h('strong',null,lastKey||'—')),
    h('button',{className:'btn',onClick:read,disabled,style:{width:'100%'}},'Lire touche'),
    output && h('div',{className:'output'},output));
}

/* ===================================================================
 *  24. I2C LCD 1602
 * =================================================================== */
function LcdPanel({ ws, disabled }) {
  const [line1, setLine1] = useState('Hello Freenove!');
  const [line2, setLine2] = useState('RPi5 Dashboard');
  const [output, setOutput] = useState('');
  const send = async () => {
    const res = await ws.send('lcd_write', { line1, line2 });
    setOutput(JSON.stringify(res.data,null,2));
  };
  return h(Card, { icon:'📺', title:'I2C LCD 1602', badge:'I2C 0x27' },
    h('div',{className:'lcd-screen'},
      h('div',null,(line1||'').padEnd(16,' ').slice(0,16)),
      h('div',null,(line2||'').padEnd(16,' ').slice(0,16))),
    h('div',{className:'field'},
      h('label',null,'Ligne 1 (max 16 car.)'),
      h('input',{value:line1,maxLength:16,onChange:e=>setLine1(e.target.value)})),
    h('div',{className:'field'},
      h('label',null,'Ligne 2 (max 16 car.)'),
      h('input',{value:line2,maxLength:16,onChange:e=>setLine2(e.target.value)})),
    h('button',{className:'btn',onClick:send,disabled,style:{width:'100%'}},'Envoyer au LCD'),
    output && h('div',{className:'output'},output));
}

/* ===================================================================
 *  25. ADC (ADS7830)
 * =================================================================== */
function AdcPanel({ ws, disabled }) {
  const [channel, setChannel] = useState(0);
  const [output, setOutput] = useState('');
  const [polling, setPolling] = useState(false);
  const timerRef = useRef(null);
  const readOnce = async () => {
    const res = await ws.send('adc_read', { channel });
    setOutput(JSON.stringify(res.data,null,2));
  };
  const togglePoll = () => {
    if (polling) { clearInterval(timerRef.current); setPolling(false); }
    else { setPolling(true); timerRef.current=setInterval(readOnce,1000); }
  };
  useEffect(()=>()=>clearInterval(timerRef.current),[]);
  return h(Card, { icon:'📊', title:'ADC (ADS7830)', badge:'I2C' },
    h('div',{className:'field-row'},
      h('div',{className:'field'},
        h('label',null,'Canal'),
        h('select',{value:channel,onChange:e=>setChannel(+e.target.value)},
          [0,1,2,3,4,5,6,7].map(c=>h('option',{key:c,value:c},'CH'+c)))),
      h('button',{className:'btn',onClick:readOnce,disabled},'Lire'),
      h('button',{className:'btn '+(polling?'danger':'success'),onClick:togglePoll,disabled},
        polling?'Stop':'Auto')),
    output && h('div',{className:'output'},output));
}

/* ===================================================================
 *  26. I2C SCANNER
 * =================================================================== */
function I2cPanel({ ws, disabled }) {
  const [bus, setBus] = useState(1);
  const [output, setOutput] = useState('');
  const scan = async () => {
    setOutput('Scan en cours...');
    const res = await ws.send('i2c_scan', { bus });
    setOutput(JSON.stringify(res.data,null,2));
  };
  return h(Card, { icon:'🔍', title:'I2C Scanner', badge:'I2C' },
    h('div',{className:'field-row'},
      h('div',{className:'field'},
        h('label',null,'Bus'),
        h('select',{value:bus,onChange:e=>setBus(+e.target.value)},
          h('option',{value:0},'i2c-0'),
          h('option',{value:1},'i2c-1'))),
      h('button',{className:'btn',onClick:scan,disabled},'Scanner')),
    output && h('div',{className:'output'},output));
}

/* ===================================================================
 *  27. GPIO CONTROL (general)
 * =================================================================== */
function GpioPanel({ ws, disabled }) {
  const pins = [4,5,6,12,13,14,16,17,18,19,20,21,22,23,24,25,26,27];
  const [states, setStates] = useState({});
  const [output, setOutput] = useState('');
  const toggle = async (pin) => {
    const nv = (states[pin]||0) ? 0 : 1;
    const res = await ws.send('gpio_write', { pin, value:nv });
    if (res.status==='ok') setStates(s=>({...s,[pin]:nv}));
    setOutput(JSON.stringify(res.data,null,2));
  };
  const readPin = async (pin) => {
    const res = await ws.send('gpio_read', { pin });
    if (res.status==='ok'&&res.data.stdout) try{setStates(s=>({...s,[pin]:JSON.parse(res.data.stdout).value}));}catch{}
    setOutput(JSON.stringify(res.data,null,2));
  };
  return h(Card, { icon:'💡', title:'GPIO Control', badge:'BCM' },
    h('div',{className:'gpio-grid'},
      pins.map(p=>h('div',{key:p,className:'gpio-pin'+(states[p]?' active':''),
        onClick:()=>!disabled&&toggle(p),
        onContextMenu:e=>{e.preventDefault();!disabled&&readPin(p);}},
        h('span',{className:'pin-num'},'GPIO '+p),
        h('span',{className:'pin-state'},states[p]?'HIGH':'LOW')))),
    h('p',{style:{fontSize:'.72rem',color:'var(--text-dim)',marginTop:6}},'Clic = toggle | Clic droit = lire'),
    output && h('div',{className:'output'},output));
}

/* ===================================================================
 *  28. PWM CONTROL
 * =================================================================== */
function PwmPanel({ ws, disabled }) {
  const [pin, setPin] = useState(18);
  const [freq, setFreq] = useState(1000);
  const [duty, setDuty] = useState(50);
  const [output, setOutput] = useState('');
  return h(Card, { icon:'〰️', title:'PWM Control', badge:'GPIO' },
    h('div',{className:'field-row'},
      h('div',{className:'field'},
        h('label',null,'Pin'),
        h('select',{value:pin,onChange:e=>setPin(+e.target.value)},
          [12,13,18,19].map(p=>h('option',{key:p,value:p},'GPIO '+p)))),
      h('div',{className:'field'},
        h('label',null,'Freq (Hz)'),
        h('input',{type:'number',min:1,max:50000,value:freq,onChange:e=>setFreq(+e.target.value)}))),
    h('div',{className:'field',style:{marginTop:8}},
      h('label',null,'Duty: '+duty+'%'),
      h('input',{type:'range',min:0,max:100,value:duty,onChange:e=>setDuty(+e.target.value)})),
    h('div',{style:{display:'flex',gap:8,marginTop:8}},
      h('button',{className:'btn success',disabled,onClick:async()=>setOutput(JSON.stringify((await ws.send('pwm_start',{pin,frequency:freq,duty})).data,null,2))},'Start'),
      h('button',{className:'btn danger',disabled,onClick:async()=>setOutput(JSON.stringify((await ws.send('pwm_stop',{pin})).data,null,2))},'Stop')),
    output && h('div',{className:'output'},output));
}

/* ===================================================================
 *  29. SYSTEM INFO
 * =================================================================== */
function SystemInfoPanel({ ws, disabled }) {
  const [info, setInfo] = useState(null);
  const [output, setOutput] = useState('');
  const refresh = async () => {
    setOutput('Chargement...');
    const res = await ws.send('system_info');
    setOutput(JSON.stringify(res.data,null,2));
    if (res.status==='ok'&&res.data.stdout) try{setInfo(JSON.parse(res.data.stdout));}catch{}
  };
  const fmtUp = s => { if(!s||s<0) return '—'; return Math.floor(s/3600)+'h '+Math.floor((s%3600)/60)+'m'; };
  return h(Card, { icon:'🖥️', title:'Systeme', badge:'Info' },
    h('button',{className:'btn',onClick:refresh,disabled,style:{marginBottom:8}},'Rafraichir'),
    info && h('div',{className:'sys-grid'},
      h('div',{className:'sys-item'},h('div',{className:'label'},'Hostname'),h('div',{className:'value'},info.hostname)),
      h('div',{className:'sys-item'},h('div',{className:'label'},'Kernel'),h('div',{className:'value',style:{fontSize:'.8rem'}},info.kernel)),
      h('div',{className:'sys-item'},h('div',{className:'label'},'CPU'),h('div',{className:'value',style:{color:info.cpu_temp_c>70?'#ef4444':'#22c55e'}},info.cpu_temp_c+'\u00B0C')),
      h('div',{className:'sys-item'},h('div',{className:'label'},'Uptime'),h('div',{className:'value'},fmtUp(info.uptime_s))),
      h('div',{className:'sys-item'},h('div',{className:'label'},'Arch'),h('div',{className:'value'},info.arch)),
      h('div',{className:'sys-item'},h('div',{className:'label'},'Disque'),h('div',{className:'value'},info.disk?info.disk.free_mb+' MB':'—'))),
    output && h('div',{className:'output'},output));
}

/* ===================================================================
 *  30. TERMINAL SSH
 * =================================================================== */
function TerminalPanel({ ws, disabled }) {
  const [cmd, setCmd] = useState('');
  const [history, setHistory] = useState([]);
  const run = async () => {
    if (!cmd.trim()) return;
    setHistory(h=>[...h,'$ '+cmd]);
    const res = await ws.send('run_command', { command:cmd });
    if (res.status==='ok'&&res.data) {
      if (res.data.stdout) setHistory(h=>[...h,res.data.stdout]);
      if (res.data.stderr) setHistory(h=>[...h,'[stderr] '+res.data.stderr]);
    } else {
      setHistory(h=>[...h,'[error] '+(res.message||JSON.stringify(res))]);
    }
    setCmd('');
  };
  return h(Card, { icon:'⌨️', title:'Terminal SSH', badge:'Shell' },
    h('div',{className:'output',style:{minHeight:100}},
      history.length===0?'Entrez une commande...':history.join('\n')),
    h('div',{className:'terminal-input'},
      h('input',{value:cmd,onChange:e=>setCmd(e.target.value),placeholder:'Commande...',
        onKeyDown:e=>e.key==='Enter'&&!disabled&&run(),disabled}),
      h('button',{className:'btn',onClick:run,disabled},'Run')));
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
      logsEndRef.current.scrollIntoView({ behavior:'smooth' });
    }
  }, [logs, autoScroll]);

  const clear = () => { ws.logsRef.current = []; setLogs([]); };

  return h('div',{className:'debug-panel'},
    h('div',{className:'debug-header'},
      h('span',null,'\uD83D\uDC1B Debug Console (',logs.length,' logs)'),
      h('div',{className:'debug-actions'},
        h('button',{onClick:()=>setAutoScroll(!autoScroll)},autoScroll?'Auto-scroll: ON':'Auto-scroll: OFF'),
        h('button',{onClick:clear},'Effacer'))),
    h('div',{className:'debug-logs',ref:panelRef},
      logs.map((l,i) =>
        h('div',{key:i,className:'log-entry'},
          h('span',{className:'log-time'},l.ts),
          l.dir==='out' && h('span',{className:'log-arrow-out'},'\u25B6 '),
          l.dir==='in'  && h('span',{className:'log-arrow-in'},'\u25C0 '),
          l.dir==='err' && h('span',{className:'log-error'},'\u2716 '),
          h('span',{className:'log-action'},l.action,' '),
          h('span',{className:'log-data'},typeof l.data==='string'?l.data:JSON.stringify(l.data)))),
      h('div',{ref:logsEndRef})));
}

/* ===================================================================
 *  SIDEBAR NAV ITEMS
 * =================================================================== */
const NAV_ITEMS = [
  { section: '💡 LEDs & Affichage' },
  { id:'blue_led',    icon:'🔵', label:'Blue LED',            badge:'GPIO17' },
  { id:'rgb_led',     icon:'🌈', label:'LED RGB',             badge:'GPIO5/6/13' },
  { id:'ws2812',      icon:'💎', label:'WS2812 LED',          badge:'GPIO18' },
  { id:'led_matrix',  icon:'⬜', label:'LED Matrix 8x8',      badge:'74HC595' },
  { id:'seven_seg',   icon:'🔢', label:'Afficheur 7-Seg',     badge:'74HC595' },
  { id:'led_bar',     icon:'📊', label:'LED Bar Graph',       badge:'74HC595' },

  { section: '⚙️ Moteurs & Actionneurs' },
  { id:'servo',       icon:'🔄', label:'Servo Moteur',        badge:'GPIO18' },
  { id:'stepper',     icon:'⚙️', label:'Moteur Pas-a-Pas',   badge:'GPIO' },
  { id:'motor',       icon:'🔌', label:'Moteur DC',           badge:'GPIO18/23/24' },
  { id:'active_buzz', icon:'🔔', label:'Buzzer Actif',        badge:'GPIO17' },
  { id:'passive_buzz',icon:'🔊', label:'Buzzer Passif',       badge:'GPIO4' },
  { id:'relay',       icon:'⚡', label:'Relais',              badge:'GPIO12' },

  { section: '📡 Capteurs' },
  { id:'dht',         icon:'🌡️', label:'DHT11',              badge:'GPIO23' },
  { id:'ultrasonic',  icon:'📏', label:'Ultrason HC-SR04',    badge:'GPIO20/21' },
  { id:'mpu6050',     icon:'🎯', label:'MPU6050',             badge:'I2C' },
  { id:'ir_motion',   icon:'👁️', label:'Capteur IR',         badge:'GPIO14' },
  { id:'photoresist', icon:'☀️', label:'Photoresistance',    badge:'ADC' },
  { id:'thermistor',  icon:'🌡️', label:'Thermistance',       badge:'ADC' },

  { section: '🕹️ Entrees' },
  { id:'button',      icon:'🔘', label:'Bouton',              badge:'GPIO16' },
  { id:'joystick',    icon:'🕹️', label:'JoyStick',           badge:'ADC' },
  { id:'potentiom',   icon:'🎛️', label:'Potentiometres',     badge:'ADC' },
  { id:'keypad',      icon:'⌨️', label:'Clavier 4x4',        badge:'GPIO' },
  { id:'rfid',        icon:'💳', label:'RFID-RC522',          badge:'SPI' },

  { section: '📟 Communication' },
  { id:'lcd',         icon:'📺', label:'I2C LCD 1602',        badge:'I2C' },
  { id:'i2c_scan',    icon:'🔍', label:'I2C Scanner',         badge:'I2C' },
  { id:'adc',         icon:'📊', label:'ADC (ADS7830)',       badge:'I2C' },

  { section: '🔧 Systeme' },
  { id:'gpio',        icon:'💡', label:'GPIO Control',        badge:'BCM' },
  { id:'pwm',         icon:'〰️', label:'PWM Control',        badge:'GPIO' },
  { id:'terminal',    icon:'⌨️', label:'Terminal SSH',        badge:'Shell' },
];

/* ===================================================================
 *  MAIN APP — 3-column layout
 * =================================================================== */
function App() {
  const ws = useMockWebSocket();
  const [sshConnected, setSshConnected] = useState(false);
  const [activePanel, setActivePanel] = useState('gpio');
  const [showDebug, setShowDebug] = useState(false);
  const dis = !ws.ready || !sshConnected;

  /* Map panel id -> component */
  const PANELS = {
    blue_led:     h(BlueLedPanel,{ws,disabled:dis}),
    rgb_led:      h(RgbLedPanel,{ws,disabled:dis}),
    ws2812:       h(Ws2812Panel,{ws,disabled:dis}),
    led_matrix:   h(LedMatrixPanel,{ws,disabled:dis}),
    seven_seg:    h(SevenSegPanel,{ws,disabled:dis}),
    led_bar:      h(LedBarPanel,{ws,disabled:dis}),
    servo:        h(ServoPanel,{ws,disabled:dis}),
    stepper:      h(StepperPanel,{ws,disabled:dis}),
    motor:        h(MotorPanel,{ws,disabled:dis}),
    active_buzz:  h(ActiveBuzzerPanel,{ws,disabled:dis}),
    passive_buzz: h(PassiveBuzzerPanel,{ws,disabled:dis}),
    relay:        h(RelayPanel,{ws,disabled:dis}),
    dht:          h(DhtPanel,{ws,disabled:dis}),
    ultrasonic:   h(UltrasonicPanel,{ws,disabled:dis}),
    mpu6050:      h(Mpu6050Panel,{ws,disabled:dis}),
    ir_motion:    h(IrMotionPanel,{ws,disabled:dis}),
    photoresist:  h(PhotoresistorPanel,{ws,disabled:dis}),
    thermistor:   h(ThermistorPanel,{ws,disabled:dis}),
    button:       h(ButtonPanel,{ws,disabled:dis}),
    joystick:     h(JoystickPanel,{ws,disabled:dis}),
    potentiom:    h(PotentiometerPanel,{ws,disabled:dis}),
    keypad:       h(KeypadPanel,{ws,disabled:dis}),
    rfid:         h(RfidPanel,{ws,disabled:dis}),
    lcd:          h(LcdPanel,{ws,disabled:dis}),
    i2c_scan:     h(I2cPanel,{ws,disabled:dis}),
    adc:          h(AdcPanel,{ws,disabled:dis}),
    gpio:         h(GpioPanel,{ws,disabled:dis}),
    pwm:          h(PwmPanel,{ws,disabled:dis}),
    terminal:     h(TerminalPanel,{ws,disabled:dis}),
  };

  return h('div', {className:'app-wrapper'},
    h('header',{className:'app-header'},
      h('h1',null,'\uD83E\uDDEA Freenove ',h('span',null,'Projects Board'),' \u2014 Dashboard'),
      h('div',{style:{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}},
        h(ConnectionBar,{ws,sshConnected,setSshConnected}),
        h('button',{className:'debug-toggle'+(showDebug?' active':''),onClick:()=>setShowDebug(!showDebug)},
          h('span',{className:'dt-dot'}),
          showDebug?'Debug ON':'Debug'))),

    !ws.ready && h('div',{style:{textAlign:'center',padding:40,color:'var(--text-dim)'}},
      h('p',{style:{fontSize:'1.2rem',marginBottom:12}},'\u26A1 Cliquez pour simuler la connexion'),
      h('button',{className:'btn',onClick:ws.connect},'Se connecter (simulation)')),

    ws.ready && !sshConnected && h('div',{style:{textAlign:'center',padding:20,color:'#f59e0b',fontSize:'.9rem'}},
      '\u26A0\uFE0F Connectez-vous en SSH pour activer les controles'),

    ws.ready && h('div',{className:'app-layout'},

      /* --- Left sidebar --- */
      h('nav',{className:'sidebar'},
        NAV_ITEMS.map((item,i) =>
          item.section
            ? h('div',{key:'s'+i,className:'sidebar-section'},item.section)
            : h('div',{key:item.id,
                className:'sidebar-item'+(activePanel===item.id?' active':''),
                onClick:()=>setActivePanel(item.id)},
                h('span',{className:'si-icon'},item.icon),
                item.label,
                item.badge && h('span',{className:'si-badge'},item.badge)))),

      /* --- Center: active panel --- */
      h('div',{className:'center-panel'},
        PANELS[activePanel] || h('p',{style:{color:'var(--text-dim)'}},'Selectionnez un composant')),

      /* --- Right: System info + Terminal --- */
      h('div',{className:'right-panel'},
        h(SystemInfoPanel,{ws,disabled:dis}),
        h(TerminalPanel,{ws,disabled:dis}))),

    /* --- Bottom: Debug panel --- */
    showDebug && h(DebugPanel,{ws})
  );
}

/* Mount */
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(h(App));
