import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(root, '.env.local') });
dotenv.config({ path: path.join(root, '.env') });

const databaseUrl = process.env.DATABASE_URL || 'file:./dev.db';
const provider =
  databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://')
    ? 'postgresql'
    : 'sqlite';
const baseSchemaPath = path.join(root, 'prisma', 'schema.prisma');
const generatedDir = path.join(root, 'prisma', '.generated');
const generatedSchemaPath = path.join(generatedDir, `${provider}.schema.prisma`);
const prismaBin = path.join(
  root,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'prisma.cmd' : 'prisma'
);

function generateSchema() {
  const baseSchema = readFileSync(baseSchemaPath, 'utf8');
  const generatedSchema = baseSchema.replace(
    /datasource db \{\s*provider\s*=\s*"[^"]+"\s*\}/,
    `datasource db {\n  provider = "${provider}"\n}`
  );

  mkdirSync(generatedDir, { recursive: true });
  writeFileSync(generatedSchemaPath, generatedSchema);

  return generatedSchemaPath;
}

const schemaPath = generateSchema();
const args = process.argv.slice(2);

if (!args.length) {
  console.log(`Generated ${provider} Prisma schema at ${schemaPath}`);
  process.exit(0);
}

if (!existsSync(prismaBin)) {
  console.error('Prisma CLI was not found in node_modules. Run npm install first.');
  process.exit(1);
}

const result = spawnSync(prismaBin, [...args, '--schema', schemaPath], {
  cwd: root,
  env: process.env,
  shell: process.platform === 'win32',
  stdio: 'inherit',
});

if (result.error) {
  console.error(result.error);
}

process.exit(result.status ?? 1);
