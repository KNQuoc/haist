/**
 * Test MiniMax with the proxy fix approach (no node_modules patching)
 */

import OpenAI from 'openai';
import { Agent, run, OpenAIChatCompletionsModel, setOpenAIAPI } from '@openai/agents';
import { tool } from '@openai/agents';
import { z } from 'zod';

setOpenAIAPI('chat_completions');

// Create MiniMax client with proxy fix
function createMinimaxClient() {
  const client = new OpenAI({
    baseURL: process.env.MINIMAX_BASE_URL || 'https://api.minimax.io/v1',
    apiKey: process.env.MINIMAX_API_KEY,
  });

  const originalCreate = client.chat.completions.create.bind(client.chat.completions);
  client.chat.completions.create = async function(body, options) {
    const result = await originalCreate(body, options);
    if (body.stream) return result;
    
    if (result.choices?.[0]?.message) {
      const msg = result.choices[0].message;
      if (msg.tool_calls && msg.tool_calls.length > 0 && msg.content) {
        msg.reasoning = msg.content;
        msg.content = null;
      }
    }
    return result;
  };
  return client;
}

const minimaxClient = createMinimaxClient();
const minimaxModel = new OpenAIChatCompletionsModel(minimaxClient, 'MiniMax-M2.5');

let passed = 0, failed = 0;
async function test(name, fn) {
  try {
    const result = await fn();
    console.log(`  ✅ ${name}`);
    if (result) console.log(`     → ${result}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ ${name}: ${e.message}`);
    failed++;
  }
}

const getWeatherTool = tool({
  name: 'get_weather',
  description: 'Get the current weather for a city',
  parameters: z.object({ city: z.string() }),
  execute: async ({ city }) => JSON.stringify({ city, temperature: 72, condition: 'sunny' }),
});

const searchTool = tool({
  name: 'web_search',
  description: 'Search the web',
  parameters: z.object({ query: z.string() }),
  execute: async ({ query }) => JSON.stringify({ results: [`Top result for: ${query}`] }),
});

const sendEmailTool = tool({
  name: 'send_email',
  description: 'Send an email',
  parameters: z.object({ to: z.string(), subject: z.string(), body: z.string() }),
  execute: async ({ to }) => JSON.stringify({ success: true, message: `Sent to ${to}` }),
});

async function runTests() {
  console.log('\n🧪 MiniMax M2.5 + Agents SDK (Proxy Fix)\n');

  console.log('🤖 Basic Agent');
  await test('Chat without tools', async () => {
    const agent = new Agent({ name: 'Test', instructions: 'Reply in one sentence.', model: minimaxModel });
    const result = await run(agent, 'What is the capital of Japan?');
    return result.finalOutput?.substring(0, 80);
  });

  console.log('\n🔧 Tool Calling');
  await test('Single tool call', async () => {
    const agent = new Agent({
      name: 'Weather Bot',
      instructions: 'Use the get_weather tool to answer weather questions. Be concise.',
      model: minimaxModel,
      tools: [getWeatherTool],
    });
    const result = await run(agent, "What's the weather in Tokyo?", { maxTurns: 5 });
    const toolCalls = result.newItems?.filter(i => i.type === 'tool_call_output_item') || [];
    return `🔧 ${toolCalls.length} tool call(s) — ${result.finalOutput?.substring(0, 60)}`;
  });

  await test('Two different tools in sequence', async () => {
    const agent = new Agent({
      name: 'Assistant',
      instructions: 'Use the tools to complete the task. Call each tool exactly once, then respond with a brief summary. Do NOT repeat tool calls.',
      model: minimaxModel,
      tools: [getWeatherTool, searchTool],
    });
    const result = await run(agent, 'What is the weather in London and also search for "London travel tips"?', { maxTurns: 8 });
    const toolCalls = result.newItems?.filter(i => i.type === 'tool_call_output_item') || [];
    return `🔧 ${toolCalls.length} tool call(s) — ${result.finalOutput?.substring(0, 60)}`;
  });

  console.log(`\n${'='.repeat(50)}`);
  console.log(`✅ Passed: ${passed} | ❌ Failed: ${failed}`);
  console.log(`${'='.repeat(50)}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(e => { console.error('Fatal:', e); process.exit(1); });
