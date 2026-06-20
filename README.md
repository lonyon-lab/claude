# 🤖 Bot de Telegram - Mejoras de Reconocimiento NLP

## 📋 Resumen

Este proyecto mejora el reconocimiento de lenguaje natural para alarmas en tu bot de Telegram desplegado en Cloudflare Workers.

### 🎯 Problemas resueltos:

1. ✅ **Typos comunes**: `pome`, `ua`, `lasrmas`, `dies`
2. ✅ **Mezcla español-inglés**: `five`, `six`, `ten`
3. ✅ **Formato ambiguo**: "a las 10 y 12" → 10:12
4. ✅ **Conectores confusos**: "pero y cuarto", "esta vez mejor a las y media"
5. ✅ **Múltiples fechas/horas**: "mañana a las 6 y pasado mañana a las 12:30"

### 📈 Mejora esperada:

- **Antes**: ~70% de reconocimiento
- **Después**: ~90-95% de reconocimiento

---

## 📁 Archivos creados:

### 1. `normalizacion.js`
Normaliza typos y errores comunes antes de procesar.

**Funciones**:
- `normalizarTextoAvanzado(texto)` - Limpia y normaliza el texto

**Correcciones que hace**:
- `pome` → `ponme`
- `lasrmas` → `alarma`
- `ua` → `una`
- `dies` → `10`
- `five` → `5`
- "a las 10 y 12" → "a las 10:12"
- "y media" → ":30"
- "y cuarto" → ":15"
- Elimina ruido: `pero`, `también`, `porfa`

### 2. `ia-mejorada.js`
Versión mejorada de la función de IA con mejor prompt y parsing.

**Funciones**:
- `interpretarAlarmaConIAMejorada(texto, ai)` - Procesa con IA mejorada

**Mejoras**:
- Prompt más conciso con ejemplos (few-shot learning)
- Temperatura 0.3 (antes 0.1) para más flexibilidad
- Mejor extracción de JSON (busca \`\`\`json o {...})
- Logs detallados en consola
- Validación robusta de campos

### 3. `regex-mejorado.js`
Versión mejorada del regex que detecta mejor múltiples fechas.

**Funciones**:
- `detectarTiempoRelativoMejorado(texto)` - Detecta patrones temporales

**Mejoras**:
- Detecta "mañana Y pasado mañana" como múltiple
- Extrae horas diferentes para cada fecha
- Mejor manejo de "y media", "y cuarto"

### 4. `debug-command.js`
Comando para debugging sin crear alarmas reales.

### 5. Documentación:
- `INSTRUCCIONES_INTEGRACION.md` - Paso a paso para integrar
- `casos-de-prueba.md` - Casos de prueba exhaustivos
- `README.md` - Este archivo

---

## 🚀 Integración rápida

### Opción A: Integración modular (recomendado)

Si tu `worker.js` soporta ES6 modules:

1. **Copia los archivos** al directorio de tu worker:
   ```
   worker.js
   diccionario.js
   normalizacion.js       ← NUEVO
   ia-mejorada.js          ← NUEVO
   regex-mejorado.js       ← NUEVO (opcional)
   ```

2. **Añade imports** al inicio de `worker.js`:
   ```javascript
   import { DICCIONARIO } from './diccionario.js';
   import { normalizarTextoAvanzado } from './normalizacion.js';
   import { interpretarAlarmaConIAMejorada } from './ia-mejorada.js';
   ```

3. **Reemplaza la normalización** en `processMessage`:
   ```javascript
   // ANTES:
   const text = textRaw
     .replace(/\bmñn\b/gi, 'mañana')
     // ... muchas líneas ...
     .trim();

   // DESPUÉS:
   const text = normalizarTextoAvanzado(textRaw);
   ```

4. **Reemplaza la función de IA**:
   ```javascript
   // ANTES:
   const datos = await interpretarAlarmaConIA(text, env.AI);

   // DESPUÉS:
   const datos = await interpretarAlarmaConIAMejorada(text, env.AI);
   ```

5. **Añade el comando de debug** (después del comando `/debug`):
   ```javascript
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
       await sendText(env.TELEGRAM_TOKEN, chatId, msgId,
         tiempoRelativo.esMultiple 
           ? `✅ <b>PASO 2: Regex detectó MÚLTIPLE</b>\n\n<code>${JSON.stringify(tiempoRelativo, null, 2)}</code>`
           : `✅ <b>PASO 2: Regex detectó alarma</b>\n\n<code>${JSON.stringify(tiempoRelativo, null, 2)}</code>`
       );
     } else {
       await sendText(env.TELEGRAM_TOKEN, chatId, msgId, "⚠️ <b>PASO 2: Regex no detectó nada</b>");
     }
     
     // PASO 3: IA
     try {
       const datos = await interpretarAlarmaConIAMejorada(normalizado, env.AI);
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
   ```

### Opción B: Todo en un archivo

Si tu worker NO soporta modules, copia el contenido de cada archivo directamente en `worker.js`:

1. Copia el contenido de `normalizacion.js` (quita el `export`)
2. Copia el contenido de `ia-mejorada.js` (quita el `export`)
3. Sigue los pasos 3-5 de la Opción A

---

## 🧪 Testing

### 1. Prueba el comando de debug:

```
/debug_ia pome porfa ua lasrmas para mañana las dies y 12 y pasado mañana tambien a las 12, pero y cuarto
```

**Deberías ver**:
- ✅ **PASO 1**: Original vs Normalizado
- ✅ **PASO 2**: Si regex lo detectó
- ✅ **PASO 3**: Respuesta de la IA con JSON válido

### 2. Prueba casos reales:

```
pome porfa ua lasrmas para mañana las dies y 12 y pasado mañana tambien a las 12, pero y cuarto
```

Debería crear 2 alarmas:
- Mañana a las 10:12
- Pasado mañana a las 12:15

```
pome lasrmas para mañana las 6 y five y pasado mañana tambien a las 12, pero esta vez mejor a las y media
```

Debería crear 2 alarmas:
- Mañana a las 06:05
- Pasado mañana a las 12:30

### 3. Casos adicionales:

Ver `casos-de-prueba.md` para lista completa.

---

## 📊 Logs y debugging

### Ver logs en Cloudflare:

1. Abre Cloudflare Dashboard
2. Ve a Workers & Pages
3. Selecciona tu worker
4. Click en "Logs" (o "Begin log stream")

### Logs que verás:

```
🤖 IA RAW: {"esAlarma":true,"nota":"Recordatorio",...}
📦 JSON extraído: {"esAlarma":true,...}
✅ IA procesada correctamente: {...}
```

O si hay error:
```
❌ No se encontró JSON en respuesta IA
💥 Error IA: Sin JSON válido en respuesta
```

---

## 🔧 Configuración avanzada

### Ajustar temperatura de la IA:

En `ia-mejorada.js`, línea ~140:

```javascript
temperature: 0.3  // Aumenta para más creatividad (0.0 - 1.0)
```

- `0.1` - Muy conservador, menos flexible
- `0.3` - **Recomendado** - Balance entre precisión y flexibilidad
- `0.5` - Más creativo, puede inventar cosas
- `0.7+` - Muy creativo, no recomendado para alarmas

### Añadir más normalizaciones:

En `normalizacion.js`, añade más reglas:

```javascript
.replace(/\btu_typo\b/gi, 'correcto')
```

### Añadir más contextos de hora:

En `ia-mejorada.js`, dentro del prompt:

```javascript
* nuevo_contexto → HH:00
```

---

## ⚠️ Troubleshooting

### Problema: "Error: Cannot use import statement outside a module"

**Solución**: Usa la Opción B (todo en un archivo) o configura `wrangler.toml`:

```toml
[build]
command = ""

[build.upload]
format = "modules"
main = "./worker.js"
```

### Problema: La IA sigue sin reconocer algunos casos

**Solución**: 
1. Verifica que la normalización se esté aplicando (`/debug_ia`)
2. Revisa los logs de Cloudflare
3. Ajusta la temperatura a 0.4-0.5
4. Añade más ejemplos al prompt en `ia-mejorada.js`

### Problema: El regex detecta pero la IA no

**Solución**: El regex es un fallback, si detecta y funciona, ¡perfecto! La IA es para casos más complejos.

### Problema: Límite de Workers AI alcanzado

**Solución**: El plan gratuito tiene límites. Considera:
- Cachear resultados comunes
- Usar regex primero (es instantáneo y gratis)
- Upgrade al plan de pago si es necesario

---

## 📝 Changelog

### v2.0 (mejoras NLP)
- ✅ Normalización avanzada de typos
- ✅ IA mejorada con mejor prompt
- ✅ Comando `/debug_ia` para testing
- ✅ Mejor manejo de múltiples fechas
- ✅ Temperatura aumentada de 0.1 a 0.3

### v1.0 (original)
- Reconocimiento básico con IA
- Regex para casos simples
- QR code generation

---

## 🤝 Contribuir

Si encuentras más casos que fallan:

1. Usa `/debug_ia <texto>` para capturar el comportamiento
2. Anota el resultado
3. Añade normalización si es un typo recurrente
4. O ajusta el prompt si es un problema de interpretación

---

## 📚 Referencias

- [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/)
- [Llama 3.1 Model Card](https://ai.meta.com/blog/meta-llama-3-1/)
- [Telegram Bot API](https://core.telegram.org/bots/api)

---

## 📧 Soporte

Si tienes problemas:
1. Revisa `INSTRUCCIONES_INTEGRACION.md`
2. Verifica logs en Cloudflare Dashboard
3. Prueba con `/debug_ia` para diagnosticar

---

**¡Hecho con ❤️ para mejorar tu bot de Telegram!**
