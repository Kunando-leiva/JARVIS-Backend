// server/services/aiProviders/cerebrasProvider.js

import { BaseProvider } from './baseProvider.js';

// server/services/aiProviders/cerebrasProvider.js

export class CerebrasProvider extends BaseProvider {
  constructor(apiKey) {
    super('Cerebras', {
      rpm: 30,
      rpd: 14400,
      tpd: 1000000,
      models: ['gpt-oss-120b', 'zai-glm-4.7']  // ✅ Modelos correctos
    });
    
    if (!apiKey) {
      throw new Error('Cerebras API key no proporcionada');
    }
    
    this.apiKey = apiKey;
    this.baseURL = 'https://api.cerebras.ai/v1';
    this.currentModel = this.config.models[0]; // gpt-oss-120b
    this.requestsThisMinute = 0;
    this.tokensToday = 0;
    
    setInterval(() => { this.requestsThisMinute = 0; }, 60000);
    setInterval(() => { this.tokensToday = 0; }, 86400000);
  }

  async chat(messages, options = {}) {
    const startTime = Date.now();
    
    if (this.requestsThisMinute >= this.config.rpm) {
      throw new Error(`Cerebras rate limit: ${this.config.rpm} RPM`);
    }

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: messages,
          model: options.model || this.currentModel,
          temperature: options.temperature || 0.7,
          max_tokens: options.maxTokens || 500,
          top_p: options.topP || 0.9,
          stream: false
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `HTTP ${response.status}`);
      }
      
      const data = await response.json();
      const responseTime = Date.now() - startTime;
      
      this.requestsThisMinute++;
      this.tokensToday += data.usage?.total_tokens || 0;
      this.recordSuccess(responseTime);
      
      return {
        success: true,
        content: data.choices[0]?.message?.content || '',
        provider: this.name,
        model: options.model || this.currentModel,
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