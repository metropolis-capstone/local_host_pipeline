export default async function globalTeardown(): Promise<void> {
  // we retrieve the environment object stored by globalSetup rather than running docker compose down directly;
  // testcontainers uses a generated project name (i.e. testcontainers-abc123) so a plain docker compose down would target the wrong project
  const environment = (global as any).__COMPOSE_ENVIRONMENT__;
  await environment.down({ removeVolumes: true }); // removeVolumes removes named volumes i.e. vmstorage-data, otherwise data persists between test runs
}
