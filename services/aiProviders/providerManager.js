// server/services/aiProviders/providerManager.js

import { GroqProvider } from './groqProvider.js';
import { TogetherProvider } from './togetherProvider.js';
import { CerebrasProvider } from './cerebrasProvider.js';
import { OpenRouterProvider } from './openrouterProvider.js';
import { GeminiProvider } from './geminiProvider.js';
import { DeepSeekProvider } from './deepseekProvider.js';
import { MistralProvider } from './mistralProvider.js';
import { ReplicateProvider } from './replicateProvider.js';
import { CohereProvider } from './cohereProvider.js';
import { OllamaProvider } from './ollamaProvider.js';

export class ProviderManager {
  constructor(config) {
    this.providers = [];
    this.currentProviderIndex = 0;
    this.fallbackChain = [];
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      fallbacksUsed: 0,
      startTime: new Date().toISOString()
    };
    
    this.initializeProviders(config);
    this.startHealthCheck();
  }

  initializeProviders(config) {
    console.log('\n🔧 INICIALIZANDO PROVEEDORES DE IA...\n');
    
    // Orden de prioridad (del más rápido/alto rendimiento al más lento/respaldo)
    const providerConfigs = [
      { name: 'groq', class: GroqProvider, key: config.GROQ_API_KEY, enabled: true, required: true },
      { name: 'together', class: TogetherProvider, key: config.TOGETHER_API_KEY, enabled: !!config.TOGETHER_API_KEY && config.TOGETHER_API_KEY !== 'tu_key_aqui', required: false },
      { name: 'cerebras', class: CerebrasProvider, key: config.CEREBRAS_API_KEY, enabled: !!config.CEREBRAS_API_KEY && config.CEREBRAS_API_KEY !== 'tu_key_aqui', required: false },
      { name: 'openrouter', class: OpenRouterProvider, key: config.OPENROUTER_API_KEY, enabled: !!config.OPENROUTER_API_KEY && config.OPENROUTER_API_KEY !== 'tu_key_aqui', required: false },
      { name: 'gemini', class: GeminiProvider, key: config.GEMINI_API_KEY, enabled: !!config.GEMINI_API_KEY && config.GEMINI_API_KEY !== 'tu_key_aqui', required: false },
      { name: 'deepseek', class: DeepSeekProvider, key: config.DEEPSEEK_API_KEY, enabled: !!config.DEEPSEEK_API_KEY && config.DEEPSEEK_API_KEY !== 'tu_key_aqui', required: false },
      { name: 'mistral', class: MistralProvider, key: config.MISTRAL_API_KEY, enabled: !!config.MISTRAL_API_KEY && config.MISTRAL_API_KEY !== 'tu_key_aqui', required: false },
      { name: 'replicate', class: ReplicateProvider, key: config.REPLICATE_API_KEY, enabled: !!config.REPLICATE_API_KEY && config.REPLICATE_API_KEY !== 'tu_key_aqui', required: false },
      { name: 'cohere', class: CohereProvider, key: config.COHERE_API_KEY, enabled: !!config.COHERE_API_KEY && config.COHERE_API_KEY !== 'tu_key_aqui', required: false },
      { name: 'ollama', class: OllamaProvider, key: null, enabled: true, required: false }
    ];

    // Inicializar solo los proveedores habilitados
    for (const providerConfig of providerConfigs) {
      if (providerConfig.enabled) {
        try {
          console.log(`🔄 Inicializando ${providerConfig.name}...`);
          const provider = new providerConfig.class(providerConfig.key);
          this.providers.push(provider);
          console.log(`✅ ${provider.name} inicializado correctamente`);
        } catch (error) {
          console.error(`❌ Error inicializando ${providerConfig.name}:`);
          console.error(`   Mensaje: ${error.message}`);
          if (providerConfig.required) {
            console.error(`   ⚠️ Este proveedor es requerido. Verifica tu API key.`);
          }
        }
      } else {
        const reason = !config[`${providerConfig.name.toUpperCase()}_API_KEY`] 
          ? 'API key no configurada en .env'
          : 'API key inválida o placeholder';
        console.log(`⏭️ Saltando ${providerConfig.name} (${reason})`);
      }
    }

    // Crear cadena de fallback (todos los proveedores en orden)
    this.fallbackChain = [...this.providers];
    
    console.log(`\n🎯 Sistema de IA inicializado con ${this.providers.length} proveedores`);
    if (this.providers.length > 0) {
      console.log(`📋 Orden de fallback: ${this.providers.map(p => p.name).join(' → ')}`);
    } else {
      console.log(`⚠️ No hay proveedores disponibles. Verifica tus API keys.`);
    }
    console.log('');
  }

  startHealthCheck() {
    // Health check cada 5 minutos
    this.healthCheckInterval = setInterval(async () => {
      const health = await this.healthCheck();
      const healthyCount = health.filter(h => h.status === 'healthy').length;
      const unhealthyCount = health.filter(h => h.status === 'unhealthy').length;
      
      if (unhealthyCount > 0) {
        console.log(`💚 Health Check: ${healthyCount}/${this.providers.length} saludables, ${unhealthyCount} con problemas`);
      }
    }, 300000);
  }

  stopHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  async chat(messages, options = {}) {
    const startTime = Date.now();
    const errors = [];
    
    // Intentar con cada proveedor en orden
    for (let i = 0; i < this.fallbackChain.length; i++) {
      const provider = this.fallbackChain[i];
      
      // Verificar si el proveedor está disponible
      if (!provider.isAvailable) {
        console.log(`⏭️ Saltando ${provider.name} (temporalmente no disponible)`);
        continue;
      }
      
      console.log(`🔄 Intentando con ${provider.name}... (intento ${i + 1}/${this.fallbackChain.length})`);
      
      try {
        const response = await provider.chat(messages, options);
        
        if (response.success) {
          const totalTime = Date.now() - startTime;
          this.stats.totalRequests++;
          this.stats.successfulRequests++;
          
          if (i > 0) {
            this.stats.fallbacksUsed++;
            console.log(`⚠️ Fallback exitoso: ${provider.name} (respuesta en ${response.responseTime}ms, tiempo total: ${totalTime}ms)`);
          } else {
            console.log(`✅ Respuesta exitosa de ${provider.name} (${response.responseTime}ms)`);
          }
          
          return {
            ...response,
            attemptsUsed: i + 1,
            totalTime: totalTime,
            fallbackChain: this.fallbackChain.slice(0, i + 1).map(p => p.name)
          };
        } else {
          errors.push({ provider: provider.name, error: response.error });
          console.log(`❌ ${provider.name} falló: ${response.error}`);
        }
        
      } catch (error) {
        errors.push({ provider: provider.name, error: error.message });
        console.log(`❌ ${provider.name} error: ${error.message}`);
      }
    }
    
    // Todos los proveedores fallaron
    this.stats.totalRequests++;
    this.stats.failedRequests++;
    
    console.error(`💥 Todos los ${this.providers.length} proveedores fallaron`);
    
    return {
      success: false,
      error: 'Todos los proveedores de IA están temporalmente no disponibles',
      details: errors,
      content: 'Lo siento, todos mis sistemas de IA están sobrecargados. Por favor, intenta de nuevo en unos momentos.'
    };
  }

  async chatWithRetry(messages, options = {}, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const result = await this.chat(messages, options);
      
      if (result.success) {
        return result;
      }
      
      if (attempt < maxRetries) {
        const waitTime = attempt * 1000;
        console.log(`⏳ Reintentando en ${waitTime}ms... (intento ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    return {
      success: false,
      error: `Falló después de ${maxRetries} reintentos`,
      content: 'No pude procesar tu solicitud después de varios intentos. Por favor, intenta más tarde.'
    };
  }

  async getBestProvider() {
    const availableProviders = this.providers.filter(p => p.isAvailable);
    if (availableProviders.length === 0) return null;
    
    // Ordenar por tiempo de respuesta y éxito
    availableProviders.sort((a, b) => {
      const aScore = a.getAverageResponseTime() * (a.consecutiveFailures + 1);
      const bScore = b.getAverageResponseTime() * (b.consecutiveFailures + 1);
      return aScore - bScore;
    });
    
    return availableProviders[0];
  }

  getStats() {
    const providerStats = {};
    for (const provider of this.providers) {
      providerStats[provider.name] = provider.getStats();
    }
    
    const uptimeMs = Date.now() - new Date(this.stats.startTime).getTime();
    const uptimeHours = Math.floor(uptimeMs / (1000 * 60 * 60));
    const uptimeMinutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return {
      totalProviders: this.providers.length,
      availableProviders: this.providers.filter(p => p.isAvailable).length,
      globalStats: {
        ...this.stats,
        uptime: `${uptimeHours}h ${uptimeMinutes}m`,
        successRate: this.stats.totalRequests === 0 ? 100 : 
          (this.stats.successfulRequests / this.stats.totalRequests * 100).toFixed(1)
      },
      providers: providerStats
    };
  }

  async healthCheck() {
    const results = [];
    
    for (const provider of this.providers) {
      try {
        const testMessage = [{ role: 'user', content: 'Di "OK" si funcionas' }];
        const response = await provider.chat(testMessage, { maxTokens: 10 });
        
        results.push({
          provider: provider.name,
          status: response.success ? 'healthy' : 'unhealthy',
          responseTime: response.responseTime,
          error: response.error
        });
      } catch (error) {
        results.push({
          provider: provider.name,
          status: 'error',
          error: error.message
        });
      }
    }
    
    return results;
  }

  resetProviders() {
    for (const provider of this.providers) {
      if (typeof provider.reset === 'function') {
        provider.reset();
      } else {
        provider.isAvailable = true;
        provider.consecutiveFailures = 0;
      }
      console.log(`🔄 ${provider.name} reiniciado`);
    }
    this.stats.fallbacksUsed = 0;
    console.log('✅ Todos los proveedores han sido reiniciados');
  }

  destroy() {
    this.stopHealthCheck();
    for (const provider of this.providers) {
      if (typeof provider.cleanup === 'function') {
        provider.cleanup();
      }
    }
    console.log('🛑 ProviderManager destruido, recursos liberados');
  }
}