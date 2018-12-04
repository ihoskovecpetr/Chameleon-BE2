'use strict';

const jsonpatch = require('fast-json-patch');
const mongoose = require('mongoose');
const HistoryModel = require('./models/history');

const historyPlugin = (options) => {
    let pluginOptions = {
        ignore: [], // List of fields to ignore when compare changes
        include: [], // List of fields to check exclusively when compare changes
        userField: '_user' //name of the field in the stored / updated doc carrying user who is doing operation
    };

    Object.assign(pluginOptions, options ? options : {});

    const toJSON = obj => JSON.parse(JSON.stringify(obj.data ? obj.data() : obj));

    const getPatch = doc => {
        const previousObject = doc._original ? doc._original : {};
        delete doc._original;
        const currentObject = toJSON(doc);

        delete currentObject.__user;
        delete currentObject.__v;
        delete previousObject.__v;

        if(pluginOptions.include && Array.isArray(pluginOptions.include) && pluginOptions.include.length > 0) {
            for(const key of Object.keys(currentObject)) if(pluginOptions.include.indexOf(key) < 0) delete currentObject[key];
            for(const key of Object.keys(previousObject)) if(pluginOptions.include.indexOf(key) < 0) delete previousObject[key];
        } else if(pluginOptions.ignore && Array.isArray(pluginOptions.ignore) && pluginOptions.ignore.length > 0) {
            for(const ignore of pluginOptions.ignore) {
                delete currentObject[ignore];
                delete previousObject[ignore];
            }
        }
        return jsonpatch.compare(previousObject, currentObject);
    };

    const createHistory = async doc => {
        const patch = getPatch(doc);
        if(patch && Array.isArray(patch) && patch.length > 0) {
            const history = new HistoryModel({
                collectionName: doc.constructor.modelName,
                ref: doc._id,
                patch: patch || [],
                method: doc._method
            });
            if(doc.__user) history.user = doc.__user;
            await history.save();
        }
    };

    async function preSave() {
        const original = await this.constructor.findById(this._id);
        this._original = original ? toJSON(original) : {};
        this._method = 'save';
    }

    async function postSave() {
        await createHistory(this);
    }

    async function preUpdateOne() {
        let original = await this.model.findOne(this._conditions);
        original = original || new this.model({});
        this._original = toJSON(original);
        this._method = 'update';
        const user = this._update._user || this._update.$set._user || this.options._user;
        if(user) this.__user = user;
    }

    async function postUpdateOne() {
        if(this._original) {
            const current = await this.model.findOne({_id: this._original._id});
            if(!current) throw new Error('No current document found.');
            current._original = this._original;
            current._method = this._method;
            current.__user = this.__user;
            await createHistory(current);
        } else {
            throw new Error('No original document found.');
        }
    }

    async function preUpdateMulti() {
        let originals = await this.model.find(this._conditions);
        if(originals && originals.length > 0) {
            originals = originals.map(original => original || new this.model({}));
            this._originals = originals.map(original => toJSON(original));
        } else {
            this._originals = []
        }
        this._method = 'update';
        const user = this._update._user || this._update.$set._user || this.options._user;
        if (user) this.__user = user;
    }

    async function postUpdateMulti() {
        if(this._originals && this._originals.length > 0) {
            for(const original of this._originals) {
                const current = await this.model.findOne({_id: original._id});
                if(!current) throw new Error('No current document found.');
                current._original = original;
                current._method = this._method;
                current.__user = this.__user;
                await createHistory(current);
            }
        } else {
            throw new Error('No original document found.');
        }
    }

    function emptyValue(value) {
        if(!value) return true;
        else if(Array.isArray(value) && value.length === 0) return true;
        else if(Object.keys(value).length === 0) return true;
        else return false;
    }

    const plugin = function(schema) {
        // *************************************************************************************************************
        // METHODS
        // *************************************************************************************************************
        schema.methods.data = function() {
            return this.toObject({
                depopulate: true,
                versionKey: false,
                transform: (doc, ret) => {
                    if (schema.options.timestamps) {
                        delete ret[schema.options.timestamps.createdAt || 'createdAt'];
                        delete ret[schema.options.timestamps.updatedAt || 'updatedAt'];
                    }
                },
            })
        };
        // *************************************************************************************************************
        // STATICS
        // *************************************************************************************************************
        schema.statics.getHistory = async function(id, pointer, options) {
            const defaults = {
                last: false, //output last current value in history
                timestamp: false, //output timestamp of value
                unique: false, //output only unique values (including current one)
                limit: 0 //limit output values, 0 - unlimited
            };
            options = Object.assign({}, defaults, options);
            let histories =  await HistoryModel.find({ref: id, collectionName: this.modelName}, 'patch timestamp').sort({timestamp: 'asc'}).lean();
            histories = histories.map(history => {
                return {
                    timestamp: history.timestamp,
                    value: history.patch.reduce((value, operation) => {
                        if(!value && (operation.op === 'replace' || operation.op === 'add')) {
                            if(pointer.indexOf(operation.path) === 0) {
                                const keys = pointer.substr(operation.path.length).split('/').filter(item => !!item);
                                let valueOfOperation = operation.value;
                                for (const key of keys) {
                                    if (valueOfOperation && valueOfOperation[key]) valueOfOperation = valueOfOperation[key];
                                    else {
                                        valueOfOperation = undefined;
                                        break;
                                    }
                                }
                                if (valueOfOperation) value = valueOfOperation;
                            } else if(operation.path.indexOf(pointer) === 0) {
                                const keys = operation.path.substr(pointer.length).split('/').filter(item => !!item);
                                let valueOfOperation = operation.value;
                                if(valueOfOperation) {
                                    for (const key of keys.reverse()) {
                                        valueOfOperation = {[key]: valueOfOperation}
                                    }
                                    value = valueOfOperation
                                }
                            }
                        }
                        return value;
                    }, undefined)
                }
            }).filter(history => !emptyValue(history.value));
            if(options.unique) histories = histories.reverse().filter((item, index, self) => index === self.findIndex(it => it.value === item.value)).reverse();
            if(!options.last) histories.pop();
            if(options.limit && histories.length > options.limit) histories = histories.slice(-options.limit);
            return histories.length === 0 ? null : !options.timestamp ? histories.map(item => item.value) : histories;
        };
        // *************************************************************************************************************
        // SAVE
        // *************************************************************************************************************
        schema.pre('save', async function(next) {
            try {
                if(mongoose.get('debug')) console.log('PRE-HOOK :: SAVE');
                await preSave.call(this);
            } catch(err) {
                console.error(err);
                next(err);
            }
        });
        schema.post('save', async function(resultObject, next) {
            try {
                if(mongoose.get('debug')) console.log(`POST-HOOK :: SAVE`);
                await postSave.call(this);
                next();
            } catch(err) {
                console.error(err);
                next(err);
            }
        });
        // *************************************************************************************************************
        // UPDATE
        // *************************************************************************************************************
        schema.pre('update', async function(next) {
            try {
                const multi = this.options.multi;
                if(mongoose.get('debug')) console.log(`PRE-HOOK :: UPDATE${multi ? ' (multi = true)' : ''}`);
                if(multi) await preUpdateMulti.call(this);
                else await preUpdateOne.call(this);
                next()
            } catch(err) {
                console.error(err);
                next(err);
            }
        });
        schema.post('update', async function(resultObject, next) {
            try {
                const multi = this.options.multi;
                if(mongoose.get('debug')) console.log(`POST-HOOK :: UPDATE${multi ? ' (many = true)' : ''}`);
                if (resultObject.result.nModified > 0) {
                    if(multi) await postUpdateMulti.call(this);
                    else await postUpdateOne.call(this);
                }
                next();
            } catch(err) {
                console.error(err);
                next(err);
            }
        });
        // *************************************************************************************************************
        // UPDATE MANY
        // *************************************************************************************************************
        schema.pre('updateMany', async function(next) {
            try {
                if(mongoose.get('debug')) console.log(`PRE-HOOK :: UPDATE-MANY`);
                await preUpdateMulti.call(this);
                next()
            } catch(err) {
                console.error(err);
                next(err);
            }
        });
        schema.post('updateMany', async function(resultObject, next) {
            try {
                if(mongoose.get('debug')) console.log(`POST-HOOK :: UPDATE-MANY`);
                if (resultObject.result.nModified > 0) {
                    await postUpdateMulti.call(this);
                }
                next();
            } catch(err) {
                console.error(err);
                next(err);
            }
        });
        // *************************************************************************************************************
        // UPDATE ONE
        // *************************************************************************************************************
        schema.pre('updateOne', async function(next) {
            try {
                if(mongoose.get('debug')) console.log(`PRE-HOOK :: UPDATE-ONE`);
                await preUpdateOne.call(this);
                next()
            } catch(err) {
                console.error(err);
                next(err);
            }
        });
        schema.post('updateOne', async function(resultObject, next) {
            try {
                if(mongoose.get('debug')) console.log(`POST-HOOK :: UPDATE-ONE`);
                if (resultObject.result.nModified > 0) {
                    await postUpdateOne.call(this);
                }
                next();
            } catch(err) {
                console.error(err);
                next(err);
            }
        });
        // *************************************************************************************************************
        // FIND ONE AND UPDATE
        // *************************************************************************************************************
        schema.pre('findOneAndUpdate', async function(next) {
            try {
                if(mongoose.get('debug')) console.log(`PRE-HOOK :: FIND-ONE-AND-UPDATE`);
                await preUpdateOne.call(this);
                next()
            } catch(err) {
                console.error(err);
                next(err);
            }
        });
        schema.post('findOneAndUpdate', async function(resultObject, next) {
            try {
                if(mongoose.get('debug')) console.log(`POST-HOOK :: FIND-ONE-AND-UPDATE`);
                await postUpdateOne.call(this);
                next();
            } catch(err) {
                console.error(err);
                next(err);
            }
        });
    };
    return plugin;
};

module.exports = historyPlugin;