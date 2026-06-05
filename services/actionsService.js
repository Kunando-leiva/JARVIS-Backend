// server/services/actionsService.js

import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';
import { spotifyWebApi } from './spotifyWebApi.js';
import { ps4Service } from './ps4Service.js';
import { acService } from './acService.js';
import { tuyaService } from './tuyaService.js';
import { codeExecutor } from './codeExecutor.js';
import { searchService } from './searchService.js';

const execAsync = promisify(exec);

const activeTimers = new Map();

export const actionService = {
  async execute(actionType, param, userName = null, options = {}) {
    console.log(`🎬 Ejecutando acción: ${actionType} - ${param}`);
    
    switch(actionType) {
      // ===== LUZ =====
      case 'LIGHT_ON':
        return await tuyaService.turnOn(param || 'principal');
      case 'LIGHT_OFF':
        return await tuyaService.turnOff(param || 'principal');
      case 'LIGHT_TOGGLE':
        return await tuyaService.toggle(param || 'principal');
      case 'LIGHT_STATUS':
        const status = await tuyaService.getStatus(param || 'principal');
        if (status.power) {
          return { success: true, message: `La luz ${param || 'principal'} está encendida` };
        } else {
          return { success: true, message: `La luz ${param || 'principal'} está apagada` };
        }
      
      // ===== PS4 =====
      case 'PS4_ON':
        return await ps4Service.powerOn();
      case 'PS4_OFF':
        return await ps4Service.powerOff();
      case 'PS4_GAME':
        return await ps4Service.openGame(param);
      case 'PS4_COMMAND':
        return await ps4Service.sendCommand(param);
      case 'PS4_SCREENSHOT':
        return await ps4Service.takeScreenshot();
      case 'PS4_RECORD':
        return await ps4Service.recordVideo();
      
      // ===== AIRE ACONDICIONADO =====
      case 'AC_ON':
        return await acService.powerOn();
      case 'AC_OFF':
        return await acService.powerOff();
      case 'AC_TEMP_UP':
        return await acService.temperatureUp();
      case 'AC_TEMP_DOWN':
        return await acService.temperatureDown();
      case 'AC_TEMP_SET':
        const temp = parseInt(param);
        return await acService.setTemperature(temp);
      case 'AC_MODE':
        return await acService.setMode(param);
      case 'AC_FAN':
        return await acService.setFanSpeed(param);
      case 'AC_STATUS':
        return acService.getStatus();
      
      // ===== SPOTIFY =====
      case 'SPOTIFY_OPEN':
        try {
          console.log('🎵 Abriendo Spotify...');
          exec('start spotify:', (error) => {
            if (error) {
              console.error('Error abriendo Spotify:', error);
            }
          });
          return { success: true, message: 'Abriendo Spotify.' };
        } catch (error) {
          return { success: false, message: 'No pude abrir Spotify' };
        }
      
      case 'SPOTIFY_PLAY':
        if (!param || param.trim() === '' || param === 'música' || param === 'musica') {
          return await spotifyWebApi.searchAndPlay('populares 2024 hit');
        }
        return await spotifyWebApi.searchAndPlay(param);
      
      case 'SPOTIFY_PODCAST':
        return await spotifyWebApi.searchAndPlayPodcast(param);
      
      case 'SPOTIFY_PAUSE':
        return await spotifyWebApi.pausePlayback();
      
      case 'SPOTIFY_RESUME':
        return await spotifyWebApi.resumePlayback();
      
      case 'SPOTIFY_NEXT':
        return await spotifyWebApi.nextTrack();
      
      case 'SPOTIFY_PREVIOUS':
        return await spotifyWebApi.previousTrack();
      
      case 'SPOTIFY_VOLUME_UP':
        return await spotifyWebApi.volumeUp();
      
      case 'SPOTIFY_VOLUME_DOWN':
        return await spotifyWebApi.volumeDown();
      
      case 'SPOTIFY_VOLUME_SET':
        const volumeNum = parseInt(param);
        if (!isNaN(volumeNum) && volumeNum >= 0 && volumeNum <= 100) {
          try {
            await execAsync(`powershell -c "(New-Object -ComObject WScript.Shell).SendKeys(0xAF)"`, { shell: 'powershell.exe' });
            return { success: true, message: `Volumen ajustado al ${volumeNum}% (aproximado)` };
          } catch {
            return { success: false, message: 'No pude ajustar el volumen' };
          }
        }
        return { success: false, message: 'Volumen no válido' };
      
      case 'SPOTIFY_MUTE':
        return await spotifyWebApi.mute();
      
      case 'SPOTIFY_RECOMMEND':
        const mood = param || 'random';
        return await spotifyWebApi.getRecommendations(mood);
      
      // ===== NUEVOS COMANDOS DE BÚSQUEDA =====
      case 'BUSCAR_PODCAST':
        try {
          const query = param;
          console.log(`🎙️ Buscando podcast: ${query}`);
          
          const searchResult = await spotifyWebApi.searchPodcast(query);
          
          if (searchResult.success && searchResult.tracks && searchResult.tracks.length > 0) {
            const podcast = searchResult.tracks[0];
            
            const playResult = await spotifyWebApi.playTrack(podcast.url);
            
            if (playResult.success) {
              return { 
                success: true, 
                message: `🎙️ Reproduciendo podcast: **${podcast.name}**\n📻 ${podcast.publisher || 'Spotify'}\n\n${playResult.message || 'Disfruta la escucha!'}`
              };
            } else {
              return { 
                success: true, 
                message: `🎙️ Encontré el podcast: **${podcast.name}**\n📻 ${podcast.publisher || 'Spotify'}\n🔗 ${podcast.url}\n\nNo pude reproducirlo automáticamente. Abrelo manualmente.`
              };
            }
          } else {
            return { 
              success: false, 
              message: `🔍 No encontré podcasts sobre "${query}". ¿Quieres que busque algo más específico?` 
            };
          }
        } catch (error) {
          console.error('Error buscando podcast:', error);
          return { 
            success: false, 
            message: `No pude buscar el podcast: ${error.message}` 
          };
        }
      
      case 'BUSCAR_CANCION':
        try {
          const query = param;
          console.log(`🎵 Buscando canción: ${query}`);
          
          const searchResult = await spotifyWebApi.searchTracks(query);
          
          if (searchResult.success && searchResult.tracks && searchResult.tracks.length > 0) {
            const track = searchResult.tracks[0];
            
            const playResult = await spotifyWebApi.playTrack(track.url);
            
            if (playResult.success) {
              return { 
                success: true, 
                message: `🎵 Reproduciendo: **${track.name}**\n🎤 ${track.artist}\n\n${playResult.message || 'Disfruta la música!'}`
              };
            } else {
              return { 
                success: true, 
                message: `🎵 Encontré: **${track.name}** de ${track.artist}\n🔗 ${track.url}\n\n¿Quieres que la reproduzca?`
              };
            }
          } else {
            return { 
              success: false, 
              message: `🔍 No encontré "${query}". ¿Quieres que busque algo similar?` 
            };
          }
        } catch (error) {
          console.error('Error buscando canción:', error);
          return { 
            success: false, 
            message: `No pude buscar la canción: ${error.message}` 
          };
        }
      
      case 'EJECUTAR_CODIGO':
  const codeToExecute = param;
  
  let language = 'javascript';
  if (codeToExecute.includes('def ') || (codeToExecute.includes('import ') && codeToExecute.includes('python'))) {
    language = 'python';
  } else if (codeToExecute.includes('function') || codeToExecute.includes('=>') || codeToExecute.includes('console.log')) {
    language = 'javascript';
  }
  
  console.log(`💻 Ejecutando código ${language}:`, codeToExecute.substring(0, 100));
  
  try {
    let result;
    if (language === 'javascript') {
      result = await codeExecutor.executeJavaScript(codeToExecute);
    } else if (language === 'python') {
      result = await codeExecutor.executePython(codeToExecute);
    } else {
      return { success: false, message: `Lenguaje ${language} no soportado aún` };
    }
    
    if (result.success) {
      let output = result.output.trim();
      
      if (!isNaN(output) && output !== '') {
        return { 
          success: true, 
          message: `El resultado de la ejecución es ${output}.` 
        };
      }
      
      if (output && output !== '✅ Código ejecutado correctamente (sin salida en consola)') {
        return { 
          success: true, 
          message: `El código ejecutado produce la siguiente salida: ${output}` 
        };
      }
      
      return { 
        success: true, 
        message: `Código ejecutado correctamente. No hubo salida en consola.` 
      };
      
    } else {
      return { 
        success: false, 
        message: `Error en el código: ${result.output.substring(0, 200)}` 
      };
    }
  } catch (error) {
    console.error('Error ejecutando código:', error);
    return { 
      success: false, 
      message: `No pude ejecutar el código: ${error.message}` 
    };
  }
      
      case 'CORREGIR_ERROR':
        const errorMsg = param;
        return { 
          success: true, 
          message: `🔧 **Analizando el error:**\n\`\`\`\n${errorMsg}\n\`\`\`\n\n¿Puedes compartir el código completo para ayudarte mejor?` 
        };
      
      // ===== CLIMA =====
      case 'CLIMA_EXTENDIDO':
        const ciudadExt = param || 'Buenos Aires';
        try {
          const response = await axios.get(`https://wttr.in/${ciudadExt}?format=%C+%t+%w+%h&lang=es`);
          const data = response.data;
          return { 
            success: true, 
            message: `En ${ciudadExt}: ${data}` 
          };
        } catch {
          return { success: false, message: `No pude obtener el clima de ${ciudadExt}` };
        }
      
      case 'TIMER':
        const seconds = parseInt(param);
        if (!isNaN(seconds) && seconds > 0) {
          const timerId = setTimeout(() => {
            console.log(`⏰ ¡Temporizador de ${seconds} segundos completado!`);
            activeTimers.delete(timerId);
          }, seconds * 1000);
          activeTimers.set(timerId, { seconds, userName });
          return { success: true, message: `⏰ Temporizador de ${seconds} segundos iniciado` };
        }
        return { success: false, message: 'Tiempo no válido' };
      
      case 'ABRIR_URL':
        const url = param.startsWith('http') ? param : `https://${param}.com`;
        const openCommand = process.platform === 'win32' 
          ? `start ${url}`
          : process.platform === 'darwin' 
            ? `open ${url}`
            : `xdg-open ${url}`;
        await execAsync(openCommand);
        return { success: true, message: `Abriendo ${url}` };
      
      case 'CLIMA':
        const ciudad = param || 'Buenos Aires';
        try {
          const response = await axios.get(`https://wttr.in/${ciudad}?format=%C+%t&lang=es`);
          const clima = response.data;
          return { success: true, message: `En ${ciudad}: ${clima}` };
        } catch {
          return { success: false, message: `No pude obtener el clima de ${ciudad}` };
        }
      
      case 'NOTICIAS':
        try {
          const response = await axios.get('https://api.spaceflightnewsapi.net/v4/articles?limit=3');
          const noticias = response.data.results.map(n => n.title).join('. ');
          return { success: true, message: `Últimas noticias: ${noticias}` };
        } catch {
          return { success: false, message: 'No pude obtener las noticias' };
        }
      
      case 'CHISTE':
        const chistes = [
          '¿Qué le dice un teclado a otro? ¡Tenemos que teclear!',
          '¿Por qué los programadores prefieren el modo oscuro? Porque la luz atrae a los bugs.',
          '¿Cómo se llama el campeón de buceo japonés? Tokofondo.',
          '¿Qué hace una abeja en el gimnasio? ¡Zum-ba!',
          '¿Cómo se despiden los químicos? Ácido un placer.',
          '¿Qué le dice un semáforo a otro? No me mires que me cambio.'
        ];
        const chiste = chistes[Math.floor(Math.random() * chistes.length)];
        return { success: true, message: chiste };
      
      case 'HORA':
        const ahora = new Date();
        const horaLocal = ahora.toLocaleString('es-ES', { hour12: false });
        return { success: true, message: `Son las ${horaLocal}` };


       // En actionsService.js, agregar el caso BUSCAR_EN_INTERNET

case 'BUSCAR_EN_INTERNET':
  try {
    const query = param;
    console.log(`🌐 Buscando en internet: ${query}`);
    
    const searchResult = await searchService.search(query);
    
    if (searchResult.success) {
      let message = '';
      
      if (searchResult.provider === 'Google') {
        message = `🔍 **Resultados de Google para "${query}":**\n\n${searchResult.answer}\n\n📊 Cuota restante hoy: ${searchResult.remainingQuota.Google} búsquedas`;
      } else if (searchResult.provider === 'Bing') {
        message = `🔍 **Resultados de Bing para "${query}":**\n\n${searchResult.answer}\n\n📊 Cuota restante del mes: ${searchResult.remainingQuota.Bing} búsquedas`;
      } else if (searchResult.provider === 'DuckDuckGo') {
        message = `🔍 **Información de DuckDuckGo:**\n\n${searchResult.answer}\n\n📖 Fuente: ${searchResult.source}`;
      } else {
        message = `🤖 **Respuesta:**\n\n${searchResult.answer}\n\n*(Información generada por IA)*`;
      }
      
      return { success: true, message: message };
    } else {
      return { 
        success: false, 
        message: `🔍 No encontré información sobre "${query}". ${searchResult.error || 'Intenta con otra pregunta.'}` 
      };
    }
  } catch (error) {
    console.error('Error en búsqueda:', error);
    return { 
      success: false, 
      message: `No pude buscar: ${error.message}` 
    };
  }
      
      case 'APAGAR_PC':
        if (param === 'confirmar') {
          setTimeout(async () => {
            if (process.platform === 'win32') {
              await execAsync('shutdown /s /t 30');
            } else {
              await execAsync('shutdown -h +1');
            }
          }, 5000);
          return { success: true, message: 'Apagando el sistema en 30 segundos.' };
        }
        return { success: false, message: 'Confirma el apagado para continuar' };
      
      case 'REINICIAR_PC':
        if (param === 'confirmar') {
          setTimeout(async () => {
            if (process.platform === 'win32') {
              await execAsync('shutdown /r /t 30');
            } else {
              await execAsync('shutdown -r +1');
            }
          }, 5000);
          return { success: true, message: 'Reiniciando el sistema en 30 segundos' };
        }
        return { success: false, message: 'Confirma el reinicio para continuar' };
      
      default:
        return { success: false, message: `No sé ejecutar ${actionType} todavía.` };
    }
  }
};