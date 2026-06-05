import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PS4_CONFIG = {
  ip: '192.168.0.132',
  mac: '78:c8:81:d3:e1:00',
  userCredential: 'b692fa890a16ba47690ad4a91f72a93d34e8cc56fe179d612eb1b713874c26fe', // ✅ TU CREDENCIAL
  credsPath: path.join(__dirname, '../creds.json')
};

export const ps4Service = {
  async powerOn() {
    try {
      console.log('📡 Encendiendo PS4...');
      
      // Método WOL (si está en reposo)
      const cleanMac = PS4_CONFIG.mac.replace(/[:-]/g, '');
      const psScript = `
        $mac = '${cleanMac}'
        $macBytes = [byte[]]($mac -split '(..)' | Where-Object { $_ -ne '' } | ForEach-Object { [Convert]::ToByte($_, 16) })
        $packet = [byte[]]@(0xFF,0xFF,0xFF,0xFF,0xFF,0xFF) + $macBytes + $macBytes + $macBytes + $macBytes + $macBytes + $macBytes
        $udp = New-Object System.Net.Sockets.UdpClient
        $udp.Connect([System.Net.IPAddress]::Broadcast, 9)
        $udp.Send($packet, $packet.Length)
        $udp.Close()
      `;
      await execAsync(`powershell -Command "${psScript.replace(/"/g, '\\"')}"`);
      
      console.log('✅ WOL enviado');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      return { success: true, message: 'Encendiendo PlayStation 4' };
    } catch (error) {
      console.error('Error:', error);
      return { success: false, message: 'No pude encender la PS4' };
    }
  },
  
  async powerOff() {
    try {
      console.log('📡 Apagando PS4...');
      const cmd = `ps4-waker -d ${PS4_CONFIG.ip} -u "${PS4_CONFIG.userCredential}" -m`;
      await execAsync(cmd);
      return { success: true, message: 'Apagando PlayStation 4 (modo reposo)' };
    } catch (error) {
      return { success: false, message: 'No pude apagar la PS4' };
    }
  },
  
  async openGame(gameName) {
    const juegos = {
      'god of war': 'CUSA07408',
      'spiderman': 'CUSA11993',
      'fifa': 'CUSA33245',
      'call of duty': 'CUSA20369',
      'fortnite': 'CUSA07019',
      'gta': 'CUSA00419',
      'red dead': 'CUSA03041',
      'the last of us': 'CUSA00552',
      'uncharted': 'CUSA02343',
      'minecraft': 'CUSA00744'
    };
    
    const gameId = juegos[gameName.toLowerCase()];
    if (!gameId) {
      return { success: false, message: `No encontré el juego "${gameName}"` };
    }
    
    try {
      console.log(`🎮 Abriendo: ${gameName} (${gameId})`);
      const cmd = `ps4-waker -d ${PS4_CONFIG.ip} -u "${PS4_CONFIG.userCredential}" -e ${gameId}`;
      await execAsync(cmd);
      return { success: true, message: `Abriendo ${gameName} en tu PS4` };
    } catch (error) {
      return { success: false, message: `No pude abrir ${gameName}` };
    }
  },
  
  async sendCommand(command) {
    const comandos = {
      'arriba': 'up', 'abajo': 'down', 'izquierda': 'left', 'derecha': 'right',
      'x': 'cross', 'circulo': 'circle', 'cuadrado': 'square', 'triangulo': 'triangle',
      'ps': 'ps', 'options': 'options', 'touch': 'touchpad'
    };
    
    const cmd = comandos[command.toLowerCase()];
    if (!cmd) {
      return { success: false, message: `No conozco el comando "${command}"` };
    }
    
    try {
      const ps4cmd = `ps4-waker -d ${PS4_CONFIG.ip} -u "${PS4_CONFIG.userCredential}" -k ${cmd}`;
      await execAsync(ps4cmd);
      return { success: true, message: `Comando ${command} enviado a PS4` };
    } catch (error) {
      return { success: false, message: `No pude enviar el comando` };
    }
  },
  
  async takeScreenshot() {
    try {
      const cmd = `ps4-waker -d ${PS4_CONFIG.ip} -u "${PS4_CONFIG.userCredential}" -k screenshot`;
      await execAsync(cmd);
      return { success: true, message: 'Captura de pantalla tomada en PS4' };
    } catch (error) {
      return { success: false, message: 'No pude tomar captura' };
    }
  },
  
  async recordVideo() {
    try {
      const cmd = `ps4-waker -d ${PS4_CONFIG.ip} -u "${PS4_CONFIG.userCredential}" -k record`;
      await execAsync(cmd);
      return { success: true, message: 'Grabando video en PS4 (últimos 15 minutos)' };
    } catch (error) {
      return { success: false, message: 'No pude iniciar grabación' };
    }
  },
  
  async isOnline() {
    try {
      const { stdout } = await execAsync(`ping -n 1 ${PS4_CONFIG.ip}`);
      const isAlive = stdout.includes('respuesta');
      return { online: isAlive };
    } catch {
      return { online: false };
    }
  },
  
  async getStatus() {
    try {
      const cmd = `ps4-waker -d ${PS4_CONFIG.ip} -u "${PS4_CONFIG.userCredential}" -s`;
      const { stdout } = await execAsync(cmd);
      return { success: true, status: stdout };
    } catch (error) {
      const online = await this.isOnline();
      return { success: true, status: online.online ? 'Encendida' : 'Apagada/reposo' };
    }
  }
};