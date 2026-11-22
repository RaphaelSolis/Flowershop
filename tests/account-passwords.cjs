const assert = require("node:assert/strict");
const { pbkdf2Sync, webcrypto } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const vm = require("node:vm");

const storePath = path.resolve(__dirname, "../store.js");
const source = fs.readFileSync(storePath, "utf8");

function passwordHelpers(crypto) {
  const context = vm.createContext({ crypto, TextEncoder });
  vm.runInContext(source, context, {
    filename: storePath,
    importModuleDynamically: (specifier) => import(new URL(specifier, pathToFileURL(storePath)).href),
  });
  return context;
}

async function main() {
  const native = passwordHelpers(webcrypto);
  const fallback = passwordHelpers({ getRandomValues: webcrypto.getRandomValues.bind(webcrypto) });
  const salt = "00112233445566778899aabbccddeeff";
  for (const password of ["Garden2026!", "Flowers 🌷 and café"]) {
    const expected = pbkdf2Sync(password, Buffer.from(salt, "hex"), 100000, 32, "sha256").toString("hex");
    for (const helpers of [native, fallback]) {
      const record = await helpers.makeAccountPassword(password, salt);
      assert.equal(record.salt, salt);
      assert.equal(record.digest, expected);
      assert.equal(await helpers.verifyAccountPassword(password, record), true);
      assert.equal(await helpers.verifyAccountPassword("wrong password", record), false);
    }
  }
  const record = await fallback.makeAccountPassword("NewGarden2026!");
  assert.match(record.salt, /^[a-f0-9]{32}$/);
  assert.equal(await native.verifyAccountPassword("NewGarden2026!", record), true);
  assert.equal(await fallback.verifyAccountPassword("password", { salt: "invalid", digest: "invalid" }), false);
  const recoveryQuestions = await fallback.makeAccountRecovery([
    { question: "What was the name of your first pet?", answer: " Fluffy  Cat " },
    { question: "What is my private garden phrase?", answer: "Café garden" },
  ]);
  const profile = { recoveryQuestions };
  assert.equal(await native.verifyAccountRecovery(["FLUFFY CAT", " café   garden "], profile), true);
  assert.equal(await fallback.verifyAccountRecovery(["FLUFFY CAT", "wrong"], profile), false);
  assert.equal(native.hasAccountRecovery({ recoveryQuestions: [recoveryQuestions[0]] }), false);
  console.log("PASS Security-question hashes created over HTTP verify over HTTPS and reject incorrect answers or malformed recovery records.");
  console.log("PASS Native and HTTP fallback passwords match PBKDF2-SHA256, verify existing records, and reject incorrect passwords.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
