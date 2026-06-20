// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 MEJORAS APLICADAS:
// ✅ Normalización avanzada de typos (pome→ponme, lasrmas→alarma, dies→10, five→5)
// ✅ IA mejorada con mejor prompt y temperatura 0.3
// ✅ Comando /debug_ia para testing sin crear alarmas
// ✅ Mejor extracción de JSON de la IA
// ✅ Logs detallados para debugging
// ✅ TODOS los botones, callbacks y QR intactos
// ═══════════════════════════════════════════════════════════════════════════════

import { DICCIONARIO } from './diccionario.js';

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

// ─── 🆕 NORMALIZACIÓN MEJORADA ────────────────────────────────────────────────
function normalizarTextoAvanzado(texto) {
  return texto
    // Typos comunes de "ponme/pon"
    .replace(/\bpome\b/gi, 'ponme')
    .replace(/\bpnme\b/gi, 'ponme')
    .replace(/\bponame\b/gi, 'ponme')
    .replace(/\bpomme\b/gi, 'ponme')
    
    // Typos de "alarma"
    .replace(/\blasrma[s]?\b/gi, 'alarma')
    .replace(/\balarmas?\b/gi, 'alarma')
    .replace(/\balrma[s]?\b/gi, 'alarma')
    
    // Typos de "una"
    .replace(/\bua\b/gi, 'una')
    
    // Números escritos con typos
    .replace(/\bdies\b/gi, '10')
    .replace(/\bdiez\b/gi, '10')
    .replace(/\bdié s\b/gi, '10')
    
    // Mezcla inglés-español en números
    .replace(/\bfive\b/gi, '5')
    .replace(/\bsix\b/gi, '6')
    .replace(/\bseven\b/gi, '7')
    .replace(/\beight\b/gi, '8')
    .replace(/\bnine\b/gi, '9')
    .replace(/\bten\b/gi, '10')
    .replace(/\beleven\b/gi, '11')
    .replace(/\btwelve\b/gi, '12')
    
    // Quitar ruido (ANTES de procesar conectores)
    .replace(/\bpero\b/gi, ' ')
    .replace(/\btambien\b/gi, ' ')
    .replace(/\btambién\b/gi, ' ')
    .replace(/\bporfa\b/gi, ' ')
    .replace(/\bporfavor\b/gi, ' ')
    .replace(/\bvenga\b/gi, ' ')
    .replace(/\boye\b/gi, ' ')
    .replace(/\bbueno\b/gi, ' ')
    .replace(/\bvale\b/gi, ' ')
    .replace(/\besta\s+vez\b/gi, ' ')
    .replace(/\bmejor\b/gi, ' ')
    
    // "y cuarto" → ":15" (ANTES de procesar números)
    .replace(/\by\s+cuarto\b/gi, ':15')
    
    // "y media" → ":30"
    .replace(/\by\s+media\b/gi, ':30')
    
    // Limpiar ", :XX" → ":XX" (cuando queda de "pero y cuarto")
    .replace(/,\s*:(\d{2})/g, ':$1')
    
    // Detectar "a las X y Y" donde Y son minutos de 2 dígitos (10-59)
    .replace(/\ba\s+las\s+(\d{1,2})\s+y\s+(\d{2})\b/gi, 'a las $1:$2')
    
    // Detectar "a las X y Y" donde Y son minutos de 1 dígito (1-9)
    .replace(/\ba\s+las\s+(\d{1,2})\s+y\s+(\d)\b/gi, (match, h, m) => {
      const minutos = parseInt(m);
      // Solo si es 1-9 (no 10-23 que serían horas)
      if (minutos >= 1 && minutos <= 9) {
        return `a las ${h}:0${m}`;
      }
      return match;
    })
    
    // Detectar "a las X :YY" (cuando quedó separado)
    .replace(/\ba\s+las\s+(\d{1,2})\s*:(\d{2})\b/gi, 'a las $1:$2')
    
    // Resto normalización original
    .replace(/\bmñn\b/gi, 'mañana')
    .replace(/\bmñana\b/gi, 'mañana')
    .replace(/\bmannana\b/gi, 'mañana')
    .replace(/\bmaiana\b/gi, 'mañana')
    .replace(/\bmaniana\b/gi, 'mañana')
    .replace(/\bmnaña\b/gi, 'mañana')
    .replace(/\bpasao mañana\b/gi, 'pasado mañana')
    .replace(/\bpasao manana\b/gi, 'pasado mañana')
    .replace(/\bjue\b/gi, 'jueves')
    .replace(/\bvie\b/gi, 'viernes')
    .replace(/\bsab\b/gi, 'sábado')
    .replace(/\bdom\b/gi, 'domingo')
    .replace(/\blun\b/gi, 'lunes')
    .replace(/\bmar\b/gi, 'martes')
    .replace(/\bmie\b/gi, 'miércoles')
    .replace(/\brecuerdame\b/gi, 'recuérdame')
    .replace(/\bavisame\b/gi, 'avísame')
    .replace(/\bxq\b/gi, 'porque')
    .replace(/\bpq\b/gi, 'porque')
    .replace(/\bq\b/gi, 'que')
    .replace(/\bx\b/gi, 'por')
    .replace(/\bpf\b/gi, 'por favor')
    .replace(/\bxfa\b/gi, 'por favor')
    .replace(/\bwsp\b/gi, 'whatsapp')
    .replace(/\bmsj\b/gi, 'mensaje')
    
    // Números en palabras
    .replace(/\bun[ao]\b/gi, '1')
    .replace(/\bdos\b/gi, '2')
    .replace(/\btres\b/gi, '3')
    .replace(/\bcuatro\b/gi, '4')
    .replace(/\bcinco\b/gi, '5')
    .replace(/\bseis\b/gi, '6')
    .replace(/\bsiete\b/gi, '7')
    .replace(/\bocho\b/gi, '8')
    .replace(/\bnueve\b/gi, '9')
    .replace(/\bonce\b/gi, '11')
    .replace(/\bdoce\b/gi, '12')
    .replace(/\btrece\b/gi, '13')
    .replace(/\bcatorce\b/gi, '14')
    .replace(/\bquince\b/gi, '15')
    .replace(/\bveinte\b/gi, '20')
    .replace(/\bveintiuno\b/gi, '21')
    .replace(/\bveintidos\b/gi, '22')
    .replace(/\bveintitres\b/gi, '23')
    // "las X" → "a las X"
    .replace(/(?<![a-záéíóúñ])las\s+(\d{1,2})/gi, 'a las $1')
    // Limpiar duplicados
    .replace(/\ba\s+a\s+las\b/gi, 'a las')
    .replace(/\s{2,}/g, ' ')
    .trim();
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

IMPORTANTE FORMATO DE HORA:
- "a las 10:12" significa las DIEZ y DOCE MINUTOS (10:12), NO dos alarmas separadas
- "a las 12:15" significa las DOCE y QUINCE MINUTOS (12:15)
- Solo son múltiples alarmas si hay "y" entre fechas diferentes

EJEMPLOS:
"recuérdame mañana a las 10 comprar pan"
→ {"esAlarma":true,"nota":"comprar pan","tipo":"unica","diaMes":${mananaNum},"mes":${mananasMes},"hora":"10","minuto":"00"}

"todos los lunes a las 8 gimnasio"
→ {"esAlarma":true,"nota":"gimnasio","tipo":"semanal","diaSemana":1,"hora":"08","minuto":"00"}

"mañana a las 10:12 reunión"
→ {"esAlarma":true,"nota":"reunión","tipo":"unica","diaMes":${mananaNum},"mes":${mananasMes},"hora":"10","minuto":"12"}

"mañana a las 10:12 y pasado mañana a las 12:15 reunión"
→ {"esAlarma":true,"multiple":true,"alarmas":[{"nota":"reunión","tipo":"unica","diaMes":${mananaNum},"mes":${mananasMes},"hora":"10","minuto":"12"},{"nota":"reunión","tipo":"unica","diaMes":${pasadoMananaNum},"mes":${pasadoMananasMes},"hora":"12","minuto":"15"}]}

"el 5 y el 6 de julio despertador a las 7"
→ {"esAlarma":true,"multiple":true,"alarmas":[{"nota":"despertador","tipo":"unica","diaMes":5,"mes":7,"hora":"07","minuto":"00"},{"nota":"despertador","tipo":"unica","diaMes":6,"mes":7,"hora":"07","minuto":"00"}]}

REGLAS HORA:
- Sin hora → contexto: médico/reunión→09:00, comida→12:00, gym→19:00, cena→21:00, defecto→10:00
- "a las 10" → 10:00. "a las 10:30" → 10:30. "a las 10:15" → 10:15
- "a las 4 de la tarde" → 16:00

REGLAS FECHA:
- "mañana" → ${mananaNum}/${mananasMes}
- "pasado mañana" → ${pasadoMananaNum}/${pasadoMananasMes}
- "lunes/martes/etc" → próximo día de esa semana
- Múltiples fechas → {"esAlarma":true,"multiple":true,"alarmas":[...]}

FORMATO:
Única: {"esAlarma":true,"nota":"...","tipo":"unica","diaMes":N,"mes":N,"hora":"HH","minuto":"MM"}
Semanal: {"esAlarma":true,"nota":"...","tipo":"semanal","diaSemana":N,"hora":"HH","minuto":"MM"}
Múltiple: {"esAlarma":true,"multiple":true,"alarmas":[...]}
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
function detectarTiempoRelativo(texto) {
  const normalizado = texto.toLowerCase()
    .replace(/dentr[oa]\s*e\s+/g, 'dentro de ')
    .replace(/dento\s+de\s+/g,    'dentro de ')
    .replace(/dentrode\s+/g,       'dentro de ')
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
  // ── "hoy" con hora explícita ──────────────────────────────────────────────
  } else if (/\bhoy\b/.test(normalizado)) {
    diasASumar = 0;
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

  if (matchHHMM) {
    hora   = String(parseInt(matchHHMM[1])).padStart(2,'0');
    minuto = matchHHMM[2];
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
  }

  // Nota limpia
  const notaLimpia = texto
    .replace(/(?:dentr[oa]\s*e?\s+|dento\s+de\s+|en\s+|pasad[ao]s?\s+)\s*(?:un\s+par\s+de\s+|unos\s+|\d+\s+o\s+\d+\s+|una\s+|dos\s+|tres\s+|\d+\s+)?(?:media\s+hora|hora[s]?\s+y\s+media|hora[s]?|minutos?|min[s]?|d[ií]as?|semanas?)/gi, '')
    .replace(/(?:pasado\s+)?ma[ñn]ana/gi, '')
    .replace(/hoy/gi, '')
    .replace(/a\s+las\s+\d{1,2}(?:[:：]\d{2}|\s+y\s+(?:media|cuarto|\d{1,2}))?/gi, '')
    .replace(/alarma/gi, '')
    .replace(/pon(?:me|e)?/gi, '')
    .replace(/recuerd[ao]me/gi, '')
    .replace(/av[ií]same/gi, '')
    .replace(/despertador/gi, 'Despertador')
    .replace(/\d+\s+de\s+[a-záéíóúñ]+/gi, '')
    .replace(/^[,\s]+|[,\s]+$/g, '')
    .trim() || "Recordatorio";

  if (hora === null) {
    const def = horaDefectoPorNota(notaLimpia);
    hora   = def.hora;
    minuto = def.minuto;
  }

  return { hora, minuto, diaMes: dia, mes, nota: notaLimpia };
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

    const resumen = nuevas.map(a =>
      `📅 <b>${a.diaMes} de ${NOMBRES_MESES[a.mes - 1]}</b> a las <b>${a.hora}:${a.minuto}</b>`
    ).join('\n');
    await sendText(env.TELEGRAM_TOKEN, chatId, msgId,
      `✅ <b>¡${nuevas.length} alarmas guardadas!</b>\n\n${resumen}\n📝 <i>${escapeHTML(nuevas[0].nota)}</i>`
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
    fechaTxt = `📅 El <b>${datos.diaMes} de ${NOMBRES_MESES[Number(datos.mes) - 1]}</b>`;
  }
  await sendText(env.TELEGRAM_TOKEN, chatId, msgId,
    `✅ <b>¡Alarma guardada!</b>\n\n${fechaTxt}\n⏰ <b>${alarma.hora}:${alarma.minuto}</b>\n📝 <i>${escapeHTML(alarma.nota)}</i>`
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
    pendiente.diaMes = diaMes;
    pendiente.mes    = mes;
    await guardarAlarmaDesdeIA(pendiente, env, chatId, messageId);
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
  const resumen = config.tipo === "semanal"
    ? `🔄 Todos los <b>${nombresDias[config.diaSemana]}</b>`
    : `📅 El <b>${config.diaMes} de ${NOMBRES_MESES[config.mes - 1]}</b>`;
  await editMessage(env.TELEGRAM_TOKEN, chatId, messageId,
    `✅ <b>¡Alarma guardada!</b>\n\n${resumen}\n⏰ <b>${config.hora}:${config.minuto}</b>\n📝 <i>${escapeHTML(config.nota)}</i>`,
    null
  );
}


// ─── PROCESAR MENSAJES ────────────────────────────────────────────────────────
async function processMessage(msg, env) {
  if (!msg.from || msg.from.id.toString() !== env.MY_TELEGRAM_ID) return;

  const chatId  = msg.chat.id;
  const msgId   = msg.message_id;
  const textRaw = (msg.text || msg.caption || '').trim();

  // 🆕 USAR NORMALIZACIÓN MEJORADA
  const text = normalizarTextoAvanzado(textRaw);

  const nombresDias = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];

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
    await sendText(env.TELEGRAM_TOKEN, chatId, msgId, "📋 <b>TUS ALARMAS ACTIVAS:</b>");
    for (const al of alarmas) {
      const fechaTxt = al.tipo === "semanal"
        ? `🔄 Todos los <b>${nombresDias[al.diaSemana]}</b>`
        : `📅 El <b>${al.diaMes} de ${NOMBRES_MESES[al.mes - 1]}</b>`;
      await sendTextConBotones(env.TELEGRAM_TOKEN, chatId,
        `${fechaTxt} a las <b>${al.hora}:${al.minuto}</b>\n📝 <i>${escapeHTML(al.nota)}</i>`,
        [[{ text: "❌ Borrar esta alarma", callback_data: `preguntar_borrar:${al.id}` }]]
      );
    }
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
    const normalizado = normalizarTextoAvanzado(testTexto);
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

  const regexLinks = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
  const tieneLinks = regexLinks.test(text);
  regexLinks.lastIndex = 0;

  if (tieneLinks && !pareceTenerIntencionDeTiempo(text)) {
    await generarQRs(text, env.TELEGRAM_TOKEN, chatId, msgId);
    return;
  }

  if (!text.startsWith('/') && text.length > 3) {
    // Capa 1: Regex tiempo relativo
    const tiempoRelativo = detectarTiempoRelativo(text);
    if (tiempoRelativo) {
      if (tiempoRelativo.esMultiple) {
        // Múltiples fechas (ej: mañana y pasado mañana)
        await guardarAlarmaDesdeIA({
          esAlarma: true,
          multiple: true,
          alarmas: tiempoRelativo.fechas.map(f => ({ ...f, tipo: "unica" }))
        }, env, chatId, msgId);
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

    // Capa 2: IA
    const datos = await interpretarAlarmaConIA(text, env.AI);
    if (!datos || !datos.esAlarma) {
      if (tieneLinks) await generarQRs(text, env.TELEGRAM_TOKEN, chatId, msgId);
      return;
    }

    // Ambigüedad mañana en madrugada
    const ahora = new Date(new Date().toLocaleString("en-US", { timeZone: "Atlantic/Canary" }));
    if (!datos.multiple && datos.tipo === "unica" && detectarAmbiguedadManana(text, ahora)) {
      const diasSemana = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
      const manana = new Date(ahora.getTime() + 86400000);
      const dHoy = ahora.getDate(), mHoy = ahora.getMonth() + 1;
      const dMan = manana.getDate(), mMan = manana.getMonth() + 1;
      await env.ALARMAS_KV.put(`pendiente_manana:${chatId}`, JSON.stringify(datos));
      await sendTextConBotones(env.TELEGRAM_TOKEN, chatId,
        "📅 ¿Te refieres a...",
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
