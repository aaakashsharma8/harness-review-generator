/**
 * LLM Client Interface
 * 
 * Abstract interface for LLM providers.
 * Supports: Ollama (local), OpenAI, Anthropic
 * 
 * Model recommendations for self-review generation:
 * - qwen2.5:7b  → Best instruction following + writing (default)
 * - llama3.1:8b → Strong alternative
 * - llama3.2    → Fallback for low RAM systems
 */

export interface LLMConfig {
  provider: 'ollama' | 'openai' | 'anthropic';
  model: string;
  baseUrl?: string;
  apiKey?: string;
  temperature?: number;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

/** Available local models */
export const MODELS = {
  /** Best for instruction following + structured writing (recommended) */
  QWEN: 'qwen2.5:7b',
  /** Strong alternative, slightly more literal */
  LLAMA_8B: 'llama3.1:8b',
  /** Fallback for low RAM systems (<6GB) */
  LLAMA_3B: 'llama3.2',
} as const;

/**
 * Default config for local Ollama
 * Note: Use 127.0.0.1 instead of localhost to avoid IPv6 issues
 */
export const DEFAULT_CONFIG: LLMConfig = {
  provider: 'ollama',
  model: MODELS.QWEN, // qwen2.5:7b - best for review generation
  baseUrl: 'http://127.0.0.1:11434',
  temperature: 0, // Deterministic
};

/** Low-RAM fallback config */
export const FALLBACK_CONFIG: LLMConfig = {
  provider: 'ollama',
  model: MODELS.LLAMA_3B,
  baseUrl: 'http://127.0.0.1:11434',
  temperature: 0,
};

/**
 * Sends a prompt to the LLM and returns the response.
 */
export async function complete(
  prompt: string,
  config: LLMConfig = DEFAULT_CONFIG
): Promise<LLMResponse> {
  if (config.provider === 'ollama') {
    return completeOllama(prompt, config);
  } else if (config.provider === 'openai') {
    return completeOpenAI(prompt, config);
  } else {
    throw new Error(`Unsupported LLM provider: ${config.provider}`);
  }
}

/**
 * Ollama completion (local)
 */
async function completeOllama(prompt: string, config: LLMConfig): Promise<LLMResponse> {
  const baseUrl = config.baseUrl || 'http://localhost:11434';
  
  const response = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model,
      prompt,
      stream: false,
      options: {
        temperature: config.temperature ?? 0,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Ollama error: ${error}`);
  }

  const data = await response.json();
  
  return {
    content: data.response,
    model: config.model,
    usage: {
      promptTokens: data.prompt_eval_count || 0,
      completionTokens: data.eval_count || 0,
    },
  };
}

/**
 * OpenAI completion (for future use)
 */
async function completeOpenAI(prompt: string, config: LLMConfig): Promise<LLMResponse> {
  if (!config.apiKey) {
    throw new Error('OpenAI API key required');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: config.temperature ?? 0,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI error: ${error}`);
  }

  const data = await response.json();
  
  return {
    content: data.choices[0].message.content,
    model: config.model,
    usage: {
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
    },
  };
}

/**
 * Test the LLM connection
 */
export async function testConnection(config: LLMConfig = DEFAULT_CONFIG): Promise<boolean> {
  try {
    const response = await complete('Say "ok" if you can hear me.', config);
    return response.content.toLowerCase().includes('ok');
  } catch (error) {
    console.error('[llm-client] Connection test failed:', error);
    return false;
  }
}

/**
 * Get list of available Ollama models
 */
export async function getAvailableModels(baseUrl: string = 'http://127.0.0.1:11434'): Promise<string[]> {
  try {
    const response = await fetch(`${baseUrl}/api/tags`);
    if (!response.ok) return [];
    const data = await response.json();
    return data.models?.map((m: { name: string }) => m.name) || [];
  } catch {
    return [];
  }
}

/**
 * Auto-select the best available model
 * Priority: qwen2.5:7b > llama3.1:8b > llama3.2
 */
export async function selectBestModel(baseUrl: string = 'http://127.0.0.1:11434'): Promise<string> {
  const available = await getAvailableModels(baseUrl);
  
  // Priority order
  const priority = [MODELS.QWEN, MODELS.LLAMA_8B, MODELS.LLAMA_3B];
  
  for (const model of priority) {
    if (available.some(m => m.startsWith(model.split(':')[0]))) {
      console.log(`[llm-client] Auto-selected model: ${model}`);
      return model;
    }
  }
  
  // Default to first available or fallback
  return available[0] || MODELS.LLAMA_3B;
}
