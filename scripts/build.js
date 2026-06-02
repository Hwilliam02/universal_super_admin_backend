import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

const exclude = new Set(['node_modules', 'dist', '.git', '.env']);

const copyRecursive = (src, dest) => {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      if (exclude.has(entry.name)) continue;
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        copyRecursive(srcPath, destPath);
      } else if (entry.isFile()) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
    return;
  }

  fs.copyFileSync(src, dest);
};

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
  if (exclude.has(entry.name)) continue;
  const srcPath = path.join(root, entry.name);
  const destPath = path.join(dist, entry.name);
  if (entry.isDirectory()) {
    copyRecursive(srcPath, destPath);
  } else if (entry.isFile()) {
    fs.copyFileSync(srcPath, destPath);
  }
}
