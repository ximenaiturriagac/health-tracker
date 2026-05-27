import { useState, useEffect, useCallback } from "react";

// ── CONFIG ────────────────────────────────────────────────────────────────
const CLIENT_ID = "309896660471-3i9106oa3dfbqu0ndbsdoa0a7bl9ol12.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/spreadsheets";
const SHEET_ID = "1b2oHbykr31dMu6QGwy8puWhh-F5Xbd40RQBDEpXhgSs";

// ── PLAN NUTRICIONAL ──────────────────────────────────────────────────────
const MEAL_PLAN = {
  0: { des:['2 huevos revueltos con tomate y espinacas','½ taza avena cocida con canela','☕ Café con leche deslactosada'], cam:['1 scoop Isopure + 200 ml leche deslactosada','1 manzana (o 1 papilla Mongui)'], com:['150 g pechuga de pollo a la plancha','½ taza arroz integral','Ensalada: lechuga, tomate, pepino + limón y aceite de oliva'], cpm:['100 g cottage cheese','½ taza arándanos (o 1 papilla Mongui)'], cen:['170 g yogur griego natural + ½ taza fresas + 1 cdita chía'] },
  1: { des:['Omelette: 3 claras + 1 yema con espinacas y tomate','1 tostada de maíz + ¼ aguacate','☕ Café con leche deslactosada'], cam:['1 scoop Isopure + 200 ml leche deslactosada','1 pera (o 1 papilla Mongui)'], com:['★ 150 g camarones al ajillo','½ taza elote en grano','Ensalada verde + limón'], cpm:['170 g yogur griego natural','½ taza mango (o 1 papilla Mongui)'], cen:['Smoothie: 200 ml leche deslactosada + ½ plátano + 1 cdita chía + canela'] },
  2: { des:['2 huevos al gusto','½ taza avena con canela','1 naranja · ☕ Café con leche deslactosada'], cam:['1 scoop Isopure + 200 ml leche deslactosada','1 manzana (o 1 papilla Mongui)'], com:['150 g res magra (arrachera, milanesa) a la plancha','½ taza arroz integral','Ensalada: lechuga, tomate, pepino + limón'], cpm:['1 pera (o 1 papilla Mongui)','1 cda semillas de girasol o pepita'], cen:['2 tostadas de maíz + ½ aguacate + tomate rebanado + 80 g cottage cheese'] },
  3: { des:['2 huevos estrellados en aceite de oliva','1 tostada de maíz + ½ aguacate','☕ Café con leche deslactosada'], cam:['1 scoop Isopure + 200 ml leche deslactosada','1 naranja (o 1 papilla Mongui)'], com:['★ 150 g salmón a la plancha con limón y hierbas','½ taza papa cambray cocida','Ensalada verde + aceite de oliva y limón'], cpm:['100 g cottage cheese','½ taza fresas (o 1 papilla Mongui)'], cen:['Bowl: 170 g yogur griego + ½ taza mango + ½ taza fresas + 1 cdita chía'] },
  4: { des:['2 huevos + calabacita en cubos salteada con tomate','☕ Café con leche deslactosada'], cam:['1 scoop Isopure + 200 ml leche deslactosada','1 manzana (o 1 papilla Mongui)'], com:['2 tacos de pollo en tortilla de maíz','Guacamole: ¼ aguacate + tomate + limón','Ensalada verde + aceite de oliva'], cpm:['170 g yogur griego natural','½ taza arándanos (o 1 papilla Mongui)'], cen:['2 tostadas de maíz + ½ aguacate + tomate con limón y sal'] },
  5: { des:['Hotcakes de avena: ½ taza avena + 1 plátano + 1 huevo','1 cdita miel de agave · ☕ Café con leche deslactosada'], cam:['1 scoop Isopure + 200 ml leche deslactosada'], com:['★ Hamburguesa casera con bimbollo','Ensalada verde (sin papas ni catsup)'], cpm:['Fruta picada: jícama + pepino + mango con limón (o 1 papilla Mongui)'], cen:['Smoothie: 200 ml leche deslactosada + ½ plátano + 1 cdita chía + canela'] },
  6: { des:['Chilaquiles rojos ligeros','2 huevos encima + cottage cheese en vez de crema','☕ Café con leche deslactosada'], cam:['1 scoop Isopure + 200 ml leche deslactosada','1 manzana (o 1 papilla Mongui)'], com:['Caldo de pollo con verduras','Pieza de pollo sin piel + 2 tortillas de maíz'], cpm:['100 g cottage cheese','½ taza fresas (o 1 papilla Mongui)'], cen:['★ ½ taza arroz blanco + 1 lata de atún en agua','Aguacate en cubos + tomate + limón'] },
};

const MEALS = [
  { key:'des', icon:'☀️', label:'Desayuno',    time:'8–10 am',     kcal:'~370' },
  { key:'cam', icon:'☕', label:'Colación AM',  time:'11:30–12 pm', kcal:'~275', conditional:true },
  { key:'com', icon:'🍽️', label:'Comida',       time:'3 pm',        kcal:'~450' },
  { key:'cpm', icon:'🍎', label:'Colación PM',  time:'5:30–6 pm',   kcal:'~130' },
  { key:'cen', icon:'🌙', label:'Cena',         time:'9 pm',        kcal:'~190' },
];

const DAYS_ES = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const todayKey = () => new Date().toISOString().split('T')[0];

// ── SLEEP CALCULATOR ──────────────────────────────────────────────────────
function calcOptimalWake(bedtime) {
  if (!bedtime) return null;
  const [h, m] = bedtime.split(':').map(Number);
  const bedMin = h * 60 + m + 14;
  const target = 7 * 60 + 30;
  return [4,5,6].map(c => {
    const wakeMin = (bedMin + c * 90) % (24 * 60);
    const wh = Math.floor(wakeMin / 60);
    const wm = wakeMin % 60;
    return { cycles:c, label:`${wh}:${wm.toString().padStart(2,'0')}`, score: c===5?'ideal':c===4?'mínimo':'largo', wakeMin };
  }).sort((a,b) => Math.abs(a.wakeMin-target) - Math.abs(b.wakeMin-target));
}

function getCurrentContext() {
  const t = new Date().getHours() * 60 + new Date().getMinutes();
  if (t < 10*60)  return 'sleep';
  if (t < 13*60)  return 'des';
  if (t < 15*60)  return 'cam';
  if (t < 18*60)  return 'com';
  if (t < 21*60)  return 'cpm';
  if (t < 22*60)  return 'cen';
  return 'sleep';
}

function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

// ── GOOGLE SHEETS API ─────────────────────────────────────────────────────
async function appendToSheet(sheet, values, token) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${sheet}!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [values] }),
  });
  if (!res.ok) throw new Error(await res.text());
}

// ── UI COMPONENTS ─────────────────────────────────────────────────────────
function Pill({ label, selected, color, onClick, small }) {
  return (
    <button onClick={onClick} style={{
      padding: small ? '6px 14px' : '10px 18px', borderRadius:100,
      border: `1.5px solid ${selected ? color : '#E0DDD8'}`,
      background: selected ? color : '#fff',
      color: selected ? '#fff' : '#6B6860',
      fontSize: small ? 13 : 14, fontWeight:600, cursor:'pointer',
      fontFamily:'inherit', transition:'all 0.15s', flexShrink:0,
    }}>{label}</button>
  );
}

function Stepper({ value, onChange, min, max, step, unit }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
      <button onClick={() => onChange(Math.max(min, value-step))} style={{ width:36, height:36, borderRadius:'50%', border:'1.5px solid #E0DDD8', background:'#fff', fontSize:18, cursor:'pointer', color:'#6B6860', display:'flex', alignItems:'center', justifyContent:'center' }}>−</button>
      <span style={{ fontSize:22, fontWeight:700, color:'#1A1916', minWidth:60, textAlign:'center' }}>
        {value}<span style={{ fontSize:13, fontWeight:500, color:'#9B9890', marginLeft:4 }}>{unit}</span>
      </span>
      <button onClick={() => onChange(Math.min(max, value+step))} style={{ width:36, height:36, borderRadius:'50%', border:'1.5px solid #E0DDD8', background:'#fff', fontSize:18, cursor:'pointer', color:'#6B6860', display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
    </div>
  );
}

function Section({ icon, title, subtitle, color, children, done }) {
  return (
    <div style={{ background:'#fff', borderRadius:20, padding:'20px', border:`1px solid ${done ? color+'40' : '#EDEBE6'}`, position:'relative', overflow:'hidden' }}>
      {done && <div style={{ position:'absolute', top:0, right:0, background:color, color:'#fff', fontSize:10, fontWeight:700, padding:'4px 12px', borderBottomLeftRadius:10 }}>✓ GUARDADO</div>}
      <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:16 }}>
        <span style={{ fontSize:24, lineHeight:1 }}>{icon}</span>
        <div>
          <div style={{ fontSize:15, fontWeight:700, color:'#1A1916' }}>{title}</div>
          {subtitle && <div style={{ fontSize:12, color:'#9B9890', marginTop:2 }}>{subtitle}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

function SaveBtn({ onClick, saving, saved, color, label }) {
  return (
    <button onClick={onClick} disabled={saving} style={{
      width:'100%', padding:'14px', borderRadius:14, border:'none', cursor:'pointer',
      background: saved ? '#52B788' : color, color:'#fff',
      fontSize:15, fontWeight:700, fontFamily:'inherit', marginTop:4,
      opacity: saving ? 0.7 : 1,
    }}>
      {saving ? '⏳ Guardando...' : saved ? '✓ Guardado en Sheets' : label}
    </button>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────
export default function App() {
  const now = new Date();
  const dow = now.getDay();
  const planDay = MEAL_PLAN[dow] || MEAL_PLAN[0];

  const [token, setToken]           = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [activeSection, setActiveSection] = useState(getCurrentContext());
  const [saving, setSaving]         = useState(false);
  const [savedSection, setSavedSection] = useState(null);

  const [mealStatus, setMealStatus] = useState({ des:null, cam:null, com:null, cpm:null, cen:null });
  const [mealNotes, setMealNotes]   = useState({});
  const [showCam, setShowCam]       = useState(null);
  const [bedtime, setBedtime]       = useState('23:00');
  const [actualWake, setActualWake] = useState('');
  const [sleepQuality, setSleepQuality] = useState(null);
  const [weight, setWeight]         = useState('');
  const [selectedWake, setSelectedWake] = useState(null);
  const [agua, setAgua]             = useState(0);
  const [lectura, setLectura]       = useState(0);

  const wakeOptions = calcOptimalWake(bedtime);
  const coral = '#E76F51';
  const sectionColor = { sleep:'#4A6FA5', des:'#E9A020', cam:'#8B8077', com:'#2D6A4F', cpm:'#E76F51', cen:'#4A6FA5', habits:'#52B788' };

  // ── AUTH ──
  useEffect(() => {
    const t = localStorage.getItem('ht_token');
    if (t) setToken(t);
    if (!document.getElementById('google-gsi')) {
      const script = document.createElement('script');
      script.id = 'google-gsi';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  }, []);

  const handleAuth = useCallback(() => {
    if (!window.google?.accounts?.oauth2) {
      setTimeout(() => {
        if (!window.google?.accounts?.oauth2) {
          alert('La API de Google no cargó. Recarga la página e intenta de nuevo.');
          return;
        }
        handleAuth();
      }, 1500);
      return;
    }
    setAuthLoading(true);
    window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (resp) => {
        setAuthLoading(false);
        if (resp.error) { alert('Error de autenticación: ' + resp.error); return; }
        setToken(resp.access_token);
        localStorage.setItem('ht_token', resp.access_token);
      },
    }).requestAccessToken();
  }, []);

  // ── SAVE FUNCTIONS ──
  const doSave = async (sheet, values, section) => {
    if (!token) { handleAuth(); return; }
    setSaving(true);
    try {
      await appendToSheet(sheet, values, token);
      setSavedSection(section);
      setTimeout(() => setSavedSection(null), 3000);
    } catch(e) {
      const msg = e.message;
      if (msg.includes('401')) { setToken(null); localStorage.removeItem('ht_token'); handleAuth(); }
      else alert('Error: ' + msg);
    }
    setSaving(false);
  };

  const saveSleep = () => {
    const optimal = selectedWake || wakeOptions?.[0]?.label || '';
    const cycles  = wakeOptions?.find(o => o.label === optimal)?.cycles || '';
    const dur = actualWake && bedtime ? (() => {
      const [bh,bm] = bedtime.split(':').map(Number);
      const [wh,wm] = actualWake.split(':').map(Number);
      return (((wh*60+wm)-(bh*60+bm)+1440)%1440/60).toFixed(1);
    })() : '';
    doSave('Sueno', [todayKey(), bedtime, actualWake, optimal, cycles, dur, sleepQuality||'', weight||''], 'sleep');
  };

  const saveMeal = (key) => {
    if (!mealStatus[key]) { alert('Indica si cumpliste la comida'); return; }
    const labels = { des:'Desayuno', cam:'ColacionAM', com:'Comida', cpm:'ColacionPM', cen:'Cena' };
    const kcals  = { des:'~370', cam:'~275', com:'~450', cpm:'~130', cen:'~190' };
    doSave('Alimentacion', [todayKey(), labels[key], mealStatus[key], mealNotes[key]||'', kcals[key]], key);
  };

  const saveHabits = () => doSave('Habitos', [todayKey(), agua, lectura], 'habits');

  const SECTIONS = [
    { id:'sleep', icon:'🌙', label:'Sueño' },
    { id:'des',   icon:'☀️', label:'Desayuno' },
    { id:'cam',   icon:'☕', label:'Col AM' },
    { id:'com',   icon:'🍽️', label:'Comida' },
    { id:'cpm',   icon:'🍎', label:'Col PM' },
    { id:'cen',   icon:'🌙', label:'Cena' },
    { id:'habits',icon:'💧', label:'Hábitos' },
  ];

  return (
    <div style={{ minHeight:'100vh', background:'#F5F3EE', fontFamily:'"DM Sans",sans-serif', maxWidth:480, margin:'0 auto', paddingBottom:40 }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* HEADER */}
      <div style={{ background:'linear-gradient(160deg,#1B4332,#2D6A4F,#40916C)', padding:'28px 20px 24px', color:'#fff' }}>
        <div style={{ fontSize:12, opacity:0.7, letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:6 }}>
          {getGreeting()} · {DAYS_ES[dow]} {now.getDate()} mayo
        </div>
        <div style={{ fontSize:26, fontWeight:800 }}>¿Cómo va tu día?</div>
        {!token ? (
          <button onClick={handleAuth} disabled={authLoading} style={{ marginTop:14, padding:'10px 20px', borderRadius:12, border:'none', background:'rgba(255,255,255,0.2)', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
            {authLoading ? '⏳ Conectando...' : '🔗 Conectar Google Sheets'}
          </button>
        ) : (
          <div style={{ marginTop:10, fontSize:12, opacity:0.8, display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ width:8, height:8, borderRadius:'50%', background:'#95D5B2', display:'inline-block' }}/>
            Conectado · datos se guardan en tu Sheet
          </div>
        )}
      </div>

      {/* NAV */}
      <div style={{ display:'flex', gap:6, padding:'16px 16px 0', overflowX:'auto', paddingBottom:4 }}>
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)} style={{
            padding:'7px 12px', borderRadius:100, cursor:'pointer', fontSize:12, fontWeight:600,
            fontFamily:'inherit', whiteSpace:'nowrap', flexShrink:0,
            border: activeSection===s.id ? 'none' : '1px solid #EDEBE6',
            background: activeSection===s.id ? sectionColor[s.id] : '#fff',
            color: activeSection===s.id ? '#fff' : '#6B6860',
          }}>{s.icon} {s.label}</button>
        ))}
      </div>

      <div style={{ padding:'16px', display:'flex', flexDirection:'column', gap:12 }}>

        {/* SUEÑO */}
        {activeSection === 'sleep' && (
          <Section icon="🌙" title="Sueño" subtitle="Registra noche anterior + alarma de mañana" color="#4A6FA5" done={savedSection==='sleep'}>
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div>
                <div style={{ fontSize:12, color:'#9B9890', marginBottom:8, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em' }}>¿A qué hora te dormiste?</div>
                <input type="time" value={bedtime} onChange={e=>setBedtime(e.target.value)} style={{ fontSize:28, fontWeight:700, border:'none', background:'#F5F3EE', borderRadius:12, padding:'10px 16px', color:'#1A1916', width:'100%', boxSizing:'border-box', fontFamily:'inherit' }} />
              </div>

              {wakeOptions && (
                <div>
                  <div style={{ fontSize:12, color:'#9B9890', marginBottom:8, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em' }}>Hora óptima → Alexa pondrá la alarma</div>
                  {wakeOptions.map((opt,i) => (
                    <div key={i} onClick={() => setSelectedWake(opt.label)} style={{
                      display:'flex', justifyContent:'space-between', alignItems:'center',
                      padding:'12px 14px', borderRadius:12, cursor:'pointer', marginBottom:6,
                      background: selectedWake===opt.label ? '#4A6FA5' : i===0 ? '#EEF2FF' : '#F5F3EE',
                      color: selectedWake===opt.label ? '#fff' : '#1A1916',
                      border: `1.5px solid ${selectedWake===opt.label ? '#4A6FA5' : i===0 ? '#4A6FA544' : 'transparent'}`,
                    }}>
                      <div>
                        <span style={{ fontWeight:800, fontSize:20 }}>{opt.label}</span>
                        <span style={{ fontSize:11, marginLeft:8, opacity:0.7 }}>{opt.cycles} ciclos</span>
                      </div>
                      <span style={{ fontSize:10, fontWeight:700, padding:'3px 9px', borderRadius:100, background: selectedWake===opt.label ? 'rgba(255,255,255,0.25)':'#E0DDD8', color: selectedWake===opt.label ? '#fff':'#6B6860' }}>{opt.score}</span>
                    </div>
                  ))}
                  <div style={{ fontSize:11, color:'#9B9890', marginTop:4 }}>Toca una opción · al guardar se escribe en Sheets · IFTTT activa Alexa</div>
                </div>
              )}

              <div>
                <div style={{ fontSize:12, color:'#9B9890', marginBottom:8, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em' }}>¿A qué hora te despertaste hoy?</div>
                <input type="time" value={actualWake} onChange={e=>setActualWake(e.target.value)} style={{ fontSize:28, fontWeight:700, border:'none', background:'#F5F3EE', borderRadius:12, padding:'10px 16px', color:'#1A1916', width:'100%', boxSizing:'border-box', fontFamily:'inherit' }} />
              </div>

              <div>
                <div style={{ fontSize:12, color:'#9B9890', marginBottom:8, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em' }}>Calidad del sueño</div>
                <div style={{ display:'flex', gap:8 }}>
                  {[['😴','Mal'],['😐','Regular'],['😊','Bueno'],['🌟','Excelente']].map(([em,label]) => (
                    <button key={label} onClick={() => setSleepQuality(label)} style={{ flex:1, padding:'10px 4px', borderRadius:12, border:'none', cursor:'pointer', background: sleepQuality===label ? '#4A6FA5':'#F5F3EE', color: sleepQuality===label ? '#fff':'#6B6860', fontSize:11, fontWeight:600, fontFamily:'inherit', display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                      <span style={{ fontSize:18 }}>{em}</span>{label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize:12, color:'#9B9890', marginBottom:8, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em' }}>Peso (opcional)</div>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <input type="number" value={weight} onChange={e=>setWeight(e.target.value)} placeholder="63.0" style={{ fontSize:20, fontWeight:700, border:'none', background:'#F5F3EE', borderRadius:12, padding:'10px 16px', color:'#1A1916', width:'110px', fontFamily:'inherit' }} />
                  <span style={{ fontSize:14, color:'#9B9890' }}>kg</span>
                </div>
              </div>

              <SaveBtn onClick={saveSleep} saving={saving} saved={savedSection==='sleep'} color="#4A6FA5" label="💾 Guardar sueño" />
            </div>
          </Section>
        )}

        {/* COMIDAS */}
        {MEALS.map(meal => activeSection === meal.key && (
          <div key={meal.key}>
            {meal.key === 'cam' && (
              <div style={{ background:'#FFFBF0', border:'1px solid #E9C46A44', borderRadius:16, padding:'14px 16px', marginBottom:12 }}>
                <div style={{ fontSize:13, fontWeight:600, color:'#1A1916', marginBottom:10 }}>☕ ¿Desayunaste antes de las 9 am?</div>
                <div style={{ display:'flex', gap:8 }}>
                  <Pill label="Sí" selected={showCam===true} color="#E9A020" onClick={()=>setShowCam(true)} small />
                  <Pill label="No, después" selected={showCam===false} color="#8B8077" onClick={()=>setShowCam(false)} small />
                </div>
                {showCam === false && <div style={{ marginTop:10, fontSize:12, color:'#8B8077', background:'#F5F3EE', borderRadius:10, padding:'8px 12px' }}>✓ Sáltate la colación AM, pasa directo a la comida.</div>}
              </div>
            )}
            {(meal.key !== 'cam' || showCam === true) && (
              <Section icon={meal.icon} title={meal.label} subtitle={meal.time} color={sectionColor[meal.key]} done={savedSection===meal.key}>
                <div style={{ background:'#F5F3EE', borderRadius:12, padding:'12px 14px', marginBottom:14 }}>
                  <div style={{ fontSize:11, color:'#9B9890', marginBottom:6, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em' }}>Plan de hoy</div>
                  {(planDay[meal.key]||[]).map((item,i) => (
                    <div key={i} style={{ fontSize:13, color:'#4A4946', padding:'3px 0', lineHeight:1.5, borderBottom: i<planDay[meal.key].length-1?'1px solid #EDEBE6':'none' }}>{item}</div>
                  ))}
                  <div style={{ marginTop:8, fontSize:11, color:'#9B9890' }}>{meal.kcal} kcal</div>
                </div>
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:12, color:'#9B9890', marginBottom:8, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em' }}>¿Lo cumpliste?</div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    <Pill label="✓ Completo" selected={mealStatus[meal.key]==='completo'} color={sectionColor[meal.key]} onClick={()=>setMealStatus(p=>({...p,[meal.key]:'completo'}))} />
                    <Pill label="~ Parcial"  selected={mealStatus[meal.key]==='parcial'}  color="#8B8077" onClick={()=>setMealStatus(p=>({...p,[meal.key]:'parcial'}))} />
                    <Pill label="✗ No"       selected={mealStatus[meal.key]==='no'}        color={coral}   onClick={()=>setMealStatus(p=>({...p,[meal.key]:'no'}))} />
                  </div>
                  {mealStatus[meal.key] && mealStatus[meal.key] !== 'completo' && (
                    <textarea placeholder="¿Qué comiste en cambio? (opcional)" value={mealNotes[meal.key]||''} onChange={e=>setMealNotes(p=>({...p,[meal.key]:e.target.value}))}
                      style={{ width:'100%', marginTop:10, padding:'10px 12px', borderRadius:12, border:'1px solid #EDEBE6', fontFamily:'inherit', fontSize:13, color:'#1A1916', background:'#F5F3EE', resize:'none', height:72, boxSizing:'border-box' }} />
                  )}
                </div>
                <SaveBtn onClick={() => saveMeal(meal.key)} saving={saving} saved={savedSection===meal.key} color={sectionColor[meal.key]} label="💾 Guardar" />
              </Section>
            )}
          </div>
        ))}

        {/* HÁBITOS */}
        {activeSection === 'habits' && (
          <Section icon="💧" title="Hábitos del día" subtitle="Agua · Lectura" color="#52B788" done={savedSection==='habits'}>
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
              {[
                { val:agua, set:setAgua, icon:'💧', label:'Agua', meta:8, step:1, unit:'vasos', color:'#52B788' },
                { val:lectura, set:setLectura, icon:'📖', label:'Lectura', meta:20, step:5, unit:'min', color:'#E9C46A' },
              ].map(h => (
                <div key={h.label}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                    <div>
                      <div style={{ fontSize:14, fontWeight:600, color:'#1A1916' }}>{h.icon} {h.label}</div>
                      <div style={{ fontSize:11, color:'#9B9890' }}>Meta: {h.meta} {h.unit}</div>
                    </div>
                    <Stepper value={h.val} onChange={h.set} min={0} max={h.meta*3} step={h.step} unit={h.unit} />
                  </div>
                  <div style={{ height:6, background:'#F5F3EE', borderRadius:3 }}>
                    <div style={{ height:'100%', borderRadius:3, background:h.color, width:`${Math.min(100,(h.val/h.meta)*100)}%`, transition:'width 0.3s' }} />
                  </div>
                </div>
              ))}
              <div style={{ border:'1.5px dashed #EDEBE6', borderRadius:12, padding:'12px', textAlign:'center', fontSize:12, color:'#9B9890', cursor:'pointer' }}>
                + Agregar hábito nuevo
              </div>
              <SaveBtn onClick={saveHabits} saving={saving} saved={savedSection==='habits'} color="#52B788" label="💾 Guardar hábitos" />
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}
