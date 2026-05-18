import { DockerComposeEnvironment, Wait } from 'testcontainers';
import path from 'path';

export default async function globalSetup(): Promise<void> {
  // compose file lives in the project root, not in tests/
  const environment = await new DockerComposeEnvironment(
    path.resolve(__dirname, '..'),
    'docker-compose.yml'
  )
    // vmstorage already has a healthcheck defined in docker-compose so we reuse it here
    .withWaitStrategy('vmstorage', Wait.forHealthCheck())
    // the other services have no healthcheck in docker-compose, so we poll their /health endpoints directly
    .withWaitStrategy('vminsert', Wait.forHttp('/health', 8480))
    .withWaitStrategy('vmselect', Wait.forHttp('/health', 8481))
    .withWaitStrategy('vmagent', Wait.forHttp('/health', 8429))
    // blocks until all wait strategies pass before handing control to the tests
    .up();

  // stored on global so globalTeardown can call .down() on the same project name testcontainers generated
  (global as any).__COMPOSE_ENVIRONMENT__ = environment;
}
