import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const VOICES_DIR = path.join(__dirname, '../../custom_voices');
const FALLBACK_VOICE = 'es-ES-AlvaroNeural';

export const customVoiceService = {
  async textToSpeech(text) {
    try {
      // Verificar si tenemos una frase grabada exacta
      const phraseKey = text.toLowerCase().trim().substring(0, 50);
      const audioFile = path.join(VOICES_DIR, `${Buffer.from(phraseKey).toString('base64')}.mp3`);
      
      // Si existe el archivo grabado, usarlo
      try {
        await fs.access(audioFile);
        console.log(`🎤 Usando grabación personalizada para: "${text.substring(0, 30)}..."`);
        return await fs.readFile(audioFile);
      } catch {
        // No existe grabación, usar Edge TTS normal
        console.log(`🎤 Usando Edge TTS (sin grabación personalizada)`);
        return await this.fallbackTTS(text);
      }
    } catch (error) {
      console.error('Error en voz personalizada:', error);
      return await this.fallbackTTS(text);
    }
  },

  async fallbackTTS(text) {
    try {
      const tempFile = path.join(__dirname, '../../temp/temp_audio.mp3');
      await fs.mkdir(path.dirname(tempFile), { recursive: true });
      
      const escapedText = text.replace(/["']/g, '').replace(/\n/g, ' ');
      const command = `edge-tts --text "${escapedText}" --voice ${FALLBACK_VOICE} --write-media "${tempFile}"`;
      
      await execAsync(command, { shell: 'powershell.exe' });
      const audioBuffer = await fs.readFile(tempFile);
      await fs.unlink(tempFile).catch(() => {});
      return audioBuffer;
    } catch (error) {
      console.error('Error en fallback TTS:', error);
      return null;
    }
  },

  async recordPhrase(text, audioBuffer) {
    await fs.mkdir(VOICES_DIR, { recursive: true });
    const phraseKey = text.toLowerCase().trim().substring(0, 50);
    const audioFile = path.join(VOICES_DIR, `${Buffer.from(phraseKey).toString('base64')}.mp3`);
    await fs.writeFile(audioFile, audioBuffer);
    console.log(`📀 Frase grabada: "${text}"`);
  }
};