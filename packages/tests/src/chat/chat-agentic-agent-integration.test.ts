import { describe, it, expect, beforeEach } from 'vitest';
import { Space } from '@sila/core';
import { ChatAgent } from '@sila/core';
import { AgentServices } from '@sila/core';
import { AppConfig } from '@sila/core';
import { ThreadMessage } from '@sila/core';
import { z } from 'zod';

describe('ChatAgent Tool Injection Integration', () => {
  let space: Space;
  let agentServices: AgentServices;
  let config: AppConfig;

  beforeEach(async () => {
    // Create a test space
    space = Space.newSpace('test-agentic-integration');
    
    // Add a mock provider config
    space.saveModelProviderConfig({
      id: 'openai',
      type: 'cloud',
      apiKey: 'test-key'
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

  it('should inject custom tools and make them available to the agent', () => {
    const customTools = {
      get_random_number: {
        description: "Get a random number for testing purposes. Use this when asked for a random number.",
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
      }
    };

    const agent = new ChatAgent(agentServices, config, customTools);
    
    // Access private tools through reflection for testing
    const tools = (agent as any).tools;
    
    // Verify custom tools are available
    expect(tools.get_random_number).toBeDefined();
    expect(tools.calculate_sum).toBeDefined();
    
    // Verify original tools are still available
    expect(tools.read_url).toBeDefined();
    expect(tools.web_search).toBeDefined();
    expect(tools.finish).toBeDefined();
    
    // Verify tool schemas
    expect(tools.get_random_number.schema).toBeDefined();
    expect(tools.calculate_sum.schema).toBeDefined();
    
    // Verify tool implementations
    expect(typeof tools.get_random_number.impl).toBe('function');
    expect(typeof tools.calculate_sum.impl).toBe('function');
  });

  it('should execute custom tools and return deterministic results', async () => {
    const customTools = {
      get_random_number: {
        description: "Get a random number for testing purposes.",
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
      }
    };

    const agent = new ChatAgent(agentServices, config, customTools);
    
    // Access private tools through reflection for testing
    const tools = (agent as any).tools;
    
    // Test get_random_number tool
    const randomResult = await tools.get_random_number.impl({});
    expect(randomResult).toEqual({ number: 6931 });
    
    // Test calculate_sum tool
    const sumResult = await tools.calculate_sum.impl({ a: 5, b: 3 });
    expect(sumResult).toEqual({ result: 8 });
    
    // Test schema validation for calculate_sum
    const validParams = tools.calculate_sum.schema.parse({ a: 10, b: 20 });
    expect(validParams).toEqual({ a: 10, b: 20 });
    
    // Test that invalid parameters are rejected
    expect(() => tools.calculate_sum.schema.parse({ a: 'invalid', b: 5 })).toThrow();
    expect(() => tools.calculate_sum.schema.parse({ a: 5 })).toThrow(); // Missing b
  });

  it('should generate correct AI tools format for custom tools', () => {
    const customTools = {
      get_random_number: {
        description: "Get a random number for testing purposes.",
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
      }
    };

    const agent = new ChatAgent(agentServices, config, customTools);
    
    // Access private method through reflection for testing
    const aiTools = (agent as any).getAITools();
    
    // Verify all tools are included
    const toolNames = aiTools.map((tool: any) => tool.name);
    expect(toolNames).toContain('get_random_number');
    expect(toolNames).toContain('calculate_sum');
    expect(toolNames).toContain('read_url');
    expect(toolNames).toContain('web_search');
    expect(toolNames).toContain('finish');
    
    // Verify tool structure
    const randomTool = aiTools.find((tool: any) => tool.name === 'get_random_number');
    expect(randomTool).toMatchObject({
      name: 'get_random_number',
      description: 'Get a random number for testing purposes.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    });
    
    const sumTool = aiTools.find((tool: any) => tool.name === 'calculate_sum');
    expect(sumTool).toMatchObject({
      name: 'calculate_sum',
      description: 'Calculate the sum of two numbers.',
      parameters: {
        type: 'object',
        properties: {
          a: { type: 'number' },
          b: { type: 'number' }
        },
        required: ['a', 'b']
      }
    });
  });

  it('should handle tool registry with custom tools', async () => {
    const customTools = {
      get_random_number: {
        description: "Get a random number for testing purposes.",
        schema: z.object({}).strict(),
        impl: async () => ({ number: 6931 })
      }
    };

    const agent = new ChatAgent(agentServices, config, customTools);
    
    // Access private method through reflection for testing
    const registry = (agent as any).getToolRegistry();
    
    // Verify custom tool is in registry
    expect(typeof registry.get_random_number).toBe('function');
    expect(typeof registry.read_url).toBe('function');
    
    // Test tool execution through registry
    const result = await registry.get_random_number({});
    expect(result).toEqual({ number: 6931 });
    
    // Test that invalid parameters are handled gracefully
    const errorResult = await registry.get_random_number({ invalid: 'param' });
    expect(errorResult).toHaveProperty('error');
    expect(errorResult.error).toContain('get_random_number');
  });

  it('should demonstrate deterministic tool usage pattern', async () => {
    // This test demonstrates how the agentic loop would work with deterministic tools
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
    
    // The deterministic nature allows us to test the agentic loop behavior
    // without needing to mock the AI model responses
  });
});