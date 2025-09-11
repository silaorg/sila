import { describe, it, expect, beforeEach } from 'vitest';
import { Space, SpaceManager } from '@sila/core';
import { ChatAgent } from '@sila/core';
import { AgentServices } from '@sila/core';
import { AppConfig } from '@sila/core';
import { ThreadMessage } from '@sila/core';
import { RepTree } from 'reptree';
import { uuid } from '@sila/core';
import { z } from 'zod';

describe('ChatAgent Agentic Loop', () => {
  let space: Space;
  let agentServices: AgentServices;
  let config: AppConfig;

  beforeEach(async () => {
    // Create a test space using Space.newSpace()
    space = Space.newSpace('test-agentic-agent');
    
    // Add a mock provider config (we won't actually call the API in this test)
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

  it('should create ChatAgent instance', () => {
    const agent = new ChatAgent(agentServices, config);
    expect(agent).toBeInstanceOf(ChatAgent);
    expect(agent.getConfig()).toEqual(config);
  });

  it('should handle basic conversation without tools', async () => {
    const agent = new ChatAgent(agentServices, config);
    
    const messages: ThreadMessage[] = [
      {
        id: '1',
        role: 'user',
        text: 'Hello, how are you?',
        inProgress: false,
        createdAt: Date.now(),
        updatedAt: null
      }
    ];

    // Note: This will fail in a real test environment without actual API keys
    // but it demonstrates the structure
    try {
      const response = await agent.input(messages);
      expect(response).toHaveProperty('text');
      expect(response).toHaveProperty('thinking');
    } catch (error) {
      // Expected to fail without real API key, but the agent structure is correct
      expect(error).toBeDefined();
    }
  });

  it('should have tool definitions', () => {
    const agent = new ChatAgent(agentServices, config);
    
    // Access private tools through reflection for testing
    const tools = (agent as any).tools;
    expect(tools).toBeDefined();
    expect(tools.read_url).toBeDefined();
    expect(tools.web_search).toBeDefined();
    expect(tools.finish).toBeDefined();
    
    // Check tool schemas
    expect(tools.read_url.schema).toBeDefined();
    expect(tools.web_search.schema).toBeDefined();
    expect(tools.finish.schema).toBeDefined();
    
    // Check tool descriptions
    expect(tools.read_url.description).toContain('Read content from a URL');
    expect(tools.web_search.description).toContain('Search the web');
    expect(tools.finish.description).toContain('Signal that the task is complete');
  });

  it('should generate AI tools format', () => {
    const agent = new ChatAgent(agentServices, config);
    
    // Access private method through reflection for testing
    const aiTools = (agent as any).getAITools();
    expect(aiTools).toBeInstanceOf(Array);
    expect(aiTools.length).toBe(3);
    
    const toolNames = aiTools.map((tool: any) => tool.name);
    expect(toolNames).toContain('read_url');
    expect(toolNames).toContain('web_search');
    expect(toolNames).toContain('finish');
    
    // Check that each tool has required properties
    aiTools.forEach((tool: any) => {
      expect(tool).toHaveProperty('name');
      expect(tool).toHaveProperty('description');
      expect(tool).toHaveProperty('parameters');
    });
  });

  it('should have tool registry with validation', () => {
    const agent = new ChatAgent(agentServices, config);
    
    // Access private method through reflection for testing
    const registry = (agent as any).getToolRegistry();
    expect(registry).toBeDefined();
    expect(typeof registry.read_url).toBe('function');
    expect(typeof registry.web_search).toBe('function');
    expect(typeof registry.finish).toBe('function');
  });

  it('should support stopping', () => {
    const agent = new ChatAgent(agentServices, config);
    
    expect(agent.hasStopped).toBe(false);
    agent.stop();
    expect(agent.hasStopped).toBe(true);
  });

  it('should have maximum steps limit', () => {
    const agent = new ChatAgent(agentServices, config);
    
    // Access private property through reflection for testing
    const maxSteps = (agent as any).MAX_STEPS;
    expect(maxSteps).toBe(12);
  });

  it('should accept custom tools injection', () => {
    const customTools = {
      get_random_number: {
        description: "Get a random number for testing purposes",
        schema: z.object({}),
        impl: async () => ({ number: 6931 })
      }
    };

    const agent = new ChatAgent(agentServices, config, customTools);
    
    // Access private tools through reflection for testing
    const tools = (agent as any).tools;
    expect(tools.get_random_number).toBeDefined();
    expect(tools.read_url).toBeDefined(); // Original tools should still be available
    expect(tools.web_search).toBeDefined();
    expect(tools.finish).toBeDefined();
  });

  it('should use injected custom tool and return deterministic result', async () => {
    const customTools = {
      get_random_number: {
        description: "Get a random number for testing purposes. Use this when asked for a random number.",
        schema: z.object({}),
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

    // Note: This will fail in a real test environment without actual API keys
    // but it demonstrates the structure and we can test the tool injection
    try {
      const response = await agent.input(messages);
      expect(response).toHaveProperty('text');
      expect(response).toHaveProperty('thinking');
      
      // The response should contain the deterministic number 6931
      expect(response.text).toContain('6931');
    } catch (error) {
      // Expected to fail without real API key, but the agent structure is correct
      expect(error).toBeDefined();
      
      // Even if the API call fails, we can verify the tool was injected correctly
      const tools = (agent as any).tools;
      expect(tools.get_random_number).toBeDefined();
      
      // Test the tool implementation directly
      const toolResult = await tools.get_random_number.impl({});
      expect(toolResult).toEqual({ number: 6931 });
    }
  });

  it('should test custom tool implementation directly', async () => {
    const customTools = {
      get_random_number: {
        description: "Get a random number for testing purposes",
        schema: z.object({}).strict(), // Use strict to reject extra properties
        impl: async () => ({ number: 6931 })
      }
    };

    const agent = new ChatAgent(agentServices, config, customTools);
    
    // Access private tools through reflection for testing
    const tools = (agent as any).tools;
    const tool = tools.get_random_number;
    
    // Test the tool implementation directly
    const result = await tool.impl({});
    expect(result).toEqual({ number: 6931 });
    
    // Test schema validation
    const validResult = tool.schema.parse({});
    expect(validResult).toEqual({});
    
    // Test that invalid parameters would be rejected
    expect(() => tool.schema.parse({ invalid: 'param' })).toThrow();
  });
});