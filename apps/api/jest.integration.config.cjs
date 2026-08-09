/** Integration tests — require running PostgreSQL/Redis (docker compose up). */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.int-spec\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testTimeout: 30000,
};
