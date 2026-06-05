import express from 'express';
import { getAuthUrl, exchangeCodeForToken } from '../services/spotifyWebApi.js';

const router = express.Router();

router.get('/spotify', (req, res) => {
  const authUrl = getAuthUrl();
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Autenticar Spotify - JARVIS</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
          background: linear-gradient(135deg, #1DB954, #191414);
          color: white;
        }
        .container {
          text-align: center;
          background: rgba(0,0,0,0.8);
          padding: 40px;
          border-radius: 20px;
          max-width: 500px;
        }
        .spotify-btn {
          background: #1DB954;
          color: white;
          border: none;
          padding: 15px 30px;
          font-size: 18px;
          font-weight: bold;
          border-radius: 50px;
          cursor: pointer;
          margin: 20px 0;
        }
        .spotify-btn:hover {
          transform: scale(1.05);
          background: #1ed760;
        }
        .warning {
          background: rgba(255,100,100,0.2);
          padding: 10px;
          border-radius: 10px;
          font-size: 12px;
          margin-top: 20px;
        }
        a { color: #1DB954; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🎵 Conectar JARVIS con Spotify</h1>
        <p>Para controlar tu música, necesitas autorizar la aplicación</p>
        <button class="spotify-btn" onclick="window.location.href='${authUrl}'">
          🔑 Autorizar Spotify
        </button>
        <div class="warning">
          ⚠️ Es normal ver una advertencia de URI no segura en desarrollo local
        </div>
      </div>
    </body>
    </html>
  `);
});

router.get('/spotify/callback', async (req, res) => {
  const { code, error } = req.query;
  
  if (error) {
    res.send(`
      <html>
      <body style="font-family: monospace; text-align: center; padding: 50px;">
        <h1>❌ Error: ${error}</h1>
        <a href="/auth/spotify">Reintentar</a>
      </body>
      </html>
    `);
    return;
  }
  
  if (!code) {
    res.send(`
      <html>
      <body style="font-family: monospace; text-align: center; padding: 50px;">
        <h1>❌ No se recibió autorización</h1>
        <a href="/auth/spotify">Reintentar</a>
      </body>
      </html>
    `);
    return;
  }
  
  const result = await exchangeCodeForToken(code);
  
  if (result.success) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>✅ Spotify Conectado - JARVIS</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #1DB954, #191414);
            color: white;
          }
          .container {
            text-align: center;
            background: rgba(0,0,0,0.8);
            padding: 40px;
            border-radius: 20px;
          }
          .success { font-size: 64px; }
          button {
            background: #1DB954;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 50px;
            cursor: pointer;
            margin-top: 20px;
            font-size: 16px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success">✅</div>
          <h1>¡Autenticación Exitosa!</h1>
          <p>JARVIS ahora puede controlar tu Spotify</p>
          <p>Ya puedes cerrar esta ventana</p>
          <button onclick="window.close()">Cerrar</button>
        </div>
        <script>
          setTimeout(() => window.close(), 3000);
        </script>
      </body>
      </html>
    `);
  } else {
    res.send(`
      <html>
      <body style="font-family: monospace; text-align: center; padding: 50px;">
        <h1>❌ Error al obtener token</h1>
        <pre>${JSON.stringify(result.error, null, 2)}</pre>
        <a href="/auth/spotify">Reintentar</a>
      </body>
      </html>
    `);
  }
});

router.get('/spotify/status', async (req, res) => {
  const { spotifyWebApi } = await import('../services/spotifyWebApi.js');
  res.json({ 
    authenticated: spotifyWebApi.isAuthenticated(),
    message: spotifyWebApi.isAuthenticated() ? 'Spotify conectado' : 'No autenticado'
  });
});

export default router;