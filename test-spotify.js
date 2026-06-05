import dotenv from 'dotenv';
import SpotifyWebApi from 'spotify-web-api-node';

dotenv.config();

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET
});

async function testSpotify() {
  console.log('🔍 Probando conexión con Spotify API...');
  console.log('Client ID:', process.env.SPOTIFY_CLIENT_ID ? '✅ Presente' : '❌ FALTA');
  console.log('Client Secret:', process.env.SPOTIFY_CLIENT_SECRET ? '✅ Presente' : '❌ FALTA');
  
  try {
    // Obtener token
    const data = await spotifyApi.clientCredentialsGrant();
    spotifyApi.setAccessToken(data.body['access_token']);
    console.log('✅ Token obtenido correctamente');
    
    // Probar búsqueda
    const search = await spotifyApi.searchTracks('pop', { limit: 1 });
    console.log('✅ Búsqueda exitosa:', search.body.tracks.items[0]?.name);
    
    // Probar recomendaciones
    const recs = await spotifyApi.getRecommendations({ 
      limit: 3, 
      seed_genres: ['pop'] 
    });
    console.log('✅ Recomendaciones exitosas:', recs.body.tracks.length, 'canciones');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Detalle:', error.body || error);
  }
}

testSpotify();