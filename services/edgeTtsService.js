import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const edgeTtsService = {
  async textToSpeech(text) {
    try {
      // Limpiar el texto
      const cleanText = text.replace(/[^\w\sáéíóúñÑ¿¡!?,.;:()-]/g, ' ').replace(/\s+/g, ' ').trim();
      
      // Crear archivo temporal
      const tempDir = path.join(__dirname, '../../temp');
      await fs.mkdir(tempDir, { recursive: true });
      const tempFile = path.join(tempDir, `speech_${Date.now()}.mp3`);
      
      // Escapar texto para el comando
      const escapedText = cleanText.replace(/["']/g, '').replace(/\n/g, ' ');
      
      // Usar voz masculina de España (cambiá si querés otra)
      const voice = 'es-MX-JorgeNeural';
      const command = `edge-tts --text "${escapedText}" --voice ${voice} --write-media "${tempFile}"`;
      
      console.log(`🔊 Ejecutando: edge-tts con voz ${voice}`);
      
      await execAsync(command, { shell: 'powershell.exe' });
      
      const audioBuffer = await fs.readFile(tempFile);
      await fs.unlink(tempFile).catch(() => {});
      
      return audioBuffer;
    } catch (error) {
      console.error('Error en Edge TTS:', error.message);
      return null;
    }
  }
};