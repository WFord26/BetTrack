/**
 * Script to create an API key for MCP integration
 * 
 * Usage: tsx src/scripts/create-api-token.ts [name] [expiresInDays]
 * 
 * Example:
 *   tsx src/scripts/create-api-token.ts "Claude Desktop" 365
 */

import { prisma } from '../config/database';
import { generateApiKey, hashApiKey, getKeyPrefix } from '../utils/api-key-generator';

async function main() {
  const keyName = process.argv[2] || 'MCP Token';
  const expiresInDays = parseInt(process.argv[3] || '365', 10);

  try {
    // Generate API key
    const plainKey = generateApiKey();
    const keyHash = await hashApiKey(plainKey);
    const keyPrefix = getKeyPrefix(plainKey);

    // Calculate expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Store in database
    const apiKey = await prisma.apiKey.create({
      data: {
        keyHash,
        keyPrefix,
        name: keyName,
        expiresAt,
        permissions: {
          read: true,
          write: true,
          bets: true,
          stats: true
        }
      }
    });

    console.log('\n✅ API Key Created Successfully!\n');
    console.log('='.repeat(80));
    console.log(`Key ID:      ${apiKey.id}`);
    console.log(`Name:        ${apiKey.name}`);
    console.log(`Key Prefix:  ${apiKey.keyPrefix}`);
    console.log(`Created:     ${apiKey.createdAt.toISOString()}`);
    console.log(`Expires:     ${apiKey.expiresAt?.toISOString() || 'Never'}`);
    console.log('='.repeat(80));
    console.log('\n🔑 Your API Key (save this - it won\'t be shown again!):\n');
    console.log(`   ${plainKey}`);
    console.log('\n');
    console.log('Add this to your MCP config:\n');
    console.log('"env": {');
    console.log(`  "DASHBOARD_API_KEY": "${plainKey}"`);
    console.log('}\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating API key:', error);
    process.exit(1);
  }
}

main();
