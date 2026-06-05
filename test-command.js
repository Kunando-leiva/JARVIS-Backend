import { exec } from 'child_process';

exec('start spotify:track:4cOdK2wGLETKBW3PvgPWqT', (error, stdout, stderr) => {
  if (error) {
    console.error('❌ Error:', error);
  } else {
    console.log('✅ Comando ejecutado');
  }
});
