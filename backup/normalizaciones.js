// ═══════════════════════════════════════════════════════════════════════════════
// NORMALIZACIONES COMPLETAS DE LENGUAJE NATURAL PARA ALARMAS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Normaliza texto de entrada para procesamiento de alarmas
 * Cubre todas las variaciones comunes del español hablado
 */
export function normalizarTextoCompleto(texto) {
  let normalizado = texto;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 1. TYPOS Y ERRORES COMUNES DE VOZ
  // ═══════════════════════════════════════════════════════════════════════════
  
  // "ponme/pon" con typos
  normalizado = normalizado
    .replace(/\bpome\b/gi, 'ponme')
    .replace(/\bpnme\b/gi, 'ponme')
    .replace(/\bponame\b/gi, 'ponme')
    .replace(/\bpomme\b/gi, 'ponme')
    .replace(/\bpon\s+me\b/gi, 'ponme');
  
  // "alarma" con typos
  normalizado = normalizado
    .replace(/\blasrma[s]?\b/gi, 'alarma')
    .replace(/\balarmas?\b/gi, 'alarma')
    .replace(/\balrma[s]?\b/gi, 'alarma');
  
  // "una/un" con typos
  normalizado = normalizado
    .replace(/\bua\b/gi, 'una')
    .replace(/\bun[ao]\b/gi, '1');
  
  // Verbos con espacios (errores de transcripción)
  normalizado = normalizado
    .replace(/\bAvisa\s+me\b/gi, 'Avísame')
    .replace(/\bavisa\s+me\b/gi, 'avísame')
    .replace(/\bavisame\b/gi, 'avísame')
    .replace(/\brecuerda\s+me\b/gi, 'recuérdame')
    .replace(/\brecuerdame\b/gi, 'recuérdame');
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 2. NÚMEROS EN PALABRAS Y MEZCLAS INGLÉS/ESPAÑOL
  // ═══════════════════════════════════════════════════════════════════════════
  
  normalizado = normalizado
    // Español
    .replace(/\bdos\b/gi, '2')
    .replace(/\btres\b/gi, '3')
    .replace(/\bcuatro\b/gi, '4')
    .replace(/\bcinco\b/gi, '5')
    .replace(/\bseis\b/gi, '6')
    .replace(/\bsiete\b/gi, '7')
    .replace(/\bocho\b/gi, '8')
    .replace(/\bnueve\b/gi, '9')
    .replace(/\bdiez\b/gi, '10')
    .replace(/\bdies\b/gi, '10')
    .replace(/\bonce\b/gi, '11')
    .replace(/\bdoce\b/gi, '12')
    .replace(/\btrece\b/gi, '13')
    .replace(/\bcatorce\b/gi, '14')
    .replace(/\bquince\b/gi, '15')
    .replace(/\bveinte\b/gi, '20')
    .replace(/\bveintiuno\b/gi, '21')
    .replace(/\bveintidos\b/gi, '22')
    .replace(/\bveintitres\b/gi, '23')
    // Inglés (errores de Whisper)
    .replace(/\bfive\b/gi, '5')
    .replace(/\bsix\b/gi, '6')
    .replace(/\bseven\b/gi, '7')
    .replace(/\beight\b/gi, '8')
    .replace(/\bnine\b/gi, '9')
    .replace(/\bten\b/gi, '10')
    .replace(/\beleven\b/gi, '11')
    .replace(/\btwelve\b/gi, '12');
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 3. PALABRAS DE RELLENO Y RUIDO
  // ═══════════════════════════════════════════════════════════════════════════
  
  normalizado = normalizado
    .replace(/\bpero\b/gi, ' ')
    .replace(/\btambien\b/gi, ' ')
    .replace(/\btambién\b/gi, ' ')
    .replace(/\bporfa\b/gi, ' ')
    .replace(/\bporfavor\b/gi, ' ')
    .replace(/\bpor\s+favor\b/gi, ' ')
    .replace(/\bvenga\b/gi, ' ')
    .replace(/\boye\b/gi, ' ')
    .replace(/\bbueno\b/gi, ' ')
    .replace(/\bvale\b/gi, ' ')
    .replace(/\besta\s+vez\b/gi, ' ')
    .replace(/\bmejor\b/gi, ' ');
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 4. HORAS - "Y MEDIO" Y "Y CUARTO"
  // ═══════════════════════════════════════════════════════════════════════════
  
  normalizado = normalizado
    .replace(/\b(\d{1,2})\s+y\s+medi[oa]\b/gi, 'a las $1:30')
    .replace(/\b(\d{1,2})\s+y\s+cuarto\b/gi, 'a las $1:15')
    .replace(/\by\s+cuarto\b/gi, ':15')
    .replace(/\by\s+medi[oa]\b/gi, ':30');
  
  // Limpiar ", :XX" → ":XX"
  normalizado = normalizado.replace(/,\s*:(\d{2})/g, ':$1');
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 5. MOMENTO DEL DÍA - TODAS LAS VARIACIONES
  // ═══════════════════════════════════════════════════════════════════════════
  
  // MADRUGADA (00:00 - 06:00)
  normalizado = normalizado
    .replace(/\ben\s+la\s+madrugada\b/gi, 'de madrugada')
    .replace(/\bpor\s+la\s+madrugada\b/gi, 'de madrugada')
    .replace(/\bla\s+madrugada\b/gi, 'de madrugada')
    .replace(/\besta\s+madrugada\b/gi, 'de madrugada');
  
  // MAÑANA (06:00 - 12:00)
  normalizado = normalizado
    .replace(/\ben\s+la\s+ma[ñn]ana\b/gi, 'de la mañana')
    .replace(/\bpor\s+la\s+ma[ñn]ana\b/gi, 'de la mañana')
    .replace(/\ba\s+la\s+ma[ñn]ana\b/gi, 'de la mañana');
  
  // MEDIODÍA (12:00 - 14:00)
  normalizado = normalizado
    .replace(/\bal\s+mediod[ií]a\b/gi, 'del mediodía')
    .replace(/\ben\s+el\s+mediod[ií]a\b/gi, 'del mediodía')
    .replace(/\bpor\s+el\s+mediod[ií]a\b/gi, 'del mediodía')
    .replace(/\bdel\s+medio\s+d[ií]a\b/gi, 'del mediodía');
  
  // TARDE (14:00 - 20:00)
  normalizado = normalizado
    .replace(/\ben\s+la\s+tarde\b/gi, 'de la tarde')
    .replace(/\bpor\s+la\s+tarde\b/gi, 'de la tarde')
    .replace(/\ba\s+la\s+tarde\b/gi, 'de la tarde');
  
  // NOCHE (20:00 - 00:00)
  normalizado = normalizado
    .replace(/\ben\s+la\s+noche\b/gi, 'de la noche')
    .replace(/\bpor\s+la\s+noche\b/gi, 'de la noche')
    .replace(/\ba\s+la\s+noche\b/gi, 'de la noche');
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 6. CONVERTIR MOMENTOS DEL DÍA A HORAS 24H
  // ═══════════════════════════════════════════════════════════════════════════
  
  // DE LA TARDE (12:00 - 20:00) → +12 horas si < 12
  normalizado = normalizado.replace(
    /\b([1-9]|1[0-2])(?::(\d{2}))?\s+de\s+la\s+tarde\b/gi,
    (match, hora, minutos) => {
      const h = parseInt(hora);
      const nuevaHora = h < 12 ? h + 12 : h;
      return minutos ? `a las ${nuevaHora}:${minutos}` : `a las ${nuevaHora}:00`;
    }
  );
  
  // DE LA NOCHE (20:00 - 00:00) → +12 horas si < 12
  normalizado = normalizado.replace(
    /\b([1-9]|1[0-2])(?::(\d{2}))?\s+de\s+la\s+noche\b/gi,
    (match, hora, minutos) => {
      const h = parseInt(hora);
      const nuevaHora = h < 12 ? h + 12 : h;
      return minutos ? `a las ${nuevaHora}:${minutos}` : `a las ${nuevaHora}:00`;
    }
  );
  
  // DE LA MAÑANA (06:00 - 12:00) → hora literal
  normalizado = normalizado.replace(
    /\b([1-9]|1[0-2])(?::(\d{2}))?\s+de\s+la\s+ma[ñn]ana\b/gi,
    (match, hora, minutos) => {
      return minutos ? `a las ${hora}:${minutos}` : `a las ${hora}:00`;
    }
  );
  
  // DEL MEDIODÍA → 12:00 por defecto
  normalizado = normalizado.replace(
    /\b(\d{1,2})(?::(\d{2}))?\s+del\s+mediod[ií]a\b/gi,
    (match, hora, minutos) => {
      return minutos ? `a las ${hora}:${minutos}` : `a las ${hora}:00`;
    }
  );
  
  // DE MADRUGADA (00:00 - 06:00) → hora literal (0-6)
  normalizado = normalizado.replace(
    /\b([1-6])(?::(\d{2}))?\s+de\s+madrugada\b/gi,
    (match, hora, minutos) => {
      return minutos ? `a las ${hora}:${minutos}` : `a las ${hora}:00`;
    }
  );
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 7. "A LAS X Y Y" - DISTINGUIR HORA:MINUTO vs MÚLTIPLES HORAS
  // ═══════════════════════════════════════════════════════════════════════════
  
  normalizado = normalizado.replace(
    /\ba\s+las\s+(\d{1,2})\s+y\s+(\d{1,2})(?=\s|,|$)/gi,
    (match, h, m, offset, textoCompleto) => {
      const hora = parseInt(h);
      const minuto = parseInt(m);
      
      // NO convertir si hay indicios de múltiples fechas
      const tieneMultiplesFechas = /(?:mañana|manana|hoy|pasado).*(?:y|,).*(?:mañana|manana|hoy|pasado)/i.test(textoCompleto);
      
      // Solo convertir a HH:MM si:
      // 1. NO hay múltiples fechas
      // 2. Los minutos son > 23 (claramente minutos: 30, 45, 50, etc.)
      // 3. La hora es razonable (0-23)
      if (!tieneMultiplesFechas && hora >= 0 && hora <= 23 && minuto > 23 && minuto <= 59) {
        return `a las ${h}:${String(minuto).padStart(2, '0')}`;
      }
      
      // Si minuto ≤ 23, puede ser hora:minuto O dos horas → dejar sin tocar
      return match;
    }
  );
  
  // Detectar "a las X :YY" (cuando quedó separado)
  normalizado = normalizado.replace(/\ba\s+las\s+(\d{1,2})\s*:(\d{2})\b/gi, 'a las $1:$2');
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 8. FECHAS Y DÍAS
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Normalizar "mañana" con typos
  normalizado = normalizado
    .replace(/\bmñn\b/gi, 'mañana')
    .replace(/\bmñana\b/gi, 'mañana')
    .replace(/\bmannana\b/gi, 'mañana')
    .replace(/\bmaiana\b/gi, 'mañana')
    .replace(/\bmaniana\b/gi, 'mañana')
    .replace(/\bmnaña\b/gi, 'mañana')
    .replace(/\bpasao\s+mañana\b/gi, 'pasado mañana')
    .replace(/\bpasao\s+manana\b/gi, 'pasado mañana');
  
  // Días de la semana abreviados
  normalizado = normalizado
    .replace(/\bjue\b/gi, 'jueves')
    .replace(/\bvie\b/gi, 'viernes')
    .replace(/\bsab\b/gi, 'sábado')
    .replace(/\bdom\b/gi, 'domingo')
    .replace(/\blun\b/gi, 'lunes')
    .replace(/\bmar\b/gi, 'martes')
    .replace(/\bmie\b/gi, 'miércoles');
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 9. ABREVIACIONES Y JERGA
  // ═══════════════════════════════════════════════════════════════════════════
  
  normalizado = normalizado
    .replace(/\bxq\b/gi, 'porque')
    .replace(/\bpq\b/gi, 'porque')
    .replace(/\bq\b/gi, 'que')
    .replace(/\bx\b/gi, 'por')
    .replace(/\bpf\b/gi, 'por favor')
    .replace(/\bxfa\b/gi, 'por favor')
    .replace(/\bwsp\b/gi, 'whatsapp')
    .replace(/\bmsj\b/gi, 'mensaje');
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 10. "LAS X" → "A LAS X" (sin "a")
  // ═══════════════════════════════════════════════════════════════════════════
  
  normalizado = normalizado.replace(/(?<![a-záéíóúñ])las\s+(\d{1,2})/gi, 'a las $1');
  
  // Limpiar duplicados
  normalizado = normalizado.replace(/\ba\s+a\s+las\b/gi, 'a las');
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 11. LIMPIEZA FINAL
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Múltiples espacios → uno solo
  normalizado = normalizado.replace(/\s{2,}/g, ' ').trim();
  
  return normalizado;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTAR PARA USO EN WORKER
// ═══════════════════════════════════════════════════════════════════════════

export default normalizarTextoCompleto;
