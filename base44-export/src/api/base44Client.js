import { createClient } from '@base44/sdk';
// import { getAccessToken } from '@base44/sdk/utils/auth-utils';

// Create a client with authentication required
export const base44 = createClient({
  appId: "68fb000e9fd41751e58b6a1a", 
  requiresAuth: true // Ensure authentication is required for all operations
});
