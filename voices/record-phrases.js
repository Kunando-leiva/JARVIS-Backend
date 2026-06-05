import { customVoiceService } from './server/services/customVoiceService.js';
import fs from 'fs/promises';

// Lista de frases comunes que Jarvis dice
const phrases = [
  "Hola, ¿en qué puedo ayudarte?",
  "Entendido, señor.",
  "Lo siento, no pude procesar eso.",
  "Apagando el sistema.",
  "Encendiendo las luces.",
  "Reproduciendo música.",
  "La hora actual es.",
  "El clima está.",
  "Hasta luego."
];

async function recordPhrases() {
  console.log("🎙️ Modo grabación de frases");
  console.log("Vas a grabar estas frases con TU voz:");
  phrases.forEach((p, i) => console.log(`${i+1}. ${p}`));
  
  for (const phrase of phrases) {
    console.log(`\n📢 Decí: "${phrase}"`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Aquí podrías grabar con el micrófono (requiere librería adicional)
    console.log(`✅ Simulando grabación de: "${phrase}"`);
  }
}

recordPhrases();
