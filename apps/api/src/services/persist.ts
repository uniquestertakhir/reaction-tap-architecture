// ===== FILE START: apps/api/src/services/persist.ts =====
import fs from "node:fs/promises";
import path from "node:path";

function dataDir() {
  // кладём данные рядом с apps/api/.data
  // process.cwd() при запуске из apps/api обычно указывает на apps/api
  return path.resolve(process.cwd(), ".data");
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export async function readJson<T>(fileName: string, fallback: T): Promise<T> {
  const dir = dataDir();
  const filePath = path.join(dir, fileName);

  try {
    const raw = await fs.readFile(filePath, "utf8");
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeJson(fileName: string, value: unknown): Promise<void> {
  const dir = dataDir();
  await ensureDir(dir);

  const filePath = path.join(dir, fileName);
  const tmpPath = `${filePath}.tmp`;

  const raw = JSON.stringify(value, null, 2);

  // atomic-ish: сначала tmp, потом rename
  await fs.writeFile(tmpPath, raw, "utf8");
  await fs.rename(tmpPath, filePath);
}
// ===== FILE END: apps/api/src/services/persist.ts =====
