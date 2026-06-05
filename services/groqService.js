// server/services/groqService.js
import dotenv from 'dotenv';
import { 
  findSimilarPastResponse, 
  savePreference, 
  getUserPreferences,
  saveInteraction,
  findCustomCommand,
  findFact,
  getLearningStats,
  learnFact
} from './learningService.js';

// Importar el Provider Manager
import { ProviderManager } from './aiProviders/providerManager.js';

// Importar Coding Service
import { codingService } from './codingService.js';

// Importar Action Service para ejecutar código
import { actionService } from './actionsService.js';

// Importar Search Service para búsquedas en internet
import { searchService } from './searchService.js';

dotenv.config();

// ===== INICIALIZAR PROVIDER MANAGER CON TODOS LOS PROVEEDORES =====
const providerManager = new ProviderManager({
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  TOGETHER_API_KEY: process.env.TOGETHER_API_KEY,
  CEREBRAS_API_KEY: process.env.CEREBRAS_API_KEY,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
  MISTRAL_API_KEY: process.env.MISTRAL_API_KEY,
  REPLICATE_API_KEY: process.env.REPLICATE_API_KEY,
  COHERE_API_KEY: process.env.COHERE_API_KEY
});

let usingFallback = false;
let currentProvider = 'Groq';

// ===== HEALTH CHECK AUTOMÁTICO CADA 5 MINUTOS =====
setInterval(async () => {
  const health = await providerManager.healthCheck();
  const healthyCount = health.filter(h => h.status === 'healthy').length;
  console.log(`💚 Health Check: ${healthyCount}/${providerManager.providers.length} proveedores saludables`);
  
  if (usingFallback && health.find(h => h.provider === 'Groq' && h.status === 'healthy')) {
    usingFallback = false;
    currentProvider = 'Groq';
    console.log('✅ Groq está nuevamente disponible, volviendo al proveedor principal');
  }
}, 300000);

// ===== MEMORIA DE CONVERSACIÓN =====
const conversationContext = new Map();

function getConversationContext(userName) {
  const key = userName || 'default';
  if (!conversationContext.has(key)) {
    conversationContext.set(key, {
      lastTopic: null,
      lastCommand: null,
      lastResponse: null,
      preferences: {},
      conversationHistory: []
    });
  }
  return conversationContext.get(key);
}

function updateConversationContext(userName, command, response, action = null) {
  const context = getConversationContext(userName);
  context.lastCommand = command;
  context.lastResponse = response;
  context.conversationHistory.push({
    timestamp: Date.now(),
    command: command,
    response: response,
    action: action
  });
  if (context.conversationHistory.length > 10) {
    context.conversationHistory.shift();
  }
  conversationContext.set(userName || 'default', context);
}

// ===== DETECCIÓN DE COMANDOS LOCALMENTE (SIN ASYNC) =====
function detectCommandLocally(userMessage, userName = null) {
  const msg = userMessage.toLowerCase();
  const context = getConversationContext(userName);

  // ===== AUTO-MODIFICACIÓN =====

// Mostrar código de un archivo
if (msg.includes('muestra tu código') || msg.includes('enséñame tu código') || msg.includes('ver código')) {
  const fileMatch = userMessage.match(/código (?:de|del)\s+(\w+)/i);
  const fileName = fileMatch ? fileMatch[1] : 'groqService';
  return {
    type: 'SHOW_CODE',
    file: fileName
  };
}

// Agregar nuevo comando de voz
if (msg.includes('agrega el comando') || msg.includes('crea un comando')) {
  const commandMatch = userMessage.match(/comando\s+["'](.+?)["']/i);
  const responseMatch = userMessage.match(/responda\s+["'](.+?)["']/i);
  
  if (commandMatch && responseMatch) {
    return {
      type: 'ADD_COMMAND',
      command: commandMatch[1],
      response: responseMatch[1]
    };
  }
  return {
    response: 'Para crear un comando, decime: "agrega el comando [frase] que responda [respuesta]"',
    action: null
  };
}

// Modificar comportamiento
if (msg.includes('modifica tu código') || msg.includes('cambia tu código')) {
  return {
    type: 'MODIFY_CODE',
    param: userMessage
  };
}

// Estadísticas del código
if (msg.includes('estadísticas de mi código') || msg.includes('cómo está mi código')) {
  const fileMatch = userMessage.match(/código (?:de|del)\s+(\w+)/i);
  return {
    type: 'CODE_STATS',
    file: fileMatch ? fileMatch[1] : 'groqService'
  };
}

// Restaurar backup
if (msg.includes('restaura backup') || msg.includes('recupera versión')) {
  return {
    type: 'RESTORE_BACKUP',
    param: userMessage
  };
}

// Listar backups
if (msg.includes('lista backups') || msg.includes('qué backups tengo')) {
  const fileMatch = userMessage.match(/backups (?:de|del)\s+(\w+)/i);
  return {
    type: 'LIST_BACKUPS',
    file: fileMatch ? fileMatch[1] : 'groqService'
  };
}

  // ===== EJECUTAR CÓDIGO REAL =====
  if (msg.includes('ejecuta este código') || msg.includes('corre este código')) {
    let code = userMessage.replace(/ejecuta este código|corre este código/gi, '');
    
    if (code.includes(':')) {
      code = code.substring(code.indexOf(':') + 1);
    }
    
    code = code.trim();
    code = code.replace(/^["']|["']$/g, '');
    code = code.replace(/\\n/g, '\n');
    code = code.replace(/`/g, '');
    
    if (code && code.length > 0) {
      return {
        type: 'EJECUTAR_CODIGO',
        code: code,
        language: 'javascript'
      };
    } else {
      return {
        response: 'No encontré ningún código para ejecutar.',
        action: null
      };
    }
  }

  // ===== APRENDER PROGRAMACIÓN =====
  if (msg.includes('aprender programación') || msg.includes('quiero aprender a programar') ||
      msg.includes('enséñame a programar')) {
    const codingHelp = `🎓 **Clases de Programación con JARVIS**

Puedo ayudarte a aprender:

📚 **Aprender conceptos**:
• "Enséñame JavaScript" - Aprende desde cero
• "Explícame async/await" - Conceptos específicos
• "Diferencia entre var y let" - Comparaciones

💻 **Práctica**:
• "Dame un ejercicio de Python" - Practica con ejercicios
• "Evalúa mi código" - Analizo tu código y doy feedback
• "Corrige mi código" - Mejoro tu código

🔍 **Analizar código**:
• "Analiza este código:" [código] - Analizo estructura
• "Qué puedo mejorar" - Sugerencias de optimización

📖 **Recursos gratuitos**:
• "Recursos para JavaScript" - Links de aprendizaje
• "Mejores prácticas" - Consejos profesionales

¿Por dónde quieres empezar?`;
    return { response: codingHelp, action: null };
  }

  // ===== EJERCICIOS DE PROGRAMACIÓN =====
  const exerciseMatch = msg.match(/dame un ejercicio (?:de|en) (\w+)(?:\s+(\w+))?/i);
  if (exerciseMatch) {
    return {
      type: 'GENERATE_EXERCISE',
      language: exerciseMatch[1],
      level: exerciseMatch[2] || 'beginner'
    };
  }

  // ===== ANALIZAR CÓDIGO =====
  if (msg.includes('analiza este código') || msg.includes('evalúa mi código')) {
    const codeMatch = userMessage.match(/código[:\s]*([\s\S]+)/i);
    if (codeMatch) {
      return {
        type: 'ANALYZE_CODE',
        code: codeMatch[1],
        language: msg.includes('javascript') || msg.includes('js') ? 'javascript' : 
                  msg.includes('python') ? 'python' : 'javascript'
      };
    }
  }

  // ===== RECURSOS DE APRENDIZAJE =====
  if (msg.includes('recursos para') || msg.includes('cómo aprender')) {
    const languageMatch = msg.match(/(?:recursos para|cómo aprender)\s+(\w+)/i);
    return {
      type: 'GET_RESOURCES',
      language: languageMatch ? languageMatch[1] : 'javascript'
    };
  }

  // ===== EVALUAR SOLUCIÓN =====
  if (msg.includes('evalúa mi solución') || msg.includes('corrige mi código')) {
    const codeMatch = userMessage.match(/solución[:\s]*([\s\S]+)/i);
    if (codeMatch) {
      return {
        type: 'EVALUATE_CODE',
        code: codeMatch[1],
        language: msg.includes('javascript') ? 'javascript' : 'python'
      };
    }
  }

  // ===== ESTADÍSTICAS DE BÚSQUEDA =====
  if (msg.includes('estadísticas de búsqueda') || msg.includes('estado de búsqueda') || 
      msg.includes('cuántas búsquedas') || msg.includes('búsquedas me quedan')) {
    return {
      type: 'SEARCH_STATS'
    };
  }

  // ===== AYUDA =====
  if (msg.includes('qué puedes hacer') || msg.includes('comandos disponibles') || 
      msg.includes('ayuda') || msg.includes('qué comandos tienes') || msg.includes('que podes hacer')) {
    const stats = providerManager.getStats();
    const helpText = `🎯 **Comandos disponibles:**

🎵 **SPOTIFY**
• "abre Spotify" - Abre la aplicación
• "poné música" - Reproduce música popular
• "pausa la música" - Pausa reproducción
• "reanuda" - Reanuda reproducción
• "siguiente canción" - Siguiente tema
• "canción anterior" - Tema anterior
• "subí el volumen" - Sube volumen
• "bajá el volumen" - Baja volumen
• "volumen al 50" - Volumen específico

🎙️ **PODCASTS**
• "reproduce el podcast [nombre]"
• "poné el podcast de misterio"
• "busca el podcast de [nombre]"

🎤 **RECOMENDACIONES**
• "qué tenés ganas de escuchar hoy"
• "recomendame música feliz/triste"

💡 **DISPOSITIVOS**
• "prendé/apagá la luz"
• "prendé/apagá la play"
• "prendé/apagá el aire"
• "subí/bajá la temperatura"

🎓 **PROGRAMACIÓN**
• "aprender programación" - Clases de programación
• "dame un ejercicio de JavaScript" - Practica con ejercicios
• "analiza este código:" - Analizo tu código
• "ejecuta este código:" - Ejecuto código y te digo el resultado
• "recursos para Python" - Links de aprendizaje

🔍 **BÚSQUEDA EN INTERNET**
• "busca en internet [pregunta]" - Busca información en la web
• "cuántas búsquedas me quedan" - Ver límites de búsqueda

ℹ️ **INFORMACIÓN**
• "qué hora es"
• "qué clima hace"
• "contame un chiste"
• "qué has aprendido"

${usingFallback ? `\n⚠️ **Modo respaldo activo**: Usando ${currentProvider}` : '✅ **Modo normal**: Usando Groq'}

📊 **Estado**: ${stats.availableProviders}/${stats.totalProviders} proveedores disponibles

¿Qué deseas hacer?`;
    return { response: helpText, action: null };
  }

  // ===== VER ESTADO DE PROVEEDORES =====
  if (msg.includes('qué proveedores tienes') || msg.includes('estado de la ia') || 
      msg.includes('qué ia usas') || msg.includes('que ia usas')) {
    const stats = providerManager.getStats();
    const providersList = Object.entries(stats.providers).map(([name, data]) => {
      const status = data.isAvailable ? '🟢' : '🔴';
      return `${status} ${name}: ${data.successRate}% éxito (${data.avgResponseTime}ms)`;
    }).join('\n');
    
    const response = `**Estado de mis sistemas de IA:**

${providersList}

**Resumen:** ${stats.availableProviders}/${stats.totalProviders} disponibles
**Modo actual:** ${usingFallback ? `Respaldo (${currentProvider})` : 'Normal (Groq)'}
**Peticiones totales:** ${stats.globalStats.totalRequests}
**Fallbacks usados:** ${stats.globalStats.fallbacksUsed}`;
    
    return { response, action: null };
  }

  // ===== REINICIAR PROVEEDORES =====
  if (msg.includes('reiniciar proveedores') || msg.includes('resetear ia') || 
      msg.includes('reiniciar ia') || msg.includes('resetear proveedores')) {
    providerManager.resetProviders();
    usingFallback = false;
    currentProvider = 'Groq';
    const response = '✅ Todos los proveedores de IA han sido reiniciados. Volviendo a Groq como principal.';
    return { response, action: null };
  }

  // ===== REPETIR =====
  if (msg.includes('repite') || msg.includes('decí de nuevo') || msg.includes('repetí')) {
    if (context.lastResponse) {
      return { response: context.lastResponse, action: null };
    }
    return { response: 'No tengo nada para repetir', action: null };
  }

  // ===== CÓMO ESTÁS =====
  if (msg.includes('cómo estás') || msg.includes('como estas') || msg.includes('que tal')) {
    const estados = [
      '¡Excelente! Listo para ayudarte. ¿En qué puedo asistirte?',
      'Funcionando al 100%. Tengo ganas de escuchar buena música, ¿alguna recomendación?',
      'Mejor que nunca. ¿Qué necesitas hoy?',
      'En modo óptimo. ¿Controlamos algo?',
      usingFallback ? `Funcionando con ${currentProvider} (modo respaldo). Todo bien.` : 'Listo para ayudarte con Groq, el más rápido del mercado.'
    ];
    return { response: estados[Math.floor(Math.random() * estados.length)], action: null };
  }

  // ===== PRESENTACIÓN =====
  if (msg.includes('quién eres') || msg.includes('quien eres') || msg.includes('presentate')) {
    return { 
      response: `Soy JARVIS, tu asistente personal inteligente. Puedo controlar Spotify, luces, PS4, aire acondicionado, aprender de conversaciones y ahora también enseñarte programación. Actualmente uso ${currentProvider} como motor de IA${usingFallback ? ' (modo respaldo)' : ''}. ¿En qué te ayudo?`, 
      action: null 
    };
  }

  // ===== SPOTIFY - ABRIR =====
  if (msg.includes('abre spotify') || msg.includes('abrir spotify') || 
      msg.includes('inicia spotify') || msg.includes('abrí spotify') ||
      msg.includes('abre el spotify')) {
    return { 
      action: { type: 'SPOTIFY_OPEN', param: '' },
      response: 'Abriendo Spotify.'
    };
  }

  // ===== SPOTIFY - VOLUMEN ESPECÍFICO =====
  const volumeMatch = msg.match(/volumen al (\d+)|pon el volumen en (\d+)/i);
  if (volumeMatch) {
    const volume = parseInt(volumeMatch[1] || volumeMatch[2]);
    if (volume >= 0 && volume <= 100) {
      return {
        action: { type: 'SPOTIFY_VOLUME_SET', param: volume.toString() },
        response: `Poniendo volumen al ${volume}%`
      };
    }
  }

  // ===== SPOTIFY - PAUSA =====
  if (msg.includes('pausa') || msg.includes('para la música') || msg.includes('detén') || 
      (msg.includes('apaga') && msg.includes('música')) || msg.includes('silencia')) {
    return { 
      action: { type: 'SPOTIFY_PAUSE', param: '' },
      response: 'Pausando la música.'
    };
  }

  // ===== SPOTIFY - REANUDAR =====
  if (msg.includes('reanuda') || msg.includes('continúa') || msg.includes('seguí') || 
      msg.includes('resume') || (msg.includes('dale') && msg.includes('música'))) {
    return { 
      action: { type: 'SPOTIFY_RESUME', param: '' },
      response: 'Reanudando la reproducción.'
    };
  }

  // ===== SPOTIFY - SIGUIENTE =====
  if (msg.includes('siguiente') || msg.includes('próxima') || msg.includes('cambiá') || 
      msg.includes('saltá') || msg.includes('pasa la canción')) {
    return { 
      action: { type: 'SPOTIFY_NEXT', param: '' },
      response: 'Pasando a la siguiente canción.'
    };
  }

  // ===== SPOTIFY - ANTERIOR =====
  if (msg.includes('anterior') || msg.includes('atrás') || msg.includes('volvé') || 
      msg.includes('previo') || msg.includes('retrocede')) {
    return { 
      action: { type: 'SPOTIFY_PREVIOUS', param: '' },
      response: 'Volviendo a la canción anterior.'
    };
  }

  // ===== SPOTIFY - VOLUMEN =====
  if (msg.includes('subí el volumen') || msg.includes('más fuerte') || 
      msg.includes('volumen más alto') || msg.includes('sube el sonido')) {
    return { 
      action: { type: 'SPOTIFY_VOLUME_UP', param: '' },
      response: 'Subiendo el volumen.'
    };
  }

  if (msg.includes('bajá el volumen') || msg.includes('más bajo') || 
      msg.includes('volumen más bajo') || msg.includes('baja el sonido')) {
    return { 
      action: { type: 'SPOTIFY_VOLUME_DOWN', param: '' },
      response: 'Bajando el volumen.'
    };
  }

  if (msg.includes('silencia') || msg.includes('mutear') || msg.includes('sin sonido') || 
      msg.includes('silencio')) {
    return { 
      action: { type: 'SPOTIFY_MUTE', param: '' },
      response: 'Silenciando el volumen.'
    };
  }

  // ===== SPOTIFY - PODCAST =====
  if (msg.includes('podcast') || msg.includes('episodio') || 
      msg.includes('reproduce el podcast') || msg.includes('pon el podcast') ||
      msg.includes('busca el podcast') ||
      (msg.includes('escuchar') && msg.includes('podcast'))) {
    let param = userMessage.replace(/podcast|episodio|reproduce el|pon el|escuchar el|busca el/gi, '').trim();
    if (!param) param = 'podcast';
    return { 
      action: { type: 'BUSCAR_PODCAST', param: param },
      response: `🔍 Buscando podcast "${param}" en Spotify...`
    };
  }

  // ===== SPOTIFY - RECOMENDACIONES =====
  if (msg.includes('qué tenés ganas de escuchar') || msg.includes('recomendame música') || 
      msg.includes('sugerime') || msg.includes('qué música me recomendás') || 
      msg.includes('que musica me recomiendas') || (msg.includes('estado de ánimo') && msg.includes('música'))) {
    
    let mood = 'random';
    if (msg.includes('feliz') || msg.includes('alegre') || msg.includes('contento')) mood = 'feliz';
    else if (msg.includes('triste') || msg.includes('depre') || msg.includes('deprimido')) mood = 'triste';
    else if (msg.includes('energético') || msg.includes('enérgico') || msg.includes('fuerte')) mood = 'energético';
    else if (msg.includes('relajado') || msg.includes('calmado') || msg.includes('tranquilo')) mood = 'relajado';
    else if (msg.includes('romántico') || msg.includes('amor') || msg.includes('enamorado')) mood = 'romántico';
    else if (msg.includes('fiesta') || msg.includes('baile') || msg.includes('bailar')) mood = 'fiesta';
    else if (msg.includes('estudiar') || msg.includes('concentrarse') || msg.includes('trabajar')) mood = 'estudiar';
    
    return { 
      action: { type: 'SPOTIFY_RECOMMEND', param: mood },
      response: `Claro, según tu estado de ánimo, tengo una recomendación especial para ti.`
    };
  }

  // ===== SPOTIFY - REPRODUCIR MÚSICA =====
  if ((msg.includes('reproduce') || msg.includes('pon') || msg.includes('poné') || 
       msg.includes('música') || msg.includes('spotify')) && 
      !msg.includes('aprende') && !msg.includes('pausa') && !msg.includes('para') && 
      !msg.includes('reanuda') && !msg.includes('siguiente') && !msg.includes('anterior') &&
      !msg.includes('playlist') && !msg.includes('recomienda') && !msg.includes('abre') &&
      !msg.includes('subí') && !msg.includes('bajá') && !msg.includes('silencia') &&
      !msg.includes('podcast')) {
    
    let param = '';
    
    const reproduceMatch = userMessage.match(/(?:reproduce|pon|poné|reproducí)\s+(.+)/i);
    if (reproduceMatch) {
      param = reproduceMatch[1];
    } else if (msg.includes('de ')) {
      const match = msg.match(/de\s+(.+)/i);
      param = match ? match[1] : '';
    } else if (msg.includes('la canción')) {
      const match = msg.match(/canción\s+(.+)/i);
      param = match ? match[1] : '';
    }
    
    param = param.replace(/por favor|ahora|urgente|gracias/gi, '').trim();
    
    if (!param || param === 'música' || param === 'musica') {
      param = '';
    }
    
    return { 
      action: { type: 'SPOTIFY_PLAY', param: param },
      response: param ? `Reproduciendo ${param} en Spotify.` : 'Reproduciendo música en Spotify.'
    };
  }

  // ===== BUSCAR CANCIÓN =====
  if (msg.includes('busca la canción') || msg.includes('encuentra la canción')) {
    const songMatch = userMessage.match(/canción\s+(.+)/i);
    if (songMatch) {
      const songName = songMatch[1];
      return {
        action: { type: 'BUSCAR_CANCION', param: songName },
        response: `🔍 Buscando "${songName}" en Spotify...`
      };
    }
  }

  // ===== COMANDOS DE DESARROLLO WEB =====
  if (msg.includes('cómo hago un componente') || msg.includes('componente en react')) {
    const response = `📁 **Componente en React:**
    
\`\`\`jsx
function MiComponente({ titulo, onClick }) {
  return (
    <div className="componente">
      <h2>{titulo}</h2>
      <button onClick={onClick}>Click aquí</button>
    </div>
  );
}

export default MiComponente;
\`\`\`

¿Quieres que profundice en hooks, props o estado?`;
    return { response, action: null };
  }

  if (msg.includes('escribe una función') || msg.includes('crea una función')) {
    const match = userMessage.match(/(?:escribe una función|crea una función)\s+para\s+(.+)/i);
    const descripcion = match ? match[1] : 'sumar dos números';
    const response = `📝 **Función JavaScript para ${descripcion}:**

\`\`\`javascript
function ${descripcion.replace(/ /g, '_')}() {
  // TODO: Implementar lógica
  console.log('Función creada por JARVIS');
  return resultado;
}
\`\`\`

¿Necesitas que la adapte a algo específico?`;
    return { response, action: null };
  }

  // ===== CLIMA EXTENDIDO =====
  if (msg.includes('clima con detalles') || msg.includes('clima completo') || 
      msg.includes('qué clima hace con detalles')) {
    const ciudadMatch = userMessage.match(/en\s+([a-záéíóúñ\s]+)/i);
    const ciudad = ciudadMatch ? ciudadMatch[1].trim() : 'Buenos Aires';
    return {
      action: { type: 'CLIMA_EXTENDIDO', param: ciudad },
      response: `Consultando clima detallado en ${ciudad}...`
    };
  }

  // ===== TEMPORIZADOR =====
  const timerMatch = msg.match(/temporizador de (\d+)\s*(minutos?|min|segundos?|seg)/i);
  if (timerMatch) {
    const time = parseInt(timerMatch[1]);
    const unit = timerMatch[2];
    const seconds = unit.includes('min') ? time * 60 : time;
    return {
      action: { type: 'TIMER', param: seconds.toString() },
      response: `⏰ Temporizador de ${time} ${unit} iniciado. Te avisaré cuando termine.`
    };
  }

  // ===== ESTADÍSTICAS =====
  if (msg.includes('cuánto has aprendido') || msg.includes('qué has aprendido') || 
      msg.includes('estadísticas') || msg.includes('que has aprendido')) {
    return { 
      action: { type: 'GET_STATS', param: '' },
      response: 'Consultando mis estadísticas de aprendizaje...'
    };
  }

  // ===== APRENDER HECHOS =====
  if (msg.includes('aprende que') || msg.includes('recuerda que')) {
    const match = userMessage.match(/(?:aprende que|recuerda que) (.+)/i);
    if (match) {
      return {
        action: { type: 'LEARN_FACT', param: match[1] },
        response: `He aprendido: "${match[1]}". Lo recordaré para el futuro.`
      };
    }
  }

  // ===== BUSCAR EN INTERNET =====
  if (msg.includes('busca en internet') || msg.includes('investiga sobre')) {
    const searchQuery = userMessage.replace(/busca en internet|investiga sobre/gi, '').trim();
    if (searchQuery) {
      return {
        action: { type: 'BUSCAR_EN_INTERNET', param: searchQuery },
        response: `🔍 Buscando "${searchQuery}" en internet...`
      };
    }
  }

  return null;
}

// ===== EXPORTAR EL SERVICIO =====
export const groqService = {
  async transcribeAudio(audioBuffer, language = 'es') {
    try {
      const { Groq } = await import('groq-sdk');
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
      
      const file = new File([audioBuffer], 'audio.webm', { type: 'audio/webm' });
      const transcription = await groq.audio.transcriptions.create({
        file: file,
        model: 'whisper-large-v3',
        language: 'es',
        response_format: 'json',
        temperature: 0.2
      });
      return transcription.text;
    } catch (error) {
      console.error('Error transcribiendo audio:', error);
      throw new Error('No pude entender lo que dijiste');
    }
  },

  async getJarvisResponse(userMessage, userName = null, conversationHistory = []) {
    try {
      // Detectar comando local
      const localCommand = detectCommandLocally(userMessage, userName);
      
      // ===== PROCESAR ESTADÍSTICAS DE BÚSQUEDA =====
      if (localCommand && localCommand.type === 'SEARCH_STATS') {
        const stats = searchService.getStats();
        const message = `📊 **Estadísticas de Búsqueda en Internet**

🔍 **Google Search:** ${stats.dailyUsage.Google} de 100 búsquedas usadas hoy
📖 **Bing Search:** ${stats.dailyUsage.Bing} de 1000 búsquedas usadas en el mes
🦆 **DuckDuckGo:** Ilimitado

💡 Los contadores se reinician automáticamente cada día.`;
        
        await saveInteraction(userMessage, message, null, true);
        updateConversationContext(userName, userMessage, message, null);
        return { text: message, action: null };
      }

      // ===== PROCESAR SHOW_CODE =====

if (localCommand && localCommand.type === 'SHOW_CODE') {
  const { selfModificationService } = await import('./selfModificationService.js');
  
  let fileName = localCommand.file;
  let searchFunction = null;
  
  // Verificar si se pidió una función específica
  if (fileName.includes('.')) {
    // Si tiene punto, es un archivo
    searchFunction = null;
  } else if (fileName.includes('detectCommandLocally') || 
             fileName.includes('getJarvisResponse') || 
             fileName.includes('execute')) {
    // Es una función, no un archivo
    searchFunction = fileName;
    fileName = 'groqService.js'; // archivo por defecto
  }
  
  // Construir la ruta completa del archivo
  let fullFileName;
  if (fileName.startsWith('server/')) {
    fullFileName = fileName;
  } else if (fileName.includes('/')) {
    fullFileName = `server/${fileName}`;
  } else {
    // Intentar encontrar el archivo
    const possiblePaths = [
      `server/services/${fileName}.js`,
      `server/services/aiProviders/${fileName}.js`,
      `server/routes/${fileName}.js`,
      `server/${fileName}.js`
    ];
    
    let found = false;
    for (const path of possiblePaths) {
      const exists = await selfModificationService.fileExists(path);
      if (exists) {
        fullFileName = path;
        found = true;
        break;
      }
    }
    
    if (!found) {
      // Listar archivos disponibles
      const availableFiles = await selfModificationService.listProjectFiles();
      const filesList = availableFiles.map(f => `  • ${f}`).join('\n');
      
      const errorMsg = `❌ **Archivo no encontrado:** "${fileName}"

📁 **Archivos disponibles en el proyecto:**

${filesList}

💡 **Sugerencia:** Usa uno de los nombres de arriba, por ejemplo:
• "muestra tu código de groqService"
• "muestra tu código de actionsService"`;
      
      await saveInteraction(userMessage, errorMsg, null, true);
      updateConversationContext(userName, userMessage, errorMsg, null);
      return { text: errorMsg, action: null };
    }
  }
  
  // Verificar si el archivo existe
  const fileExists = await selfModificationService.fileExists(fullFileName);
  
  if (!fileExists) {
    const errorMsg = `❌ **El archivo "${fullFileName}" no existe en el proyecto.**

¿Quieres que te muestre la lista de archivos disponibles?`;
    
    await saveInteraction(userMessage, errorMsg, null, true);
    updateConversationContext(userName, userMessage, errorMsg, null);
    return { text: errorMsg, action: null };
  }
  
  // Si se busca una función específica
  if (searchFunction) {
    const functionResult = await selfModificationService.searchFunctionInFile(fullFileName, searchFunction);
    
    if (!functionResult.success) {
      // Listar funciones disponibles en el archivo
      const content = (await selfModificationService.readFile(fullFileName)).content;
      const functions = content.match(/(?:function|async function|const)\s+(\w+)\s*[=\(]/g) || [];
      const functionNames = functions.map(f => f.replace(/function|async|const|=/g, '').trim()).slice(0, 20);
      
      const errorMsg = `❌ **Función "${searchFunction}" no encontrada en ${fullFileName}**

📋 **Funciones disponibles en este archivo:**
${functionNames.map(f => `  • ${f}`).join('\n')}

💡 **Sugerencia:** Usa uno de los nombres de arriba.`;
      
      await saveInteraction(userMessage, errorMsg, null, true);
      updateConversationContext(userName, userMessage, errorMsg, null);
      return { text: errorMsg, action: null };
    }
    
    const message = `📄 **Función "${searchFunction}" encontrada en ${fullFileName} (línea ${functionResult.line})**

\`\`\`javascript
${functionResult.content}
\`\`\`

¿Quieres que modifique esta función?`;
    
    await saveInteraction(userMessage, message, null, true);
    updateConversationContext(userName, userMessage, message, null);
    return { text: message, action: null };
  }
  
  // Si solo se busca el archivo completo
  const result = await selfModificationService.readFile(fullFileName);
  
  if (result.success) {
    const lines = result.content.split('\n');
    const preview = lines.slice(0, 60).join('\n');
    const totalLines = lines.length;
    
    // Verificar funciones en el archivo
    const functions = result.content.match(/(?:function|async function|const)\s+(\w+)\s*[=\(]/g) || [];
    const functionNames = functions.map(f => f.replace(/function|async|const|=/g, '').trim()).slice(0, 15);
    
    const message = `📄 **Código de ${fullFileName}**

\`\`\`javascript
${preview}
${totalLines > 60 ? `\n... (${totalLines - 60} líneas más, código truncado)` : ''}
\`\`\`

📊 **Total:** ${totalLines} líneas

📋 **Funciones principales en este archivo:**
${functionNames.map(f => `  • ${f}`).join('\n')}

💡 **Para ver una función específica, decime:**
• "muéstrame la función detectCommandLocally de groqService"
• "busca la función execute en actionsService"`;
    
    await saveInteraction(userMessage, message, null, true);
    updateConversationContext(userName, userMessage, message, null);
    return { text: message, action: null };
  } else {
    const errorMsg = `❌ **No pude leer el archivo ${fullFileName}:** ${result.error}`;
    await saveInteraction(userMessage, errorMsg, null, false);
    updateConversationContext(userName, userMessage, errorMsg, null);
    return { text: errorMsg, action: null };
  }
}

// ===== PROCESAR ADD_COMMAND =====
if (localCommand && localCommand.type === 'ADD_COMMAND') {
  const { selfModificationService } = await import('./selfModificationService.js');
  
  const command = localCommand.command;
  const response = localCommand.response;
  
  const result = await selfModificationService.addVoiceCommand(command, response, 'CUSTOM_COMMAND');
  
  if (result.success) {
    const message = `✅ **Nuevo comando agregado!**

Ahora puedes decir: **"${command}"** y te responderé: *"${response}"*

Para que funcione, necesito reiniciarme. ¿Quieres que lo haga ahora?`;
    
    await saveInteraction(userMessage, message, null, true);
    updateConversationContext(userName, userMessage, message, null);
    return { text: message, action: null };
  } else {
    const errorMsg = `No pude agregar el comando: ${result.error}`;
    await saveInteraction(userMessage, errorMsg, null, false);
    updateConversationContext(userName, userMessage, errorMsg, null);
    return { text: errorMsg, action: null };
  }
}

// ===== PROCESAR CODE_STATS =====
if (localCommand && localCommand.type === 'CODE_STATS') {
  const { selfModificationService } = await import('./selfModificationService.js');
  const fileName = `server/services/${localCommand.file}.js`;
  
  const result = await selfModificationService.getCodeStats(fileName);
  
  if (result.success) {
    const stats = result.stats;
    const message = `📊 **Estadísticas de ${localCommand.file}.js**

📝 **Líneas totales:** ${stats.lines}
🔧 **Funciones:** ${stats.functions}
⚡ **Funciones async:** ${stats.asyncFunctions}
💬 **Comentarios:** ${stats.comments}
💾 **Tamaño:** ${stats.sizeKB} KB

¿Quieres que vea el código de otro archivo?`;
    
    await saveInteraction(userMessage, message, null, true);
    updateConversationContext(userName, userMessage, message, null);
    return { text: message, action: null };
  } else {
    const errorMsg = `No pude obtener estadísticas: ${result.error}`;
    await saveInteraction(userMessage, errorMsg, null, false);
    updateConversationContext(userName, userMessage, errorMsg, null);
    return { text: errorMsg, action: null };
  }
}

// ===== PROCESAR LIST_BACKUPS =====
if (localCommand && localCommand.type === 'LIST_BACKUPS') {
  const { selfModificationService } = await import('./selfModificationService.js');
  const fileName = `server/services/${localCommand.file}.js`;
  
  const result = await selfModificationService.listBackups(fileName);
  
  if (result.success && result.backups.length > 0) {
    const backupsList = result.backups.map((b, i) => `${i + 1}. ${b}`).join('\n');
    const message = `📦 **Backups disponibles para ${localCommand.file}.js**

${backupsList}

Para restaurar uno, decime: **"restaura backup [número] de ${localCommand.file}"**`;
    
    await saveInteraction(userMessage, message, null, true);
    updateConversationContext(userName, userMessage, message, null);
    return { text: message, action: null };
  } else {
    const message = `📦 No hay backups disponibles para ${localCommand.file}.js`;
    await saveInteraction(userMessage, message, null, true);
    updateConversationContext(userName, userMessage, message, null);
    return { text: message, action: null };
  }
}
      
      // ===== PROCESAR EJECUTAR CÓDIGO =====
      if (localCommand && localCommand.type === 'EJECUTAR_CODIGO') {
        console.log(`💻 Ejecutando código: ${localCommand.code.substring(0, 100)}...`);
        const response = await actionService.execute('EJECUTAR_CODIGO', localCommand.code, userName);
        
        if (response.success) {
          await saveInteraction(userMessage, response.message, null, true);
          updateConversationContext(userName, userMessage, response.message, null);
          return { text: response.message, action: null };
        } else {
          const errorMessage = `Error ejecutando código: ${response.message}`;
          await saveInteraction(userMessage, errorMessage, null, false);
          updateConversationContext(userName, userMessage, errorMessage, null);
          return { text: errorMessage, action: null };
        }
      }
      
      // ===== PROCESAR GENERATE_EXERCISE =====
      if (localCommand && localCommand.type === 'GENERATE_EXERCISE') {
        const exercise = codingService.generateExercise(localCommand.language, localCommand.level);
        if (exercise) {
          const exerciseText = `📝 **Ejercicio de ${exercise.language} (${exercise.level})**

${exercise.exercise}

💡 **Pista**: ${exercise.hint}

¿Quieres que evalúe tu solución cuando la tengas?`;
          await saveInteraction(userMessage, exerciseText, null, true);
          updateConversationContext(userName, userMessage, exerciseText, null);
          return { text: exerciseText, action: null };
        }
      }
      
      // ===== PROCESAR ANALYZE_CODE =====
      if (localCommand && localCommand.type === 'ANALYZE_CODE') {
        const analysis = await codingService.analyzeCode(localCommand.code, localCommand.language);
        const analysisText = `🔍 **Análisis de código**

📊 **Métricas**:
• Líneas: ${analysis.lines}
• Complejidad: ${analysis.complexity}
• Patrones detectados: ${analysis.patterns.join(', ') || 'ninguno'}

💡 **Sugerencias**:
${analysis.suggestions.map(s => `• ${s}`).join('\n')}

🛠️ **Mejoras sugeridas**:
${analysis.improvements.map(i => `• ${i}`).join('\n')}`;
        await saveInteraction(userMessage, analysisText, null, true);
        updateConversationContext(userName, userMessage, analysisText, null);
        return { text: analysisText, action: null };
      }
      
      // ===== PROCESAR GET_RESOURCES =====
      if (localCommand && localCommand.type === 'GET_RESOURCES') {
        const resources = await codingService.getLearningResources(localCommand.language);
        const resourcesText = `📚 **Recursos gratuitos para aprender ${localCommand.language}**

${resources.map(r => `• **${r.name}**: ${r.url}`).join('\n')}

🎯 **Recomendación**: Empieza con los tutoriales oficiales y practica en Exercism.`;
        await saveInteraction(userMessage, resourcesText, null, true);
        updateConversationContext(userName, userMessage, resourcesText, null);
        return { text: resourcesText, action: null };
      }
      
      // ===== PROCESAR EVALUATE_CODE =====
      if (localCommand && localCommand.type === 'EVALUATE_CODE') {
        const evaluation = await codingService.evaluateCode(localCommand.code, localCommand.language, ['función', 'retorno']);
        const evaluationText = `📊 **Evaluación de código**

🎯 **Puntaje**: ${evaluation.score}/100

📝 **Feedback**:
${evaluation.feedback.map(f => `• ${f}`).join('\n')}

⚠️ **Advertencias**:
${evaluation.warnings.map(w => `• ${w}`).join('\n')}

🚀 **Mejoras sugeridas**:
${evaluation.improvements.map(i => `• ${i}`).join('\n')}`;
        await saveInteraction(userMessage, evaluationText, null, true);
        updateConversationContext(userName, userMessage, evaluationText, null);
        return { text: evaluationText, action: null };
      }
      
      // ===== PROCESAR COMANDOS NORMALES (con action/response) =====
      if (localCommand && (localCommand.action || localCommand.response)) {
        if (localCommand.action?.type === 'GET_STATS') {
          const stats = await getLearningStats();
          const response = `He aprendido ${stats.total_conversations || 0} conversaciones, ${stats.learned_facts || 0} hechos, y ${stats.custom_commands || 0} comandos personalizados.`;
          await saveInteraction(userMessage, response, localCommand.action, true);
          updateConversationContext(userName, userMessage, response, localCommand.action);
          return { text: response, action: null };
        }
        
        if (localCommand.action?.type === 'LEARN_FACT') {
          await learnFact(localCommand.action.param, 'user_teaching', 'custom');
          await saveInteraction(userMessage, localCommand.response, localCommand.action, true);
          updateConversationContext(userName, userMessage, localCommand.response, localCommand.action);
          return { text: localCommand.response, action: null };
        }
        
        if (localCommand.action || localCommand.response) {
          await saveInteraction(userMessage, localCommand.response, localCommand.action || null, true);
          updateConversationContext(userName, userMessage, localCommand.response, localCommand.action || null);
          return { text: localCommand.response, action: localCommand.action || null };
        }
      }
      
      // ===== DETECTAR COMANDOS PERSONALIZADOS =====
      const customCommand = await findCustomCommand(userMessage);
      if (customCommand) {
        console.log(`🎯 Comando personalizado detectado: "${customCommand.matched}"`);
        const response = `Ejecutando: ${customCommand.matched}`;
        await saveInteraction(userMessage, response, customCommand.action, true);
        updateConversationContext(userName, userMessage, response, customCommand.action);
        return { text: response, action: customCommand.action };
      }
      
      // ===== CONTEXTO Y MEMORIA =====
      const similarResponses = await findSimilarPastResponse(userMessage);
      let memoryContext = '';
      if (similarResponses.length > 0) {
        memoryContext = `\nBasado en conversaciones anteriores similares: ${similarResponses.map(r => `"${r.user_input}" → "${r.jarvis_response}"`).join('; ')}.`;
      }
      
      const learnedFacts = await findFact(userMessage);
      let factsContext = '';
      if (learnedFacts.length > 0) {
        factsContext = `\nHechos aprendidos: ${learnedFacts.map(f => `"${f.fact}"`).join('; ')}.`;
      }
      
      let userPreferences = '';
      if (userName) {
        const prefs = await getUserPreferences(userName);
        if (prefs.length > 0) {
          userPreferences = `\nPreferencias de ${userName}: ${prefs.map(p => `${p.preference_key}: ${p.preference_value}`).join(', ')}.`;
        }
      }
      
      const context = getConversationContext(userName);
      let contextHistory = '';
      if (context.conversationHistory.length > 0) {
        const lastFew = context.conversationHistory.slice(-3);
        contextHistory = `\nConversación reciente: ${lastFew.map(h => `Usuario: "${h.command}" → JARVIS: "${h.response}"`).join('; ')}.`;
      }
      
      const systemPrompt = `Eres JARVIS, un asistente personal inteligente y amigable.

CARACTERÍSTICAS:
- Hablas español neutro, natural y cercano
- Eres proactivo y ofreces ayuda
- Tienes sentido del humor
- Siempre respondes en español

CAPACIDADES:
- Controlar Spotify (reproducir, pausar, siguiente, volumen)
- Recomendar música según estado de ánimo
- Controlar dispositivos del hogar (luces, PS4, A/C)
- Responder preguntas generales
- Aprender de conversaciones pasadas
- Enseñar programación (JavaScript, Python, etc.)

${memoryContext}${factsContext}${userPreferences}${contextHistory}

${usingFallback ? `⚠️ ACTUALMENTE ESTÁS EN MODO RESPALDO CON ${currentProvider}. RESPONDE NORMALMENTE.` : ''}`;

      const formattedHistory = conversationHistory.slice(-5).map(msg => ({
        role: msg.role === 'jarvis' ? 'assistant' : 'user',
        content: msg.content
      }));

      const messages = [
        { role: 'system', content: systemPrompt },
        ...formattedHistory,
        { role: 'user', content: userMessage }
      ];
      
      console.log(`🤖 Enviando consulta a IA... (modo: ${usingFallback ? 'respaldo' : 'normal'})`);
      
      const aiResponse = await providerManager.chatWithRetry(messages, {
        temperature: 0.7,
        maxTokens: 500,
        topP: 0.9
      });
      
      if (aiResponse.success) {
        if (aiResponse.provider !== 'Groq') {
          usingFallback = true;
          currentProvider = aiResponse.provider;
          console.log(`⚠️ Usando proveedor de respaldo: ${currentProvider} (${aiResponse.responseTime}ms)`);
        } else {
          if (usingFallback) {
            usingFallback = false;
            currentProvider = 'Groq';
            console.log('✅ Groq está nuevamente disponible');
          } else {
            console.log(`✅ Respuesta de Groq (${aiResponse.responseTime}ms)`);
          }
        }
        
        let response = aiResponse.content;
        response = response.replace(/```json\s*/g, '').replace(/```\s*/g, '');

        let action = null;
        const actionMatch = response.match(/\{"accion":\s*"([^"]+)",\s*"parametro":\s*"([^"]*)"\}/);
        if (actionMatch) {
          action = { type: actionMatch[1], param: actionMatch[2] };
          response = response.replace(/\{"accion".*\}/, '').trim();
        }

        if (!action && (userMessage.toLowerCase().includes('música') || userMessage.toLowerCase().includes('spotify'))) {
          let param = '';
          const artistMatch = userMessage.match(/(?:de|del)\s+([a-záéíóúñ\s]+)/i);
          if (artistMatch) param = artistMatch[1].trim();
          action = { type: 'SPOTIFY_PLAY', param: param };
          if (!response || response.length < 10) {
            response = param ? `Reproduciendo ${param} en Spotify.` : 'Reproduciendo música en Spotify.';
          }
        }

        await saveInteraction(userMessage, response, action, true);
        updateConversationContext(userName, userMessage, response, action);
        
        return {
          text: response,
          action: action,
          provider: aiResponse.provider,
          responseTime: aiResponse.responseTime
        };
      }
      
      console.error('❌ Todos los proveedores fallaron');
      const fallbackResponse = 'Lo siento, todos mis sistemas de IA están temporalmente sobrecargados. Por favor, intenta de nuevo en unos momentos.';
      await saveInteraction(userMessage, fallbackResponse, null, false);
      updateConversationContext(userName, userMessage, fallbackResponse, null);
      return { text: fallbackResponse, action: null };
      
    } catch (error) {
      console.error('Error en getJarvisResponse:', error);
      let fallbackResponse = 'Hubo un problema. ¿Podrías repetirlo?';
      if (userMessage.toLowerCase().includes('música') || userMessage.toLowerCase().includes('spotify')) {
        fallbackResponse = 'Reproduciendo música en Spotify.';
        const action = { type: 'SPOTIFY_PLAY', param: '' };
        await saveInteraction(userMessage, fallbackResponse, action, false);
        updateConversationContext(userName, userMessage, fallbackResponse, action);
        return { text: fallbackResponse, action: action };
      }
      await saveInteraction(userMessage, fallbackResponse, null, false);
      updateConversationContext(userName, userMessage, fallbackResponse, null);
      return { text: fallbackResponse, action: null };
    }
  },
  
  async getProviderStats() {
    return providerManager.getStats();
  },
  
  async healthCheck() {
    return await providerManager.healthCheck();
  },
  
  getCurrentProvider() {
    return { current: currentProvider, isFallback: usingFallback };
  }
};