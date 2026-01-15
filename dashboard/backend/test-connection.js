const { Client } = require('pg');

async function testConnection() {
  const client = new Client({
    connectionString: 'postgresql://sports_user:sports_password_change_in_production@localhost:5432/sports_betting_dashboard'
  });

  try {
    await client.connect();
    console.log('✓ Connection successful!');
    
    const result = await client.query('SELECT current_database(), current_schema()');
    console.log('Database:', result.rows[0].current_database);
    console.log('Schema:', result.rows[0].current_schema);
    
    await client.query('CREATE TABLE IF NOT EXISTS test_table (id SERIAL PRIMARY KEY)');
    console.log('✓ Table creation successful!');
    
    await client.query('DROP TABLE test_table');
    console.log('✓ Table drop successful!');
    
  } catch (error) {
    console.error('✗ Connection failed:', error.message);
  } finally {
    await client.end();
  }
}

testConnection();
