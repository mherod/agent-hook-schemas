#!/usr/bin/env bun
/**
 * Refresh the npm registry bearer token in ~/.npmrc using 1Password CLI (`op`).
 *
 * Usage:
 *   bun scripts/refresh-npm-token.ts
 *   bun scripts/refresh-npm-token.ts --item "My NPM Item"
 *   bun scripts/refresh-npm-token.ts --dry-run
 *
 * Requires:
 *   - 1Password CLI (`op`) installed and authenticated (`op signin`)
 *   - A 1Password item with username, password, and TOTP configured
 *
 * Note: The npm CouchDB endpoint issues 2-hour session tokens. For longer-lived
 * tokens, create a granular access token at npmjs.com → Account Settings → Access Tokens.
 */

import { $ } from "bun";
import { homedir } from "os";
import { join } from "path";

const REGISTRY = "https://registry.npmjs.org";
const NPMRC_PATH = join(homedir(), ".npmrc");
const TOKEN_LINE_PREFIX = "//registry.npmjs.org/:_authToken=";

// Parse CLI args
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const itemFlagIdx = args.indexOf("--item");
const itemNameRaw = itemFlagIdx !== -1 ? args[itemFlagIdx + 1] : undefined;
const itemName: string = itemNameRaw ?? "Npmjs";

async function opGet(item: string, field: string): Promise<string> {
  const result = await $`op item get ${item} --fields ${field} --reveal`.quiet().text();
  return result.trim();
}

async function opOtp(item: string): Promise<string> {
  const result = await $`op item get ${item} --otp`.quiet().text();
  return result.trim();
}

async function main() {
  console.log(`Using 1Password item: "${itemName}"`);

  // Step 1: Retrieve credentials
  console.log("Retrieving credentials from 1Password...");
  const [username, password] = await Promise.all([
    opGet(itemName, "username"),
    opGet(itemName, "password"),
  ]);
  if (!username || !password) {
    console.error("Error: Could not retrieve username or password from 1Password.");
    process.exit(1);
  }
  console.log(`  Username: ${username}`);

  // Step 2: Get OTP (time-sensitive — fetch right before the PUT)
  console.log("Fetching OTP...");
  const otp = await opOtp(itemName);
  if (!otp) {
    console.error("Error: Could not retrieve OTP from 1Password.");
    process.exit(1);
  }

  // Step 3: Exchange credentials for a bearer token
  console.log("Requesting bearer token from npm registry...");
  const response = await fetch(`${REGISTRY}/-/user/org.couchdb.user:${username}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "npm-otp": otp,
    },
    body: JSON.stringify({ name: username, password, type: "user" }),
  });

  const body = await response.json() as { token?: string; error?: string };
  if (!response.ok || !body.token) {
    console.error("Error: Token request failed.");
    console.error(`  Status: ${response.status}`);
    console.error(`  Body: ${JSON.stringify(body)}`);
    process.exit(1);
  }

  const token = body.token;
  console.log(`  Token received: ${token.slice(0, 8)}...(${token.length} chars)`);

  if (dryRun) {
    console.log("\n--dry-run: Would write to", NPMRC_PATH);
    console.log(`  ${TOKEN_LINE_PREFIX}<redacted>`);
    return;
  }

  // Step 4: Update ~/.npmrc
  console.log(`Updating ${NPMRC_PATH}...`);
  const npmrcFile = Bun.file(NPMRC_PATH);
  const existingContent = (await npmrcFile.exists()) ? await npmrcFile.text() : "";

  const lines = existingContent.split("\n");
  const filtered = lines.filter((line) => !line.startsWith(TOKEN_LINE_PREFIX));
  filtered.push(`${TOKEN_LINE_PREFIX}${token}`);

  // Ensure single trailing newline
  const newContent = filtered.filter((l) => l !== "").join("\n") + "\n";
  await Bun.write(NPMRC_PATH, newContent);
  console.log("  Token written.");

  // Step 5: Verify
  console.log("Verifying...");
  try {
    const whoami = await $`bunx npm@latest whoami`.quiet().text();
    console.log(`  Authenticated as: ${whoami.trim()}`);
  } catch {
    // Automation tokens may not support whoami — check the token exists
    console.log("  whoami unavailable (expected for some token types). Token is written.");
  }

  console.log("\nDone. Token expires in ~2 hours (CouchDB session token).");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
