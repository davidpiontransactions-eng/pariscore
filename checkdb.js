const db = require("better-sqlite3")("./pariscore.db", {readonly: true});
try {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log("Tables:", tables.map(t=>t.name).join(", "));
  const cols = db.prepare("SELECT sql FROM sqlite_master WHERE name='matches'").all();
  console.log("Schema:", cols[0] ? cols[0].sql.substring(0, 500) : "no schema");
} catch(e) { console.log("Error:", e.message); }
