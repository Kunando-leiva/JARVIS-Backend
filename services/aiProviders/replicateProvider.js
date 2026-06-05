// server/services/aiProviders/replicateProvider.js

import { BaseProvider } from './baseProvider.js';

export class ReplicateProvider extends BaseProvider {
  constructor(apiKey) {
    super('Replicate', {
      rpm: 10,
      rpd: 50,
      models: ['meta/meta-llama-3-8b-instruct', 'mistralai/mistral-7b-instruct']
    });
    
    if (!apiKey) {
      throw new Error('Replicate API key no proporcionada');
    }
    
    this.apiKey = apiKey;
    this.baseURL = 'https://api.replicate.com/v1';
    this.currentModel = this.config.models[0];
    this.requestsThisMinute = 0;
    this.requestsToday = 0;
    
    setInterval(() => { this.requestsThisMinute = 0; }, 60000);
    setInterval(() => { this.requestsToday = 0; }, 86400000);
  }

  async chat(messages, options = {}) {
    const startTime = Date.now();
    
    if (this.requestsThisMinute >= this.config.rpm) {
      throw new Error(`Replicate rate limit: ${this.config.rpm} RPM`);
    }
    
    if (this.requestsToday >= this.config.rpd) {
      throw new Error(`Replicate daily limit: ${this.config.rpd} RPD`);
    }

    try {
      // Replicate necesita un prompt específico
      const systemPrompt = messages.find(m => m.role === 'system')?.content || '';
      const userMessage = messages.filter(m => m.role === 'user').pop()?.content || '';
      const fullPrompt = systemPrompt ? `${systemPrompt}\n\nUsuario: ${userMessage}\nAsistente:` : `Usuario: ${userMessage}\nAsistente:`;
      
      const response = await fetch(`${this.baseURL}/predictions`, {
        method: 'POST',
        headers: {
          'Authorization': `Token ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          version: "2c1608e18606fad2812020dc541930f2d0495ce32eee50074220b87300bc16e1",
          input: {
            prompt: fullPrompt,
            max_new_tokens: options.maxTokens || 500,
            temperature: options.temperature || 0.7,
            top_p: options.topP || 0.9
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const prediction = await response.json();
      
      // Esperar a que termine la predicción
      let result = await this.waitForPrediction(prediction.id);
      
      const responseTime = Date.now() - startTime;
      
      this.requestsThisMinute++;
      this.requestsToday++;
      this.recordSuccess(responseTime);
      
      return {
        success: true,
        content: result.output?.join('') || '',
        provider: this.name,
        model: this.currentModel,
        responseTime: responseTime
      };
      
    } catch (error) {
      this.recordFailure(error);
      return {
        success: false,
        error: error.message,
        provider: this.name
      };
    }
  }
  
  async waitForPrediction(predictionId, maxAttempts = 30) {
    for (let i = 0; i < maxAttempts; i++) {
      const response = await fetch(`${this.baseURL}/predictions/${predictionId}`, {
        headers: { 'Authorization': `Token ${this.apiKey}` }
      });
      
      const prediction = await response.json();
      
      if (prediction.status === 'succeeded') {
        return prediction;
      }
      
      if (prediction.status === 'failed') {
        throw new Error('Prediction failed');
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error('Prediction timeout');
  }
}