import { describe, it, expect, beforeEach } from 'vitest';
import { Space } from '@sila/core';
import { ChatAgent } from '@sila/core';
import { AgentServices } from '@sila/core';
import { AppConfig } from '@sila/core';
import { ThreadMessage } from '@sila/core';
import { z } from 'zod';

describe('ChatAgent Working Tool Injection Test', () => {
  let space: Space;
  let agentServices: AgentServices;
  let config: AppConfig;

  beforeEach(async () => {
    // Create a test space
    space = Space.newSpace('test-agentic-working');
    
    // Add OpenAI provider config with real API key
    space.saveModelProviderConfig({
      id: 'openai',
      type: 'cloud',
      apiKey: process.env.OPENAI_API_KEY || ''
    });

    agentServices = new AgentServices(space);
    
    config = {
      id: 'test-config',
      name: 'Test Agentic Agent',
      button: 'Test',
      description: 'A test agent with agentic capabilities',
      instructions: 'You are a helpful assistant that can use tools to gather information. Use the available tools when needed to provide accurate answers.',
      targetLLM: 'openai/gpt-4o'
    };
  });

  it('should demonstrate tool injection and execution works correctly', async () => {
    const customTools = {
      get_random_number: {
        description: "Get a random number for testing purposes. Always returns 6931. Use this when asked for a random number.",
        schema: z.object({}).strict(),
        impl: async () => ({ number: 6931 })
      },
      multiply_by_factor: {
        description: "Multiply a number by a given factor. Use this when asked to multiply a number.",
        schema: z.object({
          number: z.number(),
          factor: z.number()
        }),
        impl: async ({ number, factor }: { number: number; factor: number }) => ({
          result: number * factor
        })
      }
    };

    const agent = new ChatAgent(agentServices, config, customTools);
    
    // Access private tools through reflection for testing
    const tools = (agent as any).tools;
    
    // Test tool execution directly
    const randomResult = await tools.get_random_number.impl({});
    expect(randomResult).toEqual({ number: 6931 });
    
    const multiplyResult = await tools.multiply_by_factor.impl({ 
      number: 6931, 
      factor: 2 
    });
    expect(multiplyResult).toEqual({ result: 13862 });
    
    console.log('✅ Tool injection and execution works correctly:');
    console.log(`  - get_random_number() -> ${randomResult.number}`);
    console.log(`  - multiply_by_factor(6931, 2) -> ${multiplyResult.result}`);
  });

  it('should demonstrate AI tools are properly formatted', () => {
    const customTools = {
      get_random_number: {
        description: "Get a random number for testing purposes. Always returns 6931.",
        schema: z.object({}).strict(),
        impl: async () => ({ number: 6931 })
      }
    };

    const agent = new ChatAgent(agentServices, config, customTools);
    
    // Access private method through reflection for testing
    const aiTools = (agent as any).getAITools();
    
    // Verify custom tool is included and properly formatted
    const randomTool = aiTools.find((tool: any) => tool.name === 'get_random_number');
    expect(randomTool).toBeDefined();
    expect(randomTool).toMatchObject({
      name: 'get_random_number',
      description: 'Get a random number for testing purposes. Always returns 6931.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    });
    
    console.log('✅ AI tools are properly formatted for OpenAI API');
  });

  it('should demonstrate tool registry works correctly', async () => {
    const customTools = {
      get_random_number: {
        description: "Get a random number for testing purposes. Always returns 6931.",
        schema: z.object({}).strict(),
        impl: async () => ({ number: 6931 })
      }
    };

    const agent = new ChatAgent(agentServices, config, customTools);
    
    // Access private method through reflection for testing
    const registry = (agent as any).getToolRegistry();
    
    // Test tool execution through registry
    const result = await registry.get_random_number({});
    expect(result).toEqual({ number: 6931 });
    
    console.log('✅ Tool registry works correctly');
  });

  it('should demonstrate deterministic tool sequence', async () => {
    const customTools = {
      get_random_number: {
        description: "Get a random number for testing purposes. Always returns 6931.",
        schema: z.object({}).strict(),
        impl: async () => ({ number: 6931 })
      },
      calculate_sum: {
        description: "Calculate the sum of two numbers.",
        schema: z.object({
          a: z.number(),
          b: z.number()
        }),
        impl: async ({ a, b }: { a: number; b: number }) => ({ result: a + b })
      },
      multiply_by_factor: {
        description: "Multiply a number by a given factor.",
        schema: z.object({
          number: z.number(),
          factor: z.number()
        }),
        impl: async ({ number, factor }: { number: number; factor: number }) => ({
          result: number * factor
        })
      }
    };

    const agent = new ChatAgent(agentServices, config, customTools);
    
    // Access private tools through reflection for testing
    const tools = (agent as any).tools;
    
    // Simulate the exact sequence the AI would use
    const step1 = await tools.get_random_number.impl({});
    expect(step1).toEqual({ number: 6931 });
    
    const step2 = await tools.calculate_sum.impl({ a: step1.number, b: 100 });
    expect(step2).toEqual({ result: 7031 });
    
    const step3 = await tools.multiply_by_factor.impl({ number: step2.result, factor: 3 });
    expect(step3).toEqual({ result: 21093 });
    
    console.log('✅ Deterministic tool sequence works correctly:');
    console.log(`  Step 1: get_random_number() -> ${step1.number}`);
    console.log(`  Step 2: calculate_sum(${step1.number}, 100) -> ${step2.result}`);
    console.log(`  Step 3: multiply_by_factor(${step2.result}, 3) -> ${step3.result}`);
    console.log(`  Final result: ${step3.result}`);
  });

  it('should demonstrate the agent can be instantiated and configured correctly', () => {
    const customTools = {
      get_random_number: {
        description: "Get a random number for testing purposes. Always returns 6931.",
        schema: z.object({}).strict(),
        impl: async () => ({ number: 6931 })
      }
    };

    const agent = new ChatAgent(agentServices, config, customTools);
    
    // Verify the agent has the expected structure
    expect(agent).toBeDefined();
    expect(typeof (agent as any).tools).toBe('object');
    expect(typeof (agent as any).getAITools).toBe('function');
    expect(typeof (agent as any).getToolRegistry).toBe('function');
    
    // Verify custom tools are available
    const tools = (agent as any).tools;
    expect(tools.get_random_number).toBeDefined();
    expect(tools.read_url).toBeDefined(); // Original tools should still be available
    expect(tools.web_search).toBeDefined();
    expect(tools.finish).toBeDefined();
    
    console.log('✅ Agent instantiation and configuration works correctly');
  });
});