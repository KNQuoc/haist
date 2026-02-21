/**
 * MiniMax M2.5 integration with OpenAI Agents SDK
 * 
 * MiniMax's API is OpenAI-compatible but returns <think> content alongside
 * tool_calls. The Agents SDK's OpenAIChatCompletionsModel treats content 
 * as mutually exclusive with tool_calls (if/else), so when both exist,
 * tool calls get skipped.
 * 
 * This wrapper intercepts the response and nullifies content when tool_calls
 * are present, fixing the tool call loop.
 */

import OpenAI from 'openai';
import { OpenAIChatCompletionsModel, setOpenAIAPI } from '@openai/agents';

// Force Chat Completions API (MiniMax doesn't support Responses API)
setOpenAIAPI('chat_completions');

/**
 * Create a MiniMax-compatible OpenAI client that fixes the content+tool_calls issue.
 */
function createMinimaxClient(): OpenAI {
  const baseClient = new OpenAI({
    baseURL: process.env.MINIMAX_BASE_URL || 'https://api.minimax.io/v1',
    apiKey: process.env.MINIMAX_API_KEY,
  });

  // Proxy the chat.completions.create method to fix MiniMax's response format
  const originalCreate = baseClient.chat.completions.create.bind(baseClient.chat.completions);
  
  baseClient.chat.completions.create = async function(body: any, options?: any) {
    const result = await originalCreate(body, options);
    
    // If it's a stream, return as-is (streaming handled differently)
    if (body.stream) return result;
    
    // Fix: when MiniMax returns both content (thinking) and tool_calls,
    // null out the content so the Agents SDK processes tool_calls
    if (result.choices?.[0]?.message) {
      const msg = result.choices[0].message;
      if (msg.tool_calls && msg.tool_calls.length > 0 && msg.content) {
        // Store thinking content as reasoning for potential later use
        (msg as any).reasoning = msg.content;
        msg.content = null as any;
      }
    }
    
    return result;
  } as any;

  return baseClient;
}

// Singleton instances
let _minimaxClient: OpenAI | null = null;
let _minimaxModel: OpenAIChatCompletionsModel | null = null;

/**
 * Get the MiniMax OpenAI client (lazy singleton).
 * Use for direct chat.completions calls (artifact-agent, summarizer, etc.)
 */
export function getMinimaxClient(): OpenAI {
  if (!_minimaxClient) {
    _minimaxClient = createMinimaxClient();
  }
  return _minimaxClient;
}

/**
 * Get the MiniMax model for use with OpenAI Agents SDK (lazy singleton).
 * Cast to `any` to bridge openai v4 (app dep) → v5 (agents SDK dep) type mismatch.
 * The runtime API is compatible — both have chat.completions.create().
 */
export function getMinimaxModel(): OpenAIChatCompletionsModel {
  if (!_minimaxModel) {
    _minimaxModel = new OpenAIChatCompletionsModel(
      getMinimaxClient() as any,
      process.env.MINIMAX_MODEL || 'MiniMax-M2.5'
    );
  }
  return _minimaxModel;
}

/**
 * Check if MiniMax is configured
 */
export function isMinimaxConfigured(): boolean {
  return !!process.env.MINIMAX_API_KEY;
}
