const { pool } = require("../config/database.js");

afterAll(async () => {
  await pool.end();
});
