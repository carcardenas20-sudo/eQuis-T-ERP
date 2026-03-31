import pg from 'pg';

const { Pool, types } = pg;

// NUMERIC (OID 1700): return as float, not string
types.setTypeParser(1700, parseFloat);

// TIMESTAMPTZ (OID 1184): return as ISO string preserving original format
// Date-only fields (midnight UTC) are trimmed to "YYYY-MM-DD" to match original Base44 format
// Datetime fields keep full ISO string
types.setTypeParser(1184, (val) => {
  if (!val) return null;
  const d = new Date(val);
  const iso = d.toISOString();
  // If time is exactly midnight UTC, this was originally a date-only string
  return iso.endsWith('T00:00:00.000Z') ? iso.slice(0, 10) : iso;
});

// DATE (OID 1082): always return as "YYYY-MM-DD"
types.setTypeParser(1082, (val) => val ? val.slice(0, 10) : null);

// INTEGER (OID 23): return as number (already is, but explicit)
// FLOAT8 (OID 701): return as number (already is)

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

export async function query(text, params) {
  const client = await pool.connect();
  try {
    const res = await client.query(text, params);
    return res;
  } finally {
    client.release();
  }
}
