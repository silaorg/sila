import { describe, it, expect, beforeEach } from 'vitest';
import { Space } from '@sila/core';
import { ChatAgent } from '@sila/core';
import { AgentServices } from '@sila/core';
import { AppConfig } from '@sila/core';
import { ThreadMessage } from '@sila/core';
import { z } from 'zod';

describe('ChatAgent Real AI Integration', () => {
  let space: Space;
  let agentServices: AgentServices;
  let config: AppConfig;

  beforeEach(async () => {
    // Create a test space
    space = Space.newSpace('test-agentic-real');
    
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
      instructions: 'You are a helpful assistant that can use tools to gather information. Use the available tools when needed to provide accurate answers. When you use a tool, make sure to include the result in your final answer.',
      targetLLM: 'openai/gpt-4o'
    };
  });

  it('should use real AI model with deterministic tool and return the expected number', async () => {
    const customTools = {
      get_random_number: {
        description: "Get a random number for testing purposes. Always returns 6931. Use this when asked for a random number.",
        schema: z.object({}).strict(),
        impl: async () => ({ number: 6931 })
      }
    };

    const agent = new ChatAgent(agentServices, config, customTools);
    
    const messages: ThreadMessage[] = [
      {
        id: '1',
        role: 'user',
        text: 'Please get a random number for me and tell me what it is.',
        inProgress: false,
        createdAt: Date.now(),
        updatedAt: null
      }
    ];

    const response = await agent.input(messages);
    
    // Verify the response contains the deterministic number
    expect(response.text).toContain('6931');
    expect(response.text).toContain('random number');
    
    console.log('AI Response:', response.text);
  }, 30000); // 30 second timeout for API call

  it('should use real AI model with multiple deterministic tools in sequence', async () => {
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
    
    const messages: ThreadMessage[] = [
      {
        id: '1',
        role: 'user',
        text: 'Get a random number and multiply it by 2. Then tell me both the original number and the result.',
        inProgress: false,
        createdAt: Date.now(),
        updatedAt: null
      }
    ];

    const response = await agent.input(messages);
    
    // Verify the response contains both numbers
    expect(response.text).toContain('6931');
    expect(response.text.replace(/,/g, '')).toContain('13862'); // 6931 * 2 (remove commas for comparison)
    
    console.log('AI Response:', response.text);
  }, 30000); // 30 second timeout for API call

  it('should use real AI model with finish tool for structured completion', async () => {
    const customTools = {
      get_random_number: {
        description: "Get a random number for testing purposes. Always returns 6931. Use this when asked for a random number.",
        schema: z.object({}).strict(),
        impl: async () => ({ number: 6931 })
      }
    };

    const agent = new ChatAgent(agentServices, config, customTools);
    
    const messages: ThreadMessage[] = [
      {
        id: '1',
        role: 'user',
        text: 'Get a random number and then use the finish tool to provide a summary.',
        inProgress: false,
        createdAt: Date.now(),
        updatedAt: null
      }
    ];

    const response = await agent.input(messages);
    
    // The response should contain the deterministic number
    expect(response.text).toContain('6931');
    
    console.log('AI Response:', response.text);
  }, 30000); // 30 second timeout for API call

  it('should demonstrate agentic loop with real AI making multiple tool calls', async () => {
    const customTools = {
      get_random_number: {
        description: "Get a random number for testing purposes. Always returns 6931. Use this when asked for a random number.",
        schema: z.object({}).strict(),
        impl: async () => ({ number: 6931 })
      },
      calculate_sum: {
        description: "Calculate the sum of two numbers. Use this when asked to add numbers together.",
        schema: z.object({
          a: z.number(),
          b: z.number()
        }),
        impl: async ({ a, b }: { a: number; b: number }) => ({ result: a + b })
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
    
    const messages: ThreadMessage[] = [
      {
        id: '1',
        role: 'user',
        text: 'Get a random number, add 100 to it, then multiply the result by 3. Show me all the steps and the final result.',
        inProgress: false,
        createdAt: Date.now(),
        updatedAt: null
      }
    ];

    const response = await agent.input(messages);
    
    // Verify the response contains the expected numbers from the deterministic tools
    expect(response.text).toContain('6931'); // Original random number
    expect(response.text).toContain('7031'); // 6931 + 100
    expect(response.text).toContain('21093'); // 7031 * 3
    
    console.log('AI Response:', response.text);
  }, 30000); // 30 second timeout for API call
});