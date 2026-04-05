const fs = require('fs');
const glob = require('glob');
const path = require('path');

const files = glob.sync('src/modules/**/*.routes.ts');
for (const f of files) {
  let content = fs.readFileSync(f, 'utf8');
  let original = content;
  content = content.replace(/roleGuard\('ADMIN', 'ALMACENISTA'\)/g, "roleGuard('OWNER', 'SELLER')");
  content = content.replace(/roleGuard\('ADMIN', 'CAJERO'\)/g, "roleGuard('OWNER', 'SELLER')");
  content = content.replace(/roleGuard\('ADMIN'\)/g, "roleGuard('OWNER')");
  
  if (original !== content) {
      fs.writeFileSync(f, content);
      console.log('Fixed roles in:', f);
  }
}
