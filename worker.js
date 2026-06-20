// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 MEJORAS APLICADAS:
// ✅ Sistema completo de normalización de lenguaje natural (normalizaciones.js)
// ✅ Cubre TODAS las variaciones comunes: madrugada/tarde/noche/mediodía
// ✅ IA mejorada con mejor prompt y temperatura 0.3
// ✅ Comando /debug_ia para testing sin crear alarmas
// ✅ Transcripción de voz con AssemblyAI (language_code="es") en lugar de Whisper
//    Requiere la variable/secret ASSEMBLYAI_API_KEY en Cloudflare
// ✅ TODOS los botones, callbacks y QR intactos
// ═══════════════════════════════════════════════════════════════════════════════

import { DICCIONARIO } from './diccionario.js';
import normalizarTextoCompleto from './normalizaciones.js';

const SALTO_GRANDE = true;
const NUM_SALTOS = 3;
let usarAzul = true;

const FOTO_POR_DEFECTO = "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&auto=format&fit=crop";
const NOMBRES_MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DIAS_POR_MES  = [31,28,31,30,31,30,31,31,30,31,30,31];
const CLAVE_ALARMAS = "alarmas";

const PALABRAS_TIEMPO = [
  "lunes","martes","miércoles","miercoles","jueves","viernes","sábado","sabado","domingo",
  "hoy","mañana","manana","pasado","semana","mes","año",
  "enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre",
  "a las","por la","de la mañana","de la tarde","de la noche","dentro de",
  "recuérdame","recuerdame","avísame","avisame","no olvides","ponme","pon una",
  "alarma","recordatorio","apuntame","apúntame","recuerda","avisa","pasado mañana","pasado manana"
];

// ─── KV ───────────────────────────────────────────────────────────────────────
async function leerAlarmas(env) {
  const data = await env.ALARMAS_KV.get(CLAVE_ALARMAS, { type: "json" });
  return Array.isArray(data) ? data : [];
}
async function guardarAlarmas(env, alarmas) {
  await env.ALARMAS_KV.put(CLAVE_ALARMAS, JSON.stringify(alarmas));
}

// ─── HORA POR DEFECTO ─────────────────────────────────────────────────────────
function horaDefectoPorNota(nota) {
  const n = nota.toLowerCase();
  if (/despertar|levantarse|desayuno/.test(n))                                                                                           return { hora: "08", minuto: "00" };
  if (/médico|medico|dentista|fisio|reunión|reunion|trabajo|clase|examen|banco|gestoría|gestoria|itv|revisión|revision|entrevista|notario/.test(n)) return { hora: "09", minuto: "00" };
  if (/almuerzo|comida/.test(n))                                                                                                          return { hora: "12", minuto: "00" };
  if (/siesta/.test(n))                                                                                                                   return { hora: "14", minuto: "00" };
  if (/merienda|colegio|cole|recoger/.test(n))                                                                                           return { hora: "17", minuto: "00" };
  if (/gimnasio|gym|ejercicio|entrenar|yoga|pilates|padel|pádel|tenis|fútbol|futbol|deporte|crossfit|natación|natacion|boxeo/.test(n))   return { hora: "19", minuto: "00" };
  if (/pasear|supermercado/.test(n))                                                                                                      return { hora: "20", minuto: "00" };
  if (/cena|restaurante|concierto|teatro|cine/.test(n))                                                                                   return { hora: "21", minuto: "00" };
  return { hora: "10", minuto: "00" };
}

function escapeHTML(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── TRADUCCIÓN ───────────────────────────────────────────────────────────────
async function traducirAlIngles(texto) {
  try {
    const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(texto)}&langpair=es|en`);
    const json = await res.json();
    const t = json?.responseData?.translatedText || "";
    if (t && !t.toUpperCase().includes("MYMEMORY WARNING")) return t;
  } catch (e) { console.warn("MyMemory falló:", e); }
  return texto.toLowerCase().split(/\s+/).map(p => DICCIONARIO.get(p) || p).join(" ");
}

// ─── PEXELS ───────────────────────────────────────────────────────────────────
async function buscarFotoPexels(terminoIngles, apiKey) {
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(terminoIngles)}&per_page=1&orientation=square`,
      { headers: { Authorization: apiKey } }
    );
    return (await res.json())?.photos?.[0]?.src?.large || null;
  } catch (e) { return null; }
}


// ─── 🆕 IA MEJORADA ───────────────────────────────────────────────────────────
async function interpretarAlarmaConIA(texto, ai) {
  const ahora = new Date(new Date().toLocaleString("en-US", { timeZone: "Atlantic/Canary" }));
  const hoy = `${ahora.getDate()} de ${NOMBRES_MESES[ahora.getMonth()]} de ${ahora.getFullYear()}`;
  const diaSemanaHoy = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"][ahora.getDay()];
  const horaActual = ahora.getHours();
  const minutoActual = ahora.getMinutes();
  const mananaDate = new Date(ahora.getTime() + 86400000);
  const mananaNum = mananaDate.getDate();
  const manananMes = NOMBRES_MESES[mananaDate.getMonth()];
  const mananasMes = mananaDate.getMonth() + 1;
  const pasadoMananaDate = new Date(ahora.getTime() + 2 * 86400000);
  const pasadoMananaNum = pasadoMananaDate.getDate();
  const pasadoManananMes = NOMBRES_MESES[pasadoMananaDate.getMonth()];
  const pasadoMananasMes = pasadoMananaDate.getMonth() + 1;

  // 🆕 PROMPT MEJORADO: Más conciso con ejemplos
  const systemPrompt = `Eres asistente de alarmas. Extrae datos de recordatorios en español.
HOY: ${diaSemanaHoy} ${hoy}, ${String(horaActual).padStart(2,'0')}:${String(minutoActual).padStart(2,'0')}
Mañana: ${mananaNum} de ${manananMes}
Pasado mañana: ${pasadoMananaNum} de ${pasadoManananMes}

RESPONDE SOLO JSON VÁLIDO, SIN MARKDOWN NI EXPLICACIONES.

⚠️ CRÍTICO - DISTINGUIR HORAS vs MINUTOS:

CASO 1: "a las X y Y" donde Y > 23
→ X:Y = hora y minutos (UNA sola alarma)
Ejemplo: "a las 10 y 45" → hora 10:45

CASO 2: "a las X y Y" donde Y ≤ 23
→ DOS alarmas diferentes a las X:00 y Y:00
Ejemplo: "a las 2 y 3" → alarma 02:00 Y alarma 03:00

CASO 3: Ya viene como "X:Y"
→ Una sola alarma a esa hora
Ejemplo: "a las 10:12" → hora 10:12

EJEMPLOS:
"avísame de madrugada a las 3 y 5"
→ {"esAlarma":true,"multiple":true,"alarmas":[{"nota":"recordatorio","tipo":"unica","diaMes":${mananaNum},"mes":${mananasMes},"hora":"03","minuto":"00"},{"nota":"recordatorio","tipo":"unica","diaMes":${mananaNum},"mes":${mananasMes},"hora":"05","minuto":"00"}]}

"avísame hoy 7 y medio de la tarde"
→ {"esAlarma":true,"nota":"avísame","tipo":"unica","diaMes":${ahora.getDate()},"mes":${ahora.getMonth()+1},"hora":"19","minuto":"30"}

"hoy 7 y cuarto de la tarde"
→ {"esAlarma":true,"nota":"recordatorio","tipo":"unica","diaMes":${ahora.getDate()},"mes":${ahora.getMonth()+1},"hora":"19","minuto":"15"}

"mañana a las 10 y 12 reunión"
→ {"esAlarma":true,"nota":"reunión","tipo":"unica","diaMes":${mananaNum},"mes":${mananasMes},"hora":"10","minuto":"12"}

"mañana a las 10 y 12 y pasado mañana a las 12 y 15"
→ {"esAlarma":true,"multiple":true,"alarmas":[{"nota":"reunión","tipo":"unica","diaMes":${mananaNum},"mes":${mananasMes},"hora":"10","minuto":"12"},{"nota":"reunión","tipo":"unica","diaMes":${pasadoMananaNum},"mes":${pasadoMananasMes},"hora":"12","minuto":"15"}]}

"recuérdame mañana a las 10 comprar pan"
→ {"esAlarma":true,"nota":"comprar pan","tipo":"unica","diaMes":${mananaNum},"mes":${mananasMes},"hora":"10","minuto":"00"}

"todos los lunes a las 8 gimnasio"
→ {"esAlarma":true,"nota":"gimnasio","tipo":"semanal","diaSemana":1,"hora":"08","minuto":"00"}

"el 5 y el 6 de julio despertador a las 7"
→ {"esAlarma":true,"multiple":true,"alarmas":[{"nota":"despertador","tipo":"unica","diaMes":5,"mes":7,"hora":"07","minuto":"00"},{"nota":"despertador","tipo":"unica","diaMes":6,"mes":7,"hora":"07","minuto":"00"}]}

"el 1 de julio a las 11 y el día antes a las 8"
→ {"esAlarma":true,"multiple":true,"alarmas":[{"nota":"recordatorio","tipo":"unica","diaMes":1,"mes":7,"hora":"11","minuto":"00"},{"nota":"recordatorio","tipo":"unica","diaMes":1,"mes":7,"diasAntes":1,"hora":"08","minuto":"00"}]}

"tengo boda dentro de 10 o 12 días, ponme alarma unos días antes"
→ {"esAlarma":true,"nota":"boda","tipo":"unica","diaMes":2,"mes":7,"diasAntes":-1,"diasAntesMin":3,"diasAntesMax":5,"hora":"10","minuto":"00"}

REGLAS HORA:
- Sin hora → contexto: médico/reunión→09:00, comida→12:00, gym→19:00, cena→21:00, defecto→10:00
- "a las X y Y" donde Y≤59 → X:Y (hora y minutos)
- "X y medio/media" SIN "a las" → X:30 (ej: "7 y medio" = 07:30 o 19:30 según contexto)
- "X y cuarto" SIN "a las" → X:15 (ej: "7 y cuarto" = 07:15 o 19:15 según contexto)
- "de la tarde" = +12 horas si hora < 12 (ej: "7 de la tarde" = 19:00)
- "de la mañana" = hora literal (ej: "7 de la mañana" = 07:00)
- "de la noche" = +12 horas si hora < 12 (ej: "10 de la noche" = 22:00)

REGLAS FECHA:
- "mañana" → ${mananaNum}/${mananasMes}
- "pasado mañana" → ${pasadoMananaNum}/${pasadoMananasMes}
- "esta madrugada", "de madrugada", "la madrugada" → si ahora es después de las 6 AM, significa mañana; si es antes de las 6 AM, significa hoy
- "hoy" → ${ahora.getDate()}/${ahora.getMonth()+1}
- "dentro de X días" → calcular fecha sumando X días a hoy
- "dentro de X o Y días" → usar diasAntesMin:X, diasAntesMax:Y, diasAntes:-1 (código elegirá aleatorio)
- "el día antes" → usa diasAntes:1
- "unos días antes" → usa diasAntesMin:3, diasAntesMax:5, diasAntes:-1 (aleatorio 3-5 días)
- "varios días antes" → usa diasAntesMin:5, diasAntesMax:7, diasAntes:-1 (aleatorio 5-7 días)
- Múltiples fechas → {"esAlarma":true,"multiple":true,"alarmas":[...]}

FORMATO:
Única: {"esAlarma":true,"nota":"...","tipo":"unica","diaMes":N,"mes":N,"hora":"HH","minuto":"MM"}
Semanal: {"esAlarma":true,"nota":"...","tipo":"semanal","diaSemana":N,"hora":"HH","minuto":"MM"}
Múltiple: {"esAlarma":true,"multiple":true,"alarmas":[...]}
Con días antes: {"esAlarma":true,"nota":"...","tipo":"unica","diaMes":N,"mes":N,"diasAntes":1,"hora":"HH","minuto":"MM"}
No alarma: {"esAlarma":false}`;

  try {
    const response = await ai.run("@cf/meta/llama-3.1-8b-instruct-fp8", {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: texto }
      ],
      max_tokens: 500,
      temperature: 0.3  // 🆕 Aumentado de 0.1 a 0.3 para más flexibilidad
    });

    const rawText = response?.response || "";
    console.log("🤖 IA RAW:", rawText);  // 🆕 Log para debugging
    
    // 🆕 Mejor extracción de JSON: busca ```json o {...}
    let match = rawText.match(/```json\s*([\s\S]*?)\s*```/);
    if (!match) {
      match = rawText.match(/\{[\s\S]*\}/);
    }
    
    if (!match) {
      console.error("❌ No se encontró JSON en respuesta IA");
      throw new Error("Sin JSON");
    }
    
    const jsonStr = match[1] || match[0];
    console.log("📦 JSON extraído:", jsonStr);  // 🆕 Log
    
    const parsed = JSON.parse(jsonStr);
    
    if (typeof parsed.esAlarma !== "boolean") throw new Error("esAlarma inválido");

    if (parsed.esAlarma && !parsed.multiple) {
      if (!parsed.nota) parsed.nota = "Recordatorio";
      if (!parsed.hora || !parsed.minuto) throw new Error("Falta hora");
      parsed.hora   = String(parseInt(parsed.hora)).padStart(2,'0');
      parsed.minuto = String(parseInt(parsed.minuto)).padStart(2,'0');
      if (parsed.tipo === "unica"   && (!parsed.diaMes || !parsed.mes)) throw new Error("Falta fecha");
      if (parsed.tipo === "semanal" && parsed.diaSemana === undefined)   throw new Error("Falta diaSemana");

      // Procesar diasAntes
      if (parsed.diasAntes !== undefined && parsed.tipo === "unica") {
        let diasARestar = parseInt(parsed.diasAntes);
        if (diasARestar === -1 && parsed.diasAntesMin !== undefined && parsed.diasAntesMax !== undefined) {
          const min = parseInt(parsed.diasAntesMin);
          const max = parseInt(parsed.diasAntesMax);
          diasARestar = Math.floor(Math.random() * (max - min + 1)) + min;
        }
        if (diasARestar > 0) {
          const fechaEvento = new Date(ahora.getFullYear(), parsed.mes - 1, parsed.diaMes);
          fechaEvento.setDate(fechaEvento.getDate() - diasARestar);
          parsed.diaMes = fechaEvento.getDate();
          parsed.mes    = fechaEvento.getMonth() + 1;
        }
      }
    }

    // Validar alarmas múltiples
    if (parsed.esAlarma && parsed.multiple && Array.isArray(parsed.alarmas)) {
      for (const a of parsed.alarmas) {
        if (!a.nota) a.nota = "Recordatorio";
        a.hora   = String(parseInt(a.hora)).padStart(2,'0');
        a.minuto = String(parseInt(a.minuto)).padStart(2,'0');
        
        // 🆕 Procesar diasAntes para cada alarma en caso múltiple
        if (a.diasAntes !== undefined && a.tipo === "unica") {
          let diasARestar = parseInt(a.diasAntes);
          if (diasARestar === -1 && a.diasAntesMin !== undefined && a.diasAntesMax !== undefined) {
            const min = parseInt(a.diasAntesMin);
            const max = parseInt(a.diasAntesMax);
            diasARestar = Math.floor(Math.random() * (max - min + 1)) + min;
          }
          if (diasARestar > 0) {
            const fechaEvento = new Date(ahora.getFullYear(), a.mes - 1, a.diaMes);
            fechaEvento.setDate(fechaEvento.getDate() - diasARestar);
            a.diaMes = fechaEvento.getDate();
            a.mes    = fechaEvento.getMonth() + 1;
          }
        }
      }
    }

    console.log("✅ IA procesada correctamente:", JSON.stringify(parsed));  // 🆕 Log
    return parsed;
  } catch (e) {
    console.error("💥 Error IA:", e.message);  // 🆕 Mejor log de error
    return null;
  }
}

// ─── AMBIGÜEDAD MAÑANA ────────────────────────────────────────────────────────
function detectarAmbiguedadManana(texto, ahora) {
  if (ahora.getHours() >= 6) return false;
  const sinHora = texto.toLowerCase()
    .replace(/de la ma[ñn]ana/g, '')
    .replace(/por la ma[ñn]ana/g, '')
    .replace(/a la ma[ñn]ana/g, '');
  return sinHora.includes('mañana') || sinHora.includes('manana') ||
         sinHora.includes('mñn')    || sinHora.includes('mñana')  ||
         sinHora.includes('mannana')|| sinHora.includes('maiana') ||
         sinHora.includes('maniana')|| sinHora.includes('mnaña');
}

// ─── REGEX: tiempos relativos ─────────────────────────────────────────────────
// ─── 🆕 FRANJA HORARIA (AM/PM) ────────────────────────────────────────────────
// Decide si una hora explícita (1-11) es clara o ambigua.
// - Con marcador "de la tarde/noche" → PM (suma 12)
// - Con marcador "de la mañana/madrugada" o contexto de mañana → AM literal
// - Sin marcador → ambigua: el bot debe preguntar
function resolverFranjaHoraria(h, marcadores, nota) {
  const esTarde   = /(de|por)\s+la\s+tarde|(de|por)\s+la\s+noche|\bp\.?\s?m\.?\b/i.test(marcadores);
  const esManana  = /(de|por)\s+la\s+ma[ñn]ana|madrugada|\ba\.?\s?m\.?\b/i.test(marcadores);
  const ctxManana = /despert|desayun|levantar|amanecer|misa/i.test(nota || "");

  if (h >= 1 && h <= 11) {
    if (esTarde)             return { hora: h + 12, ambigua: false };
    if (esManana || ctxManana) return { hora: h,    ambigua: false };
    return { hora: h, ambigua: true }; // sin pistas → preguntar
  }
  return { hora: h, ambigua: false }; // 0 y 12-23 no son ambiguas
}

function detectarTiempoRelativo(texto, textoOriginal) {
  // 🆕 Los marcadores am/pm se buscan en el texto ORIGINAL, porque la
  //    normalización ya convierte "9 de la mañana" → "09:00" (perdiendo el marcador).
  const original = (textoOriginal || texto).toLowerCase();
  const normalizado = texto.toLowerCase()
    .replace(/dentr[oa]\s*e\s+/g, 'dentro de ')
    .replace(/dento\s+de\s+/g,    'dentro de ')
    .replace(/dentrode\s+/g,       'dentro de ')
    // 🆕 Normalizar inglés → español
    .replace(/\bminutes?\b/g,      'minutos')
    .replace(/\bhours?\b/g,        'horas')
    .replace(/\bdays?\b/g,         'dias')
    .replace(/\bweeks?\b/g,        'semanas')
    // Abreviaciones comunes
    .replace(/\bmins?\b/g,         'minutos')
    .replace(/\bh\b/g,             'hora')
    .replace(/\bhrs?\b/g,          'horas');

  const ahora = new Date(new Date().toLocaleString("en-US", { timeZone: "Atlantic/Canary" }));
  let minutosASumar = null;
  let diasASumar    = null;

  if (/(?:en|dentro de|pasad[ao]s?)\s+media\s+hora/.test(normalizado)) {
    minutosASumar = 30;
  } else if (/(?:en|dentro de|pasad[ao]s?)\s+(\d+)\s+hora[s]?\s+y\s+media/.test(normalizado)) {
    const m = normalizado.match(/(?:en|dentro de|pasad[ao]s?)\s+(\d+)\s+hora[s]?\s+y\s+media/);
    minutosASumar = parseInt(m[1]) * 60 + 30;
  } else if (/(?:en|dentro de|pasad[ao]s?)\s+(\d+)\s+hora[s]?/.test(normalizado)) {
    const m = normalizado.match(/(?:en|dentro de|pasad[ao]s?)\s+(\d+)\s+hora[s]?/);
    minutosASumar = parseInt(m[1]) * 60;
  } else if (/(?:en|dentro de|pasad[ao]s?)\s+(\d+)\s+minutos?/.test(normalizado)) {
    const m = normalizado.match(/(?:en|dentro de|pasad[ao]s?)\s+(\d+)\s+minutos?/);
    minutosASumar = parseInt(m[1]);
  } else if (/(?:en|dentro de|pasad[ao]s?)\s+(\d+)\s+o\s+(\d+)\s+d[ií]as?/.test(normalizado)) {
    const m = normalizado.match(/(?:en|dentro de|pasad[ao]s?)\s+(\d+)\s+o\s+(\d+)\s+d[ií]as?/);
    const min = parseInt(m[1]), max = parseInt(m[2]);
    diasASumar = Math.floor(Math.random() * (max - min + 1)) + min;
  } else if (/(?:en|dentro de|pasad[ao]s?)\s+un\s+par\s+de\s+d[ií]as?/.test(normalizado)) {
    diasASumar = 2;
  } else if (/(?:en|dentro de|pasad[ao]s?)\s+unos\s+d[ií]as?/.test(normalizado)) {
    diasASumar = 3;
  } else if (/(?:en|dentro de|pasad[ao]s?)\s+(\d+)\s+d[ií]as?/.test(normalizado)) {
    const m = normalizado.match(/(?:en|dentro de|pasad[ao]s?)\s+(\d+)\s+d[ií]as?/);
    diasASumar = parseInt(m[1]);
  } else if (/(?:en|dentro de|pasad[ao]s?)\s+dos\s+semanas?/.test(normalizado)) {
    diasASumar = 14;
  } else if (/(?:en|dentro de|pasad[ao]s?)\s+tres\s+semanas?/.test(normalizado)) {
    diasASumar = 21;
  } else if (/(?:en|dentro de|pasad[ao]s?)\s+una\s+semana/.test(normalizado)) {
    diasASumar = 7;
  } else if (/(?:en|dentro de|pasad[ao]s?)\s+(\d+)\s+semanas?/.test(normalizado)) {
    const m = normalizado.match(/(?:en|dentro de|pasad[ao]s?)\s+(\d+)\s+semanas?/);
    diasASumar = parseInt(m[1]) * 7;

  // ── "mañana y pasado mañana" — múltiples fechas ─────────────────────────
  } else if (/\bma[ñn]ana\b/.test(normalizado) && /pasado\s+ma[ñn]ana/.test(normalizado)) {
    // 🆕 Verificar si tiene múltiples horas diferentes (ej: "las 10 y 12... a las 12")
    const horasEnTexto = texto.match(/\d{1,2}(?:[:：]\d{2})?/g) || [];
    if (horasEnTexto.length > 2) {
      // Caso complejo con múltiples horas → delegar a IA
      return null;
    }
    
    // Caso especial: contiene AMBAS → devolver múltiple
    const matchHoraMulti = texto.match(/a\s+las\s+(\d{1,2})(?:[:：](\d{2})|\s+y\s+(media|cuarto))?/i);
    let horaM = "11", minutoM = "00";
    if (matchHoraMulti) {
      horaM = String(parseInt(matchHoraMulti[1])).padStart(2,'0');
      if (matchHoraMulti[2]) {
        minutoM = matchHoraMulti[2];
      } else if (matchHoraMulti[3] === 'media') {
        minutoM = "30";
      } else if (matchHoraMulti[3] === 'cuarto') {
        minutoM = "15";
      }
    }
    const ahora2 = new Date(new Date().toLocaleString("en-US", { timeZone: "Atlantic/Canary" }));
    const manana2 = new Date(ahora2.getTime() + 86400000);
    const pasado2 = new Date(ahora2.getTime() + 2 * 86400000);
    const notaM = texto
      .replace(/(?:pasado\s+)?ma[ñn]ana/gi,'').replace(/hoy/gi,'')
      .replace(/a\s+las\s+\d{1,2}(?:[:：]\d{2}|\s+y\s+(?:media|cuarto))?/gi,'')
      .replace(/alarma/gi,'').replace(/pon(?:me|e)?/gi,'')
      .replace(/recuerd[ao]me/gi,'').replace(/av[ií]same/gi,'')
      .replace(/^[,\s]+|[,\s]+$/g,'').trim() || "Recordatorio";
    return {
      esMultiple: true,
      fechas: [
        { diaMes: manana2.getDate(), mes: manana2.getMonth()+1, hora: horaM, minuto: minutoM, nota: notaM },
        { diaMes: pasado2.getDate(), mes: pasado2.getMonth()+1, hora: horaM, minuto: minutoM, nota: notaM }
      ]
    };

  // ── "mañana" y "pasado mañana" individuales ───────────────────────────────
  } else if (/pasado\s+ma[ñn]ana/.test(normalizado)) {
    diasASumar = 2;
  } else if (/\bma[ñn]ana\b/.test(normalizado) && !/de la ma[ñn]ana|por la ma[ñn]ana/.test(normalizado)) {
    diasASumar = 1;
  // ── "esta madrugada" ──────────────────────────────────────────────────────
  } else if (/esta\s+madrugada|de\s+madrugada|la\s+madrugada|en\s+la\s+madrugada/.test(normalizado)) {
    // Si ahora son más de las 6 AM, "madrugada" = mañana de madrugada
    // Si son menos de las 6 AM, "madrugada" = hoy (aún estamos en madrugada)
    diasASumar = ahora.getHours() >= 6 ? 1 : 0;
  // ── "hoy" con hora explícita ──────────────────────────────────────────────
  } else if (/\bhoy\b/.test(normalizado)) {
    diasASumar = 0;
  // ── 🆕 Día de la semana por nombre (ej: "el lunes a las 4 y 37") ───────────
  //    Se excluye "todos los"/"cada" para que las alarmas semanales las maneje la IA.
  } else if (/\b(lunes|martes|mi[eé]rcoles|miercoles|jueves|viernes|s[aá]bado|sabado|domingo)\b/.test(normalizado)
             && !/todos\s+los|todas\s+las|cada\b/.test(normalizado)) {
    const mapaDias = { domingo:0, lunes:1, martes:2, "miércoles":3, miercoles:3, jueves:4, viernes:5, "sábado":6, sabado:6 };
    const md = normalizado.match(/\b(lunes|martes|mi[eé]rcoles|miercoles|jueves|viernes|s[aá]bado|sabado|domingo)\b/);
    const objetivo = mapaDias[md[1]];
    let diff = (objetivo - ahora.getDay() + 7) % 7;
    if (diff === 0) diff = 7; // si hoy es ese día, se entiende el de la próxima semana
    diasASumar = diff;
  }

  if (minutosASumar === null && diasASumar === null) return null;

  let hora, minuto, dia, mes;

  if (minutosASumar !== null) {
    const obj = new Date(ahora.getTime() + minutosASumar * 60000);
    hora   = String(obj.getHours()).padStart(2,'0');
    minuto = String(obj.getMinutes()).padStart(2,'0');
    dia    = obj.getDate();
    mes    = obj.getMonth() + 1;
  } else {
    const obj = new Date(ahora.getTime() + diasASumar * 86400000);
    dia    = obj.getDate();
    mes    = obj.getMonth() + 1;
    hora   = null;
    minuto = "00";
  }

  // Extraer hora explícita del texto
  const matchHHMM  = texto.match(/(\d{1,2}):(\d{2})/);
  const matchAlasX = texto.match(/a\s+las\s+(\d{1,2})(?:\s+y\s+(media|cuarto|(\d{1,2})))?/i);

  let horaExplicita = false;
  if (matchHHMM) {
    hora   = String(parseInt(matchHHMM[1])).padStart(2,'0');
    minuto = matchHHMM[2];
    horaExplicita = true;
  } else if (matchAlasX) {
    hora = String(parseInt(matchAlasX[1])).padStart(2,'0');
    if (!matchAlasX[2]) {
      minuto = "00";
    } else if (matchAlasX[2] === 'media') {
      minuto = "30";
    } else if (matchAlasX[2] === 'cuarto') {
      minuto = "15";
    } else if (matchAlasX[3]) {
      minuto = String(parseInt(matchAlasX[3])).padStart(2,'0');
    }
    horaExplicita = true;
  }

  // 🆕 Nota explícita: si el usuario dice "nota ..." o "nota: ...", usar lo que sigue
  let notaExplicita = null;
  const matchNota = texto.match(/\bnota\b\s*[:\-]?\s*(.+)$/i);
  if (matchNota && matchNota[1].trim()) {
    notaExplicita = matchNota[1].replace(/[.\s]+$/, '').trim();
  }

  // Nota limpia
  const notaLimpia = texto
    .replace(/\bnota\b\s*[:\-]?\s*.*$/i, '')          // 🆕 quitar "nota ..." del final
    .replace(/(?:dentr[oa]\s*e?\s+|dento\s+de\s+|en\s+|pasad[ao]s?\s+)\s*(?:un\s+par\s+de\s+|unos\s+|\d+\s+o\s+\d+\s+|una\s+|dos\s+|tres\s+|\d+\s+)?(?:media\s+hora|hora[s]?\s+y\s+media|hora[s]?|hours?|minutos?|minutes?|min[s]?|d[ií]as?|days?|semanas?|weeks?)/gi, '')
    .replace(/(?:pasado\s+)?ma[ñn]ana/gi, '')
    .replace(/hoy/gi, '')
    .replace(/\b(lunes|martes|mi[eé]rcoles|miercoles|jueves|viernes|s[aá]bado|sabado|domingo)\b/gi, '') // 🆕 día de la semana
    .replace(/a\s+las\s+\d{1,2}(?:[:：]\d{2}|\s+y\s+(?:media|cuarto|\d{1,2}))?/gi, '')
    .replace(/quiero\s+que/gi, '')                     // 🆕
    .replace(/\b(me\s+)?av[ií]s\w*/gi, '')             // 🆕 avísame/avises/avisa
    .replace(/alarma/gi, '')
    .replace(/pon(?:me|e)?/gi, '')
    .replace(/recu[eé]rd[ao]me/gi, '')                 // 🆕 recuérdame/recuerdame
    .replace(/av[ií]same/gi, '')
    .replace(/despertador/gi, 'Despertador')
    .replace(/\d+\s+de\s+[a-záéíóúñ]+/gi, '')
    .replace(/\b(de\s+)?(la\s+)?(madrugada|ma[ñn]ana|tarde|noche)\b/gi, '') // 🆕 restos de franja
    .replace(/\bde\s+de\b/gi, '')                      // 🆕 "de de"
    .replace(/\ba\s+las\b/gi, '')                       // 🆕 restos de "a las"
    .replace(/\s{2,}/g, ' ')                            // 🆕 colapsar espacios
    .replace(/^[,\s]+|[,\s]+$/g, '')
    .replace(/^(el|la|los|las|al)\s+/i, '')            // 🆕 artículo inicial sobrante
    .trim() || "Recordatorio";

  const notaFinal = notaExplicita || notaLimpia;

  // 🆕 Resolver franja horaria (am/pm) cuando la hora es explícita
  let ambiguaFranja = false;
  if (horaExplicita && hora !== null) {
    const fr = resolverFranjaHoraria(parseInt(hora), original, notaFinal);
    hora = String(fr.hora).padStart(2, '0');
    ambiguaFranja = fr.ambigua;
  }

  if (hora === null) {
    const def = horaDefectoPorNota(notaFinal);
    hora   = def.hora;
    minuto = def.minuto;
  }

  return { hora, minuto, diaMes: dia, mes, nota: notaFinal, ambiguaFranja };
}

function pareceTenerIntencionDeTiempo(texto) {
  const t = texto.toLowerCase();
  return PALABRAS_TIEMPO.some(p => t.includes(p));
}


// ─── ENVÍO ────────────────────────────────────────────────────────────────────
async function enviarFotoPorUrl(token, chatId, fotoUrl, caption) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, photo: fotoUrl, caption, parse_mode: 'HTML' })
  });
  return (await res.json()).ok;
}

async function enviarTextoSimple(token, chatId, texto) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: texto, parse_mode: 'HTML' })
  });
  return (await res.json()).ok;
}

async function enviarAlarma(token, chatId, alarma, textoAlarma) {
  if (alarma.fotoUrl && alarma.fotoUrl !== FOTO_POR_DEFECTO) {
    if (await enviarFotoPorUrl(token, chatId, alarma.fotoUrl, textoAlarma)) return true;
  }
  if (await enviarFotoPorUrl(token, chatId, FOTO_POR_DEFECTO, textoAlarma)) return true;
  return await enviarTextoSimple(token, chatId, textoAlarma);
}

// ─── 🆕 CUENTA ATRÁS ──────────────────────────────────────────────────────────
// Devuelve un texto tipo "⏳ Faltan 2 días, 5 horas y 10 minutos" calculando el
// tiempo restante hasta que suene la alarma (zona horaria Atlantic/Canary).
function calcularCuentaAtras(alarma) {
  const ahora = new Date(new Date().toLocaleString("en-US", { timeZone: "Atlantic/Canary" }));
  const hh = parseInt(alarma.hora);
  const mm = parseInt(alarma.minuto);
  let target;

  if (alarma.tipo === "semanal") {
    const diaObjetivo = Number(alarma.diaSemana);
    target = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), hh, mm, 0, 0);
    let diff = (diaObjetivo - ahora.getDay() + 7) % 7;
    if (diff === 0 && target.getTime() <= ahora.getTime()) diff = 7; // hoy pero ya pasó → próxima semana
    target.setDate(target.getDate() + diff);
  } else {
    target = new Date(ahora.getFullYear(), Number(alarma.mes) - 1, Number(alarma.diaMes), hh, mm, 0, 0);
    if (target.getTime() < ahora.getTime()) target.setFullYear(target.getFullYear() + 1); // ya pasó este año
  }

  let ms = target.getTime() - ahora.getTime();
  if (ms < 0) ms = 0;

  const totalMin = Math.round(ms / 60000);
  const dias    = Math.floor(totalMin / 1440);
  const horas   = Math.floor((totalMin % 1440) / 60);
  const minutos = totalMin % 60;

  const partes = [];
  if (dias > 0)    partes.push(`${dias} ${dias === 1 ? "día" : "días"}`);
  if (horas > 0)   partes.push(`${horas} ${horas === 1 ? "hora" : "horas"}`);
  if (minutos > 0) partes.push(`${minutos} ${minutos === 1 ? "minuto" : "minutos"}`);

  if (partes.length === 0) return "⏳ <b>Suena en menos de 1 minuto</b>";

  let texto;
  if (partes.length === 1)      texto = partes[0];
  else if (partes.length === 2) texto = `${partes[0]} y ${partes[1]}`;
  else                          texto = `${partes[0]}, ${partes[1]} y ${partes[2]}`;

  return `⏳ <b>Faltan ${texto}</b>`;
}

// ─── GUARDAR ALARMA DESDE IA ──────────────────────────────────────────────────
async function guardarAlarmaDesdeIA(datos, env, chatId, msgId) {
  const alarmas = await leerAlarmas(env);
  const nombresDias = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];

  // Caso múltiples alarmas
  if (datos.multiple && Array.isArray(datos.alarmas)) {
    console.log("🔄 Guardando múltiples alarmas:", JSON.stringify(datos.alarmas)); // 🆕 Debug
    
    // 🆕 Para múltiples alarmas, buscar foto basada en la primera nota
    const ruido = ["el","la","los","las","un","una","de","del","al","para","con","en","por","y","o","mi","tu"];
    const notaParaFoto = datos.alarmas[0]?.nota || "recordatorio";
    const palabrasClave = notaParaFoto.toLowerCase().split(/\s+/).filter(p => !ruido.includes(p) && p.length > 2);
    const terminoIngles = await traducirAlIngles(palabrasClave.join(" ") || notaParaFoto);
    const fotoPexels = await buscarFotoPexels(terminoIngles, env.PEXELS_API_KEY);
    const fotoUrl = fotoPexels || FOTO_POR_DEFECTO;
    
    const nuevas = datos.alarmas.map(a => {
      const alarma = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
        tipo: a.tipo,
        hora: String(a.hora).padStart(2,'0'),      // 🆕 Asegurar formato
        minuto: String(a.minuto).padStart(2,'0'),  // 🆕 Asegurar formato
        nota: a.nota || datos.nota || "Recordatorio",
        fotoUrl,
        ultimaEnviada: "",
        ...(a.tipo === "unica" ? { diaMes: a.diaMes, mes: a.mes } : { diaSemana: a.diaSemana })
      };
      console.log("📦 Alarma creada:", JSON.stringify(alarma)); // 🆕 Debug
      return alarma;
    });
    
    alarmas.push(...nuevas);
    await guardarAlarmas(env, alarmas);
    
    console.log("✅ Total alarmas después de guardar:", alarmas.length); // 🆕 Debug

    // 🆕 Calcular día de la semana para cada alarma
    const resumen = nuevas.map(a => {
      const fecha = new Date(new Date().getFullYear(), a.mes - 1, a.diaMes);
      const diaSemana = nombresDias[fecha.getDay()].toLowerCase();
      return `📅 <b>El ${diaSemana} ${a.diaMes} de ${NOMBRES_MESES[a.mes - 1]}</b> a las <b>${a.hora}:${a.minuto}</b>\n${calcularCuentaAtras(a)}`;
    }).join('\n\n');
    
    // 🆕 Botones para editar cada alarma
    const botones = nuevas.map(a => [{ 
      text: `✏️ Editar "${a.nota.substring(0, 20)}${a.nota.length > 20 ? '...' : ''}"`, 
      callback_data: `editar_desc:${a.id}` 
    }]);
    
    await sendTextConBotones(env.TELEGRAM_TOKEN, chatId,
      `✅ <b>¡${nuevas.length} alarmas guardadas!</b>\n\n${resumen}\n📝 <i>${escapeHTML(nuevas[0].nota)}</i>`,
      botones
    );
    return;
  }

  // Caso alarma única
  const ruido = ["el","la","los","las","un","una","de","del","al","para","con","en","por","y","o","mi","tu"];
  const palabrasClave = datos.nota.toLowerCase().split(/\s+/).filter(p => !ruido.includes(p) && p.length > 2);
  const terminoIngles = await traducirAlIngles(palabrasClave.join(" ") || datos.nota);
  const fotoPexels = await buscarFotoPexels(terminoIngles, env.PEXELS_API_KEY);
  const fotoUrl = fotoPexels || FOTO_POR_DEFECTO;

  const id = Date.now().toString();
  const alarma = {
    id, tipo: datos.tipo, hora: datos.hora, minuto: datos.minuto,
    nota: datos.nota, fotoUrl, ultimaEnviada: "",
    ...(datos.tipo === "unica"
      ? { diaMes: datos.diaMes, mes: datos.mes }
      : { diaSemana: datos.diaSemana })
  };
  alarmas.push(alarma);
  await guardarAlarmas(env, alarmas);

  let fechaTxt = "";
  if (datos.tipo === "semanal") {
    fechaTxt = `🔄 Todos los <b>${nombresDias[Number(datos.diaSemana)]}</b>`;
  } else {
    // 🆕 Agregar día de la semana
    const fecha = new Date(new Date().getFullYear(), datos.mes - 1, datos.diaMes);
    const diaSemana = nombresDias[fecha.getDay()].toLowerCase();
    fechaTxt = `📅 El <b>${diaSemana} ${datos.diaMes} de ${NOMBRES_MESES[Number(datos.mes) - 1]}</b>`;
  }
  
  // 🆕 Agregar botón de editar descripción
  const botones = [[{ text: "✏️ Editar descripción", callback_data: `editar_desc:${alarma.id}` }]];
  
  await sendTextConBotones(env.TELEGRAM_TOKEN, chatId,
    `✅ <b>¡Alarma guardada!</b>\n\n${fechaTxt}\n⏰ <b>${alarma.hora}:${alarma.minuto}</b>\n${calcularCuentaAtras(alarma)}\n📝 <i>${escapeHTML(alarma.nota)}</i>`,
    botones
  );
}

// ─── PANELES ──────────────────────────────────────────────────────────────────
async function desplegarPanelMeses(token, chatId, messageId) {
  const filas = [];
  for (let i = 0; i < 12; i += 3) {
    const fila = [];
    for (let j = i; j < i + 3; j++) {
      fila.push({ text: `${NOMBRES_MESES[j]} (${j+1})`, callback_data: `set_mes:${j+1}` });
    }
    filas.push(fila);
  }
  filas.push([{ text: "↩️ Volver al menú", callback_data: "menu_principal" }]);
  await editMessage(token, chatId, messageId, "📅 <b>Alarma de Fecha Única</b>\n\nSelecciona el <b>mes</b>:", filas);
}

async function desplegarPanelDias(token, chatId, messageId, mes) {
  const totalDias = DIAS_POR_MES[mes - 1];
  const filas = [];
  for (let i = 1; i <= totalDias; i += 7) {
    const fila = [];
    for (let j = i; j < i + 7 && j <= totalDias; j++) fila.push({ text: `${j}`, callback_data: `set_dia:${j}` });
    filas.push(fila);
  }
  filas.push([{ text: "↩️ Cambiar mes", callback_data: "volver_a_mes" }]);
  await editMessage(token, chatId, messageId, `📅 Mes: <b>${NOMBRES_MESES[mes-1]}</b>\n\nSelecciona el <b>día</b>:`, filas);
}

async function desplegarPanelDiasSemana(token, chatId, messageId) {
  const ahora = new Date(new Date().toLocaleString("en-US", { timeZone: "Atlantic/Canary" }));
  const diasNombres = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];

  const proximosDias = [];
  for (let i = 1; i <= 7; i++) {
    const fecha = new Date(ahora.getTime() + i * 86400000);
    proximosDias.push({ diaSemana: fecha.getDay(), diaMes: fecha.getDate() });
  }
  const orden = [1,2,3,4,5,6,0];
  const diasOrdenados = orden.map(ds => proximosDias.find(d => d.diaSemana === ds));

  const filas = [];
  for (let i = 0; i < diasOrdenados.length; i += 2) {
    const fila = [];
    for (let j = i; j < i + 2 && j < diasOrdenados.length; j++) {
      const d = diasOrdenados[j];
      if (d) fila.push({ text: `${diasNombres[d.diaSemana]} ${d.diaMes}`, callback_data: `set_dia_sem:${d.diaSemana}` });
    }
    filas.push(fila);
  }
  filas.push([{ text: "↩️ Volver al menú", callback_data: "menu_principal" }]);
  await editMessage(token, chatId, messageId, "🔄 <b>Alarma Semanal</b>\nSelecciona el día (se repetirá cada semana):", filas);
}

async function desplegarPanelHoras(token, chatId, messageId, esCorrecion) {
  const botonesHoras = [];
  for (let i = 0; i < 24; i += 6) {
    const fila = [];
    for (let j = i; j < i + 6; j++) fila.push({ text: `${String(j).padStart(2,'0')}:00`, callback_data: `set_hora:${String(j).padStart(2,'0')}` });
    botonesHoras.push(fila);
  }
  botonesHoras.push([{ text: "↩️ Modificar Día/Fecha", callback_data: "volver_a_fecha" }]);
  await editMessage(token, chatId, messageId,
    esCorrecion ? "🔄 <b>Corrección:</b> Selecciona la <b>Hora</b>:" : "📅 Fecha registrada.\n\nSelecciona la <b>Hora</b> del aviso:",
    botonesHoras
  );
}

async function desplegarPanelDecenas(token, chatId, messageId, hora) {
  const horaSegura = (hora && hora !== "false") ? hora : "00";
  await editMessage(token, chatId, messageId,
    `⏰ Hora: <code>${horaSegura}:XX</code>\n\nSelecciona el bloque de <b>minutos</b>:`,
    [
      [{ text: ":00", callback_data: "decena:0" }, { text: ":10", callback_data: "decena:1" }, { text: ":20", callback_data: "decena:2" }],
      [{ text: ":30", callback_data: "decena:3" }, { text: ":40", callback_data: "decena:4" }, { text: ":50", callback_data: "decena:5" }],
      [{ text: `↩️ Corregir Hora (${horaSegura}:00)`, callback_data: "volver_a_hora" }]
    ]
  );
}

async function desplegarPanelNota(token, chatId, messageId) {
  const notasPredefinidas = [
    ["💊 Medicina", "🐱 Dar de comer al gato", "🐶 Pasear al perro"],
    ["🛒 Compras", "💪 Ejercicio", "🏥 Médico"],
    ["💈 Peluquería", "🦷 Dentista", "📦 Recoger paquete"],
    ["💡 Pagar factura", "🚗 Revisar coche", "🌱 Regar plantas"],
    ["📞 Llamada importante", "🏦 Banco", "🎂 Cumpleaños"],
  ];
  const filas = notasPredefinidas.map(fila =>
    fila.map(nota => ({ text: nota, callback_data: `nota:${nota}` }))
  );
  filas.push([{ text: "✏️ Escribir nota personalizada", callback_data: "nota_manual" }]);
  await editMessage(token, chatId, messageId, "✍️ <b>Selecciona o escribe la nota del recordatorio:</b>", filas);
}

// ─── 🎤 TRANSCRIPCIÓN CON ASSEMBLYAI ──────────────────────────────────────────
// Flujo AssemblyAI: 1) subir el audio  2) crear la transcripción  3) hacer polling
// hasta que el estado sea "completed". Devuelve el texto transcrito (o "" si falla).
async function transcribirConAssemblyAI(audioBuffer, apiKey) {
  const BASE = "https://api.assemblyai.com/v2";
  const headers = { authorization: apiKey };

  // 1) Subir el audio (cuerpo binario directo)
  const uploadRes = await fetch(`${BASE}/upload`, {
    method: "POST",
    headers,
    body: audioBuffer
  });
  if (!uploadRes.ok) {
    throw new Error(`AssemblyAI upload falló: ${uploadRes.status} ${await uploadRes.text()}`);
  }
  const { upload_url } = await uploadRes.json();
  if (!upload_url) throw new Error("AssemblyAI no devolvió upload_url");

  // 2) Crear la transcripción en español
  const createRes = await fetch(`${BASE}/transcript`, {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({
      audio_url: upload_url,
      language_code: "es",       // 🆕 Español
      punctuate: true,
      format_text: true
    })
  });
  if (!createRes.ok) {
    throw new Error(`AssemblyAI transcript falló: ${createRes.status} ${await createRes.text()}`);
  }
  const created = await createRes.json();
  const transcriptId = created.id;
  if (!transcriptId) throw new Error("AssemblyAI no devolvió id de transcripción");

  // 3) Polling hasta "completed" (máx ~55s para no exceder límites del Worker)
  const inicio = Date.now();
  const TIMEOUT_MS = 55000;
  const INTERVALO_MS = 2000;

  while (Date.now() - inicio < TIMEOUT_MS) {
    const pollRes = await fetch(`${BASE}/transcript/${transcriptId}`, { headers });
    if (!pollRes.ok) {
      throw new Error(`AssemblyAI polling falló: ${pollRes.status} ${await pollRes.text()}`);
    }
    const data = await pollRes.json();

    if (data.status === "completed") {
      return (data.text || "").trim();
    }
    if (data.status === "error") {
      throw new Error(`AssemblyAI error: ${data.error}`);
    }
    // status "queued" o "processing" → esperar y reintentar
    await new Promise(r => setTimeout(r, INTERVALO_MS));
  }

  throw new Error("AssemblyAI: tiempo de espera agotado (timeout)");
}

// ─── EXPORT DEFAULT ───────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/set_webhook') {
      const webhookUrl = url.origin + '/';
      const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl })
      });
      return new Response(await res.text(), { headers: { 'Content-Type': 'application/json' } });
    }
    if (request.method === 'POST') {
      try {
        const update = await request.json();
        if (update.callback_query) await handleCallback(update.callback_query, env);
        else if (update.message)   await processMessage(update.message, env);
      } catch (err) {
        console.error("Error global:", err);
      }
      return new Response('OK');
    }
    return new Response('🤖 Bot de Control Total Activo.');
  },

  async scheduled(event, env, ctx) {
    const ahora = new Date(new Date().toLocaleString("en-US", { timeZone: "Atlantic/Canary" }));
    const diaSemanaActual = ahora.getDay();
    const diaMesActual    = ahora.getDate();
    const mesActual       = ahora.getMonth() + 1;
    const horaActual      = ahora.getHours();
    const minutosActuales = ahora.getMinutes();

    const alarmas = await leerAlarmas(env);
    let huboCambios = false;

    for (const alarma of alarmas) {
      if (horaActual !== parseInt(alarma.hora) || minutosActuales !== parseInt(alarma.minuto)) continue;
      let debeSonar = false;
      if (alarma.tipo === "semanal") debeSonar = (diaSemanaActual === parseInt(alarma.diaSemana));
      else if (alarma.tipo === "unica") debeSonar = (diaMesActual === parseInt(alarma.diaMes) && mesActual === parseInt(alarma.mes));
      if (!debeSonar) continue;
      const hoyStr = `${ahora.toDateString()}_${horaActual}_${alarma.minuto}`;
      if (alarma.ultimaEnviada === hoyStr) continue;

      let textoAlarma = "";
      if (SALTO_GRANDE) textoAlarma += "⠀\n".repeat(NUM_SALTOS);
      textoAlarma += `⏰ <b>RECORDATORIO</b> ⏰\n📝 <i>${escapeHTML(alarma.nota)}</i>`;
      if (alarma.tipo === "semanal") textoAlarma += `\n\n🔄 <i>(Aviso semanal)</i>`;

      const enviado = await enviarAlarma(env.TELEGRAM_TOKEN, env.MY_TELEGRAM_ID, alarma, textoAlarma);
      if (enviado) { alarma.ultimaEnviada = hoyStr; huboCambios = true; }
    }

    if (huboCambios) {
      const hoyStr = `${ahora.toDateString()}_${horaActual}_${minutosActuales}`;
      await guardarAlarmas(env, alarmas.filter(a => !(a.tipo === "unica" && a.ultimaEnviada === hoyStr)));
    }
  }
};


// ─── CALLBACKS ────────────────────────────────────────────────────────────────
async function handleCallback(cb, env) {
  const chatId    = cb.message.chat.id;
  const messageId = cb.message.message_id;
  const data      = cb.data;
  const nombresDias = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];

  if (data === "menu_principal") {
    await editMessage(env.TELEGRAM_TOKEN, chatId, messageId,
      "⏰ <b>ASISTENTE DE ALARMAS</b>\n\nSelecciona el tipo o escríbeme el recordatorio directamente.",
      [[{ text: "🔄 Semanal (Fija)", callback_data: "menu_semanal" }, { text: "📅 Fecha Única", callback_data: "menu_unica" }]]
    );
  }
  else if (data === "menu_semanal") {
    await desplegarPanelDiasSemana(env.TELEGRAM_TOKEN, chatId, messageId);
  }
  else if (data === "menu_unica") {
    await desplegarPanelMeses(env.TELEGRAM_TOKEN, chatId, messageId);
  }
  else if (data.startsWith("set_mes:")) {
    const mes = parseInt(data.split(":")[1]);
    const config = await env.ALARMAS_KV.get(`temp_${chatId}`, { type: "json" }) || {};
    config.tipo = "unica"; config.mes = mes;
    await env.ALARMAS_KV.put(`temp_${chatId}`, JSON.stringify(config));
    await desplegarPanelDias(env.TELEGRAM_TOKEN, chatId, messageId, mes);
  }
  else if (data === "volver_a_mes") {
    await desplegarPanelMeses(env.TELEGRAM_TOKEN, chatId, messageId);
  }
  else if (data.startsWith("set_dia:")) {
    const dia = parseInt(data.split(":")[1]);
    const config = await env.ALARMAS_KV.get(`temp_${chatId}`, { type: "json" }) || {};
    config.diaMes = dia;
    await env.ALARMAS_KV.put(`temp_${chatId}`, JSON.stringify(config));
    await desplegarPanelHoras(env.TELEGRAM_TOKEN, chatId, messageId, false);
  }
  else if (data.startsWith("set_dia_sem:")) {
    const dia = data.split(":")[1];
    await env.ALARMAS_KV.put(`temp_${chatId}`, JSON.stringify({ tipo: "semanal", diaSemana: dia }));
    await desplegarPanelHoras(env.TELEGRAM_TOKEN, chatId, messageId, false);
  }
  else if (data === "volver_a_fecha") {
    const config = await env.ALARMAS_KV.get(`temp_${chatId}`, { type: "json" });
    if (!config) return;
    if (config.tipo === "semanal") await desplegarPanelDiasSemana(env.TELEGRAM_TOKEN, chatId, messageId);
    else await desplegarPanelMeses(env.TELEGRAM_TOKEN, chatId, messageId);
  }
  else if (data.startsWith("set_hora:")) {
    const hora = data.split(":")[1];
    const config = await env.ALARMAS_KV.get(`temp_${chatId}`, { type: "json" }) || {};
    config.hora = hora;
    await env.ALARMAS_KV.put(`temp_${chatId}`, JSON.stringify(config));
    await desplegarPanelDecenas(env.TELEGRAM_TOKEN, chatId, messageId, hora);
  }
  else if (data === "volver_a_hora") {
    await desplegarPanelHoras(env.TELEGRAM_TOKEN, chatId, messageId, true);
  }
  else if (data.startsWith("decena:")) {
    const decena = data.split(":")[1];
    const config = await env.ALARMAS_KV.get(`temp_${chatId}`, { type: "json" });
    if (!config) return;
    config.temp_decena = decena;
    await env.ALARMAS_KV.put(`temp_${chatId}`, JSON.stringify(config));
    const fila1 = [], fila2 = [];
    for (let n = 0; n < 5; n++) fila1.push({ text: `${decena}${n}`, callback_data: `final:${decena}${n}` });
    for (let n = 5; n < 10; n++) fila2.push({ text: `${decena}${n}`, callback_data: `final:${decena}${n}` });
    await editMessage(env.TELEGRAM_TOKEN, chatId, messageId,
      `⏰ Tramo: <code>${config.hora}:${decena}X</code>\nElige el <b>minuto exacto</b>:`,
      [fila1, fila2, [{ text: "↩️ Cambiar decena", callback_data: `volver_a_decena:${config.hora}` }]]
    );
  }
  else if (data.startsWith("volver_a_decena:")) {
    await desplegarPanelDecenas(env.TELEGRAM_TOKEN, chatId, messageId, data.split(":")[1]);
  }
  else if (data.startsWith("final:")) {
    const minutoCompleto = data.split(":")[1];
    const config = await env.ALARMAS_KV.get(`temp_${chatId}`, { type: "json" });
    if (!config) return;
    config.minuto = minutoCompleto.toString().padStart(2,'0');
    config.id = Date.now().toString();
    config.nota = "Recordatorio sin nombre";
    config.fotoUrl = FOTO_POR_DEFECTO;
    config.ultimaEnviada = "";
    await env.ALARMAS_KV.put(`temp_${chatId}`, JSON.stringify(config));
    await desplegarPanelNota(env.TELEGRAM_TOKEN, chatId, messageId);
  }
  else if (data.startsWith("nota:")) {
    await guardarNotaYFinalizar(env, chatId, messageId, data.slice(5));
  }
  else if (data === "nota_manual") {
    await env.ALARMAS_KV.put(`esperando_nota:${chatId}`, messageId.toString());
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: "✏️ Escribe el texto de tu recordatorio:",
        parse_mode: 'HTML',
        reply_markup: { force_reply: true, selective: true }
      })
    });
  }
  else if (data === "cancelar_nota_manual") {
    await env.ALARMAS_KV.delete(`esperando_nota:${chatId}`);
    await desplegarPanelNota(env.TELEGRAM_TOKEN, chatId, messageId);
  }
  else if (data.startsWith("confirmar_manana:")) {
    const partes = data.split(":");
    const diaMes = parseInt(partes[1]);
    const mes    = parseInt(partes[2]);
    const pendiente = await env.ALARMAS_KV.get(`pendiente_manana:${chatId}`, { type: "json" });
    if (!pendiente) {
      await editMessage(env.TELEGRAM_TOKEN, chatId, messageId, "❌ La operación expiró. Vuelve a escribir el recordatorio.", null);
      return;
    }
    await env.ALARMAS_KV.delete(`pendiente_manana:${chatId}`);
    
    // 🆕 Manejar tanto alarmas únicas como múltiples
    if (pendiente.multiple && Array.isArray(pendiente.alarmas)) {
      // Para cada alarma múltiple, ajustar la fecha si usa "mañana"
      for (const alarma of pendiente.alarmas) {
        if (alarma.tipo === "unica") {
          // Si la alarma original tenía la fecha del "mañana" de la IA, actualizarla
          alarma.diaMes = diaMes;
          alarma.mes = mes;
        }
      }
    } else {
      // Alarma única (comportamiento original)
      pendiente.diaMes = diaMes;
      pendiente.mes    = mes;
    }
    
    await guardarAlarmaDesdeIA(pendiente, env, chatId, messageId);
  }
  else if (data === "franja:am" || data === "franja:pm") {
    // 🆕 Resolver hora ambigua (am/pm) elegida por el usuario
    const pend = await env.ALARMAS_KV.get(`pendiente_franja:${chatId}`, { type: "json" });
    if (!pend) {
      await editMessage(env.TELEGRAM_TOKEN, chatId, messageId, "❌ La operación expiró. Vuelve a escribir el recordatorio.", null);
      return;
    }
    await env.ALARMAS_KV.delete(`pendiente_franja:${chatId}`);
    const hora = data === "franja:pm" ? pend.horaPM : pend.horaAM;
    await editMessage(env.TELEGRAM_TOKEN, chatId, messageId, `👍 Hora seleccionada: <b>${hora}:${pend.minuto}</b>`, null);
    await guardarAlarmaDesdeIA({
      esAlarma: true, tipo: "unica",
      diaMes: pend.diaMes, mes: pend.mes,
      hora, minuto: pend.minuto, nota: pend.nota
    }, env, chatId, messageId);
  }
  else if (data.startsWith("preguntar_borrar:")) {
    const id      = data.split(":")[1];
    const alarmas = await leerAlarmas(env);
    const alarma  = alarmas.find(a => a.id === id);
    if (!alarma) { await editMessage(env.TELEGRAM_TOKEN, chatId, messageId, "❌ Esta alarma ya no existe.", null); return; }
    const detalle = alarma.tipo === "semanal"
      ? `Todos los ${nombresDias[alarma.diaSemana]}`
      : `El ${alarma.diaMes} de ${NOMBRES_MESES[alarma.mes - 1]}`;
    await editMessage(env.TELEGRAM_TOKEN, chatId, messageId,
      `⚠️ <b>¿Seguro que quieres borrar esta alarma?</b>\n\n📅 ${detalle} a las ${alarma.hora}:${alarma.minuto}\n📝 <i>${escapeHTML(alarma.nota)}</i>`,
      [[{ text: "Sí, borrar 🗑️", callback_data: `confirmar_borrar:${id}` }, { text: "No, volver ↩️", callback_data: "cancelar_borrar" }]]
    );
  }
  else if (data.startsWith("confirmar_borrar:")) {
    const id = data.split(":")[1];
    const alarmas = await leerAlarmas(env);
    await guardarAlarmas(env, alarmas.filter(a => a.id !== id));
    await editMessage(env.TELEGRAM_TOKEN, chatId, messageId, "🗑️ Alarma eliminada correctamente.", null);
  }
  else if (data === "cancelar_borrar") {
    await editMessage(env.TELEGRAM_TOKEN, chatId, messageId, "↩️ Borrado cancelado. Usa /ver para listarlas de nuevo.", null);
  }
  else if (data === "ver_todas") {
    // 🆕 Ver todas las alarmas (sin límite)
    const alarmas = await leerAlarmas(env);
    await editMessage(env.TELEGRAM_TOKEN, chatId, messageId, "📋 <b>TODAS TUS ALARMAS:</b>", null);
    
    for (const al of alarmas) {
      const fechaTxt = al.tipo === "semanal"
        ? `🔄 Todos los <b>${nombresDias[al.diaSemana]}</b>`
        : (() => {
            const fecha = new Date(new Date().getFullYear(), al.mes - 1, al.diaMes);
            const diaSemana = nombresDias[fecha.getDay()].toLowerCase();
            return `📅 El <b>${diaSemana} ${al.diaMes} de ${NOMBRES_MESES[al.mes - 1]}</b>`;
          })();
      await sendTextConBotones(env.TELEGRAM_TOKEN, chatId,
        `${fechaTxt} a las <b>${al.hora}:${al.minuto}</b>\n📝 <i>${escapeHTML(al.nota)}</i>`,
        [
          [{ text: "✏️ Editar nota", callback_data: `editar_nota:${al.id}` }],
          [{ text: "❌ Borrar", callback_data: `preguntar_borrar:${al.id}` }]
        ]
      );
    }
  }
  else if (data === "buscar_alarma") {
    // 🆕 Buscar alarma
    await editMessage(env.TELEGRAM_TOKEN, chatId, messageId,
      "🔍 <b>Buscar alarma</b>\n\nEscribe palabras clave para buscar en tus alarmas:",
      [[{ text: "❌ Cancelar", callback_data: "cancelar_buscar" }]]
    );
    await env.ALARMAS_KV.put(`esperando_busqueda:${chatId}`, "1");
  }
  else if (data === "cancelar_buscar") {
    await env.ALARMAS_KV.delete(`esperando_busqueda:${chatId}`);
    await editMessage(env.TELEGRAM_TOKEN, chatId, messageId, "↩️ Búsqueda cancelada.", null);
  }
  else if (data === "ver_por_mes") {
    // 🆕 Ver alarmas agrupadas por mes
    const alarmas = await leerAlarmas(env);
    const unicas = alarmas.filter(a => a.tipo === "unica");
    const semanales = alarmas.filter(a => a.tipo === "semanal");
    
    // Agrupar por mes
    const porMes = {};
    for (const al of unicas) {
      const clave = `${al.mes}`;
      if (!porMes[clave]) porMes[clave] = [];
      porMes[clave].push(al);
    }
    
    let mensaje = "📆 <b>ALARMAS POR MES:</b>\n";
    const mesesOrdenados = Object.keys(porMes).sort((a, b) => parseInt(a) - parseInt(b));
    
    for (const mes of mesesOrdenados) {
      const alarmasMes = porMes[mes];
      mensaje += `\n<b>${NOMBRES_MESES[parseInt(mes) - 1]}</b> (${alarmasMes.length}):\n`;
      
      // Ordenar por día
      alarmasMes.sort((a, b) => a.diaMes - b.diaMes);
      
      for (const al of alarmasMes) {
        const fecha = new Date(new Date().getFullYear(), al.mes - 1, al.diaMes);
        const diaSemana = nombresDias[fecha.getDay()];
        mensaje += `  • ${diaSemana} ${al.diaMes} - ${al.hora}:${al.minuto} - ${escapeHTML(al.nota)}\n`;
      }
    }
    
    if (semanales.length > 0) {
      mensaje += `\n🔄 <b>SEMANALES</b> (${semanales.length}):\n`;
      for (const al of semanales) {
        mensaje += `  • ${nombresDias[al.diaSemana]} - ${al.hora}:${al.minuto} - ${escapeHTML(al.nota)}\n`;
      }
    }
    
    await editMessage(env.TELEGRAM_TOKEN, chatId, messageId, mensaje, [[{ text: "↩️ Volver", callback_data: "volver_ver" }]]);
  }
  else if (data === "volver_ver") {
    await editMessage(env.TELEGRAM_TOKEN, chatId, messageId, "↩️ Usa /ver para ver tus alarmas.", null);
  }
  else if (data.startsWith("editar_nota:")) {
    const id = data.split(":")[1];
    const alarmas = await leerAlarmas(env);
    const alarma = alarmas.find(a => a.id === id);
    if (!alarma) {
      await editMessage(env.TELEGRAM_TOKEN, chatId, messageId, "❌ Esta alarma ya no existe.", null);
      return;
    }
    
    // Guardar el ID de la alarma que se está editando
    await env.ALARMAS_KV.put(`esperando_edicion_nota:${chatId}`, id);
    
    await editMessage(env.TELEGRAM_TOKEN, chatId, messageId,
      `✏️ <b>Editar nota</b>\n\nNota actual: <i>${escapeHTML(alarma.nota)}</i>\n\nEscribe la nueva nota:`,
      [[{ text: "❌ Cancelar", callback_data: "cancelar_editar_nota" }]]
    );
    
    // Enviar también un mensaje con respuesta forzada
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: "✏️ Escribe la nueva nota:",
        parse_mode: 'HTML',
        reply_markup: { force_reply: true, selective: true }
      })
    });
  }
  else if (data.startsWith("editar_desc:")) {
    // 🆕 Editar descripción de alarma recién creada (mismo flujo que editar_nota)
    const id = data.split(":")[1];
    const alarmas = await leerAlarmas(env);
    const alarma = alarmas.find(a => a.id === id);
    if (!alarma) {
      await editMessage(env.TELEGRAM_TOKEN, chatId, messageId, "❌ Esta alarma ya no existe.", null);
      return;
    }
    
    // Guardar el ID de la alarma que se está editando
    await env.ALARMAS_KV.put(`esperando_edicion_nota:${chatId}`, id);
    
    await editMessage(env.TELEGRAM_TOKEN, chatId, messageId,
      `✏️ <b>Editando descripción</b>\n\n📝 Descripción actual: <i>"${escapeHTML(alarma.nota)}"</i>\n\n💬 Escribe la nueva descripción:`,
      [[{ text: "❌ Cancelar", callback_data: "cancelar_editar_nota" }]]
    );
    
    // Enviar también un mensaje con respuesta forzada
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: "✏️ Escribe la nueva descripción:",
        parse_mode: 'HTML',
        reply_markup: { force_reply: true, input_field_placeholder: "Nueva descripción..." }
      })
    });
  }
  else if (data === "cancelar_editar_nota") {
    await env.ALARMAS_KV.delete(`esperando_edicion_nota:${chatId}`);
    await editMessage(env.TELEGRAM_TOKEN, chatId, messageId, "↩️ Edición cancelada. Usa /ver para ver tus alarmas.", null);
  }

  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/answerCallbackQuery?callback_query_id=${cb.id}`);
}

// ─── GUARDAR NOTA Y BUSCAR FOTO ───────────────────────────────────────────────
async function guardarNotaYFinalizar(env, chatId, messageId, nota) {
  const config = await env.ALARMAS_KV.get(`temp_${chatId}`, { type: "json" });
  if (!config) return;
  config.nota = nota;
  const ruido = ["el","la","los","las","un","una","de","del","al","para","con","en","por","y","o","mi","tu"];
  const palabrasClave = nota.toLowerCase().split(/\s+/).filter(p => !ruido.includes(p) && p.length > 2);
  const terminoIngles = await traducirAlIngles(palabrasClave.join(" ") || nota);
  config.fotoUrl = await buscarFotoPexels(terminoIngles, env.PEXELS_API_KEY) || FOTO_POR_DEFECTO;

  const alarmas = await leerAlarmas(env);
  const idx = alarmas.findIndex(a => a.id === config.id);
  if (idx >= 0) alarmas[idx] = config; else alarmas.push(config);
  await guardarAlarmas(env, alarmas);
  await env.ALARMAS_KV.delete(`temp_${chatId}`);
  await env.ALARMAS_KV.delete(`esperando_nota:${chatId}`);

  const nombresDias = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
  let resumen = "";
  if (config.tipo === "semanal") {
    resumen = `🔄 Todos los <b>${nombresDias[config.diaSemana]}</b>`;
  } else {
    // 🆕 Agregar día de la semana
    const fecha = new Date(new Date().getFullYear(), config.mes - 1, config.diaMes);
    const diaSemana = nombresDias[fecha.getDay()].toLowerCase();
    resumen = `📅 El <b>${diaSemana} ${config.diaMes} de ${NOMBRES_MESES[config.mes - 1]}</b>`;
  }
  
  // 🆕 Agregar botón de editar descripción
  await editMessage(env.TELEGRAM_TOKEN, chatId, messageId,
    `✅ <b>¡Alarma guardada!</b>\n\n${resumen}\n⏰ <b>${config.hora}:${config.minuto}</b>\n${calcularCuentaAtras(config)}\n📝 <i>${escapeHTML(config.nota)}</i>`,
    [[{ text: "✏️ Editar descripción", callback_data: `editar_desc:${config.id}` }]]
  );
}


// ─── PROCESAR MENSAJES ────────────────────────────────────────────────────────
async function processMessage(msg, env) {
  if (!msg.from || msg.from.id.toString() !== env.MY_TELEGRAM_ID) return;

  const chatId  = msg.chat.id;
  const msgId   = msg.message_id;
  
  // 🆕 SOPORTE DE MENSAJES DE VOZ CON WHISPER MEJORADO
  if (msg.voice) {
    try {
      // Validar duración del audio (max 60 segundos recomendado)
      if (msg.voice.duration > 60) {
        await sendText(env.TELEGRAM_TOKEN, chatId, msgId, 
          "⏱️ El audio es muy largo (>60s).\n💡 Intenta con mensajes más cortos para mejor precisión.");
        return;
      }
      
      // Obtener info del archivo de voz
      const fileInfoRes = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/getFile?file_id=${msg.voice.file_id}`);
      const fileInfo = await fileInfoRes.json();
      
      if (!fileInfo.ok) {
        await sendText(env.TELEGRAM_TOKEN, chatId, msgId, "❌ No pude procesar el audio. Inténtalo de nuevo.");
        return;
      }
      
      const filePath = fileInfo.result.file_path;
      const audioUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_TOKEN}/${filePath}`;
      
      // Descargar el audio
      const audioRes = await fetch(audioUrl);
      const audioBuffer = await audioRes.arrayBuffer();
      
      // 🆕 Validar que existe la API key de AssemblyAI
      if (!env.ASSEMBLYAI_API_KEY) {
        console.error("❌ Falta el secret ASSEMBLYAI_API_KEY");
        await sendText(env.TELEGRAM_TOKEN, chatId, msgId,
          "❌ Configuración incompleta: falta la clave de AssemblyAI.");
        return;
      }
      
      // 🆕 Transcribir con AssemblyAI
      await sendText(env.TELEGRAM_TOKEN, chatId, msgId, "🎤 Transcribiendo audio...");
      
      const textoTranscrito = await transcribirConAssemblyAI(audioBuffer, env.ASSEMBLYAI_API_KEY);
      
      if (!textoTranscrito || textoTranscrito.length === 0) {
        await sendText(env.TELEGRAM_TOKEN, chatId, msgId, 
          "❌ No pude entender el audio.\n\n💡 <b>Consejos:</b>\n• Habla claro y despacio\n• Evita ruido de fondo\n• Mantén el audio corto (<30s)\n• O escríbelo en su lugar");
        return;
      }
      
      console.log("🎤 Audio transcrito:", textoTranscrito);
      console.log("🎤 Duración:", msg.voice.duration, "s");
      
      // 🆕 Mostrar transcripción al usuario
      await sendText(env.TELEGRAM_TOKEN, chatId, msgId, 
        `🎤 <b>Transcribí:</b> <i>"${escapeHTML(textoTranscrito)}"</i>\n\n⏳ Procesando...`);
      
      // 🆕 Ahora procesar como texto normal (sin recursión infinita)
      // Simplemente asignar el texto transcrito y continuar el flujo
      msg.text = textoTranscrito;
      msg.fromVoice = true; // 🆕 Marcar que vino de audio para dar feedback apropiado
      delete msg.voice; // Eliminar voz para que no vuelva a procesarse
      
      // El flujo continuará abajo en el procesamiento de texto normal
      
    } catch (voiceError) {
      console.error("💥 Error en transcripción de voz:", voiceError);
      await sendText(env.TELEGRAM_TOKEN, chatId, msgId, 
        `❌ Error al procesar el audio.\n\n💡 <b>Sugerencia:</b> Intenta:\n• Enviar un audio más corto\n• Hablar más claro y pausado\n• Escribir el mensaje en su lugar`);
      return;
    }
  }

  // ─── PROCESAR TEXTO (tanto directo como transcrito) ─────────────────────────
  const text = msg.text;

  if (!text) {
    // Si no hay texto ni voz, ignorar
    return;
  }

  // 🆕 USAR NORMALIZACIÓN MEJORADA (para procesamiento de alarmas)
  const textNormalizado = normalizarTextoCompleto(text);

  const nombresDias = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];

  // Los comandos usan 'text' sin normalizar
  if (text === '/alarma') {
    await sendTextConBotones(env.TELEGRAM_TOKEN, chatId,
      "⏰ <b>ASISTENTE DE ALARMAS</b>\n\nUsa los botones o escríbeme el recordatorio directamente.\n\n<i>Ej: «el 5 y el 6 de julio pon despertador a las 7»</i>",
      [[{ text: "🔄 Semanal (Fija)", callback_data: "menu_semanal" }, { text: "📅 Fecha Única", callback_data: "menu_unica" }]]
    );
    return;
  }

  if (text === '/ver') {
    const alarmas = await leerAlarmas(env);
    if (alarmas.length === 0) {
      await sendText(env.TELEGRAM_TOKEN, chatId, msgId, "🤷‍♂️ No tienes ninguna alarma configurada.");
      return;
    }
    
    // 🆕 Ordenar y agrupar alarmas
    const ahora = new Date(new Date().toLocaleString("en-US", { timeZone: "Atlantic/Canary" }));
    const hoyInicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    
    // Separar semanales y únicas
    const semanales = alarmas.filter(a => a.tipo === "semanal");
    const unicas = alarmas.filter(a => a.tipo === "unica");
    
    // Ordenar únicas por proximidad
    unicas.sort((a, b) => {
      const fechaA = new Date(ahora.getFullYear(), a.mes - 1, a.diaMes, a.hora, a.minuto);
      const fechaB = new Date(ahora.getFullYear(), b.mes - 1, b.diaMes, b.hora, b.minuto);
      // Si la fecha ya pasó este año, considerar año siguiente
      if (fechaA < ahora) fechaA.setFullYear(fechaA.getFullYear() + 1);
      if (fechaB < ahora) fechaB.setFullYear(fechaB.getFullYear() + 1);
      return fechaA.getTime() - fechaB.getTime();
    });
    
    // Agrupar por categorías temporales
    const grupos = {
      hoy: [],
      manana: [],
      estaSemana: [],
      esteMes: [],
      proximosMeses: []
    };
    
    const mananaInicio = new Date(hoyInicio.getTime() + 86400000);
    const finSemana = new Date(hoyInicio.getTime() + 7 * 86400000);
    const finMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0);
    
    for (const al of unicas) {
      const fecha = new Date(ahora.getFullYear(), al.mes - 1, al.diaMes);
      if (fecha < ahora) fecha.setFullYear(fecha.getFullYear() + 1);
      
      if (fecha.toDateString() === hoyInicio.toDateString()) {
        grupos.hoy.push(al);
      } else if (fecha.toDateString() === mananaInicio.toDateString()) {
        grupos.manana.push(al);
      } else if (fecha < finSemana) {
        grupos.estaSemana.push(al);
      } else if (fecha <= finMes) {
        grupos.esteMes.push(al);
      } else {
        grupos.proximosMeses.push(al);
      }
    }
    
    // Construir mensaje agrupado
    let mensaje = `📋 <b>TUS ALARMAS</b> (${alarmas.length} total)`;
    let contador = 0;
    const limite = 10;
    
    // HOY
    if (grupos.hoy.length > 0) {
      mensaje += `\n\n📅 <b>HOY</b> (${grupos.hoy.length})`;
      for (const al of grupos.hoy) {
        if (contador >= limite) break;
        const diaSemana = nombresDias[new Date(ahora.getFullYear(), al.mes - 1, al.diaMes).getDay()].toLowerCase();
        mensaje += `\n  • <b>${al.hora}:${al.minuto}</b> - ${escapeHTML(al.nota)}`;
        contador++;
      }
    }
    
    // MAÑANA
    if (grupos.manana.length > 0 && contador < limite) {
      mensaje += `\n\n📅 <b>MAÑANA</b> (${grupos.manana.length})`;
      for (const al of grupos.manana) {
        if (contador >= limite) break;
        mensaje += `\n  • <b>${al.hora}:${al.minuto}</b> - ${escapeHTML(al.nota)}`;
        contador++;
      }
    }
    
    // ESTA SEMANA
    if (grupos.estaSemana.length > 0 && contador < limite) {
      mensaje += `\n\n📅 <b>ESTA SEMANA</b> (${grupos.estaSemana.length})`;
      for (const al of grupos.estaSemana) {
        if (contador >= limite) break;
        const fecha = new Date(ahora.getFullYear(), al.mes - 1, al.diaMes);
        const diaSemana = nombresDias[fecha.getDay()];
        mensaje += `\n  • <b>${diaSemana} ${al.diaMes}</b> - ${al.hora}:${al.minuto} - ${escapeHTML(al.nota)}`;
        contador++;
      }
    }
    
    // ESTE MES
    if (grupos.esteMes.length > 0 && contador < limite) {
      mensaje += `\n\n📅 <b>ESTE MES</b> (${grupos.esteMes.length})`;
      for (const al of grupos.esteMes) {
        if (contador >= limite) break;
        const fecha = new Date(ahora.getFullYear(), al.mes - 1, al.diaMes);
        const diaSemana = nombresDias[fecha.getDay()];
        mensaje += `\n  • <b>${diaSemana} ${al.diaMes}</b> - ${al.hora}:${al.minuto} - ${escapeHTML(al.nota)}`;
        contador++;
      }
    }
    
    // PRÓXIMOS MESES
    if (grupos.proximosMeses.length > 0 && contador < limite) {
      mensaje += `\n\n📅 <b>PRÓXIMOS MESES</b> (${grupos.proximosMeses.length})`;
      for (const al of grupos.proximosMeses) {
        if (contador >= limite) break;
        const fecha = new Date(ahora.getFullYear(), al.mes - 1, al.diaMes);
        const diaSemana = nombresDias[fecha.getDay()];
        mensaje += `\n  • <b>${diaSemana} ${al.diaMes} ${NOMBRES_MESES[al.mes - 1]}</b> - ${al.hora}:${al.minuto} - ${escapeHTML(al.nota)}`;
        contador++;
      }
    }
    
    // SEMANALES
    if (semanales.length > 0) {
      mensaje += `\n\n🔄 <b>SEMANALES</b> (${semanales.length})`;
      for (const al of semanales) {
        if (contador >= limite) break;
        mensaje += `\n  • <b>Todos los ${nombresDias[al.diaSemana]}</b> - ${al.hora}:${al.minuto} - ${escapeHTML(al.nota)}`;
        contador++;
      }
    }
    
    // Botones
    const botones = [];
    if (alarmas.length > limite) {
      mensaje += `\n\n<i>Mostrando ${contador} de ${alarmas.length} alarmas</i>`;
      botones.push([{ text: "📋 Ver todas", callback_data: "ver_todas" }]);
    }
    botones.push([
      { text: "🔍 Buscar", callback_data: "buscar_alarma" },
      { text: "📆 Por mes", callback_data: "ver_por_mes" }
    ]);
    
    await sendTextConBotones(env.TELEGRAM_TOKEN, chatId, mensaje, botones);
    return;
  }

  if (text === '/debug') {
    const keyOk = env.PEXELS_API_KEY ? env.PEXELS_API_KEY.slice(0,8)+'...' : 'NO EXISTE';
    const alarmas = await leerAlarmas(env);
    let statusPexels = 'error', totalResultados = 'error', urlFoto = 'NINGUNA', traduccion = 'error';
    try { traduccion = await traducirAlIngles("gato comida"); } catch(e) { traduccion = String(e); }
    try {
      const r = await fetch('https://api.pexels.com/v1/search?query=cat+food&per_page=1', { headers: { Authorization: env.PEXELS_API_KEY } });
      statusPexels = r.status.toString();
      const j = await r.json();
      totalResultados = j?.total_results?.toString() ?? 'ausente';
      urlFoto = j?.photos?.[0]?.src?.large || 'NINGUNA';
    } catch(e) { statusPexels = String(e); }
    await sendText(env.TELEGRAM_TOKEN, chatId, msgId,
      `🔍 <b>DEBUG</b>\n\n🔑 Key: <code>${keyOk}</code>\n🌐 Pexels: <code>${statusPexels}</code>\n📸 Fotos: <code>${totalResultados}</code>\n🖼 URL: <code>${urlFoto.slice(0,80)}</code>\n🌍 Traducción: <code>${traduccion}</code>\n📦 Alarmas: <code>${alarmas.length}</code>`
    );
    return;
  }

  // 🆕 COMANDO /borrar - Eliminar todas las alarmas (para testing)
  if (text === '/borrar') {
    const alarmas = await leerAlarmas(env);
    if (alarmas.length === 0) {
      await sendText(env.TELEGRAM_TOKEN, chatId, msgId, "🤷‍♂️ No hay alarmas para borrar.");
      return;
    }
    const cantidad = alarmas.length;
    await guardarAlarmas(env, []); // Vaciar todas las alarmas
    await sendText(env.TELEGRAM_TOKEN, chatId, msgId, 
      `🗑️ <b>¡${cantidad} alarma${cantidad > 1 ? 's' : ''} eliminada${cantidad > 1 ? 's' : ''}!</b>\n\n✨ La lista está limpia.`
    );
    return;
  }

  // 🆕 COMANDO DEBUG_IA - Testing sin crear alarmas
  if (text.startsWith('/debug_ia ')) {
    const testTexto = text.slice(10).trim();
    await sendText(env.TELEGRAM_TOKEN, chatId, msgId, "🔍 <b>Analizando...</b>");
    
    // PASO 1: Normalización
    const normalizado = normalizarTextoCompleto(testTexto);
    await sendText(env.TELEGRAM_TOKEN, chatId, msgId, 
      `📝 <b>PASO 1: Normalización</b>\n\n<b>Original:</b>\n<code>${escapeHTML(testTexto)}</code>\n\n<b>Normalizado:</b>\n<code>${escapeHTML(normalizado)}</code>`
    );
    
    // PASO 2: Regex
    const tiempoRelativo = detectarTiempoRelativo(normalizado);
    if (tiempoRelativo) {
      if (tiempoRelativo.esMultiple) {
        await sendText(env.TELEGRAM_TOKEN, chatId, msgId,
          `✅ <b>PASO 2: Regex detectó MÚLTIPLE</b>\n\n<code>${JSON.stringify(tiempoRelativo, null, 2)}</code>`
        );
      } else {
        await sendText(env.TELEGRAM_TOKEN, chatId, msgId,
          `✅ <b>PASO 2: Regex detectó alarma</b>\n\n<code>${JSON.stringify(tiempoRelativo, null, 2)}</code>`
        );
      }
    } else {
      await sendText(env.TELEGRAM_TOKEN, chatId, msgId, "⚠️ <b>PASO 2: Regex no detectó nada</b>");
    }
    
    // PASO 3: IA
    try {
      const datos = await interpretarAlarmaConIA(normalizado, env.AI);
      if (datos) {
        await sendText(env.TELEGRAM_TOKEN, chatId, msgId,
          `🤖 <b>PASO 3: IA respondió</b>\n\n<code>${JSON.stringify(datos, null, 2)}</code>`
        );
      } else {
        await sendText(env.TELEGRAM_TOKEN, chatId, msgId, "❌ <b>PASO 3: IA devolvió null</b>");
      }
    } catch (e) {
      await sendText(env.TELEGRAM_TOKEN, chatId, msgId,
        `💥 <b>PASO 3: IA falló</b>\n\n<code>${escapeHTML(e.message)}</code>`
      );
    }
    
    return;
  }

  const esperandoNotaMsgId = await env.ALARMAS_KV.get(`esperando_nota:${chatId}`);
  if (esperandoNotaMsgId && !text.startsWith('/')) {
    await guardarNotaYFinalizar(env, chatId, parseInt(esperandoNotaMsgId), text);
    return;
  }
  
  // 🆕 Manejar búsqueda de alarmas
  const esperandoBusqueda = await env.ALARMAS_KV.get(`esperando_busqueda:${chatId}`);
  if (esperandoBusqueda && !text.startsWith('/')) {
    await env.ALARMAS_KV.delete(`esperando_busqueda:${chatId}`);
    
    const alarmas = await leerAlarmas(env);
    const termino = text.toLowerCase();
    const resultados = alarmas.filter(a => a.nota.toLowerCase().includes(termino));
    
    if (resultados.length === 0) {
      await sendText(env.TELEGRAM_TOKEN, chatId, msgId, 
        `🔍 No encontré alarmas con "<i>${escapeHTML(text)}</i>"\n\nIntenta con otras palabras.`
      );
      return;
    }
    
    await sendText(env.TELEGRAM_TOKEN, chatId, msgId, 
      `🔍 <b>Encontré ${resultados.length} alarma${resultados.length > 1 ? 's' : ''}:</b>`
    );
    
    for (const al of resultados) {
      const fechaTxt = al.tipo === "semanal"
        ? `🔄 Todos los <b>${nombresDias[al.diaSemana]}</b>`
        : (() => {
            const fecha = new Date(new Date().getFullYear(), al.mes - 1, al.diaMes);
            const diaSemana = nombresDias[fecha.getDay()].toLowerCase();
            return `📅 El <b>${diaSemana} ${al.diaMes} de ${NOMBRES_MESES[al.mes - 1]}</b>`;
          })();
      await sendTextConBotones(env.TELEGRAM_TOKEN, chatId,
        `${fechaTxt} a las <b>${al.hora}:${al.minuto}</b>\n📝 <i>${escapeHTML(al.nota)}</i>`,
        [
          [{ text: "✏️ Editar nota", callback_data: `editar_nota:${al.id}` }],
          [{ text: "❌ Borrar", callback_data: `preguntar_borrar:${al.id}` }]
        ]
      );
    }
    return;
  }
  
  // 🆕 Manejar edición de nota de alarma existente
  const esperandoEdicionId = await env.ALARMAS_KV.get(`esperando_edicion_nota:${chatId}`);
  if (esperandoEdicionId && !text.startsWith('/')) {
    const alarmas = await leerAlarmas(env);
    const alarma = alarmas.find(a => a.id === esperandoEdicionId);
    
    if (!alarma) {
      await sendText(env.TELEGRAM_TOKEN, chatId, msgId, "❌ Esta alarma ya no existe.");
      await env.ALARMAS_KV.delete(`esperando_edicion_nota:${chatId}`);
      return;
    }
    
    // Actualizar la nota
    const notaAnterior = alarma.nota;
    alarma.nota = text;
    
    // Buscar nueva foto basada en la nota
    const ruido = ["el","la","los","las","un","una","de","del","al","para","con","en","por","y","o","mi","tu"];
    const palabrasClave = text.toLowerCase().split(/\s+/).filter(p => !ruido.includes(p) && p.length > 2);
    const terminoIngles = await traducirAlIngles(palabrasClave.join(" ") || text);
    const fotoPexels = await buscarFotoPexels(terminoIngles, env.PEXELS_API_KEY);
    if (fotoPexels) alarma.fotoUrl = fotoPexels;
    
    // Guardar cambios
    await guardarAlarmas(env, alarmas);
    await env.ALARMAS_KV.delete(`esperando_edicion_nota:${chatId}`);
    
    const nombresDias = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
    const fechaTxt = alarma.tipo === "semanal"
      ? `🔄 Todos los <b>${nombresDias[alarma.diaSemana]}</b>`
      : `📅 El <b>${alarma.diaMes} de ${NOMBRES_MESES[alarma.mes - 1]}</b>`;
    
    await sendText(env.TELEGRAM_TOKEN, chatId, msgId, 
      `✅ <b>¡Nota actualizada!</b>\n\n${fechaTxt}\n⏰ <b>${alarma.hora}:${alarma.minuto}</b>\n\n📝 Antes: <i>${escapeHTML(notaAnterior)}</i>\n📝 Ahora: <i>${escapeHTML(alarma.nota)}</i>`
    );
    return;
  }

  const regexLinks = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
  const tieneLinks = regexLinks.test(text);
  regexLinks.lastIndex = 0;

  if (tieneLinks && !pareceTenerIntencionDeTiempo(text)) {
    await generarQRs(text, env.TELEGRAM_TOKEN, chatId, msgId);
    return;
  }

  if (!text.startsWith('/') && text.length > 3) {
    console.log("📥 TEXTO RECIBIDO:", text); // 🆕 Log inicial
    console.log("📝 TEXTO NORMALIZADO:", textNormalizado); // 🆕 Log normalizado
    
    // Capa 1: Regex tiempo relativo (con texto normalizado)
    const tiempoRelativo = detectarTiempoRelativo(textNormalizado, text);
    console.log("🔍 Regex resultado:", tiempoRelativo ? "DETECTADO" : "null"); // 🆕 Log
    
    if (tiempoRelativo) {
      console.log("📊 Regex datos:", JSON.stringify(tiempoRelativo)); // 🆕 Log
      if (tiempoRelativo.esMultiple) {
        // Múltiples fechas (ej: mañana y pasado mañana)
        await guardarAlarmaDesdeIA({
          esAlarma: true,
          multiple: true,
          alarmas: tiempoRelativo.fechas.map(f => ({ ...f, tipo: "unica" }))
        }, env, chatId, msgId);
      } else if (tiempoRelativo.ambiguaFranja) {
        // 🆕 Hora ambigua (sin marcador am/pm) → preguntar al usuario
        const amH = tiempoRelativo.hora;
        const pmH = String(parseInt(amH) + 12).padStart(2, '0');
        const amInt = parseInt(amH), pmInt = parseInt(pmH);
        const amLabel = amInt < 6 ? "madrugada" : "mañana";
        const pmLabel = pmInt < 20 ? "tarde" : "noche";

        await env.ALARMAS_KV.put(`pendiente_franja:${chatId}`, JSON.stringify({
          tipo: "unica",
          diaMes: tiempoRelativo.diaMes, mes: tiempoRelativo.mes,
          minuto: tiempoRelativo.minuto, nota: tiempoRelativo.nota,
          horaAM: amH, horaPM: pmH
        }));

        await sendTextConBotones(env.TELEGRAM_TOKEN, chatId,
          `🤔 ¿A qué hora te refieres con las <b>${amInt}:${tiempoRelativo.minuto}</b>?\n📝 <i>${escapeHTML(tiempoRelativo.nota)}</i>`,
          [[
            { text: `🌙 ${amH}:${tiempoRelativo.minuto} (${amLabel})`, callback_data: "franja:am" },
            { text: `☀️ ${pmH}:${tiempoRelativo.minuto} (${pmLabel})`, callback_data: "franja:pm" }
          ]]
        );
      } else {
        await guardarAlarmaDesdeIA({
          esAlarma: true, tipo: "unica",
          diaMes: tiempoRelativo.diaMes, mes: tiempoRelativo.mes,
          hora: tiempoRelativo.hora, minuto: tiempoRelativo.minuto,
          nota: tiempoRelativo.nota
        }, env, chatId, msgId);
      }
      return;
    }

    console.log("🤖 Llamando a IA..."); // 🆕 Log
    // Capa 2: IA (con texto normalizado)
    const datos = await interpretarAlarmaConIA(textNormalizado, env.AI);
    if (!datos || !datos.esAlarma) {
      // Si no es alarma, verificar si tiene links para QR
      if (tieneLinks) {
        await generarQRs(text, env.TELEGRAM_TOKEN, chatId, msgId);
      } else if (msg.fromVoice) {
        // 🆕 Si venía de audio y la IA no entendió, avisar al usuario
        await sendText(env.TELEGRAM_TOKEN, chatId, msgId, 
          `❌ <b>No entendí:</b> <i>"${escapeHTML(text)}"</i>\n\n💡 <b>Sugerencia:</b> Intenta:\n• Hablar más claro y pausado\n• Una frase más simple: "alarma mañana a las 10"\n• O escríbelo en su lugar`
        );
      }
      return;
    }

    // 🆕 Ambigüedad mañana en madrugada (ahora también para múltiples)
    const ahora = new Date(new Date().toLocaleString("en-US", { timeZone: "Atlantic/Canary" }));
    if (detectarAmbiguedadManana(textNormalizado, ahora)) {
      const diasSemana = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
      const manana = new Date(ahora.getTime() + 86400000);
      const dHoy = ahora.getDate(), mHoy = ahora.getMonth() + 1;
      const dMan = manana.getDate(), mMan = manana.getMonth() + 1;
      
      // Guardar los datos completos (único o múltiple)
      await env.ALARMAS_KV.put(`pendiente_manana:${chatId}`, JSON.stringify(datos));
      
      await sendTextConBotones(env.TELEGRAM_TOKEN, chatId,
        "📅 Cuando dices 'mañana', ¿te refieres a...?",
        [
          [{ text: `Hoy ${diasSemana[ahora.getDay()]} ${dHoy} de ${NOMBRES_MESES[ahora.getMonth()]}`,   callback_data: `confirmar_manana:${dHoy}:${mHoy}` }],
          [{ text: `Mañana ${diasSemana[manana.getDay()]} ${dMan} de ${NOMBRES_MESES[manana.getMonth()]}`, callback_data: `confirmar_manana:${dMan}:${mMan}` }]
        ]
      );
      return;
    }

    await guardarAlarmaDesdeIA(datos, env, chatId, msgId);
  }
}

// ─── GENERAR QRs ──────────────────────────────────────────────────────────────
async function generarQRs(text, token, chatId, msgId) {
  const regexLinks = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
  const links = text.match(regexLinks) || [];
  for (let link of links) {
    link = link.replace(/[.,;:)]+$/, '');
    if (!link.startsWith('http')) link = 'http://' + link;
    link = cleanUrl(link);
    const colorHex = usarAzul ? '004080' : '000000';
    usarAzul = !usarAzul;
    try {
      const qrBuffer = await (await fetch(`https://api.qrserver.com/v1/create-qr-code/?size=500x500&margin=2&color=${colorHex}&data=${encodeURIComponent(link)}`)).arrayBuffer();
      let cap = SALTO_GRANDE ? "⠀\n".repeat(NUM_SALTOS) : "";
      cap += `🔗 ${escapeHTML(link)}`;
      await sendPhoto(token, chatId, msgId, qrBuffer, cap);
    } catch (e) {
      await sendText(token, chatId, msgId, `❌ Error generando QR`);
    }
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function cleanUrl(urlStr) {
  try {
    const url = new URL(urlStr);
    ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','utm_id','fbclid','gclid','igsh','si','ref','ref_src','ref_url','_hsenc','s']
      .forEach(p => url.searchParams.delete(p));
    return url.toString();
  } catch (e) { return urlStr; }
}

async function sendText(token, chatId, replyId, text) {
  const params = new URLSearchParams({ chat_id: chatId, text, parse_mode: 'HTML' });
  if (replyId) params.append('reply_to_message_id', replyId);
  await fetch(`https://api.telegram.org/bot${token}/sendMessage?${params}`);
}

async function sendTextConBotones(token, chatId, text, infoBotones) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', reply_markup: { inline_keyboard: infoBotones } })
  });
}

async function editMessage(token, chatId, messageId, nuevoTexto, nuevosBotones) {
  const payload = { chat_id: chatId, message_id: messageId, text: nuevoTexto, parse_mode: 'HTML' };
  if (nuevosBotones) payload.reply_markup = { inline_keyboard: nuevosBotones };
  await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

async function sendPhoto(token, chatId, replyId, arrayBuffer, caption) {
  const formData = new FormData();
  formData.append('chat_id', chatId.toString());
  if (replyId) formData.append('reply_to_message_id', replyId.toString());
  formData.append('caption', caption);
  formData.append('parse_mode', 'HTML');
  formData.append('photo', new Blob([arrayBuffer], { type: 'image/png' }), 'alarma.png');
  await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: 'POST', body: formData });
}
