// server/services/aiProviders/togetherProvider.js

import { BaseProvider } from './baseProvider.js';
import Together from 'together-ai';

export class TogetherProvider extends BaseProvider {
  constructor(apiKey) {
    super('Together AI', {
      rpm: 60,
      rpd: 10000,
      tpm: 1000000,
      models: ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'mistralai/Mixtral-8x7B-Instruct-v0.1']
    });
    
    this.client = new Together({ apiKey });
    this.currentModel = this.config.models[0];
    this.requestsThisMinute = 0;
    this.requestsThisDay = 0;
    
    setInterval(() => { this.requestsThisMinute = 0; }, 60000);
    setInterval(() => { this.requestsThisDay = 0; }, 86400000);
  }

  async chat(messages, options = {}) {
    const startTime = Date.now();
    
    if (this.requestsThisMinute >= this.config.rpm) {
      throw new Error(`Together AI rate limit: ${this.config.rpm} RPM`);
    }
    
    if (this.requestsThisDay >= this.config.rpd) {
      throw new Error(`Together AI daily limit: ${this.config.rpd} RPD`);
    }

    try {
      const model = options.model || this.currentModel;
      
      const response = await this.client.chat.completions.create({
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
        content: response.choices[0]?.message?.content || '',
        provider: this.name,
        model: model,
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
}