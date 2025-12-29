// Learn more: https://github.com/testing-library/jest-dom
require('@testing-library/jest-dom')

// Mock global fetch for API tests
global.fetch = jest.fn();

// Suppress console methods to reduce noise in test output
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
};
