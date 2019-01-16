const autobahn = require('autobahn');
const path = require('path');
const fs = require('fs-extra');
const dotEnv = require('dotenv').config({path: path.resolve(__dirname, '../../.env')});

const CONFIG_SOURCE = '../../crossbar/crossbar-node/config_template.json';
const CONFIG_DESTINATION = '../../crossbar/crossbar-node/config.json';

(async () => {
    try {
        const config = await fs.readJson(path.resolve(__dirname, CONFIG_SOURCE));
        for(const worker of config.workers) {
            if(worker.type === 'router') {
                for(const transport of worker.transports) {
                    if(transport.type === 'websocket') {
                        const users = transport.auth.wampcra.users;
                        for(const user of Object.keys(users)) {
                            const userData = users[user];
                            const secret = process.env[`CROSSBAR_SECRET_${user.toUpperCase()}`];
                            const salt = process.env[`CROSSBAR_SALT_${user.toUpperCase()}`];
                            userData.secret = autobahn.auth_cra.derive_key(secret, salt, 100, 16);
                            userData.salt = salt;
                        }
                    }
                }
            }
        }
        await fs.writeJson(path.resolve(__dirname, CONFIG_DESTINATION), config, {spaces: 2});
    } catch (e) {
        console.log(e);
    }
})();

