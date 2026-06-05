import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// 🔑 ============================================
// 🔑 CONFIGURACIÓN DEL AIRE ACONDICIONADO
// 🔑 ============================================
// 📝 TIPOS SOPORTADOS:
// - 'broadlink': necesitas un Broadlink RM4 Mini (~$20.000 ARS)
// - 'tuya': necesitas adaptador Tuya para AA
// - 'manual': si tu aire ya tiene WiFi
// 🔑 ============================================

const AC_CONFIG = {
  type: 'broadlink',           // Cambiar según lo que tengas: 'broadlink', 'tuya', 'manual'
  ip: '🔑_AQUI_VA_LA_IP_DEL_BROADLINK',     // Ejemplo: '192.168.1.150'
  mac: '🔑_AQUI_VA_LA_MAC_DEL_BROADLINK',   // Ejemplo: 'XX:XX:XX:XX:XX:XX'
  // Para Tuya
  tuyaDeviceId: '🔑_AQUI_VA_TUYA_DEVICE_ID',
  tuyaLocalKey: '🔑_AQUI_VA_TUYA_LOCAL_KEY',
  // Para HTTP directo
  httpEndpoint: '🔑_AQUI_VA_HTTP_ENDPOINT'   // Ejemplo: 'http://192.168.1.150/command'
};

// Códigos IR - Debes aprenderlos con el Broadlink
// Para aprender códigos: usa la app Broadlink o el script send_ir.py
const IR_CODES = {
  power_on: '🔑_AQUI_VA_CODIGO_IR_ENCENDIDO',
  power_off: '🔑_AQUI_VA_CODIGO_IR_APAGADO',
  temp_up: '🔑_AQUI_VA_CODIGO_IR_SUBIR_TEMP',
  temp_down: '🔑_AQUI_VA_CODIGO_IR_BAJAR_TEMP',
  mode_cool: '🔑_AQUI_VA_CODIGO_IR_MODO_FRIO',
  mode_heat: '🔑_AQUI_VA_CODIGO_IR_MODO_CALOR',
  mode_fan: '🔑_AQUI_VA_CODIGO_IR_MODO_VENTILADOR',
  mode_dry: '🔑_AQUI_VA_CODIGO_IR_MODO_SECO',
  fan_auto: '🔑_AQUI_VA_CODIGO_IR_FAN_AUTO',
  fan_low: '🔑_AQUI_VA_CODIGO_IR_FAN_BAJA',
  fan_medium: '🔑_AQUI_VA_CODIGO_IR_FAN_MEDIA',
  fan_high: '🔑_AQUI_VA_CODIGO_IR_FAN_ALTA'
};

let currentState = {
  power: false,
  temperature: 24,
  mode: 'cool',
  fanSpeed: 'auto'
};

export const acService = {
  async powerOn() {
    try {
      await this.sendIRCommand('power_on');
      currentState.power = true;
      return { success: true, message: 'Aire acondicionado encendido' };
    } catch (error) {
      return { success: false, message: 'No pude encender el aire acondicionado' };
    }
  },
  
  async powerOff() {
    try {
      await this.sendIRCommand('power_off');
      currentState.power = false;
      return { success: true, message: 'Aire acondicionado apagado' };
    } catch (error) {
      return { success: false, message: 'No pude apagar el aire acondicionado' };
    }
  },
  
  async temperatureUp() {
    if (!currentState.power) await this.powerOn();
    currentState.temperature = Math.min(currentState.temperature + 1, 30);
    await this.sendIRCommand('temp_up');
    return { success: true, message: `Temperatura subida a ${currentState.temperature} grados` };
  },
  
  async temperatureDown() {
    if (!currentState.power) await this.powerOn();
    currentState.temperature = Math.max(currentState.temperature - 1, 16);
    await this.sendIRCommand('temp_down');
    return { success: true, message: `Temperatura bajada a ${currentState.temperature} grados` };
  },
  
  async setTemperature(temp) {
    if (temp < 16 || temp > 30) {
      return { success: false, message: 'La temperatura debe estar entre 16 y 30 grados' };
    }
    if (!currentState.power) await this.powerOn();
    
    const diff = temp - currentState.temperature;
    if (diff > 0) {
      for (let i = 0; i < diff; i++) await this.temperatureUp();
    } else if (diff < 0) {
      for (let i = 0; i < Math.abs(diff); i++) await this.temperatureDown();
    }
    return { success: true, message: `Temperatura ajustada a ${temp} grados` };
  },
  
  async setMode(mode) {
    const modes = ['cool', 'heat', 'fan', 'dry', 'auto'];
    if (!modes.includes(mode)) {
      return { success: false, message: `Modo inválido. Opciones: frío, calor, ventilador, seco, auto` };
    }
    await this.sendIRCommand(`mode_${mode}`);
    currentState.mode = mode;
    const modeNames = { cool: 'frío', heat: 'calor', fan: 'ventilador', dry: 'seco', auto: 'automático' };
    return { success: true, message: `Modo cambiado a ${modeNames[mode]}` };
  },
  
  async setFanSpeed(speed) {
    const speeds = ['auto', 'low', 'medium', 'high'];
    if (!speeds.includes(speed)) {
      return { success: false, message: `Velocidad inválida. Opciones: auto, baja, media, alta` };
    }
    await this.sendIRCommand(`fan_${speed}`);
    currentState.fanSpeed = speed;
    const speedNames = { auto: 'automática', low: 'baja', medium: 'media', high: 'alta' };
    return { success: true, message: `Velocidad del ventilador cambiada a ${speedNames[speed]}` };
  },
  
  getStatus() {
    const modeNames = { cool: 'frío', heat: 'calor', fan: 'ventilador', dry: 'seco', auto: 'automático' };
    const speedNames = { auto: 'automática', low: 'baja', medium: 'media', high: 'alta' };
    if (!currentState.power) {
      return { success: true, message: 'El aire acondicionado está apagado' };
    }
    return { 
      success: true, 
      message: `Aire encendido en modo ${modeNames[currentState.mode]}, ${currentState.temperature}°C, ventilador en ${speedNames[currentState.fanSpeed]}`,
      state: currentState
    };
  },
  
  async sendIRCommand(command) {
    const irCode = IR_CODES[command];
    if (!irCode || irCode.startsWith('🔑')) {
      console.log(`⚠️ No hay código IR configurado para: ${command}`);
      return false;
    }
    
    try {
      if (AC_CONFIG.type === 'broadlink') {
        await execAsync(`python3 send_ir.py ${AC_CONFIG.ip} ${irCode}`);
      } else if (AC_CONFIG.type === 'tuya') {
        await axios.post(`http://${AC_CONFIG.ip}/command`, { deviceId: AC_CONFIG.tuyaDeviceId, command: command });
      } else if (AC_CONFIG.type === 'http') {
        await axios.post(AC_CONFIG.httpEndpoint, { command: command });
      }
      return true;
    } catch (error) {
      console.error('Error enviando IR:', error);
      return false;
    }
  },
  
  async learnIRCode() {
    console.log('📡 Modo aprendizaje activado');
    return { success: true, message: 'Modo aprendizaje activado.' };
  }
};