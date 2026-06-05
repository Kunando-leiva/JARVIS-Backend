// server/services/aiProviders/baseProvider.js

export class BaseProvider {
  constructor(name, config) {
    this.name = name;
    this.config = config;
    this.isAvailable = true;
    this.consecutiveFailures = 0;
    this.lastError = null;
    this.totalRequests = 0;
    this.successfulRequests = 0;
    this.responseTimes = [];
  }

  async chat(messages, options = {}) {
    throw new Error(`Method chat() must be implemented by ${this.name}`);
  }

  recordSuccess(responseTime) {
    this.consecutiveFailures = 0;
    this.totalRequests++;
    this.successfulRequests++;
    this.responseTimes.push(responseTime);
    
    // Mantener solo las últimas 100 respuestas para estadísticas
    if (this.responseTimes.length > 100) {
      this.responseTimes.shift();
    }
  }

  recordFailure(error) {
    this.consecutiveFailures++;
    this.totalRequests++;
    this.lastError = error;
    
    // Deshabilitar temporalmente si falla 3 veces seguidas
    if (this.consecutiveFailures >= 3) {
      this.isAvailable = false;
      console.log(`⚠️ ${this.name} deshabilitado temporalmente después de ${this.consecutiveFailures} fallos`);
      
      // Reintentar después de 60 segundos
      setTimeout(() => {
        this.isAvailable = true;
        this.consecutiveFailures = 0;
        console.log(`🔄 ${this.name} reactivado después del cooldown`);
      }, 60000);
    }
  }

  getAverageResponseTime() {
    if (this.responseTimes.length === 0) return Infinity;
    const sum = this.responseTimes.reduce((a, b) => a + b, 0);
    return sum / this.responseTimes.length;
  }

  getStats() {
    return {
      name: this.name,
      isAvailable: this.isAvailable,
      successRate: this.totalRequests === 0 ? 100 : (this.successfulRequests / this.totalRequests * 100).toFixed(1),
      avgResponseTime: this.getAverageResponseTime().toFixed(0),
      totalRequests: this.totalRequests
    };
  }
}