export default {
  // ts-jest lets jest understand TypeScript directly without a separate compile step
  preset: 'ts-jest',
  testEnvironment: 'node',
  globalSetup: './globalSetup.ts',
  globalTeardown: './globalTeardown.ts',
  // default jest timeout is 5s; docker compose startup needs considerably more runway
  testTimeout: 120000,
};
