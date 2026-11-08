module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: 'test/.*\\.spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
  collectCoverageFrom: ['src/**/*.ts'],
  coverageThreshold: {
    global: {
      branches: 20,
      functions: 25,
      lines: 35,
      statements: 34,
    },
  },
  testEnvironment: 'node',
};
