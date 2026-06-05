// server/services/aiProviders/groqProvider.js

import Groq from 'groq-sdk';
import { BaseProvider } from './baseProvider.js';

export class GroqProvider extends BaseProvider {
  constructor(apiKey) {
    super('Groq', {
      rpm: 30,
      rpd: 14400,
      tpm: 30000,
      models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768']
    });
    
    this.client = new Groq({ apiKey });
    this.currentModel = this.config.models[0];
    this.requestsThisMinute = 0;
    this.requestsThisDay = 0;
    
    // Resetear contadores cada minuto y día
    setInterval(() => { this.requestsThisMinute = 0; }, 60000);
    setInterval(() => { this.requestsThisDay = 0; }, 86400000);
  }

  async chat(messages, options = {}) {
    const startTime = Date.now();
    
    // Verificar rate limits
    if (this.requestsThisMinute >= this.config.rpm) {
      throw new Error(`Groq rate limit: ${this.config.rpm} RPM`);
    }
    
    if (this.requestsThisDay >= this.config.rpd) {
      throw new Error(`Groq daily limit: ${this.config.rpd} RPD`);
    }

    try {
      const model = options.model || this.currentModel;
      
      const completion = await this.client.chat.completions.create({
        messages: messages,
        model: model,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 500,
        top_p: options.topP || 0.9
      });
      
      const responseTime = Date.now() - startTime;
      this.requestsThisMinute++;
      this.requestsThisDay++;
      this.recordSuccess(responseTime);
      
      return {
        success: true,
        content: completion.choices[0]?.message?.content || '',
        provider: this.name,
        model: model,
        responseTime: responseTime,
        usage: completion.usage
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

  async getAvailableModels() {
    return this.config.models;
  }
}