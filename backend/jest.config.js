export default {
  testEnvironment: "node",
  testMatch: ["**/src/test/**/*.test.js"],
  setupFilesAfterEnv: ["<rootDir>/src/test/jest.setup.js"],
  verbose: true
};