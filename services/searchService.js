// server/services/searchService.js

import axios from 'axios';

// Configuración de proveedores de búsqueda
const searchProviders = [
  {
    name: 'Google',
    enabled: !!process.env.GOOGLE_API_KEY && !!process.env.GOOGLE_SEARCH_ENGINE_ID,
    search: async (query) => await googleSearch(query),
    dailyLimit: 100
  },
  {
    name: 'Bing',
    enabled: !!process.env.BING_API_KEY,
    search: async (query) => await bingSearch(query),
    dailyLimit: 1000
  },
  {
    name: 'DuckDuckGo',
    enabled: true, // Siempre disponible
    search: async (query) => await duckDuckGoSearch(query),
    dailyLimit: Infinity
  }
];

// Contadores de uso diario
const dailyCounters = {
  Google: 0,
  Bing: 0,
  DuckDuckGo: 0
};

// Resetear contadores cada día
setInterval(() => {
  dailyCounters.Google = 0;
  dailyCounters.Bing = 0;
  console.log('📊 Contadores de búsqueda reiniciados');
}, 24 * 60 * 60 * 1000);

// ============= GOOGLE SEARCH API =============
async function googleSearch(query) {
  try {
    const apiKey = process.env.GOOGLE_API_KEY;
    const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
    
    if (!apiKey || !searchEngineId) {
      return { success: false, error: 'Google Search no configurado' };
    }
    
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}&num=5`;
    
    const response = await axios.get(url, { timeout: 10000 });
    
    if (response.data.items && response.data.items.length > 0) {
      const results = response.data.items.slice(0, 3).map(item => ({
        title: item.title,
        snippet: item.snippet,
        link: item.link
      }));
      
      return {
        success: true,
        provider: 'Google',
        answer: results.map(r => `${r.title}: ${r.snippet}`).join('\n\n'),
        results: results,
        source: 'Google Custom Search'
      };
    }
    
    return { success: false, error: 'No se encontraron resultados' };
  } catch (error) {
    console.error('Error en Google Search:', error.message);
    return { success: false, error: error.message };
  }
}

// ============= BING SEARCH API =============
async function bingSearch(query) {
  try {
    const apiKey = process.env.BING_API_KEY;
    
    if (!apiKey) {
      return { success: false, error: 'Bing Search no configurado' };
    }
    
    const url = `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}&count=5&responseFilter=Webpages`;
    
    const response = await axios.get(url, {
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey
      },
      timeout: 10000
    });
    
    if (response.data.webPages && response.data.webPages.value.length > 0) {
      const results = response.data.webPages.value.slice(0, 3).map(item => ({
        title: item.name,
        snippet: item.snippet,
        link: item.url
      }));
      
      return {
        success: true,
        provider: 'Bing',
        answer: results.map(r => `${r.title}: ${r.snippet}`).join('\n\n'),
        results: results,
        source: 'Bing Web Search'
      };
    }
    
    return { success: false, error: 'No se encontraron resultados' };
  } catch (error) {
    console.error('Error en Bing Search:', error.message);
    return { success: false, error: error.message };
  }
}

// ============= DUCKDUCKGO SEARCH =============
async function duckDuckGoSearch(query) {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    
    const response = await axios.get(url, { timeout: 10000 });
    
    if (response.data.AbstractText) {
      return {
        success: true,
        provider: 'DuckDuckGo',
        answer: response.data.AbstractText,
        source: response.data.AbstractURL || 'DuckDuckGo',
        heading: response.data.Heading
      };
    } else if (response.data.RelatedTopics && response.data.RelatedTopics.length > 0) {
      const topics = response.data.RelatedTopics.slice(0, 3);
      const answer = topics.map(t => t.Text).join('\n\n');
      return {
        success: true,
        provider: 'DuckDuckGo',
        answer: answer,
        source: 'DuckDuckGo Related Topics'
      };
    }
    
    return { success: false, error: 'No se encontró información' };
  } catch (error) {
    console.error('Error en DuckDuckGo:', error.message);
    return { success: false, error: error.message };
  }
}

// ============= CASCADA DE BÚSQUEDA =============
export const searchService = {
  async search(query, userName = null) {
    console.log(`🔍 Buscando: "${query}"`);
    
    const errors = [];
    
    // Intentar con cada proveedor en orden
    for (const provider of searchProviders) {
      // Verificar si está habilitado
      if (!provider.enabled) {
        console.log(`⏭️ Saltando ${provider.name} (no configurado)`);
        continue;
      }
      
      // Verificar límite diario
      if (dailyCounters[provider.name] >= provider.dailyLimit) {
        console.log(`⏭️ Saltando ${provider.name} (límite diario alcanzado: ${dailyCounters[provider.name]}/${provider.dailyLimit})`);
        continue;
      }
      
      console.log(`🌐 Intentando búsqueda con ${provider.name}...`);
      
      try {
        const result = await provider.search(query);
        
        if (result.success) {
          dailyCounters[provider.name]++;
          console.log(`✅ Búsqueda exitosa con ${provider.name} (consumo: ${dailyCounters[provider.name]}/${provider.dailyLimit})`);
          
          return {
            success: true,
            provider: result.provider,
            answer: result.answer,
            source: result.source,
            remainingQuota: {
              Google: provider.dailyLimit - dailyCounters.Google,
              Bing: provider.dailyLimit - dailyCounters.Bing,
              DuckDuckGo: 'Ilimitado'
            }
          };
        } else {
          errors.push({ provider: provider.name, error: result.error });
          console.log(`❌ ${provider.name} falló: ${result.error}`);
        }
      } catch (error) {
        errors.push({ provider: provider.name, error: error.message });
        console.log(`❌ ${provider.name} error: ${error.message}`);
      }
    }
    
    // Todos los proveedores fallaron
    console.error(`💥 Todos los proveedores de búsqueda fallaron`);
    
    // Último recurso: usar la IA para responder
    try {
      const { providerManager } = await import('./aiProviders/providerManager.js');
      const aiResponse = await providerManager.chat([
        { role: 'system', content: 'Eres un asistente que responde preguntas de forma concisa. Si no sabes la respuesta, dícelo al usuario.' },
        { role: 'user', content: query }
      ]);
      
      if (aiResponse.success) {
        return {
          success: true,
          provider: 'IA (Fallback)',
          answer: aiResponse.content,
          source: 'Inteligencia Artificial'
        };
      }
    } catch (error) {
      console.error('Error con IA fallback:', error);
    }
    
    return {
      success: false,
      error: 'No se pudo obtener información de ninguna fuente',
      details: errors
    };
  },
  
  getStats() {
    return {
      dailyUsage: { ...dailyCounters },
      providers: searchProviders.map(p => ({
        name: p.name,
        enabled: p.enabled,
        dailyLimit: p.dailyLimit,
        remaining: p.dailyLimit - (dailyCounters[p.name] || 0)
      }))
    };
  }
};