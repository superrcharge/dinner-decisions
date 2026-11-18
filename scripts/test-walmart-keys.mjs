// Before the browser tests: a throwaway Walmart key pair, so the server
// signs its requests for real and the pretend Walmart checks them for real.
// The private half goes where the Functions emulator reads secrets
// (functions/.secret.local); the public half goes to the pretend Walmart.
// Neither is ever used outside the tests, and both are git-ignored.

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" }
});

fs.writeFileSync("functions/.secret.local",
  "WALMART_CONSUMER_ID=test-consumer\n" +
  // One line, with the key's line breaks written as \n, which the server
  // puts back (pem() in functions/walmart.js).
  'WALMART_PRIVATE_KEY="' + privateKey.trim().replace(/\n/g, "\\n") + '"\n');
// Not under test-results/, which Playwright empties when it starts.
fs.writeFileSync(path.join(os.tmpdir(), "dinner-decisions-fake-walmart.pem"), publicKey);
