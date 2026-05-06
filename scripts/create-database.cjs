'use strict';
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  const env = {};
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

function sanitizeDbName(name) {
  if (!/^[a-zA-Z0-9_]+$/.test(name)) {
    throw new Error(
      `DATABASE_NAME inválido (${name}). Use apenas letras, números e underscore.`,
    );
  }
  return name;
}

async function main() {
  const env = loadEnv();
  const dbName = sanitizeDbName(env.DATABASE_NAME || 'financeiro');

  const client = new Client({
    host: env.DATABASE_HOST || 'localhost',
    port: Number(env.DATABASE_PORT || 5432),
    user: env.DATABASE_USER || 'postgres',
    password: env.DATABASE_PASSWORD || '',
    database: 'postgres',
  });

  await client.connect();
  const exists = await client.query(
    `SELECT 1 FROM pg_database WHERE datname = $1`,
    [dbName],
  );
  if (exists.rowCount === 0) {
    await client.query(`CREATE DATABASE "${dbName}"`);
    console.log(`Banco criado: ${dbName}`);
  } else {
    console.log(`Banco já existe: ${dbName}`);
  }
  await client.end();
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
