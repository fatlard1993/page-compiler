const fs = require('fs');
const path = require('path');
const files = fs.readdirSync(__dirname, { withFileTypes: true });

const data = {};

files
  .filter((file) => file.name !== 'index.js' && file.isFile())
  .forEach(({ name }) => {
    const file = fs.readFileSync(path.join(__dirname, name), 'utf8');
    data[name] = file;
  })

module.exports = data;
