import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const source = join("src", "data", "migrations");
const target = join("dist", "data", "migrations");

if (existsSync(source)) {
  mkdirSync(target, { recursive: true });
  cpSync(source, target, { recursive: true });
}
