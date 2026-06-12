process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import pg from 'pg';

const { Client } = pg;

const connectionString = "postgres://postgres.ifnvjffeptufaelzqijb:UaL4b0enmxoc5B2G@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true";

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function setup() {
  try {
    await client.connect();
    console.log("Connected to Supabase Postgres.");

    await client.query(`
      DROP TABLE IF EXISTS kb_docs;
      CREATE TABLE kb_docs (
        id UUID PRIMARY KEY,
        data JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
      );
    `);
    console.log("kb_docs table created or already exists.");

  } catch (err) {
    console.error("Error setting up database:", err);
  } finally {
    await client.end();
  }
}

setup();
