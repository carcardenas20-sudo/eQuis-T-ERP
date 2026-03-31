export const agentSDK = {
  listConversations: async () => [],
  createConversation: async ({ agent_name, metadata } = {}) => ({
    id: `local-${Date.now()}`,
    agent_name,
    metadata,
    messages: [],
    created_date: new Date().toISOString(),
  }),
  subscribeToConversation: (_id, _callback) => {
    return () => {};
  },
  addMessage: async (_conversation, _message) => {
    return { status: 'unavailable' };
  },
};
