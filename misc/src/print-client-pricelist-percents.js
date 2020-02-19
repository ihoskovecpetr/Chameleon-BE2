const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({path: path.resolve(__dirname, '../../.env')});
const fs = require('fs');
const moment = require('moment');

const config = {
    dbURI: `mongodb://${process.env.MONGO_DB_HOST}:${process.env.MONGO_DB_PORT}/${'chameleon'}?authSource=admin`,
    dbOptions: {
        user: `${process.env.MONGO_DB_USER}`,
        pass: `${process.env.MONGO_DB_PASSWORD}`,
        useNewUrlParser: true
    }
};

mongoose.Promise = global.Promise;
//mongoose.set('debug', true);


//Email,"First Name","Last Name",,,,,,,,,,,,,,,,,,
//shiqing.zhao@shootinggalleryasia.com,Shiging,Zhao,,"Shooting Gallery Asia","INDIE\, EGYPT...",2,"2018-10-11 09:55:14",,"2018-10-11 09:55:14",89.233.144.101,,,,,,,,"2018-10-11 09:55:14",90498395,810826c56e,

(async () => {
    try {
        await mongoose.connect(config.dbURI, config.dbOptions);

        const Pricelist = mongoose.connection.db.collection('pricelists');
        const PricelistItem = mongoose.connection.db.collection('pricelist-items');

        const pricelists = await Pricelist.find().toArray();

        for(const pricelist of pricelists) {
            console.log();
            console.log(`${pricelist.label} (${pricelist.currency.toUpperCase()})`);
            console.log('------------------------------');
            for(const pricelistItem of pricelist.pricelist) {
                const item = await PricelistItem.find({_id: pricelistItem.itemId}).toArray();
                if(item[0]) {
                    const label = item[0].label[pricelist.language];
                    const price =  item[0].price[pricelist.currency];
                    const clientPrice = pricelistItem.price;
                    const percent = price ? Math.round(1000 * (1 - (clientPrice / price))) / 10 : 0;
                    console.log(`${label}: ${price} -> ${clientPrice} ${percent ? `[${percent}%]` : ''}`)
                }

            }
        }
    } catch(e) {
        console.error(e);
    } finally {
        mongoose.disconnect();
    }
})();

