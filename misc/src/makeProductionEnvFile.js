const path = require('path');
const fs = require('fs');

const ENV_FILE = '../../.env';
const PROD_ENV_FILE = '../../.env.production';
const OUTPUT_ENV_FILE = '../../dist/.env';

const prodEnv = fs
    .readFileSync(path.resolve(__dirname, PROD_ENV_FILE))
    .toString()
    .split('\n')
    .filter(line => !!line.trim() && line.trim().indexOf('#') !== 0 && line.indexOf('=') > 0)
    .reduce((out, line) => {
        const index = line.indexOf('=');
        const name = line.substring(0, index).trim();
        out[name] = line.substring(index+1).trim();;
        return out;
    }, {});

const outputEnv = [];

fs.readFileSync(path.resolve(__dirname, ENV_FILE)).toString().split('\n').forEach(line => {
    if(!!line.trim() && line.trim().indexOf('#') !== 0 && line.indexOf('=') > 0) {
        const index = line.indexOf('=');
        const name = line.substring(0, index).trim();
        let value = line.substring(index+1).trim();
        if(typeof prodEnv[name] !== 'undefined') value=prodEnv[name];
        if(value) outputEnv.push(`${name}=${value}`);
    } else outputEnv.push(line);
});

console.log(`Exporting merged production .env file: ${path.resolve(__dirname, OUTPUT_ENV_FILE)}`);
fs.writeFileSync(path.resolve(__dirname, OUTPUT_ENV_FILE), outputEnv.join('\n'));




