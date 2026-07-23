import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const configPath = resolve(root, "src-tauri", "tauri.conf.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));
const cargo = readFileSync(resolve(root, "src-tauri", "Cargo.toml"), "utf8");
const cargoVersion = cargo.match(/^version = "([^"]+)"/m)?.[1];
const tag = process.env.GITHUB_REF_NAME;
const repository = process.env.GITHUB_REPOSITORY ?? "windht/watcher";
const publicKey = process.env.TAURI_UPDATER_PUBLIC_KEY;
const privateKey = process.env.TAURI_SIGNING_PRIVATE_KEY;
const requireUpdater = process.env.REQUIRE_TAURI_UPDATER === "1";

const versions = [packageJson.version, config.version, cargoVersion];
if (new Set(versions).size !== 1) {
  throw new Error(`Version mismatch: package=${versions[0]}, tauri=${versions[1]}, cargo=${versions[2]}`);
}
if (tag && /^v\d+\.\d+\.\d+$/.test(tag) && tag !== `v${packageJson.version}`) {
  throw new Error(`Release tag ${tag} does not match v${packageJson.version}.`);
}
if (requireUpdater && (!publicKey || !privateKey)) {
  throw new Error("TAURI_UPDATER_PUBLIC_KEY and TAURI_SIGNING_PRIVATE_KEY are required.");
}

config.bundle.homepage = `https://github.com/${repository}`;
config.plugins.updater.endpoints = [
  `https://github.com/${repository}/releases/latest/download/latest.json`,
];
if (publicKey) config.plugins.updater.pubkey = publicKey;
config.bundle.createUpdaterArtifacts = Boolean(privateKey);

writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
console.log(`Watcher v${packageJson.version} release configuration is valid.`);
