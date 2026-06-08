import { useState, useEffect, useCallback, useRef } from "react";

// ── CONFIG ────────────────────────────────────────────────────────────────
const CLIENT_ID = "309896660471-3i9106oa3dfbqu0ndbsdoa0a7bl9ol12.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/spreadsheets";
const SHEET_ID = "1b2oHbykr31dMu6QGwy8puWhh-F5Xbd40RQBDEpXhgSs";
const PLAN_START = new Date("2026-06-01");
const TARGET = 1550;

// ── STORAGE (localStorage) ────────────────────────────────────────────────
const LS = {
  get: (key) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; } },
  set: (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
};
const todayKey = () => new Date().toISOString().split("T")[0];
const fmtShort = (d) => { const [, m, day] = d.split("-"); return `${day}/${m}`; };

// ── BARCODE / OPEN FOOD FACTS ─────────────────────────────────────────────
async function lookupBarcode(code) {
  const saved = LS.get("ht_products") || {};
  if (saved[code]) return { ...saved[code], source: "guardado" };
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,nutriments,brands`);
    const data = await res.json();
    if (data.status === 1 && data.product) {
      const p = data.product;
      const n = p.nutriments || {};
      const kcal = n["energy-kcal_serving"] || n["energy-kcal_100g"] || null;
      const name = [p.brands, p.product_name].filter(Boolean).join(" ") || "Producto";
      return { name, kcal: kcal ? Math.round(kcal) : null, source: "openfoodfacts", code };
    }
  } catch (_) {}
  return null;
}

function saveProduct(code, name, kcal) {
  const saved = LS.get("ht_products") || {};
  saved[code] = { name, kcal: Number(kcal), code };
  LS.set("ht_products", saved);
}

// ── PLAN DINÁMICO ─────────────────────────────────────────────────────────
const MEAL_META = [
  { key:"des", icon:"☀️", label:"Desayuno",    time:"8–10 am" },
  { key:"cam", icon:"☕", label:"Colación AM",  time:"11:30–12" },
  { key:"com", icon:"🍽️", label:"Comida",       time:"3 pm" },
  { key:"cpm", icon:"🍎", label:"Colación PM",  time:"5:30–6" },
  { key:"cen", icon:"🌙", label:"Cena",         time:"9 pm" },
];
const SLOT_BASE = { des:380, cam:250, com:450, cpm:390, cen:190 };

const LIB = {
  des: [
    { n:"Huevos revueltos con tomate y espinacas · ½ avena · café", k:380, p:"P_HUEVO", r:null },
    { n:"Omelette (3 claras+1 yema) · tostada de maíz · ¼ aguacate · café", k:360, p:"P_HUEVO", r:null },
    { n:"2 huevos estrellados · tostada de maíz · ½ aguacate · café", k:370, p:"P_HUEVO", r:null },
    { n:"Frittata de 2 huevos con espinacas y jitomate cherry · ½ avena", k:400, p:"P_HUEVO", r:"frittata" },
    { n:"Hotcakes de avena (avena+plátano+huevo) · café", k:395, p:"P_HUEVO", r:"hotcakes" },
    { n:"Huevos rancheros: 2 huevos · salsa roja · tortilla", k:390, p:"P_HUEVO", r:"rancheros" },
    { n:"Huevos con calabacita salteada y tomate · café", k:340, p:"P_HUEVO", r:"huevos-calabacita" },
    { n:"Omelette de espinacas con queso panela · café", k:370, p:"P_HUEVO", r:"omelette-panela" },
    { n:"Tostada de huevo: tostada + 2 huevos + aguacate + tomate", k:385, p:"P_HUEVO", r:null },
    { n:"Chilaquiles rojos ligeros + 2 huevos + cottage", k:430, p:"P_HUEVO", r:"chilaquiles" },
    { n:"2 huevos revueltos con espinacas (ligero) · café", k:250, p:"P_HUEVO", r:null },
    { n:"Omelette de claras con tomate (muy ligero) · café", k:200, p:"P_HUEVO", r:null },
  ],
  cam: [
    { n:"Fitmingo + 500 ml leche deslactosada", k:390, p:"P_SHAKE", r:null },
    { n:"Smoothie: Fitmingo + 500 ml leche + fresas", k:440, p:"P_SHAKE", r:"smoothie-iso" },
    { n:"1 papilla Mongui + yogur griego natural", k:170, p:"P_LACTEO", r:null },
    { n:"1 pera + queso panela en cubos", k:160, p:"P_LACTEO", r:null },
    { n:"Yogur griego + fruta", k:150, p:"P_LACTEO", r:null },
    { n:"Yogur griego + 1 manzana", k:145, p:"P_LACTEO", r:null },
    { n:"Cottage cheese + fruta", k:130, p:"P_LACTEO", r:null },
    { n:"1 manzana + 1 cda pepita de calabaza", k:130, p:"P_FRUTA", r:null },
    { n:"1 papilla Mongui + cottage cheese", k:140, p:"P_LACTEO", r:null },
    { n:"1 papilla Mongui + 1 manzana", k:125, p:"P_FRUTA", r:null },
    { n:"1 papilla Mongui (sola)", k:50, p:"P_FRUTA", r:null },
    { n:"Fruta picada con limón", k:90, p:null, r:null },
  ],
  com: [
    { n:"Res magra a la plancha · ½ arroz integral · ensalada", k:465, p:"P_RES", r:null },
    { n:"Tinga de pollo (jitomate+chipotle) · ½ arroz integral · ensalada", k:465, p:"P_POLLO", r:"tinga" },
    { n:"Albóndigas de res en salsa de jitomate · ½ arroz integral", k:470, p:"P_RES", r:"albondigas" },
    { n:"Arrachera · calabacitas a la plancha · 2 tortillas de maíz", k:470, p:"P_RES", r:"arrachera" },
    { n:"Salmón al horno con limón · papa cambray · calabacitas", k:460, p:"P_MAR", r:"salmon-horno" },
    { n:"Milanesa de pollo al horno (avena) · ½ arroz · ensalada", k:460, p:"P_POLLO", r:"milanesa" },
    { n:"Pollo al curry ligero · ½ arroz integral · brócoli", k:460, p:"P_POLLO", r:"curry" },
    { n:"Pavo al horno con mostaza · ½ arroz integral · brócoli", k:450, p:"P_POLLO", r:"pavo-mostaza" },
    { n:"Pechuga de pollo a la plancha · ½ arroz integral · ensalada", k:450, p:"P_POLLO", r:null },
    { n:"★ Salmón a la plancha con limón y hierbas · papa cambray · ensalada", k:450, p:"P_MAR", r:"salmon-plancha" },
    { n:"Fajitas de pollo (con calabacita) · 2 tortillas de maíz", k:450, p:"P_POLLO", r:"fajitas" },
    { n:"2 tacos de pollo · guacamole · ensalada", k:460, p:"P_POLLO", r:"guacamole" },
    { n:"★ Camarones a la diabla (chile guajillo) · arroz integral · ensalada", k:440, p:"P_MAR", r:"camarones-diabla" },
    { n:"★ Brochetas de camarón a la plancha · arroz integral · ensalada", k:430, p:"P_MAR", r:"brochetas" },
    { n:"★ Pasta · camarones en salsa de jitomate · ensalada", k:430, p:"P_MAR", r:"pasta-camaron" },
    { n:"★ Atún sellado · arroz integral · ensalada", k:430, p:"P_MAR", r:"atun-sellado" },
    { n:"★ Camarones al ajillo · ½ taza elote · ensalada", k:420, p:"P_MAR", r:"camarones-ajillo" },
    { n:"★ Ceviche de camarón · 2 tostadas · ¼ aguacate", k:380, p:"P_MAR", r:"ceviche" },
    { n:"Ensalada de atún (lechuga, tomate, aguacate, pepino)", k:350, p:"P_MAR", r:"ensalada-atun" },
    { n:"Pechuga a la plancha · ensalada grande (sin carbohidrato)", k:320, p:"P_POLLO", r:null },
  ],
  cpm: [
    { n:"Fitmingo + 500 ml leche deslactosada", k:390, p:"P_SHAKE", r:null },
    { n:"Smoothie: Fitmingo + 500 ml leche + fresas", k:440, p:"P_SHAKE", r:"smoothie-iso" },
    { n:"Fitmingo con agua (shake ligero, sin leche)", k:140, p:"P_SHAKE", r:null },
    { n:"Yogur griego + granola sin azúcar", k:175, p:"P_LACTEO", r:null },
    { n:"Yogur griego + mango", k:170, p:"P_LACTEO", r:null },
    { n:"Queso panela en cubos + fruta", k:140, p:"P_LACTEO", r:null },
    { n:"Yogur griego + fresas", k:130, p:"P_LACTEO", r:null },
    { n:"Cottage + durazno", k:130, p:"P_LACTEO", r:null },
    { n:"Cottage cheese + arándanos", k:120, p:"P_LACTEO", r:null },
    { n:"Cottage + fresas", k:115, p:"P_LACTEO", r:null },
    { n:"Yogur griego natural (solo)", k:100, p:"P_LACTEO", r:null },
    { n:"Fruta picada con limón", k:90, p:null, r:null },
    { n:"2 mandarinas", k:90, p:"P_FRUTA", r:null },
    { n:"Pepino y jícama con limón y chile piquín", k:60, p:"P_FRUTA", r:null },
    { n:"1 papilla Mongui", k:50, p:"P_FRUTA", r:null },
  ],
  cen: [
    { n:"★ ½ arroz blanco + atún + aguacate + tomate", k:310, p:"P_MAR", r:"arroz-atun" },
    { n:"Smoothie de proteína: Fitmingo + 500 ml leche + fresas", k:420, p:"P_SHAKE", r:"smoothie-iso" },
    { n:"Tostadas + ½ aguacate + tomate + cottage", k:220, p:"P_LACTEO", r:null },
    { n:"Coctel de camarón ligero (camarón, tomate, aguacate, limón)", k:220, p:"P_MAR", r:"coctel" },
    { n:"Yogur + arándanos + granola sin azúcar", k:210, p:"P_LACTEO", r:null },
    { n:"Tostada de atún + aguacate + tomate + limón", k:200, p:"P_MAR", r:"tostada-atun" },
    { n:"Bowl: yogur + mango + fresas", k:195, p:"P_LACTEO", r:null },
    { n:"Crema de brócoli express + tostada", k:185, p:"P_FRUTA", r:"crema-brocoli" },
    { n:"Crema de calabacita + tostada", k:180, p:"P_FRUTA", r:"crema-calabacita" },
    { n:"Ceviche ligero de camarón (camarón, pepino, tomate, limón)", k:180, p:"P_MAR", r:"ceviche-ligero" },
    { n:"Smoothie: leche + plátano + canela", k:175, p:"P_LACTEO", r:null },
    { n:"Tostada con queso panela y tomate", k:170, p:"P_LACTEO", r:null },
    { n:"Yogur griego + fresas", k:160, p:"P_LACTEO", r:null },
    { n:"Cottage cheese + duraznos", k:155, p:"P_LACTEO", r:null },
    { n:"Yogur griego + papilla Mongui", k:150, p:"P_LACTEO", r:null },
    { n:"Yogur griego natural (solo, ligero)", k:100, p:"P_LACTEO", r:null },
    { n:"Cottage cheese (solo, ligero)", k:90, p:"P_LACTEO", r:null },
  ],
}

const RECIPES = {
  "camarones-ajillo": { t:"Camarones al ajillo", time:"15 min", ing:["150 g camarón pelado","3 dientes de ajo picados","1 cda aceite de oliva","Perejil picado","Jugo de ½ limón","Sal y pimienta"], steps:["Seca los camarones con papel.","Calienta el aceite a fuego medio. Agrega el ajo 30 seg.","Sube fuego, añade camarones. Cocina 2 min por lado.","Agrega perejil, sal, pimienta y limón.","Sirve con ½ taza de elote y ensalada verde."] },
  "salmon-plancha": { t:"Salmón a la plancha", time:"12 min", ing:["150 g filete de salmón","1 cdita aceite de oliva","Jugo de ½ limón","Hierbas (orégano, romero)","Sal y pimienta"], steps:["Seca y sazona el salmón.","Plancha caliente con aceite a fuego medio-alto.","Piel hacia abajo 4 min sin mover.","Voltea y cocina 2-3 min más.","Rocía limón. Sirve con papa cambray y ensalada."] },
  "salmon-horno": { t:"Salmón al horno con calabacitas", time:"25 min", ing:["150 g filete de salmón","1 calabacita en rodajas","1 cdita aceite de oliva","Jugo de limón","Ajo en polvo, sal, pimienta"], steps:["Precalienta horno a 200°C.","Coloca salmón y calabacitas en charola.","Rocía aceite, limón, ajo, sal y pimienta.","Hornea 15-18 min.","Sirve con papa cambray cocida."] },
  "ceviche": { t:"Ceviche de camarón", time:"20 min", ing:["150 g camarón cocido picado","1 jitomate en cubos","½ pepino en cubos","Jugo de 2-3 limones","Cilantro picado","¼ aguacate","Sal y pimienta"], steps:["Mezcla camarón, jitomate y pepino.","Agrega jugo de limón y reposa 10 min.","Añade cilantro, sal, pimienta y aguacate al final.","Sirve sobre 2 tostadas."] },
  "tinga": { t:"Tinga de pollo", time:"30 min", ing:["150 g pechuga de pollo","2 jitomates","1-2 chiles chipotles en adobo","1 diente de ajo","Aceite de oliva, sal"], steps:["Cuece la pechuga y desmenúzala.","Licúa jitomates con ajo y chipotle.","Sofríe la salsa 5 min.","Agrega el pollo y cocina 5 min más.","Sirve con ½ taza arroz integral y ensalada."] },
  "pasta-camaron": { t:"Pasta con camarones", time:"20 min", ing:["½ taza pasta cocida","100 g camarones","2 jitomates licuados","1 diente de ajo","1 cda aceite de oliva","Albahaca, sal, pimienta"], steps:["Cuece la pasta al dente; reserva.","Sofríe el ajo, agrega jitomate y cocina 8 min.","Añade camarones, cocina 3-4 min.","Incorpora la pasta y mezcla.","Acompaña con ensalada verde."] },
  "milanesa": { t:"Milanesa de pollo al horno", time:"30 min", ing:["1 pechuga aplanada","½ taza avena molida","1 huevo batido","Ajo en polvo, sal, pimienta","Spray de aceite"], steps:["Precalienta horno a 200°C.","Sazona el pollo. Pásalo por huevo y avena molida.","Coloca en charola y rocía aceite.","Hornea 12 min por lado.","Sirve con ½ arroz integral y ensalada."] },
  "albondigas": { t:"Albóndigas de res en salsa", time:"35 min", ing:["150 g carne molida magra","2 cdas avena","2 jitomates","1 diente de ajo","Hierbas, sal, pimienta"], steps:["Mezcla carne con avena, sal y pimienta. Forma albóndigas.","Licúa jitomates con ajo y cuela.","Cocina la salsa 5 min.","Agrega albóndigas y cocina a fuego bajo 20 min.","Sirve con ½ taza arroz integral."] },
  "camarones-diabla": { t:"Camarones a la diabla", time:"20 min", ing:["150 g camarón","2 chiles guajillo","1 jitomate","1 diente de ajo","Aceite de oliva, sal"], steps:["Hidrata los guajillos 10 min en agua caliente.","Licúa con jitomate y ajo; cuela.","Sofríe la salsa en aceite 5 min.","Agrega camarones y cocina 4 min.","Sirve con arroz integral y ensalada."] },
  "brochetas": { t:"Brochetas de camarón", time:"15 min", ing:["150 g camarón grande","Calabacita en trozos","Jitomate cherry","Aceite de oliva, limón, ajo en polvo, sal"], steps:["Ensarta camarón, calabacita y jitomate.","Barniza con aceite, limón, ajo y sal.","Asa en plancha 2-3 min por lado.","Sirve con arroz integral y ensalada."] },
  "ensalada-atun": { t:"Ensalada de atún", time:"10 min", ing:["1 lata de atún en agua escurrido","Lechuga","1 jitomate","½ pepino","¼ aguacate","Limón, aceite de oliva, sal"], steps:["Escurre bien el atún.","Pica lechuga, jitomate y pepino.","Mezcla todo con atún y aguacate.","Adereza con limón, aceite y sal."] },
  "arrachera": { t:"Arrachera con calabacitas", time:"15 min", ing:["150 g arrachera","1 calabacita en rodajas","Aceite de oliva, sal, pimienta, limón"], steps:["Sazona la arrachera con sal, pimienta y limón.","Asa en plancha caliente 3-4 min por lado.","Asa las calabacitas con aceite y sal.","Deja reposar la carne 3 min antes de cortar.","Sirve con 2 tortillas."] },
  "pavo-mostaza": { t:"Pavo al horno con mostaza", time:"30 min", ing:["150 g pechuga de pavo","1 cda mostaza","Jugo de limón","Hierbas, ajo en polvo, sal"], steps:["Precalienta horno a 190°C.","Mezcla mostaza, limón, hierbas y ajo; unta el pavo.","Hornea 20-25 min hasta cocer.","Sirve con ½ arroz integral y brócoli."] },
  "guacamole": { t:"Tacos de pollo con guacamole", time:"15 min", ing:["100 g pollo desmenuzado","2 tortillas de maíz","¼ aguacate","1 jitomate","Limón, cilantro, sal"], steps:["Calienta el pollo desmenuzado.","Machaca aguacate con jitomate, limón, cilantro y sal.","Calienta las tortillas.","Arma los tacos. Acompaña con ensalada."] },
  "frittata": { t:"Frittata de espinacas", time:"15 min", ing:["2 huevos","Puño de espinacas","Jitomate cherry partido","1 cdita aceite de oliva, sal, pimienta"], steps:["Bate los huevos con sal y pimienta.","Saltea espinacas y jitomate 2 min.","Vierte el huevo, baja fuego y tapa.","Cocina 5 min hasta cuajar.","Acompaña con ½ taza de avena."] },
  "hotcakes": { t:"Hotcakes de avena", time:"15 min", ing:["½ taza avena","1 plátano maduro","1 huevo","Canela","1 cdita miel de agave"], steps:["Licúa avena, plátano, huevo y canela.","Calienta sartén antiadherente a fuego medio.","Vierte porciones y cocina 2 min por lado.","Sirve con un toque de miel de agave."] },
  "rancheros": { t:"Huevos rancheros", time:"15 min", ing:["2 huevos","1 tortilla de maíz","2 jitomates","1 diente de ajo","Aceite de oliva, sal"], steps:["Licúa jitomates con ajo y sal; cocina la salsa 5 min.","Fríe ligeramente los huevos.","Calienta la tortilla.","Sirve los huevos sobre la tortilla y baña con la salsa."] },
  "chilaquiles": { t:"Chilaquiles rojos ligeros", time:"20 min", ing:["Tortillas de maíz en triángulos","2 jitomates","1 diente de ajo","2 huevos","Cottage cheese","Sal"], steps:["Hornea los triángulos hasta dorar.","Licúa jitomates con ajo y sal; cocina la salsa 5 min.","Mezcla los totopos con la salsa caliente.","Sirve con 2 huevos encima y cottage."] },
  "huevos-calabacita": { t:"Huevos con calabacita", time:"12 min", ing:["2 huevos","1 calabacita en cubos","1 jitomate","1 cdita aceite de oliva, sal"], steps:["Saltea calabacita con jitomate en aceite 5 min.","Agrega los huevos batidos y revuelve.","Cocina hasta cuajar. Sazona con sal."] },
  "omelette-panela": { t:"Omelette de espinacas y panela", time:"10 min", ing:["3 claras + 1 yema","Espinacas","40 g queso panela","1 cdita aceite de oliva, sal"], steps:["Bate los huevos con sal.","Saltea espinacas en aceite 1 min.","Vierte el huevo, agrega el panela y dobla cuando cuaje."] },
  "smoothie-iso": { t:"Smoothie de proteína", time:"5 min", ing:["1 scoop Fitmingo","200 ml leche deslactosada","½ taza fresas","Hielo"], steps:["Pon todo en la licuadora.","Licúa hasta que quede cremoso.","Sirve de inmediato."] },
  "crema-brocoli": { t:"Crema de brócoli express", time:"15 min", ing:["1 taza de brócoli","200 ml caldo de verduras","1 cdita aceite de oliva","Ajo en polvo, sal, pimienta"], steps:["Cuece el brócoli 8 min.","Licúa con caldo, aceite, ajo, sal y pimienta.","Calienta y sirve con 1 tostada de maíz."] },
  "crema-calabacita": { t:"Crema de calabacita", time:"15 min", ing:["2 calabacitas en cubos","200 ml caldo de verduras","1 cdita aceite de oliva","Ajo en polvo, sal, pimienta"], steps:["Cuece las calabacitas 8 min.","Licúa con caldo, aceite, ajo, sal y pimienta.","Calienta y sirve con 1 tostada de maíz."] },
  "arroz-atun": { t:"Arroz con atún (cena)", time:"10 min", ing:["½ taza arroz blanco cocido","1 lata de atún en agua escurrido","¼ aguacate en cubos","1 jitomate","Limón, sal"], steps:["Escurre bien el atún.","Mezcla arroz con atún, jitomate y aguacate.","Adereza con limón y sal. Sin mayonesa."] },
  "tostada-atun": { t:"Tostada de atún (cena)", time:"8 min", ing:["1 tostada de maíz","½ lata de atún en agua","¼ aguacate","Jitomate, limón, sal"], steps:["Escurre el atún y mézclalo con limón y sal.","Unta el aguacate en la tostada.","Coloca el atún y jitomate encima."] },
  "coctel": { t:"Coctel de camarón ligero", time:"15 min", ing:["120 g camarón cocido","1 jitomate en cubos","½ pepino","¼ aguacate","Jugo de limón","Salsa de tomate natural","Cilantro, sal"], steps:["Mezcla camarón con jitomate y pepino.","Agrega un poco de salsa y jugo de limón.","Incorpora aguacate y cilantro al final.","Sirve frío."] },
  "ceviche-ligero": { t:"Ceviche ligero de camarón (cena)", time:"15 min", ing:["120 g camarón cocido","½ pepino en cubos","1 jitomate pequeño","Jugo de 2 limones","Cilantro","Sal"], steps:["Pica el camarón cocido.","Mezcla con pepino y jitomate.","Agrega jugo de limón, cilantro y sal.","Reposa 5 min y sirve. Sin tostada."] },
  "atun-sellado": { t:"Atún sellado", time:"10 min", ing:["1 filete de atún fresco (150 g)","1 cdita aceite de oliva","Ajonjolí (opcional)","Limón, sal, pimienta"], steps:["Seca el atún y sazona con sal y pimienta.","Calienta la sartén bien caliente con el aceite.","Sella el atún 1-2 min por lado (rosado al centro).","Rocía limón. Acompaña con arroz integral y ensalada."] },
  "fajitas": { t:"Fajitas de pollo", time:"20 min", ing:["150 g pechuga en tiras","1 calabacita en tiras","1 jitomate","Ajo en polvo, comino, sal","1 cda aceite de oliva"], steps:["Sazona el pollo con ajo, comino y sal.","Saltea el pollo en aceite a fuego alto 5 min.","Agrega la calabacita y el jitomate; cocina 5 min más.","Sirve con 2 tortillas de maíz calientes."] },
  "curry": { t:"Pollo al curry ligero", time:"25 min", ing:["150 g pechuga en cubos","1 cdita curry en polvo","½ taza leche deslactosada","1 diente de ajo","1 cda aceite de oliva, sal"], steps:["Sofríe el ajo, agrega el pollo y sella 5 min.","Añade el curry y mezcla 1 min.","Incorpora la leche y cocina a fuego bajo 10 min.","Sirve con ½ arroz integral y brócoli."] },
};

const SHOPPING = {
  trip1: { label:"Compra 1 · Semanas 1 y 2", note:"Incluye la despensa básica que rinde para todo el plan.", cats:[
    { c:"🥩 Proteínas", items:["Pechuga de pollo — ~1 kg","Pechuga de pavo — ~300 g","Res magra / molida — ~500 g","Arrachera — ~300 g","Salmón — 2 filetes (~300 g)","Camarón — ~800 g","Atún en agua — 5 latas"] },
    { c:"🥚 Huevo y lácteos", items:["Huevo — 3 docenas","Yogur griego natural — 3 botes","Cottage cheese — 3 botes","Queso panela — 250 g","Leche deslactosada — 4 L","Fitmingo — 1 bote"] },
    { c:"🥬 Verduras", items:["Espinacas — 3 bolsas","Jitomate — ~1.5 kg","Jitomate cherry — 1 paquete","Lechuga — 2 piezas","Pepino — 5 piezas","Calabacita — ~800 g","Brócoli — 3 piezas","Jícama — 1 pieza","Ajo — 2 cabezas"] },
    { c:"🍓 Frutas", items:["Manzana — 6","Pera — 4","Plátano — 6","Naranja — 4","Fresas — 3 canastillas","Arándanos — 2 paquetes","Mango — 3","Durazno — 3","Kiwi — 3","Mandarina — 6","Limón — ~15"] },
    { c:"🌾 Despensa", items:["Avena — 1 kg","Arroz integral — 1 kg","Arroz blanco — 1 kg","Pasta — 500 g","Tortillas de maíz — 2 paquetes","Tostadas de maíz — 2 paquetes","Papa cambray — ~500 g","Elote en grano — 3 latas","Granola sin azúcar — 1 bolsa","Papillas Mongui — 5","Pepita de calabaza — 1 bolsa"] },
    { c:"🧂 Condimentos", items:["Aceite de oliva — 1 botella","Miel de agave — 1 frasco","Canela en polvo","Chipotle en adobo — 1 lata","Chile guajillo — 6 piezas","Chile piquín en polvo","Mostaza — 1 frasco","Curry en polvo","Cilantro — 2 manojos","Hierbas (orégano, romero)"] },
  ]},
  trip2: { label:"Compra 2 · Semanas 3 y 4", note:"Solo lo perecedero; la despensa básica ya la tienes.", cats:[
    { c:"🥩 Proteínas", items:["Pechuga de pollo — ~1 kg","Pechuga de pavo — ~300 g","Res magra / molida — ~500 g","Arrachera — ~300 g","Salmón — 2 filetes (~300 g)","Camarón — ~800 g","Atún en agua — 5 latas"] },
    { c:"🥚 Huevo y lácteos", items:["Huevo — 3 docenas","Yogur griego natural — 3 botes","Cottage cheese — 3 botes","Queso panela — 250 g","Leche deslactosada — 4 L"] },
    { c:"🥬 Verduras", items:["Espinacas — 3 bolsas","Jitomate — ~1.5 kg","Jitomate cherry — 1 paquete","Lechuga — 2 piezas","Pepino — 5 piezas","Calabacita — ~800 g","Brócoli — 3 piezas","Jícama — 1 pieza","Ajo — 1 cabeza"] },
    { c:"🍓 Frutas", items:["Manzana — 6","Pera — 4","Plátano — 6","Naranja — 4","Fresas — 3 canastillas","Arándanos — 2 paquetes","Mango — 3","Durazno — 3","Kiwi — 3","Mandarina — 6","Limón — ~15"] },
    { c:"🌾 Reponer si se acabó", items:["Tortillas de maíz — 2 paquetes","Tostadas de maíz — 1 paquete","Papa cambray — ~500 g","Elote en grano — 3 latas","Papillas Mongui — 5","Granola — si se acabó","Aceite de oliva — si se acabó"] },
  ]},
};

// ── SLEEP HELPERS ─────────────────────────────────────────────────────────
function calcOptimalWake(bedtime) {
  if (!bedtime) return null;
  const [h, m] = bedtime.split(":").map(Number);
  const bedMin = h * 60 + m + 14;
  const target = 7 * 60 + 30;
  return [4,5,6].map(c => {
    const wakeMin = (bedMin + c * 90) % (24 * 60);
    const wh = Math.floor(wakeMin / 60);
    const wm = wakeMin % 60;
    return { cycles:c, label:`${wh}:${wm.toString().padStart(2,"0")}`, score:c===5?"ideal":c===4?"mínimo":"largo", wakeMin };
  }).sort((a,b) => {
    const da = Math.abs(a.wakeMin-target), db = Math.abs(b.wakeMin-target);
    // Si ambos quedan dentro de 45 min del objetivo, prioriza el ciclo ideal (5)
    if (Math.abs(da-db) <= 30) {
      if (a.cycles === 5 && b.cycles !== 5) return -1;
      if (b.cycles === 5 && a.cycles !== 5) return 1;
    }
    return da - db;
  });
}

function getCurrentSection() {
  // Si la URL trae ?seccion=... úsala (para los Siri Shortcuts)
  try {
    const params = new URLSearchParams(window.location.search);
    const s = params.get("seccion");
    const valid = ["sleep_am","sleep_pm","food","habits","peso"];
    if (s && valid.includes(s)) return s;
  } catch (_) {}
  const t = new Date().getHours() * 60 + new Date().getMinutes();
  if (t >= 6*60  && t < 10*60)  return "sleep_am";
  if (t >= 10*60 && t < 14*60)  return "food";
  if (t >= 14*60 && t < 21*60)  return "food";
  if (t >= 21*60 && t < 23*60)  return "sleep_pm";
  return "sleep_am";
}

function getInitialFoodTab() {
  // Para abrir directo en una comida específica del plan dinámico
  try {
    const params = new URLSearchParams(window.location.search);
    const c = params.get("comida");
    if (c) return "hoy"; // siempre la tab Hoy; la comida se resalta por hora
  } catch (_) {}
  return "hoy";
}

function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
}

// ── GOOGLE SHEETS API ─────────────────────────────────────────────────────
async function appendToSheet(sheet, values, token) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${sheet}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  const res = await fetch(url, {
    method:"POST",
    headers:{"Authorization":`Bearer ${token}`,"Content-Type":"application/json"},
    body:JSON.stringify({ values:[values.map(v => String(v))] }),
  });
  if (!res.ok) throw new Error(await res.text());
}

async function updateCell(sheet, cell, value, token) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${sheet}!${cell}?valueInputOption=RAW`;
  await fetch(url, {
    method:"PUT",
    headers:{"Authorization":`Bearer ${token}`,"Content-Type":"application/json"},
    body:JSON.stringify({ values:[[String(value)]] }),
  });
}

// Guarda una fila por fecha: si la fecha (columna A) ya existe, actualiza esa fila; si no, agrega
async function upsertByDate(sheet, values, token) {
  // Paso 1: Leer la columna A para encontrar si la fecha ya existe
  const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${sheet}!A:A`;
  const res = await fetch(readUrl, { headers:{ "Authorization":`Bearer ${token}` } });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  const rows = data.values || [];
  const dateStr = String(values[0]);
  let rowIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === dateStr) { rowIndex = i + 1; break; } // +1: filas 1-indexed
  }
  const rowValues = [values.map(v => String(v))];
  if (rowIndex > 0) {
    // Actualizar la fila existente
    const lastCol = values.length <= 26
      ? String.fromCharCode(64 + values.length)
      : "A" + String.fromCharCode(64 + values.length - 26);
    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${sheet}!A${rowIndex}:${lastCol}${rowIndex}?valueInputOption=RAW`;
    const r = await fetch(updateUrl, {
      method:"PUT",
      headers:{"Authorization":`Bearer ${token}`,"Content-Type":"application/json"},
      body:JSON.stringify({ values:rowValues }),
    });
    if (!r.ok) throw new Error(await r.text());
  } else {
    // Agregar fila nueva
    await appendToSheet(sheet, values, token);
  }
}

// ── FOOD ESTIMATE (local) ─────────────────────────────────────────────────
const FOODDB = [
  { kw:["taco de carnitas","taco carnitas","tacos de carnitas","tacos carnitas"], k:110 }, { kw:["taco al pastor","taco pastor"], k:180 }, { kw:["taco"], k:150 },
  { kw:["quesadilla"], k:250 }, { kw:["torta"], k:450 }, { kw:["enchilada"], k:170 },
  { kw:["chilaquiles"], k:400 }, { kw:["pozole"], k:300 }, { kw:["tostada"], k:130 },
  { kw:["pizza"], k:285 }, { kw:["hamburguesa"], k:500 }, { kw:["sandwich","sándwich"], k:350 },
  { kw:["café con leche","cafe con leche"], k:80 }, { kw:["latte","capuchino"], k:130 },
  { kw:["café","cafe","té","te"], k:5 }, { kw:["sidral mundet","refresco de manzana mundet","refresco mundet","mundet"], k:71 }, { kw:["refresco","coca"], k:150 },
  { kw:["cerveza"], k:150 }, { kw:["vino"], k:125 },
  { kw:["manzana"], k:75 }, { kw:["plátano","platano"], k:105 }, { kw:["naranja"], k:65 },
  { kw:["mango"], k:100 }, { kw:["fresas"], k:50 },
  { kw:["galleta"], k:50 }, { kw:["pan dulce","dona","concha"], k:300 },
  { kw:["huevo"], k:70 }, { kw:["yogur","yogurt"], k:120 }, { kw:["cottage","queso cottage","requesón"], k:90 }, { kw:["queso panela","panela"], k:90 }, { kw:["queso"], k:110 },
  { kw:["papaya"], k:60 }, { kw:["sandía","sandia"], k:50 }, { kw:["melón","melon"], k:60 }, { kw:["piña","pina"], k:80 }, { kw:["uvas","uva"], k:90 }, { kw:["durazno"], k:60 }, { kw:["arándanos","arandanos"], k:60 }, { kw:["mandarina"], k:45 }, { kw:["kiwi"], k:45 },
  { kw:["proteína","proteina","scoop","fitmingo","isopure"], k:140 },
  { kw:["espinaca"], k:10 }, { kw:["jitomate","tomate"], k:20 }, { kw:["calabacita","calabaza"], k:25 }, { kw:["brócoli","brocoli"], k:30 }, { kw:["pepino"], k:15 }, { kw:["lechuga"], k:10 }, { kw:["jícama","jicama"], k:35 }, { kw:["nopal","nopales"], k:15 }, { kw:["champiñones","champiñon","hongos"], k:20 }, { kw:["zanahoria"], k:35 }, { kw:["papa cambray","papa","papas cambray"], k:110 },
  { kw:["leche deslactosada","500 ml leche","leche"], k:200 }, { kw:["arroz"], k:200 }, { kw:["frijoles","frijol"], k:130 },
  { kw:["pasta","espagueti"], k:300 }, { kw:["ensalada"], k:150 }, { kw:["sopa","caldo"], k:180 },
  { kw:["pechuga","pollo"], k:200 }, { kw:["carne","bistec","res","arrachera"], k:250 },
  { kw:["camarón","camaron","camarones"], k:120 }, { kw:["salmón","salmon","atún","atun","pescado"], k:180 },
  { kw:["aguacate","guacamole"], k:120 }, { kw:["avena"], k:150 },
  { kw:["chocolate"], k:230 }, { kw:["papas fritas","papas"], k:300 },
  { kw:["helado","nieve"], k:200 }, { kw:["pastel","pay"], k:350 },
  { kw:["elote"], k:100 }, { kw:["esquite"], k:250 },
  { kw:["jamón","jamon"], k:50 }, { kw:["crema"], k:110 }, { kw:["mantequilla"], k:70 },
  { kw:["mermelada"], k:50 }, { kw:["miel"], k:60 }, { kw:["tocino"], k:90 },
  { kw:["salchichas de pavo","salchicha de pavo","salchicha pavo"], k:87 }, { kw:["salchichas de res costco","salchicha de res costco","salchicha costco","salchicha kirkland","salchichas de res","salchicha de res"], k:170 }, { kw:["salchichas cocktail","salchicha cocktail","salchichas coctel","salchicha coctel"], k:25 }, { kw:["salchicha"], k:80 }, { kw:["mayonesa"], k:90 }, { kw:["aderezo"], k:80 },
  { kw:["nutella","crema de avellana"], k:100 }, { kw:["azúcar","azucar"], k:50 },
  { kw:["leche condensada","lechera"], k:130 }, { kw:["nata"], k:80 },
  { kw:["tlacoyo"], k:230 }, { kw:["sope"], k:200 }, { kw:["gordita"], k:280 },
  { kw:["tamal"], k:250 }, { kw:["menudo"], k:280 },
  { kw:["bolillo","telera"], k:180 }, { kw:["pan tostado","rebanada de pan","pan"], k:80 },
  { kw:["agua de melón","agua de melon","agua de melon natural"], k:90 }, { kw:["agua de horchata","horchata"], k:150 }, { kw:["agua de jamaica","jamaica"], k:90 },
  { kw:["pan árabe","pan arabe","pan pita","pita"], k:150 }, { kw:["pepperoni","peperoni"], k:80 }, { kw:["papilla mongui","mongui"], k:50 }, { kw:["licuado de fresa con plátano","licuado de fresa con platano","licuado de fresa y plátano","licuado de fresa y platano"], k:460 }, { kw:["licuado de fresa","licuado de fresas"], k:400 }, { kw:["licuado","smoothie"], k:200 }, { kw:["jumex de uva","jugo de uva jumex","jumex uva"], k:174 }, { kw:["jugo de manzana jumex","jugo manzana jumex","jumex de manzana","jugo de manzana","jumex"], k:121 }, { kw:["jugo de naranja natural","jugo de naranja"], k:90 }, { kw:["jugo de zanahoria natural","jugo de zanahoria"], k:80 }, { kw:["galleta breton","galletas breton","breton"], k:40 }, { kw:["galleta salada","galletas saladas","galleta de soda","cracker","crackers"], k:13 }, { kw:["jugo"], k:120 }, { kw:["tequila","mezcal"], k:100 }, { kw:["palomitas"], k:250 },
  { kw:["chicharrón de cerdo","chicharron de cerdo","chicharrón","chicharron"], k:174 }, { kw:["papas fritas de bolsa","sabritas","frituras"], k:280 },
  { kw:["flan","gelatina"], k:200 },
];

function wordMatch(text, kw) {
  const isLetter = ch => /[a-záéíóúüñ0-9]/i.test(ch);
  let from = 0;
  while (from <= text.length) {
    const pos = text.indexOf(kw, from);
    if (pos < 0) return -1;
    const before = pos === 0 ? " " : text[pos - 1];
    let end = pos + kw.length;
    if (text.substr(end, 2) === "es" && !isLetter(text[end + 2] || " ")) end += 2;
    else if (text[end] === "s" && !isLetter(text[end + 1] || " ")) end += 1;
    const after = end >= text.length ? " " : text[end];
    if (!isLetter(before) && !isLetter(after)) return pos;
    from = pos + 1;
  }
  return -1;
}

const WORDNUM = { "un":1,"una":1,"uno":1,"dos":2,"tres":3,"cuatro":4,"cinco":5,"media":0.5,"medio":0.5 };

function localEstimate(text) {
  const t = " " + text.toLowerCase().replace(/\s+/g, " ") + " ";
  // Divide en platillos por separadores (no "con", para no romper frases)
  const chunks = t.split(/,| y |\+|\/| mas | más /).map(s => s.trim()).filter(Boolean);
  let total = 0; const parts = [];
  for (const ch of chunks) {
    let qty = 1;
    // Solo tomar como cantidad números pequeños (1-20), no mililitros/gramos
    const num = ch.match(/(?<![\d])(\d{1,2})(?!\s*(?:ml|g|gr|gramos|mililitros)\b)(?![\d])/);
    if (num && parseInt(num[1]) <= 20) qty = parseInt(num[1]);
    else { for (const w in WORDNUM) { if (new RegExp("\\b" + w + "\\b").test(ch)) { qty = WORDNUM[w]; break; } } }
    // Encuentra alimentos del chunk; evita contar el mismo alimento dos veces (sinónimos)
    let rem = ch;
    const found = [];
    const usedFood = new Set();
    while (true) {
      let best = null;
      for (let fi = 0; fi < FOODDB.length; fi++) {
        if (usedFood.has(fi)) continue;
        for (const kw of FOODDB[fi].kw) {
          const pos = wordMatch(rem, kw);
          if (pos >= 0 && (!best || kw.length > best.len)) best = { k:FOODDB[fi].k, len:kw.length, name:kw, pos, fi };
        }
      }
      if (!best) break;
      usedFood.add(best.fi);
      const origPos = wordMatch(ch, best.name);
      found.push({ ...best, origPos: origPos >= 0 ? origPos : best.pos });
      rem = rem.slice(0, best.pos) + " ".repeat(best.len) + rem.slice(best.pos + best.len);
    }
    found.sort((a,b) => a.origPos - b.origPos);
    found.forEach((f, idx) => {
      const useQty = idx === 0 ? qty : 1;
      const c = Math.round(f.k * useQty);
      total += c;
      parts.push(`${useQty !== 1 ? useQty + " " : ""}${f.name} ~${c} kcal`);
    });
  }
  return total > 0 ? { kcal:total, desglose:parts.join(", ") } : null;
}

// ── UI COMPONENTS ─────────────────────────────────────────────────────────
const VINO = "#7D2E46";
const VINO2 = "#A33E5C";
const VINO_LIGHT = "#F2E5E9";
const NEUTRAL = "#F5F0EE";
const NEUTRAL2 = "#E6DADD";
const TEXT = "#2C2528";
const MUTED = "#6B5F62";

function Pill({ label, selected, color, onClick, small }) {
  return (
    <button onClick={onClick} style={{
      padding:small?"6px 14px":"10px 18px", borderRadius:100,
      border:`1.5px solid ${selected ? color : NEUTRAL2}`,
      background:selected ? color : "#fff",
      color:selected ? "#fff" : MUTED,
      fontSize:small?13:14, fontWeight:600, cursor:"pointer",
      fontFamily:"inherit", transition:"all 0.15s", flexShrink:0,
    }}>{label}</button>
  );
}

function Stepper({ value, onChange, min, max, step, unit }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:12 }}>
      <button onClick={() => onChange(Math.max(min, value-step))} style={{ width:36, height:36, borderRadius:"50%", border:`1.5px solid ${NEUTRAL2}`, background:"#fff", fontSize:18, cursor:"pointer", color:MUTED, display:"flex", alignItems:"center", justifyContent:"center" }}>−</button>
      <span style={{ fontSize:22, fontWeight:700, color:TEXT, minWidth:60, textAlign:"center" }}>
        {value}<span style={{ fontSize:13, fontWeight:500, color:MUTED, marginLeft:4 }}>{unit}</span>
      </span>
      <button onClick={() => onChange(Math.min(max, value+step))} style={{ width:36, height:36, borderRadius:"50%", border:`1.5px solid ${NEUTRAL2}`, background:"#fff", fontSize:18, cursor:"pointer", color:MUTED, display:"flex", alignItems:"center", justifyContent:"center" }}>+</button>
    </div>
  );
}

function SaveBtn({ onClick, saving, saved, label }) {
  return (
    <button onClick={onClick} disabled={saving} style={{
      width:"100%", padding:"14px", borderRadius:14, border:"none", cursor:"pointer",
      background:saved ? "#52B788" : VINO, color:"#fff",
      fontSize:15, fontWeight:700, fontFamily:"inherit", marginTop:4,
      opacity:saving?0.7:1,
    }}>
      {saving?"⏳ Guardando...":saved?"✓ Guardado en Sheets":label}
    </button>
  );
}

// ── BARCODE SCANNER MODAL ─────────────────────────────────────────────────
function ScannerModal({ onDetected, onClose }) {
  const [status, setStatus] = useState("Cargando cámara...");

  useEffect(() => {
    let scanner = null;
    let cancelled = false;

    function start() {
      if (!window.Html5Qrcode) { setStatus("Cargando librería..."); setTimeout(start, 500); return; }
      try {
        scanner = new window.Html5Qrcode("scanner-region");
        scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          (decodedText) => {
            if (cancelled) return;
            cancelled = true;
            scanner.stop().then(() => onDetected(decodedText)).catch(() => onDetected(decodedText));
          },
          () => {}
        ).then(() => setStatus("Apunta al código de barras"))
         .catch(() => setStatus("No se pudo acceder a la cámara. Revisa permisos en Safari."));
      } catch (e) { setStatus("Error al iniciar scanner."); }
    }
    start();
    return () => { cancelled = true; if (scanner) scanner.stop().catch(() => {}); };
  }, [onDetected]);

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:1000, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ color:"#fff", fontSize:14, marginBottom:16, fontWeight:600 }}>{status}</div>
      <div id="scanner-region" style={{ width:"100%", maxWidth:340, borderRadius:16, overflow:"hidden", background:"#000" }} />
      <button onClick={onClose} style={{ marginTop:20, padding:"12px 28px", borderRadius:12, border:"none", background:"#fff", color:"#2C2528", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Cancelar</button>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────
export default function App() {
  const now = new Date();
  const DAYS_ES = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

  // ── State ──
  const [section, setSection]           = useState(getCurrentSection());
  const [foodTab, setFoodTab]           = useState("hoy");
  const [token, setToken]               = useState(null);
  const [authLoading, setAuthLoading]   = useState(false);
  const [saving, setSaving]             = useState(false);
  const [savedSection, setSavedSection] = useState(null);

  // Sleep AM
  const [prevBedtime, setPrevBedtime]   = useState("23:00");
  const [firstWake, setFirstWake]       = useState("");
  const [backToBed, setBackToBed]       = useState("");   // hora en que volviste a dormirte
  const [actualWake, setActualWake]     = useState("");   // despertar final
  const [sleepQuality, setSleepQuality] = useState(null);
  // Sleep PM
  const [bedtime, setBedtime]           = useState("23:00");
  const [selectedWake, setSelectedWake] = useState(null);
  // Sync AM→PM
  useEffect(() => { setBedtime(prevBedtime); }, [prevBedtime]);

  // Habits
  const [agua, setAgua]                 = useState(0);
  const [lectura, setLectura]           = useState(0);
  const [customHabits, setCustomHabits] = useState([]);
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [newHabitName, setNewHabitName] = useState("");
  const [newHabitMeta, setNewHabitMeta] = useState("30");
  const [newHabitUnit, setNewHabitUnit] = useState("min");
  const [customValues, setCustomValues] = useState({});
  const [habitSaved, setHabitSaved]     = useState(false);

  // Weight
  const [weight, setWeight]             = useState("");

  // Food (dynamic plan)
  const [activeDate, setActiveDate]     = useState(todayKey());
  const [log, setLog]                   = useState({});
  const [history, setHistory]           = useState({});
  const [customFor, setCustomFor]       = useState(null);
  const [customName, setCustomName]     = useState("");
  const [customKcal, setCustomKcal]     = useState("");
  const [calcLoading, setCalcLoading]   = useState(false);
  const [calcInfo, setCalcInfo]         = useState("");
  const [scanningFor, setScanningFor]   = useState(null);
  const [scanMsg, setScanMsg]           = useState("");
  const [openRecipe, setOpenRecipe]     = useState(null);
  const [recipeSearch, setRecipeSearch] = useState("");
  const [activeTrip, setActiveTrip]     = useState("trip1");
  const [shopChecked, setShopChecked]   = useState({});
  const [closingDay, setClosingDay]     = useState(false);
  const [dayClosed, setDayClosed]       = useState(false);

  const wakeOptions = calcOptimalWake(bedtime);
  const planDayNum = Math.floor((new Date(activeDate+"T12:00:00") - new Date("2026-06-01T12:00:00")) / 86400000) + 1;
  const planLabel = planDayNum < 1 ? "Tu plan inicia el 1 de junio" : planDayNum <= 28 ? `Día ${planDayNum} de 28` : "Plan de 4 semanas completado 🎉";

  // ── Load from localStorage ──
  useEffect(() => {
    const t = localStorage.getItem("ht_token");
    const exp = parseInt(localStorage.getItem("ht_token_exp") || "0");
    if (t && Date.now() < exp) setToken(t);
    else { localStorage.removeItem("ht_token"); localStorage.removeItem("ht_token_exp"); }
    const h = LS.get("ht_history"); if (h) setHistory(h);
    const s = LS.get("ht_shopping"); if (s) setShopChecked(s);
    const ch = LS.get("ht_custom_habits"); if (ch) setCustomHabits(ch);
    const cv = LS.get("ht_custom_values"); if (cv) setCustomValues(cv);
    if (!document.getElementById("google-gsi")) {
      const script = document.createElement("script");
      script.id = "google-gsi";
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true; script.defer = true;
      document.head.appendChild(script);
    }
    if (!document.getElementById("html5-qrcode")) {
      const s = document.createElement("script");
      s.id = "html5-qrcode";
      s.src = "https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js";
      s.async = true;
      document.head.appendChild(s);
    }
  }, []);

  const firstDateRun = useRef(true);
  useEffect(() => {
    loadDay(activeDate);
    // En el montaje inicial NO limpiamos (para no borrar lo cargado de localStorage)
    if (firstDateRun.current) { firstDateRun.current = false; return; }
    // Al CAMBIAR de día, limpiar campos para no arrastrar valores
    setPrevBedtime("23:00");
    setActualWake("");
    setFirstWake("");
    setBackToBed("");
    setFirstWake("");
    setSleepQuality(null);
    setBedtime("23:00");
    setSelectedWake(null);
    setAgua(0);
    setLectura(0);
    setCustomValues(prev => {
      const cleared = {};
      Object.keys(prev).forEach(k => { cleared[k] = 0; });
      return cleared;
    });
    setWeight("");
    setSavedSection(null);
    setHabitSaved(false);
    setDayClosed(false);
  }, [activeDate]);

  function loadDay(d) {
    const saved = LS.get(`ht_day:${d}`);
    setLog(saved || {});
    setDayClosed(false);
  }

  function persistLog(nl) {
    LS.set(`ht_day:${activeDate}`, nl);
    const consumed = Object.values(nl).reduce((s,m) => s+(m?.kcal||0), 0);
    const h = { ...history, [activeDate]:{ consumed, logged:Object.keys(nl).length } };
    setHistory(h); LS.set("ht_history", h);
  }

  function logMeal(key, name, kcal, status="pick", recipe=null) {
    const nl = { ...log, [key]:{ name, kcal, status, recipe } };
    setLog(nl); persistLog(nl);
  }
  function clearMeal(key) {
    const nl = { ...log }; delete nl[key]; setLog(nl); persistLog(nl);
  }

  // ── Auth ──
  const handleAuth = useCallback((silent = false) => {
    if (!window.google?.accounts?.oauth2) {
      setTimeout(() => { if (window.google?.accounts?.oauth2) handleAuth(silent); }, 1500);
      return;
    }
    if (!silent) setAuthLoading(true);
    window.google.accounts.oauth2.initTokenClient({
      client_id:CLIENT_ID, scope:SCOPES,
      prompt: silent ? "none" : "",
      callback:(resp) => {
        setAuthLoading(false);
        if (resp.error) {
          // Si falla el silent, pedir login normal
          if (silent) handleAuth(false);
          else alert("Error de autenticación: " + resp.error);
          return;
        }
        setToken(resp.access_token);
        localStorage.setItem("ht_token", resp.access_token);
        // Guardar el momento de expiración (~55 min para tener margen)
        localStorage.setItem("ht_token_exp", String(Date.now() + 55 * 60 * 1000));
      },
    }).requestAccessToken();
  }, []);

  // Detectar si el token guardado ya expiró antes de usarlo
  function getValidToken() {
    const exp = parseInt(localStorage.getItem("ht_token_exp") || "0");
    if (Date.now() > exp) { setToken(null); localStorage.removeItem("ht_token"); return null; }
    return token;
  }

  // ── Sheets saves ──
  const doSave = async (sheet, values, sec) => {
    const t = getValidToken() || token;
    if (!t) { handleAuth(); return; }
    setSaving(true);
    try {
      await appendToSheet(sheet, values, t);
      setSavedSection(sec); setTimeout(() => setSavedSection(null), 3000);
    } catch(e) {
      if (e.message.includes("401") || e.message.includes("403")) {
        setToken(null); localStorage.removeItem("ht_token");
        handleAuth();
      } else alert("Error al guardar: " + e.message);
    }
    setSaving(false);
  };

  const saveSleepAM = () => {
    const minsBetween = (from, to) => {
      const [fh,fm] = from.split(":").map(Number);
      const [th,tm] = to.split(":").map(Number);
      return ((th*60+tm) - (fh*60+fm) + 1440) % 1440;
    };
    let dur = "";
    // Bloque 1: dormir → primer despertar
    // Bloque 2: volver a dormir → despertar final
    const hasTwoBlocks = firstWake && backToBed && actualWake;
    const finalWake = actualWake || firstWake;
    if (prevBedtime && finalWake) {
      let total;
      if (hasTwoBlocks) {
        const block1 = minsBetween(prevBedtime, firstWake);
        const block2 = minsBetween(backToBed, actualWake);
        total = block1 + block2;
      } else {
        total = minsBetween(prevBedtime, finalWake);
      }
      dur = (total / 60).toFixed(1);
    }
    doSave("Sueno", [activeDate, prevBedtime, finalWake, "", "", dur, sleepQuality||"", firstWake||"", backToBed||""], "sleep_am");
  };

  const saveSleepPM = async () => {
    const token = getValidToken() || (setToken(null), null);
    if (!token) { handleAuth(); return; }
    const optimal = selectedWake || wakeOptions?.[0]?.label || "";
    const cycles  = wakeOptions?.find(o => o.label===optimal)?.cycles || "";
    setSaving(true);
    try {
      await appendToSheet("Sueno", [activeDate, bedtime, "", optimal, cycles, "", ""], token);
      if (optimal) await appendToSheet("AlarmaAlexa", [activeDate, optimal], token);
      setSavedSection("sleep_pm"); setTimeout(() => setSavedSection(null), 3000);
    } catch(e) {
      if (e.message.includes("401") || e.message.includes("403")) { setToken(null); localStorage.removeItem("ht_token"); handleAuth(); }
      else alert("Error: "+e.message);
    }
    setSaving(false);
  };

  const saveHabits = async () => {
    const token = getValidToken() || (setToken(null), null);
    if (!token) { handleAuth(); return; }
    setSaving(true);
    try {
      const customVals = customHabits.map(h => customValues[h.name]||0);
      await appendToSheet("Habitos", [activeDate, agua, lectura, ...customVals], token);
      setHabitSaved(true); setTimeout(() => setHabitSaved(false), 3000);
    } catch(e) {
      if (e.message.includes("401") || e.message.includes("403")) { setToken(null); localStorage.removeItem("ht_token"); handleAuth(); }
      else alert("Error: "+e.message);
    }
    setSaving(false);
  };

  const saveWeight = () => {
    if (!weight) { alert("Ingresa tu peso"); return; }
    doSave("Sueno", [activeDate, "", "", "", "", "", "", weight], "peso");
  };

  const closeDay = async () => {
    const token = getValidToken() || (setToken(null), null);
    if (!token) { handleAuth(); return; }
    setClosingDay(true);
    const consumed = Object.values(log).reduce((s,m) => s+(m?.kcal||0), 0);
    try {
      await upsertByDate("Historial_Alimentacion", [
        activeDate, consumed, consumed-TARGET,
        log.des?.name||"—", log.des?.kcal||0,
        log.cam?.name||"—", log.cam?.kcal||0,
        log.com?.name||"—", log.com?.kcal||0,
        log.cpm?.name||"—", log.cpm?.kcal||0,
        log.cen?.name||"—", log.cen?.kcal||0,
      ], token);
      setDayClosed(true);
    } catch(e) {
      alert("Error al cerrar día: "+e.message);
    }
    setClosingDay(false);
  };

  const addHabit = () => {
    if (!newHabitName.trim()) return;
    const habit = { name:newHabitName, meta:parseInt(newHabitMeta), unit:newHabitUnit };
    const updated = [...customHabits, habit];
    setCustomHabits(updated); LS.set("ht_custom_habits", updated);
    setCustomValues(prev => { const n = {...prev,[newHabitName]:0}; LS.set("ht_custom_values", n); return n; });
    setNewHabitName(""); setNewHabitMeta("30"); setShowAddHabit(false);
  };

  // ── Food logic ──
  const consumed = Object.values(log).reduce((s,m) => s+(m?.kcal||0), 0);
  const loggedKeys = Object.keys(log);
  const remaining = TARGET - consumed;
  const pendingKeys = MEAL_META.filter(m => !loggedKeys.includes(m.key)).map(m => m.key);
  const pendingBaseSum = pendingKeys.reduce((s,k) => s+SLOT_BASE[k], 0) || 1;
  const shakeLoggedToday = Object.values(log).some(m => m?.name?.includes("Fitmingo"));
  const MAIN_P = new Set(["P_POLLO","P_RES","P_MAR","P_HUEVO","P_SHAKE"]);

  function mealTarget(key) {
    if (remaining <= 0) return Math.min(...LIB[key].map(o => o.k));
    return Math.round(remaining * (SLOT_BASE[key]/pendingBaseSum));
  }

  function pickOptions(key) {
    const n = key === "cpm" ? 3 : 2;
    const t = mealTarget(key);
    let sorted = [...LIB[key]].sort((a,b) => Math.abs(a.k-t)-Math.abs(b.k-t));
    if (shakeLoggedToday) sorted = sorted.filter(o => o.p !== "P_SHAKE");
    if (key === "cam") {
      const nonShake = sorted.filter(o => o.p !== "P_SHAKE");
      const shakes   = sorted.filter(o => o.p === "P_SHAKE");
      const pool = []; let mongui = false;
      for (const opt of nonShake) {
        if (opt.n.includes("Mongui")) { if (!mongui) { pool.push(opt); mongui = true; } }
        else pool.push(opt);
        if (pool.length >= 8) break;
      }
      const rest = nonShake.filter(o => !pool.includes(o));
      const dayOff = pool.length ? new Date(activeDate+"T12:00:00").getDate() % pool.length : 0;
      sorted = [...pool.slice(dayOff), ...pool.slice(0, dayOff), ...rest, ...shakes];
    }
    if (!shakeLoggedToday && key === "cpm") {
      const shakes    = sorted.filter(o => o.p === "P_SHAKE").sort((a,b) => Math.abs(a.k-t)-Math.abs(b.k-t));
      const nonShakes = sorted.filter(o => o.p !== "P_SHAKE");
      sorted = [...shakes, ...nonShakes];
    }
    const results = []; const used = {};
    for (const opt of sorted) {
      if (results.length >= n) break;
      const p = opt.p;
      if (p && MAIN_P.has(p)) {
        const max = p === "P_SHAKE" ? 2 : 1;
        if ((used[p] || 0) >= max) continue;
      }
      results.push(opt);
      if (p && MAIN_P.has(p)) used[p] = (used[p] || 0) + 1;
    }
    for (const opt of sorted) { if (results.length >= n) break; if (!results.includes(opt)) results.push(opt); }
    if (!shakeLoggedToday && key === "cam" && results.length < 3) {
      const reminder = sorted.find(o => o.p === "P_SHAKE" && o.n.includes("500 ml") && !results.includes(o));
      if (reminder) results.push(reminder);
    }
    return results;
  }

  async function handleBarcodeDetected(code) {
    const mealKey = scanningFor;
    setScanningFor(null);
    setScanMsg("Buscando producto...");
    const result = await lookupBarcode(code);
    if (result && result.kcal) {
      setCustomFor(mealKey);
      setCustomName(result.name);
      setCustomKcal(String(result.kcal));
      setCalcInfo(`✓ ${result.name} · ${result.kcal} kcal (${result.source})`);
      setScanMsg("");
    } else if (result && !result.kcal) {
      setCustomFor(mealKey);
      setCustomName(result.name);
      setCustomKcal("");
      setCalcInfo(`Encontré "${result.name}" pero sin calorías. Escríbelas y se guardarán para la próxima.`);
      setScanMsg("");
      window._lastScanCode = code;
    } else {
      setCustomFor(mealKey);
      setCustomName("");
      setCustomKcal("");
      setCalcInfo(`Producto no encontrado (código ${code}). Escribe el nombre y las kcal; se guardarán para futuros escaneos.`);
      setScanMsg("");
      window._lastScanCode = code;
    }
  }

  function estimateKcal() {    if (!customName.trim()) return;
    setCalcLoading(true); setCalcInfo("");
    setTimeout(() => {
      const result = localEstimate(customName);
      if (result) {
        setCustomKcal(String(result.kcal));
        setCalcInfo(result.desglose);
      } else {
        setCalcInfo("No reconocí esos alimentos. Escribe las kcal manualmente.");
      }
      setCalcLoading(false);
    }, 300);
  }

  let advice, aCol, aBg;
  if (loggedKeys.length === 0) { advice="Elige tu primera comida. Las opciones se ajustan a tu meta de 1,550 kcal."; aCol=MUTED; aBg=NEUTRAL; }
  else if (loggedKeys.length === 5) {
    if (consumed <= TARGET+50) { advice=`¡Día completo! Cerraste en ${consumed} kcal. 🎉`; aCol=VINO; aBg=VINO_LIGHT; }
    else { advice=`Cerraste en ${consumed} kcal (${consumed-TARGET} sobre la meta). Mañana retomas.`; aCol="#92500E"; aBg="#FBEEDD"; }
  } else if (remaining < 0) { advice=`Superaste tu meta por ${Math.abs(remaining)} kcal. Verás solo opciones ligeras.`; aCol="#92500E"; aBg="#FBEEDD"; }
  else { advice=`Te quedan ${remaining} kcal. Las opciones ya están dimensionadas para cerrar cerca de 1,550.`; aCol=VINO; aBg=VINO_LIGHT; }

  const recipeList = Object.entries(RECIPES)
    .filter(([,r]) => r.t.toLowerCase().includes(recipeSearch.toLowerCase()))
    .sort((a,b) => a[1].t.localeCompare(b[1].t));

  // ── NAV ──
  const NAV = [
    { id:"sleep_am", icon:"🌅", label:"Sueño AM" },
    { id:"sleep_pm", icon:"😴", label:"Sueño PM" },
    { id:"food",     icon:"🥗", label:"Alimentación" },
    { id:"habits",   icon:"💧", label:"Hábitos" },
    { id:"peso",     icon:"⚖️", label:"Peso" },
  ];

  const card = { background:"#fff", border:`1px solid ${NEUTRAL2}`, borderRadius:14 };

  return (
    <div style={{ fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", background:NEUTRAL, minHeight:"100vh", maxWidth:500, margin:"0 auto", paddingBottom:40 }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* HEADER */}
      <div style={{ background:`linear-gradient(135deg,${VINO},${VINO2})`, color:"#fff", padding:"20px 18px 16px" }}>
        <div style={{ fontSize:12, opacity:0.75, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:4 }}>
          {getGreeting()} · {DAYS_ES[now.getDay()]} {now.getDate()} {["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"][now.getMonth()]}
        </div>
        <div style={{ fontSize:24, fontWeight:800 }}>Mi Tracker de Salud</div>

        {/* Selector de fecha global */}
        <div style={{ marginTop:12, display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
          <span style={{ fontSize:12, opacity:0.85 }}>Registrando el día:</span>
          <input type="date" value={activeDate} max={todayKey()} onChange={e=>setActiveDate(e.target.value)}
            style={{ border:"none", borderRadius:8, padding:"5px 10px", fontSize:13, fontFamily:"inherit", background:"rgba(255,255,255,0.9)", color:TEXT, fontWeight:600 }} />
          {activeDate !== todayKey() && (
            <button onClick={()=>setActiveDate(todayKey())} style={{ border:"none", background:"rgba(255,255,255,0.25)", color:"#fff", borderRadius:8, padding:"5px 10px", fontSize:11, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Hoy</button>
          )}
        </div>
        {activeDate !== todayKey() && (
          <div style={{ marginTop:6, fontSize:11, background:"rgba(255,255,255,0.18)", borderRadius:8, padding:"4px 10px", display:"inline-block" }}>
            ✏️ Registrando un día pasado
          </div>
        )}

        {!token ? (
          <button onClick={handleAuth} disabled={authLoading} style={{ marginTop:12, padding:"9px 18px", borderRadius:10, border:"none", background:"rgba(255,255,255,0.2)", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>
            {authLoading?"⏳ Conectando...":"🔗 Conectar Google Sheets"}
          </button>
        ) : (
          <div style={{ marginTop:10, fontSize:12, opacity:0.8, display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ width:8, height:8, borderRadius:"50%", background:"#95D5B2", display:"inline-block" }}/>
            Conectado a Google Sheets
          </div>
        )}
      </div>

      {/* NAV */}
      <div style={{ display:"flex", gap:6, padding:"12px 14px 0", overflowX:"auto", paddingBottom:4, background:"#fff", borderBottom:`1px solid ${NEUTRAL2}`, position:"sticky", top:0, zIndex:10 }}>
        {NAV.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)} style={{
            padding:"7px 12px", borderRadius:100, cursor:"pointer", fontSize:12, fontWeight:600,
            fontFamily:"inherit", whiteSpace:"nowrap", flexShrink:0,
            border:section===s.id?"none":`1px solid ${NEUTRAL2}`,
            background:section===s.id ? VINO : "#fff",
            color:section===s.id ? "#fff" : MUTED,
          }}>{s.icon} {s.label}</button>
        ))}
      </div>

      <div style={{ padding:14, display:"flex", flexDirection:"column", gap:12 }}>

        {/* ── SUEÑO AM ── */}
        {section === "sleep_am" && (
          <div style={{ ...card, padding:20 }}>
            {savedSection==="sleep_am" && <div style={{ background:VINO, color:"#fff", fontSize:10, fontWeight:700, padding:"4px 12px", borderBottomLeftRadius:10, position:"absolute", top:0, right:14 }}>✓ GUARDADO</div>}
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
              <span style={{ fontSize:24 }}>🌅</span>
              <div>
                <div style={{ fontSize:15, fontWeight:700, color:TEXT }}>Sueño — mañana</div>
                <div style={{ fontSize:12, color:MUTED }}>¿Cómo dormiste anoche?</div>
              </div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

              {/* BLOQUE 1 */}
              <div style={{ background:NEUTRAL, borderRadius:14, padding:"14px 14px 10px" }}>
                <div style={{ fontSize:11, color:VINO, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:10 }}>Bloque 1</div>
                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:12, color:MUTED, marginBottom:6, fontWeight:600 }}>Me dormí a las</div>
                  <input type="time" value={prevBedtime} onChange={e=>setPrevBedtime(e.target.value)} style={{ fontSize:26, fontWeight:700, border:"none", background:"#fff", borderRadius:10, padding:"8px 14px", color:TEXT, width:"100%", boxSizing:"border-box", fontFamily:"inherit" }} />
                </div>
                <div>
                  <div style={{ fontSize:12, color:MUTED, marginBottom:6, fontWeight:600 }}>Me desperté a las</div>
                  <input type="time" value={firstWake} onChange={e=>setFirstWake(e.target.value)} style={{ fontSize:26, fontWeight:700, border:"none", background:"#fff", borderRadius:10, padding:"8px 14px", color:TEXT, width:"100%", boxSizing:"border-box", fontFamily:"inherit" }} />
                </div>
                {prevBedtime && firstWake && (
                  <div style={{ marginTop:8, fontSize:12, color:VINO, fontWeight:600 }}>
                    {(() => { const [bh,bm]=prevBedtime.split(":").map(Number); const [wh,wm]=firstWake.split(":").map(Number); const min=((wh*60+wm)-(bh*60+bm)+1440)%1440; return `⏱ ${Math.floor(min/60)}h ${min%60}m`; })()}
                  </div>
                )}
              </div>

              {/* Toggle bloque 2 */}
              {!firstWake ? null : !backToBed && !actualWake ? (
                <button onClick={() => setBackToBed("04:00")} style={{ background:"transparent", border:`1.5px dashed ${VINO2}`, borderRadius:12, padding:"10px", fontSize:13, fontWeight:600, color:VINO, cursor:"pointer", fontFamily:"inherit" }}>
                  + Me volví a dormir (agregar bloque 2)
                </button>
              ) : (
                <div style={{ background:NEUTRAL, borderRadius:14, padding:"14px 14px 10px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                    <div style={{ fontSize:11, color:VINO, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em" }}>Bloque 2</div>
                    <button onClick={() => { setBackToBed(""); setActualWake(""); }} style={{ background:"transparent", border:"none", color:MUTED, fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>✕ quitar</button>
                  </div>
                  <div style={{ marginBottom:12 }}>
                    <div style={{ fontSize:12, color:MUTED, marginBottom:6, fontWeight:600 }}>Me volví a dormir a las</div>
                    <input type="time" value={backToBed} onChange={e=>setBackToBed(e.target.value)} style={{ fontSize:26, fontWeight:700, border:"none", background:"#fff", borderRadius:10, padding:"8px 14px", color:TEXT, width:"100%", boxSizing:"border-box", fontFamily:"inherit" }} />
                  </div>
                  <div>
                    <div style={{ fontSize:12, color:MUTED, marginBottom:6, fontWeight:600 }}>Me desperté definitivamente a las</div>
                    <input type="time" value={actualWake} onChange={e=>setActualWake(e.target.value)} style={{ fontSize:26, fontWeight:700, border:"none", background:"#fff", borderRadius:10, padding:"8px 14px", color:TEXT, width:"100%", boxSizing:"border-box", fontFamily:"inherit" }} />
                  </div>
                  {backToBed && actualWake && (
                    <div style={{ marginTop:8, fontSize:12, color:VINO, fontWeight:600 }}>
                      {(() => { const [bh,bm]=backToBed.split(":").map(Number); const [wh,wm]=actualWake.split(":").map(Number); const min=((wh*60+wm)-(bh*60+bm)+1440)%1440; return `⏱ ${Math.floor(min/60)}h ${min%60}m`; })()}
                    </div>
                  )}
                </div>
              )}

              {/* Total */}
              {prevBedtime && (firstWake || actualWake) && (
                <div style={{ background:VINO_LIGHT, borderRadius:12, padding:"12px 14px" }}>
                  <div style={{ fontSize:11, color:VINO, fontWeight:600 }}>Total dormido</div>
                  <div style={{ fontSize:26, fontWeight:800, color:VINO }}>
                    {(() => {
                      const mins = (from, to) => { const [fh,fm]=from.split(":").map(Number); const [th,tm]=to.split(":").map(Number); return ((th*60+tm)-(fh*60+fm)+1440)%1440; };
                      const hasTwoBlocks = firstWake && backToBed && actualWake;
                      const total = hasTwoBlocks
                        ? mins(prevBedtime, firstWake) + mins(backToBed, actualWake)
                        : mins(prevBedtime, actualWake||firstWake);
                      return `${Math.floor(total/60)}h ${total%60}m`;
                    })()}
                  </div>
                  {firstWake && backToBed && actualWake && (
                    <div style={{ fontSize:11, color:VINO, opacity:0.8, marginTop:2 }}>
                      Bloque 1 + Bloque 2 · sin contar el tiempo despierta
                    </div>
                  )}
                </div>
              )}

              {/* Calidad */}
              <div>
                <div style={{ fontSize:12, color:MUTED, marginBottom:8, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.08em" }}>Calidad del sueño</div>
                <div style={{ display:"flex", gap:8 }}>
                  {[["😴","Mal"],["😐","Regular"],["😊","Bueno"],["🌟","Excelente"]].map(([em,label]) => (
                    <button key={label} onClick={() => setSleepQuality(label)} style={{ flex:1, padding:"10px 4px", borderRadius:12, border:"none", cursor:"pointer", background:sleepQuality===label?VINO:NEUTRAL, color:sleepQuality===label?"#fff":MUTED, fontSize:11, fontWeight:600, fontFamily:"inherit", display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                      <span style={{ fontSize:18 }}>{em}</span>{label}
                    </button>
                  ))}
                </div>
              </div>
              <SaveBtn onClick={saveSleepAM} saving={saving} saved={savedSection==="sleep_am"} label="💾 Guardar sueño de anoche" />
            </div>
          </div>
        )}

        {/* ── SUEÑO PM ── */}
        {section === "sleep_pm" && (
          <div style={{ ...card, padding:20 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
              <span style={{ fontSize:24 }}>😴</span>
              <div>
                <div style={{ fontSize:15, fontWeight:700, color:TEXT }}>Sueño — noche</div>
                <div style={{ fontSize:12, color:MUTED }}>Calcula tu alarma de mañana</div>
              </div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              {prevBedtime && (
                <div style={{ background:VINO_LIGHT, borderRadius:12, padding:"10px 14px" }}>
                  <div style={{ fontSize:11, color:VINO, fontWeight:600 }}>Basado en tu historial de anoche</div>
                  <div style={{ fontSize:13, color:TEXT, marginTop:2 }}>Te dormiste a las <strong>{prevBedtime}</strong> — ajusta si hoy será diferente</div>
                </div>
              )}
              <div>
                <div style={{ fontSize:12, color:MUTED, marginBottom:8, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.08em" }}>¿A qué hora te vas a dormir?</div>
                <input type="time" value={bedtime} onChange={e=>setBedtime(e.target.value)} style={{ fontSize:28, fontWeight:700, border:"none", background:NEUTRAL, borderRadius:12, padding:"10px 16px", color:TEXT, width:"100%", boxSizing:"border-box", fontFamily:"inherit" }} />
              </div>
              {wakeOptions && (
                <div>
                  <div style={{ fontSize:12, color:MUTED, marginBottom:8, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.08em" }}>Toca tu hora óptima de despertar</div>
                  {wakeOptions.map((opt,i) => (
                    <div key={i} onClick={() => setSelectedWake(opt.label)} style={{
                      display:"flex", justifyContent:"space-between", alignItems:"center",
                      padding:"12px 14px", borderRadius:12, cursor:"pointer", marginBottom:6,
                      background:selectedWake===opt.label?VINO:i===0?VINO_LIGHT:NEUTRAL,
                      color:selectedWake===opt.label?"#fff":TEXT,
                      border:`1.5px solid ${selectedWake===opt.label?VINO:i===0?VINO2+"44":"transparent"}`,
                    }}>
                      <div>
                        <span style={{ fontWeight:800, fontSize:20 }}>{opt.label}</span>
                        <span style={{ fontSize:11, marginLeft:8, opacity:0.7 }}>{opt.cycles} ciclos · {opt.cycles*1.5}h</span>
                      </div>
                      <span style={{ fontSize:10, fontWeight:700, padding:"3px 9px", borderRadius:100, background:selectedWake===opt.label?"rgba(255,255,255,0.25)":NEUTRAL2, color:selectedWake===opt.label?"#fff":MUTED }}>{opt.score}</span>
                    </div>
                  ))}
                  {(selectedWake || wakeOptions?.[0]?.label) && (
                    <div style={{ background:VINO, color:"#fff", borderRadius:12, padding:"12px 14px", marginTop:8 }}>
                      <div style={{ fontSize:11, opacity:0.85, fontWeight:600 }}>🔔 Dile a Alexa antes de dormir:</div>
                      <div style={{ fontSize:16, fontWeight:800, marginTop:4 }}>"Alexa, pon una alarma a las {selectedWake || wakeOptions[0].label}"</div>
                    </div>
                  )}
                </div>
              )}
              <SaveBtn onClick={saveSleepPM} saving={saving} saved={savedSection==="sleep_pm"} label="😴 Guardar registro de sueño" />
            </div>
          </div>
        )}

        {/* ── ALIMENTACIÓN ── */}
        {section === "food" && (
          <>
            {/* Sub-tabs */}
            <div style={{ display:"flex", background:"#fff", borderRadius:14, border:`1px solid ${NEUTRAL2}`, overflow:"hidden" }}>
              {[["hoy","📋 Hoy"],["recetas","📖 Recetas"],["compras","🛒 Compras"],["historial","📅 Historial"],["reporte","📊 Reporte"]].map(([id,l]) => (
                <button key={id} onClick={() => setFoodTab(id)} style={{ flex:1, padding:"11px 2px", border:"none", fontFamily:"inherit", background:foodTab===id?VINO_LIGHT:"transparent", color:foodTab===id?VINO:MUTED, fontWeight:foodTab===id?700:400, fontSize:11.5, cursor:"pointer", borderBottom:foodTab===id?`2px solid ${VINO}`:"2px solid transparent" }}>{l}</button>
              ))}
            </div>

            {/* HOY */}
            {foodTab === "hoy" && <>
              <div style={{ ...card, padding:"10px 14px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div style={{ fontSize:11, color:VINO, fontWeight:700 }}>{planLabel}</div>
                <div style={{ fontSize:11, color:MUTED }}>{activeDate === todayKey() ? "Hoy" : fmtShort(activeDate)}</div>
              </div>

              <div style={{ ...card, padding:16, textAlign:"center" }}>
                <div style={{ fontSize:11, color:MUTED }}>Consumido hoy</div>
                <div style={{ fontSize:36, fontWeight:800, color:consumed>TARGET+50?"#C0392B":VINO, lineHeight:1.1 }}>{consumed} <span style={{ fontSize:16, color:MUTED }}>/ {TARGET}</span></div>
                <div style={{ background:NEUTRAL, borderRadius:999, height:10, overflow:"hidden", margin:"10px 0 4px" }}>
                  <div style={{ width:`${Math.min((consumed/TARGET)*100,100)}%`, background:consumed>TARGET+50?"#C0392B":VINO, height:"100%", transition:"width .4s" }} />
                </div>
                <div style={{ fontSize:12, color:remaining>=0?VINO:"#C0392B", fontWeight:600 }}>{remaining>=0?`Te quedan ${remaining} kcal`:`${Math.abs(remaining)} kcal sobre la meta`}</div>
              </div>

              <div style={{ background:aBg, borderRadius:12, padding:"12px 14px", fontSize:13, color:aCol, fontWeight:500, lineHeight:1.5 }}>💡 {advice}</div>

              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {MEAL_META.map(m => {
                  const entry = log[m.key];
                  const done = !!entry;
                  const options = pickOptions(m.key);
                  const t = mealTarget(m.key);
                  const adapted = loggedKeys.length > 0 && pendingKeys.includes(m.key);
                  return (
                    <div key={m.key} style={{ ...card, padding:"12px 14px", borderColor:done?(entry.status==="skip"?NEUTRAL2:VINO2+"66"):NEUTRAL2, background:done?(entry.status==="skip"?NEUTRAL:VINO_LIGHT):"#fff" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                        <span style={{ fontSize:17 }}>{m.icon}</span>
                        <span style={{ fontSize:13, fontWeight:700, color:TEXT, flex:1 }}>{m.label}</span>
                        <span style={{ fontSize:11, color:MUTED }}>{m.time}</span>
                        {!done && adapted && <span style={{ fontSize:10, background:VINO_LIGHT, color:VINO, borderRadius:999, padding:"2px 8px", fontWeight:600 }}>~{t} kcal</span>}
                      </div>

                      {done ? (
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
                          <span style={{ fontSize:12.5, fontWeight:500, color:entry.status==="skip"?"#C0392B":VINO, flex:1 }}>
                            {entry.status==="skip"?"⊘ Saltada":`${entry.status==="custom"?"✏️":"✅"} ${entry.name} · ${entry.kcal} kcal`}
                          </span>
                          {entry.recipe && RECIPES[entry.recipe] && <button onClick={() => { setFoodTab("recetas"); setOpenRecipe(entry.recipe); }} style={{ background:"transparent", border:"none", color:VINO, fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>ver receta</button>}
                          <button onClick={() => clearMeal(m.key)} style={{ background:"transparent", border:"none", color:MUTED, fontSize:11, cursor:"pointer", textDecoration:"underline", fontFamily:"inherit" }}>cambiar</button>
                        </div>
                      ) : customFor === m.key ? (
                        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                          <input value={customName} onChange={e=>setCustomName(e.target.value)} placeholder="¿Qué comiste? Ej: 2 tacos y café con leche" autoFocus style={{ border:`1px solid ${NEUTRAL2}`, borderRadius:8, padding:"8px 10px", fontSize:13, fontFamily:"inherit" }} />
                          <button onClick={estimateKcal} disabled={calcLoading||!customName.trim()} style={{ background:calcLoading?VINO_LIGHT:VINO, color:calcLoading?VINO:"#fff", border:"none", borderRadius:8, padding:"8px", fontSize:12.5, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                            {calcLoading?"Calculando...":"🤖 Estimar calorías"}
                          </button>
                          {calcInfo && <div style={{ background:VINO_LIGHT, borderRadius:8, padding:"8px 10px", fontSize:11.5, color:VINO, lineHeight:1.45 }}>{calcInfo}</div>}
                          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                            <input type="number" value={customKcal} onChange={e=>setCustomKcal(e.target.value)} placeholder="kcal" style={{ flex:1, border:`1px solid ${NEUTRAL2}`, borderRadius:8, padding:"8px 10px", fontSize:13, fontFamily:"inherit" }} />
                            <button onClick={() => { const k=parseInt(customKcal); if(!isNaN(k)){ if(window._lastScanCode){ saveProduct(window._lastScanCode, customName||"Producto", k); window._lastScanCode=null; } logMeal(m.key,customName||"Otra cosa",k,"custom"); setCustomFor(null); setCustomName(""); setCustomKcal(""); setCalcInfo(""); }}} style={{ background:VINO, color:"#fff", border:"none", borderRadius:8, padding:"8px 14px", fontSize:12.5, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Guardar</button>
                            <button onClick={() => { setCustomFor(null); setCustomName(""); setCustomKcal(""); setCalcInfo(""); }} style={{ background:"transparent", border:"none", color:MUTED, fontSize:16, cursor:"pointer" }}>✕</button>
                          </div>
                          <div style={{ fontSize:10.5, color:MUTED, lineHeight:1.4 }}>Estimación aproximada; ajusta el número antes de guardar.</div>
                        </div>
                      ) : (
                        <>
                          {adapted && <div style={{ fontSize:11, color:VINO2, marginBottom:6 }}>Opciones ajustadas a tu presupuesto restante:</div>}
                          {m.key === "cam" && !shakeLoggedToday && (
                            <div style={{ background:VINO_LIGHT, border:`1px solid ${NEUTRAL2}`, borderRadius:8, padding:"7px 10px", marginBottom:8, fontSize:11.5, color:VINO, lineHeight:1.4 }}>
                              💊 El shake aparece abajo como opción. Si no lo tomas aquí, la colación PM te lo priorizará.
                            </div>
                          )}
                          {m.key === "cpm" && !shakeLoggedToday && (
                            <div style={{ background:VINO_LIGHT, border:`1px solid ${NEUTRAL2}`, borderRadius:8, padding:"7px 10px", marginBottom:8, fontSize:11.5, color:VINO, lineHeight:1.4 }}>
                              💊 Aún no tomaste el shake de Fitmingo hoy.
                            </div>
                          )}
                          {m.key === "cpm" && shakeLoggedToday && (
                            <div style={{ background:NEUTRAL, borderRadius:8, padding:"7px 10px", marginBottom:8, fontSize:11.5, color:MUTED, lineHeight:1.4 }}>
                              ✅ Ya tomaste el Fitmingo hoy.
                            </div>
                          )}
                          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                            {options.map((o,oi) => (
                              <div key={oi} style={{ display:"flex", gap:6, alignItems:"stretch" }}>
                                <button onClick={() => logMeal(m.key,o.n,o.k,"pick",o.r)} style={{ flex:1, background:"#fff", border:`1px solid ${VINO2}55`, borderRadius:10, padding:"9px 11px", cursor:"pointer", fontFamily:"inherit", textAlign:"left", display:"flex", justifyContent:"space-between", alignItems:"center", gap:8 }}>
                                  <span style={{ fontSize:12, color:o.n.startsWith("★")?VINO:TEXT, fontWeight:o.n.startsWith("★")?600:400, lineHeight:1.35 }}>{o.n}</span>
                                  <span style={{ fontSize:11, color:VINO2, fontWeight:700, flexShrink:0 }}>{o.k}</span>
                                </button>
                                {o.r && RECIPES[o.r] && (
                                  <button onClick={() => { setFoodTab("recetas"); setOpenRecipe(o.r); }} style={{ background:VINO_LIGHT, border:`1px solid ${NEUTRAL2}`, borderRadius:10, padding:"0 10px", cursor:"pointer", fontSize:15, flexShrink:0 }}>📖</button>
                                )}
                              </div>
                            ))}
                            <div style={{ display:"flex", gap:6 }}>
                              <button onClick={() => { setCustomFor(m.key); setCustomName(""); setCustomKcal(""); setCalcInfo(""); }} style={{ flex:1, background:VINO_LIGHT, color:VINO, border:`1px solid ${NEUTRAL2}`, borderRadius:10, padding:"8px", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>✏️ Otra cosa</button>
                              <button onClick={() => setScanningFor(m.key)} style={{ background:VINO_LIGHT, color:VINO, border:`1px solid ${NEUTRAL2}`, borderRadius:10, padding:"8px 12px", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>📷</button>
                              <button onClick={() => logMeal(m.key,"",0,"skip")} style={{ background:"#fff", color:"#C0392B", border:`1px solid ${NEUTRAL2}`, borderRadius:10, padding:"8px 12px", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>⊘ Saltar</button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Cerrar día */}
              {loggedKeys.length >= 1 && (
                <div style={{ ...card, padding:16 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:TEXT, marginBottom:4 }}>{dayClosed ? "Día guardado" : "Guardar día en tu historial"}</div>
                  <div style={{ fontSize:12, color:MUTED, marginBottom:12, lineHeight:1.5 }}>Guarda el resumen en Sheets para tener tu historial permanente. Puedes volver a guardar si agregas más comidas.</div>
                  {dayClosed ? (
                    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                      <div style={{ textAlign:"center", fontSize:14, color:"#52B788", fontWeight:700, padding:4 }}>✓ Guardado en Sheets</div>
                      <button onClick={closeDay} disabled={closingDay} style={{ width:"100%", padding:"10px", borderRadius:12, border:`1px solid ${NEUTRAL2}`, background:"#fff", color:VINO, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
                        {closingDay?"⏳ Guardando...":"↻ Volver a guardar (actualicé comidas)"}
                      </button>
                    </div>
                  ) : (
                    <button onClick={closeDay} disabled={closingDay} style={{ width:"100%", padding:"13px", borderRadius:12, border:"none", background:VINO, color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"inherit", opacity:closingDay?0.7:1 }}>
                      {closingDay?"⏳ Guardando...":"📊 Cerrar día y guardar en Sheets"}
                    </button>
                  )}
                </div>
              )}
            </>}

            {/* RECETAS */}
            {foodTab === "recetas" && <>
              <input value={recipeSearch} onChange={e=>setRecipeSearch(e.target.value)} placeholder="🔍 Buscar receta..." style={{ width:"100%", border:`1px solid ${NEUTRAL2}`, borderRadius:10, padding:"10px 12px", fontSize:14, fontFamily:"inherit", boxSizing:"border-box" }} />
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {recipeList.map(([id,r]) => {
                  const isOpen = openRecipe === id;
                  return (
                    <div key={id} style={{ ...card, overflow:"hidden" }}>
                      <button onClick={() => setOpenRecipe(isOpen?null:id)} style={{ width:"100%", background:isOpen?VINO_LIGHT:"#fff", border:"none", padding:"12px 14px", cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"space-between", textAlign:"left" }}>
                        <div>
                          <div style={{ fontSize:14, fontWeight:600, color:TEXT }}>{r.t}</div>
                          <div style={{ fontSize:11, color:MUTED }}>⏱ {r.time}</div>
                        </div>
                        <span style={{ fontSize:14, color:MUTED }}>{isOpen?"▲":"▼"}</span>
                      </button>
                      {isOpen && (
                        <div style={{ padding:"0 14px 14px" }}>
                          <div style={{ fontSize:12, fontWeight:700, color:VINO2, margin:"8px 0 5px" }}>Ingredientes</div>
                          <ul style={{ margin:0, paddingLeft:18 }}>
                            {r.ing.map((x,i) => <li key={i} style={{ fontSize:12.5, color:MUTED, lineHeight:1.6 }}>{x}</li>)}
                          </ul>
                          <div style={{ fontSize:12, fontWeight:700, color:VINO, margin:"10px 0 5px" }}>Preparación</div>
                          <ol style={{ margin:0, paddingLeft:18 }}>
                            {r.steps.map((x,i) => <li key={i} style={{ fontSize:12.5, color:MUTED, lineHeight:1.6, marginBottom:3 }}>{x}</li>)}
                          </ol>
                        </div>
                      )}
                    </div>
                  );
                })}
                {recipeList.length === 0 && <div style={{ textAlign:"center", padding:30, color:MUTED, fontSize:14 }}>No se encontró esa receta.</div>}
              </div>
            </>}

            {/* COMPRAS */}
            {foodTab === "compras" && (() => {
              const trip = SHOPPING[activeTrip];
              const allKeys = trip.cats.flatMap((cat,ci) => cat.items.map((_,ii) => `${activeTrip}:${ci}:${ii}`));
              const checkedCount = allKeys.filter(k => shopChecked[k]).length;
              return <>
                <div style={{ display:"flex", gap:6 }}>
                  {[["trip1","Semanas 1-2"],["trip2","Semanas 3-4"]].map(([id,l]) => (
                    <button key={id} onClick={() => setActiveTrip(id)} style={{ flex:1, padding:"9px", border:"1px solid", borderRadius:10, fontSize:12.5, fontWeight:activeTrip===id?700:400, cursor:"pointer", fontFamily:"inherit", background:activeTrip===id?VINO:"#fff", borderColor:activeTrip===id?VINO:NEUTRAL2, color:activeTrip===id?"#fff":MUTED }}>{l}</button>
                  ))}
                </div>
                <div style={{ ...card, padding:"12px 14px" }}>
                  <div style={{ fontSize:13, fontWeight:700, color:TEXT }}>{trip.label}</div>
                  <div style={{ fontSize:11, color:MUTED, marginTop:3, lineHeight:1.4 }}>{trip.note}</div>
                  <div style={{ background:NEUTRAL, borderRadius:999, height:8, overflow:"hidden", margin:"10px 0 5px" }}>
                    <div style={{ width:`${allKeys.length?(checkedCount/allKeys.length)*100:0}%`, background:VINO, height:"100%", transition:"width .3s" }} />
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontSize:11.5, color:VINO, fontWeight:600 }}>{checkedCount} de {allKeys.length} comprados</span>
                    <button onClick={() => { const ns={...shopChecked}; Object.keys(ns).forEach(k=>{ if(k.startsWith(activeTrip+":")) delete ns[k]; }); setShopChecked(ns); LS.set("ht_shopping",ns); }} style={{ background:"transparent", border:"none", color:MUTED, fontSize:11, cursor:"pointer", textDecoration:"underline", fontFamily:"inherit" }}>limpiar</button>
                  </div>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {trip.cats.map((cat,ci) => (
                    <div key={ci} style={{ ...card, overflow:"hidden" }}>
                      <div style={{ background:VINO_LIGHT, padding:"8px 14px", fontSize:13, fontWeight:700, color:VINO }}>{cat.c}</div>
                      {cat.items.map((item,ii) => {
                        const k = `${activeTrip}:${ci}:${ii}`;
                        const on = !!shopChecked[k];
                        return (
                          <div key={ii} onClick={() => { const ns={...shopChecked,[k]:!on}; setShopChecked(ns); LS.set("ht_shopping",ns); }} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 14px", cursor:"pointer", borderTop:ii===0?"none":`1px solid ${NEUTRAL}` }}>
                            <span style={{ width:18, height:18, borderRadius:5, border:`2px solid ${on?VINO:NEUTRAL2}`, background:on?VINO:"#fff", color:"#fff", fontSize:12, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{on?"✓":""}</span>
                            <span style={{ fontSize:12.5, color:on?MUTED:TEXT, textDecoration:on?"line-through":"none", lineHeight:1.4 }}>{item}</span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </>;
            })()}

            {/* HISTORIAL */}
            {foodTab === "historial" && <>
              {Object.keys(history).length === 0 ? (
                <div style={{ textAlign:"center", padding:40, color:MUTED, fontSize:14 }}>Aún no hay días registrados.</div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  {Object.entries(history).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,14).map(([d,info]) => {
                    const diff = info.consumed - TARGET;
                    const c = Math.abs(diff)<=80?VINO:diff>0?"#92500E":VINO2;
                    return (
                      <div key={d} style={{ ...card, padding:"10px 14px", display:"flex", alignItems:"center", gap:10 }}>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13, fontWeight:d===todayKey()?700:500 }}>{d===todayKey()?"Hoy":fmtShort(d)}</div>
                          <div style={{ fontSize:11, color:MUTED }}>{info.logged}/5 comidas</div>
                        </div>
                        <div style={{ textAlign:"right" }}>
                          <div style={{ fontSize:15, fontWeight:700, color:c }}>{info.consumed} kcal</div>
                          <div style={{ fontSize:10, color:c }}>{diff>0?`+${diff}`:diff} vs meta</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {Object.keys(history).length > 0 && (() => {
                const vals = Object.values(history);
                const avg = Math.round(vals.reduce((s,i)=>s+i.consumed,0)/vals.length);
                const onTarget = vals.filter(i=>Math.abs(i.consumed-TARGET)<=80).length;
                return (
                  <div style={{ background:VINO_LIGHT, border:`1px solid ${NEUTRAL2}`, borderRadius:12, padding:14, marginTop:4 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:VINO, marginBottom:6 }}>Resumen</div>
                    <div style={{ fontSize:13, color:TEXT }}>Promedio diario: <strong>{avg} kcal</strong></div>
                    <div style={{ fontSize:13, color:TEXT }}>Días en meta (±80 kcal): <strong>{onTarget} de {vals.length}</strong></div>
                  </div>
                );
              })()}
            </>}

            {/* REPORTE */}
            {foodTab === "reporte" && (() => {
              const dias = Object.entries(history).sort((a,b) => b[0].localeCompare(a[0]));
              if (dias.length === 0) return (
                <div style={{ textAlign:"center", padding:40, color:MUTED, fontSize:14 }}>
                  Aún no hay días cerrados. Registra tus comidas y toca "Cerrar día" para generar el reporte.
                </div>
              );

              // Kcal promedio por comida (usando log guardado en localStorage)
              const mealTotals = { des:[], cam:[], com:[], cpm:[], cen:[] };
              const mealNames  = { des:{}, cam:{}, com:{}, cpm:{}, cen:{} };
              dias.forEach(([d]) => {
                const dayLog = LS.get(`ht_day:${d}`);
                if (!dayLog) return;
                MEAL_META.forEach(m => {
                  const entry = dayLog[m.key];
                  if (entry && entry.status !== "skip" && entry.kcal > 0) {
                    mealTotals[m.key].push(entry.kcal);
                    const n = entry.name || "Otra cosa";
                    const short = n.length > 35 ? n.slice(0,35)+"…" : n;
                    mealNames[m.key][short] = (mealNames[m.key][short] || 0) + 1;
                  }
                });
              });

              const avg = k => mealTotals[k].length
                ? Math.round(mealTotals[k].reduce((s,v)=>s+v,0) / mealTotals[k].length)
                : null;

              const top3 = k => Object.entries(mealNames[k])
                .sort((a,b) => b[1]-a[1]).slice(0,3);

              const totalDays = dias.length;
              const totalAvg  = Math.round(dias.reduce((s,[,i])=>s+i.consumed,0)/totalDays);
              const onTarget  = dias.filter(([,i])=>Math.abs(i.consumed-TARGET)<=80).length;
              const overTarget = dias.filter(([,i])=>i.consumed>TARGET+80).length;
              const underTarget = dias.filter(([,i])=>i.consumed<TARGET-80).length;

              return <>
                {/* Resumen global */}
                <div style={{ ...card, padding:14, marginBottom:10, background:VINO_LIGHT, border:`1px solid ${VINO2}44` }}>
                  <div style={{ fontSize:13, fontWeight:800, color:VINO, marginBottom:8 }}>📊 Resumen general · {totalDays} días</div>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    {[
                      ["Promedio diario", `${totalAvg} kcal`],
                      ["En meta (±80)", `${onTarget} días`],
                      ["Sobre la meta", `${overTarget} días`],
                      ["Bajo la meta",  `${underTarget} días`],
                    ].map(([label, val]) => (
                      <div key={label} style={{ background:"#fff", borderRadius:10, padding:"8px 12px", flex:"1 1 40%", minWidth:100 }}>
                        <div style={{ fontSize:10, color:MUTED, fontWeight:600 }}>{label}</div>
                        <div style={{ fontSize:16, fontWeight:800, color:VINO }}>{val}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Promedio kcal por comida */}
                <div style={{ ...card, padding:14, marginBottom:10 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:TEXT, marginBottom:10 }}>⚡ Promedio de calorías por comida</div>
                  {MEAL_META.map(m => {
                    const a = avg(m.key);
                    const pct = a ? Math.round((a/totalAvg)*100) : 0;
                    return (
                      <div key={m.key} style={{ marginBottom:10 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                          <span style={{ fontSize:12, color:TEXT }}>{m.icon} {m.label}</span>
                          <span style={{ fontSize:12, fontWeight:700, color:a?VINO:MUTED }}>{a ? `${a} kcal · ${pct}%` : "Sin datos"}</span>
                        </div>
                        <div style={{ height:6, background:NEUTRAL, borderRadius:3 }}>
                          <div style={{ height:"100%", borderRadius:3, background:VINO, width:`${pct}%`, transition:"width .3s" }} />
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ fontSize:10, color:MUTED, marginTop:4 }}>% calculado sobre el promedio total del día</div>
                </div>

                {/* Top platillos por comida */}
                <div style={{ ...card, padding:14, marginBottom:10 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:TEXT, marginBottom:10 }}>🏆 Lo que más comes por comida</div>
                  {MEAL_META.map(m => {
                    const tops = top3(m.key);
                    if (tops.length === 0) return null;
                    return (
                      <div key={m.key} style={{ marginBottom:12 }}>
                        <div style={{ fontSize:12, fontWeight:700, color:VINO, marginBottom:5 }}>{m.icon} {m.label}</div>
                        {tops.map(([name, count], i) => (
                          <div key={name} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"5px 0", borderTop: i===0?"none":`1px solid ${NEUTRAL}` }}>
                            <span style={{ fontSize:12, color:TEXT, flex:1, lineHeight:1.3 }}>{i===0?"🥇":i===1?"🥈":"🥉"} {name}</span>
                            <span style={{ fontSize:11, color:MUTED, marginLeft:8, flexShrink:0 }}>{count}x</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>

                <div style={{ fontSize:11, color:MUTED, lineHeight:1.5, padding:"0 4px" }}>
                  El reporte usa los días que has cerrado con "Cerrar día". Más días = análisis más preciso.
                </div>
              </>;
            })()}
          </>
        )}

        {/* ── HÁBITOS ── */}
        {section === "habits" && (
          <div style={{ ...card, padding:20 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
              <span style={{ fontSize:24 }}>💧</span>
              <div>
                <div style={{ fontSize:15, fontWeight:700, color:TEXT }}>Hábitos del día</div>
                <div style={{ fontSize:12, color:MUTED }}>Agua · Lectura</div>
              </div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
              {[
                { val:agua, set:setAgua, icon:"💧", label:"Agua", meta:8, step:1, unit:"vasos", color:VINO },
                { val:lectura, set:setLectura, icon:"📖", label:"Lectura", meta:20, step:5, unit:"min", color:VINO2 },
                ...customHabits.map(h => ({ val:customValues[h.name]||0, set:(v)=>{ setCustomValues(p=>{ const n={...p,[h.name]:v}; LS.set("ht_custom_values",n); return n; }); }, icon:"⭐", label:h.name, meta:h.meta, step:h.unit==="min"?5:1, unit:h.unit, color:MUTED }))
              ].map(h => (
                <div key={h.label}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                    <div>
                      <div style={{ fontSize:14, fontWeight:600, color:TEXT }}>{h.icon} {h.label}</div>
                      <div style={{ fontSize:11, color:MUTED }}>Meta: {h.meta} {h.unit}</div>
                    </div>
                    <Stepper value={h.val} onChange={h.set} min={0} max={h.meta*3} step={h.step} unit={h.unit} />
                  </div>
                  <div style={{ height:6, background:NEUTRAL, borderRadius:3 }}>
                    <div style={{ height:"100%", borderRadius:3, background:h.color, width:`${Math.min(100,(h.val/h.meta)*100)}%`, transition:"width 0.3s" }} />
                  </div>
                </div>
              ))}

              {!showAddHabit ? (
                <button onClick={() => setShowAddHabit(true)} style={{ border:`1.5px dashed ${NEUTRAL2}`, borderRadius:12, padding:"12px", textAlign:"center", fontSize:13, fontWeight:600, color:VINO, cursor:"pointer", background:"transparent", fontFamily:"inherit" }}>
                  + Agregar hábito nuevo
                </button>
              ) : (
                <div style={{ background:NEUTRAL, borderRadius:14, padding:16, display:"flex", flexDirection:"column", gap:10 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:TEXT }}>Nuevo hábito</div>
                  <input placeholder="Nombre (ej. Meditación)" value={newHabitName} onChange={e=>setNewHabitName(e.target.value)} style={{ padding:"10px 12px", borderRadius:10, border:`1px solid ${NEUTRAL2}`, fontSize:13, fontFamily:"inherit", background:"#fff", color:TEXT }} />
                  <div style={{ display:"flex", gap:8 }}>
                    <input placeholder="Meta" type="number" value={newHabitMeta} onChange={e=>setNewHabitMeta(e.target.value)} style={{ flex:1, padding:"10px 12px", borderRadius:10, border:`1px solid ${NEUTRAL2}`, fontSize:13, fontFamily:"inherit", background:"#fff", color:TEXT }} />
                    <select value={newHabitUnit} onChange={e=>setNewHabitUnit(e.target.value)} style={{ flex:1, padding:"10px 12px", borderRadius:10, border:`1px solid ${NEUTRAL2}`, fontSize:13, fontFamily:"inherit", background:"#fff", color:TEXT }}>
                      <option value="min">minutos</option>
                      <option value="veces">veces</option>
                      <option value="vasos">vasos</option>
                    </select>
                  </div>
                  <div style={{ display:"flex", gap:8 }}>
                    <button onClick={addHabit} style={{ flex:1, padding:"10px", borderRadius:10, border:"none", background:VINO, color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>✓ Agregar</button>
                    <button onClick={() => setShowAddHabit(false)} style={{ flex:1, padding:"10px", borderRadius:10, border:`1px solid ${NEUTRAL2}`, background:"#fff", color:MUTED, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>Cancelar</button>
                  </div>
                </div>
              )}

              <button onClick={saveHabits} disabled={saving} style={{ width:"100%", padding:"14px", borderRadius:14, border:"none", cursor:"pointer", background:habitSaved?"#52B788":VINO, color:"#fff", fontSize:15, fontWeight:700, fontFamily:"inherit", opacity:saving?0.7:1 }}>
                {saving?"⏳ Guardando...":habitSaved?"✓ Guardado en Sheets":"💾 Guardar hábitos"}
              </button>
            </div>
          </div>
        )}

        {/* ── PESO ── */}
        {section === "peso" && (
          <div style={{ ...card, padding:20 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
              <span style={{ fontSize:24 }}>⚖️</span>
              <div>
                <div style={{ fontSize:15, fontWeight:700, color:TEXT }}>Peso</div>
                <div style={{ fontSize:12, color:MUTED }}>Registro semanal</div>
              </div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div>
                <div style={{ fontSize:12, color:MUTED, marginBottom:8, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.08em" }}>Peso de hoy</div>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <input type="number" value={weight} onChange={e=>setWeight(e.target.value)} placeholder="63.0" step="0.1" style={{ fontSize:32, fontWeight:800, border:"none", background:NEUTRAL, borderRadius:12, padding:"12px 16px", color:TEXT, width:"140px", fontFamily:"inherit" }} />
                  <span style={{ fontSize:18, color:MUTED, fontWeight:600 }}>kg</span>
                </div>
              </div>
              <SaveBtn onClick={saveWeight} saving={saving} saved={savedSection==="peso"} label="⚖️ Guardar peso" />
            </div>
          </div>
        )}

      </div>

      {scanningFor && <ScannerModal onDetected={handleBarcodeDetected} onClose={() => setScanningFor(null)} />}
      {scanMsg && (
        <div style={{ position:"fixed", bottom:20, left:"50%", transform:"translateX(-50%)", background:VINO, color:"#fff", padding:"10px 20px", borderRadius:12, fontSize:13, fontWeight:600, zIndex:1001 }}>{scanMsg}</div>
      )}
    </div>
  );
}
