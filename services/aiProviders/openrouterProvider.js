// server/services/aiProviders/openrouterProvider.js

import { BaseProvider } from './baseProvider.js';

export class OpenRouterProvider extends BaseProvider {
  constructor(apiKey) {
    super('OpenRouter', {
      rpm: 50,
      rpd: 200,
      models: [
        'deepseek/deepseek-r1:free',
        'google/gemini-2.0-flash-exp:free',
        'meta-llama/llama-3.2-3b-instruct:free',
        'microsoft/phi-3-mini-128k-instruct:free',
        'qwen/qwen-2.5-7b-instruct:free'
      ]
    });
    
    this.apiKey = apiKey;
    this.baseURL = 'https://openrouter.ai/api/v1';
    this.currentModelIndex = 0;
    this.requestsThisMinute = 0;
    this.requestsToday = 0;
    
    setInterval(() => { this.requestsThisMinute = 0; }, 60000);
    setInterval(() => { this.requestsToday = 0; }, 86400000);
  }

  async chat(messages, options = {}) {
    const startTime = Date.now();
    
    if (this.requestsThisMinute >= this.config.rpm) {
      throw new Error(`OpenRouter rate limit: ${this.config.rpm} RPM`);
    }
    
    if (this.requestsToday >= this.config.rpd) {
      throw new Error(`OpenRouter daily limit: ${this.config.rpd} RPD`);
    }

    // Rotar modelos para distribuir el uso
    const model = options.model || this.config.models[this.currentModelIndex];
    this.currentModelIndex = (this.currentModelIndex + 1) % this.config.models.length;

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3001',
          'X-Title': 'JARVIS Assistant'
        },
        body: JSON.stringify({
          messages: messages,
          model: model,
          temperature: options.temperature || 0.7,
          max_tokens: options.maxTokens || 500,
          top_p: options.topP || 0.9
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }
      
      const data = await response.json();
      const responseTime = Date.now() - startTime;
      
      this.requestsThisMinute++;
      this.requestsToday++;
      this.recordSuccess(responseTime);
      
      return {
        success: true,
        content: data.choices[0]?.message?.content || '',
        provider: this.name,
        model: model,
        responseTime: responseTime,
        usage: data.usage
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