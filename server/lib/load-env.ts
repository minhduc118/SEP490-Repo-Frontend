/**
 * Load sep490-frontend/.env into process.env before any other server module reads it.
 * Must be the first import of server/index.ts.
 */
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  process.loadEnvFile(envPath);
}
