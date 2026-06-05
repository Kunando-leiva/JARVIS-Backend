// server/services/spotifyWebApi.js

import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();

let accessToken = null;
let refreshToken = null;
let tokenExpiration = 0;
const TOKEN_FILE = path.join(__dirname, '../spotify_tokens.json');

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = 'http://127.0.0.1:3001/auth/spotify/callback';

// ============= TOKEN MANAGEMENT =============
async function saveTokens() {
  try {
    await fs.writeFile(TOKEN_FILE, JSON.stringify({
      accessToken, refreshToken, tokenExpiration
    }, null, 2));
  } catch (error) {
    console.error('Error guardando tokens:', error);
  }
}

async function loadTokens() {
  try {
    const data = await fs.readFile(TOKEN_FILE, 'utf8');
    const tokens = JSON.parse(data);
    accessToken = tokens.accessToken;
    refreshToken = tokens.refreshToken;
    tokenExpiration = tokens.tokenExpiration;
    console.log('✅ Tokens de Spotify cargados');
    return true;
  } catch (error) {
    console.log('📝 No hay tokens guardados, necesitas autenticarte');
    return false;
  }
}

export function getAuthUrl() {
  const scopes = [
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'playlist-read-private',
    'playlist-modify-private',
    'user-library-read',
    'user-library-modify'
  ].join(' ');
  
  return `https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(scopes)}&show_dialog=true`;
}

export async function exchangeCodeForToken(code) {
  try {
    const response = await axios.post('https://accounts.spotify.com/api/token', 
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET
      }), {
        headers: { 
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
        }
      }
    );
    
    accessToken = response.data.access_token;
    refreshToken = response.data.refresh_token;
    tokenExpiration = Date.now() + (response.data.expires_in * 1000);
    await saveTokens();
    console.log('✅ Token de usuario obtenido correctamente');
    return { success: true, message: 'Autenticación exitosa' };
  } catch (error) {
    console.error('Error obteniendo token:', error.response?.data || error.message);
    return { success: false, error: error.response?.data || error.message };
  }
}

async function refreshAccessToken() {
  if (!refreshToken) return false;
  
  try {
    const response = await axios.post('https://accounts.spotify.com/api/token',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET
      }), {
        headers: { 
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
        }
      }
    );
    
    accessToken = response.data.access_token;
    tokenExpiration = Date.now() + (response.data.expires_in * 1000);
    await saveTokens();
    console.log('🔄 Token de Spotify refrescado');
    return true;
  } catch (error) {
    console.error('Error refrescando token:', error.response?.data || error.message);
    return false;
  }
}

async function ensureValidToken() {
  if (!accessToken) {
    const loaded = await loadTokens();
    if (!loaded) return false;
  }
  
  if (Date.now() >= tokenExpiration) {
    return await refreshAccessToken();
  }
  return true;
}

async function spotifyApiRequest(endpoint, method = 'GET', body = null, retries = 2) {
  const isValid = await ensureValidToken();
  if (!isValid) {
    return { success: false, error: 'No autenticado. Visita http://127.0.0.1:3001/auth/spotify' };
  }
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const config = {
        method,
        url: `https://api.spotify.com/v1/${endpoint}`,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      };
      
      if (body) config.data = body;
      
      const response = await axios(config);
      return { success: true, data: response.data };
    } catch (error) {
      console.error(`Intento ${attempt + 1} fallido:`, error.response?.data?.error?.message || error.message);
      
      if (error.response?.status === 401 && attempt < retries) {
        await refreshAccessToken();
        continue;
      }
      
      if (error.response?.status === 404 && attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }
      
      return { success: false, error: error.response?.data?.error || error.message };
    }
  }
  
  return { success: false, error: 'Max retries reached' };
}

// ============= MÉTODOS PRINCIPALES =============
export const spotifyWebApi = {
  isAuthenticated() {
    return accessToken !== null;
  },
  
  async getDevices() {
    const result = await spotifyApiRequest('me/player/devices');
    return result.success ? result.data.devices : [];
  },
  
  async openSpotify() {
    return new Promise((resolve) => {
      console.log('🎵 Abriendo Spotify...');
      exec('start spotify:', (error) => {
        if (error) {
          console.log('⚠️ No se pudo abrir Spotify');
          resolve(false);
        } else {
          console.log('✅ Spotify abierto');
          resolve(true);
        }
      });
    });
  },
  
  async ensureActiveDevice() {
    console.log('🎵 Verificando dispositivos...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    const devices = await this.getDevices();
    
    if (devices.length === 0) {
      console.log('⚠️ No hay dispositivos activos');
      return false;
    }
    console.log(`✅ Dispositivo activo: ${devices[0].name}`);
    return true;
  },
  
  async playTrack(uri, retryCount = 0) {
    let hasDevice = await this.ensureActiveDevice();
    
    if (!hasDevice) {
      await this.openSpotify();
      await new Promise(resolve => setTimeout(resolve, 4000));
      hasDevice = await this.ensureActiveDevice();
      
      if (!hasDevice) {
        return { success: false, message: '❌ Abrí Spotify manualmente primero' };
      }
    }
    
    const result = await spotifyApiRequest('me/player/play', 'PUT', { uris: [uri] });
    
    if (result.success) {
      return { success: true, message: '🎵 Reproduciendo en Spotify' };
    }
    
    if (result.error?.reason === 'NO_ACTIVE_DEVICE' && retryCount === 0) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      return this.playTrack(uri, 1);
    }
    
    return { success: false, message: 'No se pudo reproducir' };
  },
  
  async searchTracks(query) {
    const result = await spotifyApiRequest(`search?q=${encodeURIComponent(query)}&type=track&limit=5`);
    
    if (result.success && result.data.tracks.items.length > 0) {
      return {
        success: true,
        tracks: result.data.tracks.items.map(track => ({
          name: track.name,
          artist: track.artists[0].name,
          url: track.external_urls.spotify,
          uri: track.uri
        }))
      };
    }
    return { success: false, tracks: [] };
  },
  
  async searchPodcast(query) {
    console.log(`🎙️ Buscando podcast: ${query}`);
    const result = await spotifyApiRequest(`search?q=${encodeURIComponent(query)}&type=show,episode&limit=5`);
    
    if (result.success) {
      const podcasts = [];
      
      if (result.data.shows?.items?.length > 0) {
        result.data.shows.items.forEach(show => {
          podcasts.push({
            name: show.name,
            publisher: show.publisher,
            url: show.external_urls.spotify,
            uri: show.uri,
            type: 'show'
          });
        });
      }
      
      if (result.data.episodes?.items?.length > 0 && podcasts.length < 3) {
        result.data.episodes.items.forEach(episode => {
          podcasts.push({
            name: episode.name,
            publisher: episode.show?.publisher || 'Podcast',
            url: episode.external_urls.spotify,
            uri: episode.uri,
            type: 'episode'
          });
        });
      }
      
      if (podcasts.length > 0) {
        return { success: true, tracks: podcasts };
      }
    }
    
    return { success: false, tracks: [] };
  },
  
  async searchAndPlay(query) {
    if (!query || query.trim() === '' || query === 'música') {
      query = 'populares 2024';
    }
    
    console.log(`🔍 Buscando y reproduciendo: ${query}`);
    const searchResult = await this.searchTracks(query);
    
    if (searchResult.success && searchResult.tracks.length > 0) {
      const track = searchResult.tracks[0];
      console.log(`🎵 Reproduciendo: ${track.name} - ${track.artist}`);
      return await this.playTrack(track.uri);
    }
    return { success: false, message: `No encontré: ${query}` };
  },
  
  async searchAndPlayPodcast(query) {
    if (!query || query.trim() === '') {
      return { success: false, message: '¿Qué podcast quieres escuchar?' };
    }
    
    console.log(`🎙️ Buscando y reproduciendo podcast: ${query}`);
    const searchResult = await this.searchPodcast(query);
    
    if (searchResult.success && searchResult.tracks.length > 0) {
      const podcast = searchResult.tracks[0];
      console.log(`🎙️ Reproduciendo: ${podcast.name}`);
      return await this.playTrack(podcast.uri);
    }
    return { success: false, message: `No encontré el podcast: ${query}` };
  },
  
  async pausePlayback() {
    console.log('⏸️ Pausando Spotify...');
    const result = await spotifyApiRequest('me/player/pause', 'PUT');
    
    if (result.success) {
      return { success: true, message: 'Música pausada' };
    }
    
    try {
      await execAsync('powershell -c "(New-Object -ComObject WScript.Shell).SendKeys(0xB3)"', { shell: 'powershell.exe' });
      return { success: true, message: 'Música pausada' };
    } catch (error) {
      return { success: false, message: 'No pude pausar la música' };
    }
  },
  
  async resumePlayback() {
    console.log('▶️ Reanudando Spotify...');
    const result = await spotifyApiRequest('me/player/play', 'PUT');
    
    if (result.success) {
      return { success: true, message: 'Reanudando reproducción' };
    }
    
    try {
      await execAsync('powershell -c "(New-Object -ComObject WScript.Shell).SendKeys(0xB3)"', { shell: 'powershell.exe' });
      return { success: true, message: 'Reanudando reproducción' };
    } catch (error) {
      return { success: false, message: 'No pude reanudar' };
    }
  },
  
  async nextTrack() {
    console.log('⏭️ Siguiente canción...');
    const result = await spotifyApiRequest('me/player/next', 'POST');
    
    if (result.success) {
      return { success: true, message: 'Siguiente canción' };
    }
    
    try {
      await execAsync('powershell -c "(New-Object -ComObject WScript.Shell).SendKeys(0xB0)"', { shell: 'powershell.exe' });
      return { success: true, message: 'Siguiente canción' };
    } catch (error) {
      return { success: false, message: 'No pude cambiar' };
    }
  },
  
  async previousTrack() {
    console.log('⏮️ Canción anterior...');
    const result = await spotifyApiRequest('me/player/previous', 'POST');
    
    if (result.success) {
      return { success: true, message: 'Canción anterior' };
    }
    
    try {
      await execAsync('powershell -c "(New-Object -ComObject WScript.Shell).SendKeys(0xB1)"', { shell: 'powershell.exe' });
      return { success: true, message: 'Canción anterior' };
    } catch (error) {
      return { success: false, message: 'No pude volver' };
    }
  },
  
  async volumeUp() {
    try {
      for(let i = 0; i < 5; i++) {
        await execAsync('powershell -c "(New-Object -ComObject WScript.Shell).SendKeys(0xAF)"', { shell: 'powershell.exe' });
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      return { success: true, message: 'Subiendo volumen' };
    } catch (error) {
      return { success: false, message: 'No pude subir volumen' };
    }
  },
  
  async volumeDown() {
    try {
      for(let i = 0; i < 5; i++) {
        await execAsync('powershell -c "(New-Object -ComObject WScript.Shell).SendKeys(0xAE)"', { shell: 'powershell.exe' });
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      return { success: true, message: 'Bajando volumen' };
    } catch (error) {
      return { success: false, message: 'No pude bajar volumen' };
    }
  },
  
  async mute() {
    try {
      await execAsync('powershell -c "(New-Object -ComObject WScript.Shell).SendKeys(0xAD)"', { shell: 'powershell.exe' });
      return { success: true, message: 'Volumen silenciado' };
    } catch (error) {
      return { success: false, message: 'No pude silenciar' };
    }
  },
  
  async getRecommendations(mood = 'random') {
    const moodMap = {
      'feliz': 'happy pop',
      'triste': 'sad songs',
      'energético': 'energetic rock',
      'relajado': 'chill music',
      'romántico': 'romantic songs',
      'fiesta': 'party music',
      'random': 'popular music'
    };
    
    const searchTerm = moodMap[mood] || moodMap.random;
    return await this.searchAndPlay(searchTerm);
  }
};

// Cargar tokens al inicio
loadTokens();