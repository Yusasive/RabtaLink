import 'dotenv/config';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as entities from './entities';

// Used by the TypeORM CLI (migration:generate / migration:run) run from the host machine,
// so it defaults to localhost rather than the `postgres` docker-compose service name.
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST_CLI ?? 'localhost',
  port: parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
  username: process.env.POSTGRES_USER ?? 'rabtalink',
  password: process.env.POSTGRES_PASSWORD ?? 'rabtalink',
  database: process.env.POSTGRES_DB ?? 'rabtalink',
  entities: Object.values(entities),
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
});
