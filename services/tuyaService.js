import axios from 'axios';
import crypto from 'crypto';

// 🔑 ============================================
// 🔑 CONFIGURACIÓN DE SMART LIFE / TUYA
// 🔑 ============================================
// 📝 CÓMO OBTENER ESTOS DATOS:
// 1. npm install -g tuya-cli
// 2. tuya-cli wizard (iniciar sesión con tu cuenta Smart Life)
// 3. tuya-cli list-devices (para ver Device ID y Local Key)
// 🔑 ============================================

const TUYA_CONFIG = {
  // Datos de tu cuenta (de tuya-cli wizard)
  accessId: '🔑_AQUI_VA_TU_ACCESS_ID',           // Ejemplo: '5f4d3c2b1a0...
  accessKey: '🔑_AQUI_VA_TU_ACCESS_KEY',         // Ejemplo: 'abc123xyz789...
  
  // Datos de tu interruptor (de tuya-cli list-devices)
  deviceId: '🔑_AQUI_VA_TU_DEVICE_ID',           // Ejemplo: '123456789abcdef'
  deviceName: 'Luz Principal',
  localKey: '🔑_AQUI_VA_TU_LOCAL_KEY',           // Ejemplo: 'xxxxxxxxxxxxxxx'
  
  // Región (us, eu, cn, in, az) - Argentina usa 'us'
  apiRegion: 'us',
  apiBaseUrl: 'https://openapi.tuyaus.com',
};

let lightStates = new Map();

export const tuyaService = {
  async getToken() {
    try {
      const timestamp = Date.now().toString();
      const signStr = TUYA_CONFIG.accessId + timestamp;
      const sign = crypto
        .createHmac('sha256', TUYA_CONFIG.accessKey)
        .update(signStr)
        .digest('hex')
        .toUpperCase();
      
      const response = await axios.post(
        `${TUYA_CONFIG.apiBaseUrl}/v1.0/token?grant_type=1`,
        {},
        {
          headers: {
            'client_id': TUYA_CONFIG.accessId,
            'sign': sign,
            't': timestamp,
            'sign_method': 'HMAC-SHA256'
          }
        }
      );
      
      return response.data.result.access_token;
    } catch (error) {
      console.error('Error obteniendo token Tuya:', error.message);
      return null;
    }
  },
  
  async sendCommand(commands, token = null) {
    if (!token) {
      token = await this.getToken();
      if (!token) return false;
    }
    
    try {
      const timestamp = Date.now().toString();
      const signStr = TUYA_CONFIG.accessId + token + timestamp;
      const sign = crypto
        .createHmac('sha256', TUYA_CONFIG.accessKey)
        .update(signStr)
        .digest('hex')
        .toUpperCase();
      
      const response = await axios.post(
        `${TUYA_CONFIG.apiBaseUrl}/v1.0/device/${TUYA_CONFIG.deviceId}/commands`,
        { commands },
        {
          headers: {
            'client_id': TUYA_CONFIG.accessId,
            'access_token': token,
            'sign': sign,
            't': timestamp,
            'sign_method': 'HMAC-SHA256'
          }
        }
      );
      
      return response.data.success;
    } catch (error) {
      console.error('Error enviando comando Tuya:', error.message);
      return false;
    }
  },
  
  async getDeviceStatus() {
    try {
      const token = await this.getToken();
      if (!token) return null;
      
      const timestamp = Date.now().toString();
      const signStr = TUYA_CONFIG.accessId + token + timestamp;
      const sign = crypto
        .createHmac('sha256', TUYA_CONFIG.accessKey)
        .update(signStr)
        .digest('hex')
        .toUpperCase();
      
      const response = await axios.get(
        `${TUYA_CONFIG.apiBaseUrl}/v1.0/device/${TUYA_CONFIG.deviceId}`,
        {
          headers: {
            'client_id': TUYA_CONFIG.accessId,
            'access_token': token,
            'sign': sign,
            't': timestamp,
            'sign_method': 'HMAC-SHA256'
          }
        }
      );
      
      const status = response.data.result.status;
      const powerState = status.find(s => s.code === 'switch_1')?.value;
      
      return {
        online: response.data.result.online,
        power: powerState === true || powerState === 'true',
        raw: status
      };
    } catch (error) {
      console.error('Error obteniendo estado Tuya:', error.message);
      return null;
    }
  },
  
  async turnOn(lightName = 'principal') {
    try {
      const success = await this.sendCommand([{ code: 'switch_1', value: true }]);
      if (success) {
        lightStates.set(lightName, true);
        return { success: true, message: `Luz ${lightName} encendida` };
      }
      throw new Error('No se pudo ejecutar el comando');
    } catch (error) {
      return { success: false, message: 'No pude encender la luz' };
    }
  },
  
  async turnOff(lightName = 'principal') {
    try {
      const success = await this.sendCommand([{ code: 'switch_1', value: false }]);
      if (success) {
        lightStates.set(lightName, false);
        return { success: true, message: `Luz ${lightName} apagada` };
      }
      throw new Error('No se pudo ejecutar el comando');
    } catch (error) {
      return { success: false, message: 'No pude apagar la luz' };
    }
  },
  
  async toggle(lightName = 'principal') {
    const currentState = lightStates.get(lightName);
    if (currentState === true) {
      return await this.turnOff(lightName);
    } else {
      return await this.turnOn(lightName);
    }
  },
  
  async getStatus(lightName = 'principal') {
    const status = await this.getDeviceStatus();
    if (status) {
      lightStates.set(lightName, status.power);
      return status;
    }
    return { online: false, power: false };
  }
};