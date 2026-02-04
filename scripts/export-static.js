const fs = require('fs');
const path = require('path');

console.log('📦 Exporting static files to out/ directory...');

// Kaynak ve hedef klasörler
const sourceDir = path.join(__dirname, '../.next/server/app');
const staticDir = path.join(__dirname, '../.next/static');
const outDir = path.join(__dirname, '../out');

// out klasörünü temizle ve oluştur
if (fs.existsSync(outDir)) {
  fs.rmSync(outDir, { recursive: true, force: true });
}
fs.mkdirSync(outDir, { recursive: true });

// Recursive copy function
function copyRecursive(src, dest) {
  const stats = fs.statSync(src);
  
  if (stats.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    const files = fs.readdirSync(src);
    
    files.forEach(file => {
      copyRecursive(
        path.join(src, file),
        path.join(dest, file)
      );
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

// app içeriğini kopyala
if (fs.existsSync(sourceDir)) {
  console.log('✅ Copying app files...');
  copyRecursive(sourceDir, outDir);
}

// static dosyaları kopyala
if (fs.existsSync(staticDir)) {
  console.log('✅ Copying static files...');
  const nextStaticOut = path.join(outDir, '_next/static');
  fs.mkdirSync(nextStaticOut, { recursive: true });
  copyRecursive(staticDir, nextStaticOut);
}

console.log('✅ Export complete! out/ directory created.');
console.log(`📊 Total files exported: ${countFiles(outDir)}`);

function countFiles(dir) {
  let count = 0;
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stats = fs.statSync(filePath);
    
    if (stats.isDirectory()) {
      count += countFiles(filePath);
    } else {
      count++;
    }
  });
  
  return count;
}
