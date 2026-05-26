import { useState, useEffect } from "react";

// ── PLAN NUTRICIONAL ─────────────────────────────────────────────────────
const MEAL_PLAN = {
  0: { // Lunes S1
    des: ['2 huevos revueltos con tomate y espinacas','½ taza avena cocida con canela','☕ Café con leche deslactosada'],
    cam: ['1 scoop Isopure + 200 ml leche deslactosada','1 manzana (o 1 papilla Mongui)'],
    com: ['150 g pechuga de pollo a la plancha','½ taza arroz integral','Ensalada: lechuga, tomate, pepino + limón y aceite de oliva'],
    cpm: ['100 g cottage cheese','½ taza arándanos (o 1 papilla Mongui)'],
    cen: ['170 g yogur griego natural + ½ taza fresas + 1 cdita chía'],
  },
  1: { // Martes S1
    des: ['Omelette: 3 claras + 1 yema con espinacas y tomate','1 tostada de maíz + ¼ aguacate','☕ Café con leche deslactosada'],
    cam: ['1 scoop Isopure + 200 ml leche deslactosada','1 pera (o 1 papilla Mongui)'],
    com: ['★ 150 g camarones al ajillo','½ taza elote en grano','Ensalada verde + limón'],
    cpm: ['170 g yogur griego natural','½ taza mango (o 1 papilla Mongui)'],
    cen: ['Smoothie: 200 ml leche deslactosada + ½ plátano + 1 cdita chía + canela'],
  },
  2: { // Miércoles S1
    des: ['2 huevos al gusto','½ taza avena con canela','1 naranja · ☕ Café con leche deslactosada'],
    cam: ['1 scoop Isopure + 200 ml leche deslactosada','1 manzana (o 1 papilla Mongui)'],
    com: ['150 g res magra (arrachera, milanesa) a la plancha','½ taza arroz integral','Ensalada: lechuga, tomate, pepino + limón'],
    cpm: ['1 pera (o 1 papilla Mongui)','1 cda semillas de girasol o pepita'],
    cen: ['2 tostadas de maíz + ½ aguacate + tomate rebanado + 80 g cottage cheese'],
  },
  3: { // Jueves S1
    des: ['2 huevos estrellados en aceite de oliva','1 tostada de maíz + ½ aguacate','☕ Café con leche deslactosada'],
    cam: ['1 scoop Isopure + 200 ml leche deslactosada','1 naranja (o 1 papilla Mongui)'],
    com: ['★ 150 g salmón a la plancha con limón y hierbas','½ taza papa cambray cocida','Ensalada verde + aceite de oliva y limón'],
    cpm: ['100 g cottage cheese','½ taza fresas (o 1 papilla Mongui)'],
    cen: ['Bowl: 170 g yogur griego + ½ taza mango + ½ taza fresas + 1 cdita chía'],
  },
  4: { // Viernes S1
    des: ['2 huevos + calabacita en cubos salteada con tomate','☕ Café con leche deslactosada'],
    cam: ['1 scoop Isopure + 200 ml leche deslactosada','1 manzana (o 1 papilla Mongui)'],
    com: ['2 tacos de pollo en tortilla de maíz','Guacamole: ¼ aguacate + tomate + limón','Ensalada verde + aceite de oliva'],
    cpm: ['170 g yogur griego natural','½ taza arándanos (o 1 papilla Mongui)'],
    cen: ['2 tostadas de maíz + ½ aguacate + tomate con limón y sal'],
  },
  5: { // Sábado S1
    des: ['Hotcakes de avena: ½ taza avena + 1 plátano + 1 huevo','1 cdita miel de agave · ☕ Café con leche deslactosada'],
    cam: ['1 scoop Isopure + 200 ml leche deslactosada'],
    com: ['★ Hamburguesa casera con bimbollo','Ensalada verde (sin papas ni catsup)'],
    cpm: ['Fruta picada: jícama + pepino + mango con limón (o 1 papilla Mongui)'],
    cen: ['Smoothie: 200 ml leche deslactosada + ½ plátano + 1 cdita chía + canela'],
  },
  6: { // Domingo S1
    des: ['Chilaquiles rojos ligeros','2 huevos encima + cottage cheese en vez de crema','☕ Café con leche deslactosada'],
    cam: ['1 scoop Isopure + 200 ml leche deslactosada','1 manzana (o 1 papilla Mongui)'],
    com: ['Caldo de pollo con verduras','Pieza de pollo sin piel + 2 tortillas de maíz'],
    cpm: ['100 g cottage cheese','½ taza fresas (o 1 papilla Mongui)'],
    cen: ['★ ½ taza arroz blanco + 1 lata de atún en agua','Aguacate en cubos + tomate + limón'],
  },
};

const MEALS = [
  { key:'des', icon:'☀️', label:'Desayuno',     time:'8–10 am',     kcal:'~370' },
  { key:'cam', icon:'☕', label:'Colación AM',   time:'11:30–12 pm', kcal:'~275', conditional:true },
  { key:'com', icon:'🍽️', label:'Comida',        time:'2 pm',        kcal:'~450' },
  { key:'cpm', icon:'🍎', label:'Colación PM',   time:'5:30–6 pm',   kcal:'~130' },
  { key:'cen', icon:'🌙', label:'Cena',          time:'8–9 pm',      kcal:'~190' },
];

const HABITS = [
  { key:'agua',    icon:'💧', label:'Agua',     unit:'vasos', goal:8,  step:1 },
  { key:'lectura', icon:'📖', label:'Lectura',  unit:'min',   goal:20, step:5 },

];

const SLEEP_CYCLES = [
  { cycles:4, duration:'6h',  wake:'5:00 am'  },
  { cycles:5, duration:'7h30',wake:'6:30 am'  },
  { cycles:6, duration:'9h',  wake:'8:00 am'  },
];

const DAYS_ES = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

// ── STORAGE HELPERS ──────────────────────────────────────────────────────
const todayKey = () => new Date().toISOString().split('T')[0];

async function saveToday(data) {
  try {
    const existing = await loadToday();
    const merged = { ...existing, ...data, updatedAt: new Date().toISOString() };
    await window.storage.set(`tracker:${todayKey()}`, JSON.stringify(merged));
    return merged;
  } catch(e) { console.error(e); return data; }
}

async function loadToday() {
  try {
    const r = await window.storage.get(`tracker:${todayKey()}`);
    return r ? JSON.parse(r.value) : {};
  } catch(e) { return {}; }
}

// ── SLEEP CALCULATOR ────────────────────────────────────────────────────
function calcOptimalWake(bedtime) {
  if (!bedtime) return null;
  const [h, m] = bedtime.split(':').map(Number);
  const bedMinutes = h * 60 + m + 14; // 14 min to fall asleep
  const options = [4,5,6].map(c => {
    const wakeMin = (bedMinutes + c * 90) % (24 * 60);
    const wh = Math.floor(wakeMin / 60);
    const wm = wakeMin % 60;
    const label = `${wh}:${wm.toString().padStart(2,'0')} am`;
    const score = c === 5 ? 'ideal' : c === 4 ? 'mínimo' : 'largo';
    return { cycles: c, label, score, wakeMin };
  });
  // find closest to 7:30am (450 min)
  const target = 7 * 60 + 30;
  return options.sort((a,b) => Math.abs(a.wakeMin - target) - Math.abs(b.wakeMin - target));
}

// ── CONTEXT DETECTOR ────────────────────────────────────────────────────
function getCurrentContext() {
  const h = new Date().getHours();
  const m = new Date().getMinutes();
  const t = h * 60 + m;
  if (t >= 7*60 && t < 10*60)   return 'des';
  if (t >= 10*60 && t < 13*60)  return 'cam';
  if (t >= 13*60 && t < 16*60)  return 'com';
  if (t >= 16*60 && t < 19*60)  return 'cpm';
  if (t >= 19*60 && t < 22*60)  return 'cen';
  if (t >= 22*60 || t < 2*60)   return 'sleep';
  return 'morning';
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

// ── PILL BUTTON ─────────────────────────────────────────────────────────
function Pill({ label, selected, color, onClick, small }) {
  return (
    <button onClick={onClick} style={{
      padding: small ? '6px 14px' : '10px 20px',
      borderRadius: 100,
      border: `1.5px solid ${selected ? color : '#E0DDD8'}`,
      background: selected ? color : '#fff',
      color: selected ? '#fff' : '#6B6860',
      fontSize: small ? 13 : 14,
      fontWeight: 600,
      cursor: 'pointer',
      fontFamily: 'inherit',
      transition: 'all 0.15s',
      flexShrink: 0,
    }}>{label}</button>
  );
}

// ── STEPPER ─────────────────────────────────────────────────────────────
function Stepper({ value, onChange, min, max, step, unit }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
      <button onClick={() => onChange(Math.max(min, value - step))} style={{
        width:36, height:36, borderRadius:'50%', border:'1.5px solid #E0DDD8',
        background:'#fff', fontSize:18, cursor:'pointer', display:'flex',
        alignItems:'center', justifyContent:'center', color:'#6B6860',
      }}>−</button>
      <span style={{ fontSize:22, fontWeight:700, color:'#1A1916', minWidth:60, textAlign:'center' }}>
        {value}<span style={{ fontSize:13, fontWeight:500, color:'#9B9890', marginLeft:4 }}>{unit}</span>
      </span>
      <button onClick={() => onChange(Math.min(max, value + step))} style={{
        width:36, height:36, borderRadius:'50%', border:'1.5px solid #E0DDD8',
        background:'#fff', fontSize:18, cursor:'pointer', display:'flex',
        alignItems:'center', justifyContent:'center', color:'#6B6860',
      }}>+</button>
    </div>
  );
}

// ── SECTION WRAPPER ──────────────────────────────────────────────────────
function Section({ icon, title, subtitle, color, children, done }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 20,
      padding: '20px',
      border: `1px solid ${done ? color+'40' : '#EDEBE6'}`,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {done && (
        <div style={{
          position:'absolute', top:0, right:0,
          background: color, color:'#fff',
          fontSize:10, fontWeight:700,
          padding:'4px 12px', borderBottomLeftRadius:10,
          letterSpacing:'0.06em'
        }}>✓ LISTO</div>
      )}
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

// ── MAIN APP ─────────────────────────────────────────────────────────────
export default function App() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const planDay = MEAL_PLAN[dayOfWeek] || MEAL_PLAN[0];
  const context = getCurrentContext();

  const [saved, setSaved] = useState(false);
  const [todayData, setTodayData] = useState({});
  const [activeSection, setActiveSection] = useState(context);

  // Meal states
  const [mealStatus, setMealStatus] = useState({ des:null, cam:null, com:null, cpm:null, cen:null });
  const [mealNotes, setMealNotes] = useState({});
  const [desTime, setDesTime] = useState('');
  const [showCam, setShowCam] = useState(null); // null=unknown, true/false

  // Habit states
  const [agua, setAgua] = useState(0);
  const [lectura, setLectura] = useState(0);

  // Sleep states
  const [bedtime, setBedtime] = useState('23:00');
  const [actualWake, setActualWake] = useState('');
  const [sleepQuality, setSleepQuality] = useState(null);
  const [weight, setWeight] = useState('');

  // Calendar events (simulated from what we fetched)
  const [calEvents] = useState([
    { time:'10:00', label:'Pitch Day #SheLeads', done:null },
  ]);
  const [eventsDone, setEventsDone] = useState({});

  useEffect(() => {
    loadToday().then(d => {
      setTodayData(d);
      if (d.mealStatus) setMealStatus(d.mealStatus);
      if (d.agua) setAgua(d.agua);
      if (d.lectura) setLectura(d.lectura);
      if (d.bedtime) setBedtime(d.bedtime);
      if (d.actualWake) setActualWake(d.actualWake);
      if (d.sleepQuality) setSleepQuality(d.sleepQuality);
      if (d.weight) setWeight(d.weight);
      if (d.eventsDone) setEventsDone(d.eventsDone);
      if (d.desTime) setDesTime(d.desTime);
      if (d.showCam !== undefined) setShowCam(d.showCam);
    });
  }, []);

  const handleSave = async () => {
    const data = {
      mealStatus, mealNotes, desTime, showCam,
      agua, lectura,
      bedtime, actualWake, sleepQuality, weight,
      eventsDone,
      date: todayKey(),
    };
    await saveToday(data);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const wakeOptions = calcOptimalWake(bedtime);

  const SECTIONS = [
    { id:'sleep', icon:'🌙', label:'Sueño' },
    { id:'des',   icon:'☀️', label:'Desayuno' },
    { id:'cam',   icon:'☕', label:'Col AM' },
    { id:'com',   icon:'🍽️', label:'Comida' },
    { id:'cpm',   icon:'🍎', label:'Col PM' },
    { id:'cen',   icon:'🌙', label:'Cena' },
    { id:'habits',icon:'💧', label:'Hábitos' },
    { id:'agenda',icon:'📅', label:'Agenda' },
  ];

  const accent = '#2D6A4F';
  const accentLight = '#52B788';
  const gold = '#E9C46A';
  const coral = '#E76F51';

  const sectionColor = { sleep:'#4A6FA5', des:'#E9C46A', cam:'#8B8077', com:'#2D6A4F', cpm:'#E76F51', cen:'#4A6FA5', habits:'#52B788', agenda:'#8B8077' };

  const mealDone = (key) => mealStatus[key] !== null;
  const allMealsDone = MEALS.filter(m => m.key !== 'cam' || showCam).every(m => mealDone(m.key));
  const habitsDone = agua > 0 || lectura > 0;

  return (
    <div style={{
      minHeight:'100vh',
      background:'#F5F3EE',
      fontFamily:'"Lora", Georgia, serif',
      maxWidth:480,
      margin:'0 auto',
      paddingBottom:80,
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />

      {/* ── HEADER ── */}
      <div style={{
        background: `linear-gradient(160deg, #1B4332 0%, #2D6A4F 60%, #40916C 100%)`,
        padding:'28px 20px 24px',
        color:'#fff',
      }}>
        <div style={{ fontSize:12, opacity:0.7, letterSpacing:'0.12em', textTransform:'uppercase', fontFamily:'"DM Sans", sans-serif', marginBottom:6 }}>
          {getGreeting()} · {DAYS_ES[dayOfWeek]} {now.getDate()} mayo
        </div>
        <div style={{ fontSize:26, fontWeight:700, lineHeight:1.2 }}>
          ¿Cómo va tu día?
        </div>
        <div style={{ fontSize:13, opacity:0.75, marginTop:6, fontFamily:'"DM Sans", sans-serif' }}>
          Registra en segundos · también funciona con Siri
        </div>

        {/* Progress bar */}
        <div style={{ marginTop:18 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, opacity:0.8, fontFamily:'"DM Sans", sans-serif', marginBottom:6 }}>
            <span>Progreso del día</span>
            <span>{Object.values(mealStatus).filter(Boolean).length + (habitsDone?1:0)} / 6 secciones</span>
          </div>
          <div style={{ height:4, background:'rgba(255,255,255,0.2)', borderRadius:2 }}>
            <div style={{
              height:'100%', borderRadius:2,
              background:'#95D5B2',
              width:`${Math.round((Object.values(mealStatus).filter(v=>v!==null).length / 5)*100)}%`,
              transition:'width 0.4s ease',
            }} />
          </div>
        </div>
      </div>

      {/* ── SIRI BANNER ── */}
      <div style={{
        margin:'16px 16px 0',
        background:'#fff',
        borderRadius:16,
        padding:'12px 16px',
        border:'1px solid #EDEBE6',
        display:'flex', alignItems:'center', gap:12,
      }}>
        <span style={{ fontSize:22 }}>🎙️</span>
        <div style={{ fontFamily:'"DM Sans", sans-serif' }}>
          <div style={{ fontSize:12, fontWeight:600, color:'#1A1916' }}>También por Siri</div>
          <div style={{ fontSize:11, color:'#9B9890', marginTop:1 }}>"Oye Siri, registrar desayuno" · "registrar sueño" · "anotar peso"</div>
        </div>
      </div>

      {/* ── NAV TABS ── */}
      <div style={{
        display:'flex', gap:6, padding:'16px 16px 0',
        overflowX:'auto', paddingBottom:4,
      }}>
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)} style={{
            padding:'7px 12px', borderRadius:100, border:'none', cursor:'pointer',
            fontFamily:'"DM Sans", sans-serif', fontSize:12, fontWeight:600,
            background: activeSection===s.id ? sectionColor[s.id] : '#fff',
            color: activeSection===s.id ? '#fff' : '#6B6860',
            whiteSpace:'nowrap', flexShrink:0,
            boxShadow: activeSection===s.id ? `0 2px 8px ${sectionColor[s.id]}44` : 'none',
            border: activeSection!==s.id ? '1px solid #EDEBE6' : 'none',
          }}>{s.icon} {s.label}</button>
        ))}
      </div>

      {/* ── CONTENT ── */}
      <div style={{ padding:'16px', display:'flex', flexDirection:'column', gap:12 }}>

        {/* ── SUEÑO ── */}
        {activeSection === 'sleep' && (
          <Section icon="🌙" title="Registro de sueño" subtitle="Anoche" color="#4A6FA5" done={!!actualWake}>
            <div style={{ fontFamily:'"DM Sans", sans-serif', display:'flex', flexDirection:'column', gap:16 }}>
              <div>
                <div style={{ fontSize:12, color:'#9B9890', marginBottom:8, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em' }}>¿A qué hora te dormiste?</div>
                <input type="time" value={bedtime} onChange={e=>setBedtime(e.target.value)}
                  style={{ fontSize:24, fontWeight:700, border:'none', background:'#F5F3EE', borderRadius:12, padding:'10px 16px', color:'#1A1916', width:'100%', boxSizing:'border-box', fontFamily:'"DM Sans", sans-serif' }} />
              </div>

              {/* Ciclos óptimos */}
              {bedtime && wakeOptions && (
                <div>
                  <div style={{ fontSize:12, color:'#9B9890', marginBottom:8, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em' }}>Hora óptima de despertar</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {wakeOptions.map((opt,i) => (
                      <div key={i} style={{
                        display:'flex', justifyContent:'space-between', alignItems:'center',
                        padding:'10px 14px', borderRadius:12,
                        background: i===0 ? '#4A6FA5' : '#F5F3EE',
                        color: i===0 ? '#fff' : '#1A1916',
                      }}>
                        <div>
                          <span style={{ fontWeight:700, fontSize:18 }}>{opt.label}</span>
                          <span style={{ fontSize:11, marginLeft:8, opacity:0.7 }}>{opt.cycles} ciclos</span>
                        </div>
                        <span style={{
                          fontSize:10, fontWeight:700, padding:'3px 9px', borderRadius:100,
                          background: i===0 ? 'rgba(255,255,255,0.25)' : '#EDEBE6',
                          color: i===0 ? '#fff' : '#6B6860',
                        }}>{opt.score}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize:11, color:'#9B9890', marginTop:8, textAlign:'center' }}>
                    💡 La primera opción es la más cercana a las 7:30 am
                  </div>
                </div>
              )}

              <div>
                <div style={{ fontSize:12, color:'#9B9890', marginBottom:8, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em' }}>¿A qué hora te despertaste?</div>
                <input type="time" value={actualWake} onChange={e=>setActualWake(e.target.value)}
                  style={{ fontSize:24, fontWeight:700, border:'none', background:'#F5F3EE', borderRadius:12, padding:'10px 16px', color:'#1A1916', width:'100%', boxSizing:'border-box', fontFamily:'"DM Sans", sans-serif' }} />
              </div>

              <div>
                <div style={{ fontSize:12, color:'#9B9890', marginBottom:8, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em' }}>Calidad del sueño</div>
                <div style={{ display:'flex', gap:8 }}>
                  {[['😴','Mal'],['😐','Regular'],['😊','Bueno'],['🌟','Excelente']].map(([em,label]) => (
                    <button key={label} onClick={() => setSleepQuality(label)} style={{
                      flex:1, padding:'10px 6px', borderRadius:12, border:'none', cursor:'pointer',
                      background: sleepQuality===label ? '#4A6FA5' : '#F5F3EE',
                      color: sleepQuality===label ? '#fff' : '#6B6860',
                      fontSize:11, fontWeight:600, fontFamily:'"DM Sans", sans-serif',
                      display:'flex', flexDirection:'column', alignItems:'center', gap:4,
                    }}>
                      <span style={{ fontSize:18 }}>{em}</span>{label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize:12, color:'#9B9890', marginBottom:8, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em' }}>Peso (opcional)</div>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <input type="number" value={weight} onChange={e=>setWeight(e.target.value)} placeholder="63.0"
                    style={{ fontSize:20, fontWeight:700, border:'none', background:'#F5F3EE', borderRadius:12, padding:'10px 16px', color:'#1A1916', width:'100px', fontFamily:'"DM Sans", sans-serif' }} />
                  <span style={{ fontSize:14, color:'#9B9890' }}>kg</span>
                </div>
              </div>
            </div>
          </Section>
        )}

        {/* ── COMIDAS ── */}
        {MEALS.map(meal => activeSection === meal.key && (
          <div key={meal.key}>
            {/* Colación AM conditional */}
            {meal.key === 'cam' && (
              <div style={{
                background:'#FFFBF0', border:'1px solid #E9C46A44', borderRadius:16,
                padding:'14px 16px', marginBottom:12, fontFamily:'"DM Sans", sans-serif',
              }}>
                <div style={{ fontSize:13, fontWeight:600, color:'#1A1916', marginBottom:10 }}>
                  ☕ ¿Desayunaste antes de las 9 am?
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <Pill label="Sí, antes de las 9" selected={showCam===true} color="#E9C46A" onClick={()=>setShowCam(true)} small />
                  <Pill label="No, después" selected={showCam===false} color="#8B8077" onClick={()=>setShowCam(false)} small />
                </div>
                {showCam === false && (
                  <div style={{ marginTop:10, fontSize:12, color:'#8B8077', background:'#F5F3EE', borderRadius:10, padding:'8px 12px' }}>
                    ✓ Sáltate la colación AM y pasa directo a la comida a las 2 pm.
                  </div>
                )}
              </div>
            )}

            {(meal.key !== 'cam' || showCam === true) && (
              <Section icon={meal.icon} title={meal.label} subtitle={meal.time} color={sectionColor[meal.key]} done={mealStatus[meal.key]!==null}>

                {/* Plan del día */}
                <div style={{ background:'#F5F3EE', borderRadius:12, padding:'12px 14px', marginBottom:14 }}>
                  <div style={{ fontSize:11, color:'#9B9890', marginBottom:6, fontFamily:'"DM Sans", sans-serif', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em' }}>
                    Plan de hoy
                  </div>
                  {(planDay[meal.key] || []).map((item,i) => (
                    <div key={i} style={{ fontSize:13, color:'#4A4946', padding:'3px 0', borderBottom: i < planDay[meal.key].length-1 ? '1px solid #EDEBE6':'none', fontFamily:'"DM Sans", sans-serif', lineHeight:1.5 }}>
                      {item}
                    </div>
                  ))}
                  <div style={{ marginTop:8, fontSize:11, color:'#9B9890', fontFamily:'"DM Sans", sans-serif' }}>~{meal.kcal} kcal</div>
                </div>

                {/* ¿Lo cumpliste? */}
                <div style={{ fontFamily:'"DM Sans", sans-serif' }}>
                  <div style={{ fontSize:12, color:'#9B9890', marginBottom:8, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em' }}>¿Lo cumpliste?</div>
                  <div style={{ display:'flex', gap:8 }}>
                    <Pill label="✓ Completo" selected={mealStatus[meal.key]==='completo'} color={sectionColor[meal.key]} onClick={()=>setMealStatus(p=>({...p,[meal.key]:'completo'}))} />
                    <Pill label="~ Parcial" selected={mealStatus[meal.key]==='parcial'} color="#8B8077" onClick={()=>setMealStatus(p=>({...p,[meal.key]:'parcial'}))} />
                    <Pill label="✗ No" selected={mealStatus[meal.key]==='no'} color={coral} onClick={()=>setMealStatus(p=>({...p,[meal.key]:'no'}))} />
                  </div>

                  {mealStatus[meal.key] && mealStatus[meal.key] !== 'completo' && (
                    <textarea
                      placeholder="¿Qué comiste en cambio? (opcional)"
                      value={mealNotes[meal.key]||''}
                      onChange={e=>setMealNotes(p=>({...p,[meal.key]:e.target.value}))}
                      style={{
                        width:'100%', marginTop:10, padding:'10px 12px',
                        borderRadius:12, border:'1px solid #EDEBE6',
                        fontFamily:'"DM Sans", sans-serif', fontSize:13,
                        color:'#1A1916', background:'#F5F3EE', resize:'none',
                        height:72, boxSizing:'border-box',
                      }}
                    />
                  )}
                </div>
              </Section>
            )}
          </div>
        ))}

        {/* ── HÁBITOS ── */}
        {activeSection === 'habits' && (
          <Section icon="💧" title="Hábitos del día" subtitle="Agua · Lectura · Estudio" color="#52B788" done={habitsDone}>
            <div style={{ fontFamily:'"DM Sans", sans-serif', display:'flex', flexDirection:'column', gap:20 }}>
              {/* Agua */}
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:600, color:'#1A1916' }}>💧 Agua</div>
                    <div style={{ fontSize:11, color:'#9B9890' }}>Meta: 8 vasos</div>
                  </div>
                  <Stepper value={agua} onChange={setAgua} min={0} max={15} step={1} unit="vasos" />
                </div>
                <div style={{ height:6, background:'#F5F3EE', borderRadius:3 }}>
                  <div style={{ height:'100%', borderRadius:3, background:'#52B788', width:`${Math.min(100,(agua/8)*100)}%`, transition:'width 0.3s' }} />
                </div>
              </div>

              {/* Lectura */}
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:600, color:'#1A1916' }}>📖 Lectura</div>
                    <div style={{ fontSize:11, color:'#9B9890' }}>Meta: 20 min</div>
                  </div>
                  <Stepper value={lectura} onChange={setLectura} min={0} max={120} step={5} unit="min" />
                </div>
                <div style={{ height:6, background:'#F5F3EE', borderRadius:3 }}>
                  <div style={{ height:'100%', borderRadius:3, background:'#E9C46A', width:`${Math.min(100,(lectura/20)*100)}%`, transition:'width 0.3s' }} />
                </div>
              </div>

              {/* Agregar hábito */}
              <div style={{
                border:'1.5px dashed #EDEBE6', borderRadius:12, padding:'12px',
                textAlign:'center', fontSize:12, color:'#9B9890', cursor:'pointer',
              }}>
                + Agregar hábito nuevo
              </div>
            </div>
          </Section>
        )}

        {/* ── AGENDA ── */}
        {activeSection === 'agenda' && (
          <Section icon="📅" title="Agenda de hoy" subtitle="Eventos de tu calendario" color="#8B8077" done={Object.keys(eventsDone).length > 0}>
            <div style={{ fontFamily:'"DM Sans", sans-serif', display:'flex', flexDirection:'column', gap:10 }}>
              {calEvents.map((ev, i) => (
                <div key={i} style={{
                  padding:'12px 14px', borderRadius:12,
                  background: eventsDone[i]==='si' ? '#EAF4EE' : eventsDone[i]==='no' ? '#FEF0ED' : '#F5F3EE',
                  border: `1px solid ${eventsDone[i]==='si' ? '#52B78840' : eventsDone[i]==='no' ? '#E76F5140' : '#EDEBE6'}`,
                }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:600, color:'#1A1916' }}>{ev.label}</div>
                      <div style={{ fontSize:11, color:'#9B9890', marginTop:2 }}>{ev.time}</div>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <Pill label="✓ Asistí" selected={eventsDone[i]==='si'} color="#52B788" onClick={()=>setEventsDone(p=>({...p,[i]:'si'}))} small />
                    <Pill label="✗ No asistí" selected={eventsDone[i]==='no'} color={coral} onClick={()=>setEventsDone(p=>({...p,[i]:'no'}))} small />
                  </div>
                </div>
              ))}
              <div style={{ fontSize:11, color:'#9B9890', textAlign:'center', marginTop:4 }}>
                Los eventos se actualizan automáticamente desde tu Google Calendar
              </div>
            </div>
          </Section>
        )}

      </div>

      {/* ── SAVE BUTTON ── */}
      <div style={{
        position:'fixed', bottom:0, left:0, right:0,
        padding:'12px 16px 20px',
        background:'linear-gradient(to top, #F5F3EE 70%, transparent)',
        maxWidth:480, margin:'0 auto',
      }}>
        <button onClick={handleSave} style={{
          width:'100%', padding:'16px',
          borderRadius:16, border:'none', cursor:'pointer',
          background: saved ? '#52B788' : `linear-gradient(135deg, #1B4332, #2D6A4F)`,
          color:'#fff', fontSize:16, fontWeight:700,
          fontFamily:'"DM Sans", sans-serif',
          boxShadow:'0 4px 20px rgba(45,106,79,0.35)',
          transition:'all 0.2s',
        }}>
          {saved ? '✓ Guardado' : 'Guardar registro'}
        </button>
      </div>
    </div>
  );
}
