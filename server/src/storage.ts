import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

/**
 * Generic JSON file store. Abstracts persistence so we can later swap in SQLite.
 */
export class JsonStore<T extends object> {
  private filePath: string;
  private cache: T | null = null;

  constructor(filename: string) {
    this.filePath = join(DATA_DIR, filename);
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  }

  read(): T {
    if (this.cache) return this.cache;
    if (!existsSync(this.filePath)) {
      this.cache = {} as T;
      return this.cache;
    }
    const raw = readFileSync(this.filePath, 'utf-8');
    this.cache = JSON.parse(raw) as T;
    return this.cache;
  }

  write(data: T): void {
    this.cache = data;
    writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  update(mutator: (data: T) => void): T {
    const data = this.read();
    mutator(data);
    this.write(data);
    return data;
  }
}
