/**
 * Script to create an API token for MCP integration
 * 
 * Usage: tsx src/scripts/create-api-token.ts [name]
 * 
 * Example:
 *   tsx src/scripts/create-api-token.ts "Claude Desktop"
 */

import crypto from 'crypto';
import { prisma } from '../config/database';
import { logger } from '../config/logger';

async function main() {
  const tokenName = process.argv[2] || 'MCP Token';
  const expiresInDays = parseInt(process.argv[3] || '365', 10);

  try {
    // Generate random token
    const token = crypto.randomBytes(32).toString('hex');

    // Hash token for storage
    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Calculate expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Store in database
    const apiToken = await prisma.apiToken.create({
      data: {
        tokenHash,
        name: tokenName,
        expiresAt
      }
    });

    console.log('\n✅ API Token Created Successfully!\n');
    console.log('='.repeat(80));
    console.log(`Token ID:    ${apiToken.id}`);
    console.log(`Name:        ${apiToken.name}`);
    console.log(`Created:     ${apiToken.createdAt.toISOString()}`);
    console.log(`Expires:     ${apiToken.expiresAt?.toISOString() || 'Never'}`);
    console.log('='.repeat(80));
    console.log('\n🔑 Your API Token (save this - it won\'t be shown again!):\n');
    console.log(`   ${token}`);
    console.log('\n');
    console.log('📋 Use in your requests:\n');
    console.log(`   Authorization: Bearer ${token}`);
    console.log('\n');
    console.log('⚠️  Keep this token secure! It provides access to your betting dashboard.\n');

  } catch (error) {
    logger.error('Failed to create API token:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
