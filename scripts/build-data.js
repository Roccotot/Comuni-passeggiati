// Rigenera comuni-data.js dopo l'arricchimento
const fs = require('fs');
const path = require('path');

const base = path.join(__dirname, '..');
const data = fs.readFileSync(path.join(base, 'comuni.json'), 'utf8');
const out  = `window.COMUNI_DATA = ${data};\n`;
fs.writeFileSync(path.join(base, 'comuni-data.js'), out);

const comuni = JSON.parse(data);
const withAlt  = comuni.filter(c => c.altitudine  != null).length;
const withPop  = comuni.filter(c => c.abitanti    != null).length;
const withTemp = comuni.filter(c => c.temp_media  != null).length;
console.log(`comuni-data.js rigenerato (${comuni.length} comuni)`);
console.log(`  altitudine:  ${withAlt}/${comuni.length}`);
console.log(`  abitanti:    ${withPop}/${comuni.length}`);
console.log(`  temp_media:  ${withTemp}/${comuni.length}`);
