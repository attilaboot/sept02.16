const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Turbó Szerviz Desktop App Build kezdődik...');

// 1. React app build
console.log('📦 React alkalmazás build...');
try {
  // Először build script hozzáadása a package.json-hoz ha nincs
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  if (!packageJson.scripts['build-react']) {
    packageJson.scripts['build-react'] = 'react-scripts build';
    fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
  }
  
  execSync('npm run build-react', { stdio: 'inherit' });
  console.log('✅ React build kész');
} catch (error) {
  console.error('❌ React build hiba:', error.message);
  process.exit(1);
}

// 2. Electron build directory beállítás
console.log('📁 Build könyvtár beállítás...');

// A build mappát public-ként beállítjuk az Electron számára
const mainJs = fs.readFileSync('main.js', 'utf8');
const updatedMainJs = mainJs.replace(
  'http://localhost:3000',
  `file://${path.join(__dirname, 'build', 'index.html')}`
);
fs.writeFileSync('main-prod.js', updatedMainJs);

// 3. Electron packaging
console.log('🔧 Electron packaging...');
try {
  execSync('npx electron-builder --win --publish=never', { stdio: 'inherit' });
  console.log('✅ Windows executable elkészült!');
  console.log('📂 Található: dist/ mappában');
} catch (error) {
  console.error('❌ Electron build hiba:', error.message);
  process.exit(1);
}

console.log('🎉 Desktop alkalmazás build befejezve!');
console.log('📝 Következő lépések:');
console.log('   1. Nézd meg a dist/ mappát');
console.log('   2. Telepítsd a .exe fájlt Windows-on');
console.log('   3. Élvezd a teljes offline Turbó Szerviz alkalmazást!');