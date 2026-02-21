/**
 * Test MiniMax M2.5 with OpenAI Agents SDK + tool calling
 * 
 * Tests:
 * 1. Basic chat completion via OpenAIChatCompletionsModel
 * 2. Agent with tool calling (simulating Composio-style tools)
 * 3. Streaming
 */

import OpenAI from 'openai';
import { Agent, run, OpenAIChatCompletionsModel, setOpenAIAPI } from '@openai/agents';
import { tool } from '@openai/agents';
import { z } from 'zod';

import { setDefaultOpenAIClient } from '@openai/agents';

// Force Chat Completions API (MiniMax doesn't support Responses API)
setOpenAIAPI('chat_completions');

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY;
if (!MINIMAX_API_KEY || MINIMAX_API_KEY === 'your_minimax_key_here') {
  console.error('❌ Set MINIMAX_API_KEY in your environment first');
  console.error('   export MINIMAX_API_KEY=your_actual_key');
  process.exit(1);
}

// Create MiniMax client and set as default
const minimaxClient = new OpenAI({
  baseURL: process.env.MINIMAX_BASE_URL || 'https://api.minimax.io/v1',
  apiKey: MINIMAX_API_KEY,
});
setDefaultOpenAIClient(minimaxClient);

// Wrap as Agents SDK Model (positional args: client, model)
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

async function runTests() {
  console.log('\n🧪 Testing MiniMax M2.5 + OpenAI Agents SDK\n');

  // Test 1: Basic raw chat completion
  console.log('📡 Raw OpenAI SDK (Chat Completions)');
  await test('Basic chat completion', async () => {
    const res = await minimaxClient.chat.completions.create({
      model: 'MiniMax-M2.5',
      messages: [
        { role: 'system', content: 'You are a helpful assistant. Reply in one sentence.' },
        { role: 'user', content: 'What is 2+2?' },
      ],
      max_tokens: 100,
    });
    const answer = res.choices[0].message.content;
    if (!answer) throw new Error('No response');
    return answer.substring(0, 80);
  });

  // Test 2: Basic Agent (no tools)
  console.log('\n🤖 Agent SDK (No Tools)');
  await test('Simple agent run', async () => {
    const agent = new Agent({
      name: 'Test Agent',
      instructions: 'You are a helpful assistant. Always reply in one short sentence.',
      model: minimaxModel,
    });
    const result = await run(agent, 'What is the capital of France?');
    if (!result.finalOutput) throw new Error('No output');
    return result.finalOutput.substring(0, 80);
  });

  // Test 3: Agent with tool calling
  console.log('\n🔧 Agent SDK (With Tools)');
  
  const getWeatherTool = tool({
    name: 'get_weather',
    description: 'Get the current weather for a city',
    parameters: z.object({
      city: z.string().describe('The city name'),
    }),
    execute: async ({ city }) => {
      // Simulate weather API
      return JSON.stringify({ city, temperature: 72, condition: 'sunny' });
    },
  });

  await test('Agent with single tool call', async () => {
    const agent = new Agent({
      name: 'Weather Agent',
      instructions: 'You help with weather queries. Use the get_weather tool when asked about weather. Reply concisely.',
      model: minimaxModel,
      tools: [getWeatherTool],
    });
    const result = await run(agent, "What's the weather in San Francisco?", { maxTurns: 5 });
    if (!result.finalOutput) throw new Error('No output');
    // Check that it actually used the tool
    const usedTool = result.newItems?.some(item => item.type === 'tool_call_output_item');
    return `${usedTool ? '🔧 Tool used!' : '⚠️ No tool call'} — ${result.finalOutput.substring(0, 80)}`;
  });

  // Test 4: Agent with multiple tools
  const searchTool = tool({
    name: 'web_search',
    description: 'Search the web for information',
    parameters: z.object({
      query: z.string().describe('Search query'),
    }),
    execute: async ({ query }) => {
      return JSON.stringify({ results: [`Result for: ${query}`, 'Some relevant info about the topic'] });
    },
  });

  const sendEmailTool = tool({
    name: 'send_email',
    description: 'Send an email to someone',
    parameters: z.object({
      to: z.string().describe('Email recipient'),
      subject: z.string().describe('Email subject'),
      body: z.string().describe('Email body'),
    }),
    execute: async ({ to, subject, body }) => {
      return JSON.stringify({ success: true, message: `Email sent to ${to}` });
    },
  });

  await test('Agent with multiple tools (Composio-style)', async () => {
    const agent = new Agent({
      name: 'Automation Agent',
      instructions: 'You help automate tasks. Use available tools to complete requests. Reply concisely after completing tasks.',
      model: minimaxModel,
      tools: [getWeatherTool, searchTool, sendEmailTool],
    });
    const result = await run(agent, 
      "Search for the best restaurants in Boston and then send an email to john@example.com with the results",
      { maxTurns: 10 }
    );
    if (!result.finalOutput) throw new Error('No output');
    const toolCalls = result.newItems?.filter(item => item.type === 'tool_call_output_item') || [];
    return `🔧 ${toolCalls.length} tool calls — ${result.finalOutput.substring(0, 80)}`;
  });

  // Summary
  console.log(`\n${'='.repeat(50)}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`${'='.repeat(50)}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
