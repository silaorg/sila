import { describe, it, expect, beforeEach } from 'vitest';
import { Space } from '@sila/core';
import { ChatAgent } from '@sila/core';
import { AgentServices } from '@sila/core';
import { AppConfig } from '@sila/core';
import { ThreadMessage } from '@sila/core';
import { z } from 'zod';

describe('ChatAgent Simple Tool Injection Test', () => {
  let space: Space;
  let agentServices: AgentServices;
  let config: AppConfig;

  beforeEach(async () => {
    // Create a test space
    space = Space.newSpace('test-agentic-simple');
    
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

  it('should inject custom tools and make them available to the AI', () => {
    const customTools = {
      get_random_number: {
        description: "Get a random number for testing purposes. Always returns 6931. Use this when asked for a random number.",
        schema: z.object({}).strict(),
        impl: async () => ({ number: 6931 })
      }
    };

    const agent = new ChatAgent(agentServices, config, customTools);
    
    // Access private tools through reflection for testing
    const tools = (agent as any).tools;
    
    // Verify custom tool is available
    expect(tools.get_random_number).toBeDefined();
    expect(tools.get_random_number.description).toContain('6931');
    
    // Verify original tools are still available
    expect(tools.read_url).toBeDefined();
    expect(tools.web_search).toBeDefined();
    expect(tools.finish).toBeDefined();
  });

  it('should generate correct AI tools format for custom tools', () => {
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
    
    // Verify custom tool is included
    const toolNames = aiTools.map((tool: any) => tool.name);
    expect(toolNames).toContain('get_random_number');
    
    // Verify tool structure
    const randomTool = aiTools.find((tool: any) => tool.name === 'get_random_number');
    expect(randomTool).toMatchObject({
      name: 'get_random_number',
      description: 'Get a random number for testing purposes. Always returns 6931.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    });
  });

  it('should test tool implementation directly', async () => {
    const customTools = {
      get_random_number: {
        description: "Get a random number for testing purposes. Always returns 6931.",
        schema: z.object({}).strict(),
        impl: async () => ({ number: 6931 })
      }
    };

    const agent = new ChatAgent(agentServices, config, customTools);
    
    // Access private tools through reflection for testing
    const tools = (agent as any).tools;
    
    // Test the tool implementation directly
    const result = await tools.get_random_number.impl({});
    expect(result).toEqual({ number: 6931 });
    
    // Test schema validation
    const validParams = tools.get_random_number.schema.parse({});
    expect(validParams).toEqual({});
  });

  it('should test tool registry with custom tools', async () => {
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
    
    // Verify custom tool is in registry
    expect(typeof registry.get_random_number).toBe('function');
    
    // Test tool execution through registry
    const result = await registry.get_random_number({});
    expect(result).toEqual({ number: 6931 });
    
    // Test that invalid parameters are handled gracefully
    const errorResult = await registry.get_random_number({ invalid: 'param' });
    expect(errorResult).toHaveProperty('error');
    expect(errorResult.error).toContain('get_random_number');
  });

  it('should demonstrate deterministic tool usage pattern', async () => {
    const customTools = {
      get_random_number: {
        description: "Get a random number for testing purposes. Always returns 6931.",
        schema: z.object({}).strict(),
        impl: async () => ({ number: 6931 })
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
    
    // Simulate a multi-step agentic process
    // Step 1: Get random number
    const step1Result = await tools.get_random_number.impl({});
    expect(step1Result).toEqual({ number: 6931 });
    
    // Step 2: Multiply by factor
    const step2Result = await tools.multiply_by_factor.impl({ 
      number: step1Result.number, 
      factor: 2 
    });
    expect(step2Result).toEqual({ result: 13862 });
    
    // This demonstrates how the AI could use these tools in sequence:
    // 1. Call get_random_number() -> gets 6931
    // 2. Call multiply_by_factor(number: 6931, factor: 2) -> gets 13862
    // 3. Provide final answer: "I got a random number (6931) and multiplied it by 2. The result is 13862."
    
    console.log('Deterministic tool sequence:');
    console.log(`Step 1: get_random_number() -> ${step1Result.number}`);
    console.log(`Step 2: multiply_by_factor(${step1Result.number}, 2) -> ${step2Result.result}`);
    console.log(`Expected AI response should contain: ${step1Result.number} and ${step2Result.result}`);
  });
});