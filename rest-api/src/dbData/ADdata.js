'use strict';

const ActiveDirectory = require('activedirectory');
const AD = require('ad');
const logger = require('../logger');
const helperMethods = require('./helperMethods');

//DEV
const configAd = {
    host: 'Srv-UPP01.global.upp.cz', 
    ssl: true,
    baseDn: 'dc=global,dc=upp,dc=cz',
    user: 'reklama.booking', 
    password: 'Ztmrsk7*',
};

const configAdSuperUser = {
    host: 'Srv-UPP01.global.upp.cz', 
    ssl: true,
    baseDn: 'dc=global,dc=upp,dc=cz',
    user: 'adv.test.hoskovec',  // 'reklama.booking', 
    password: 'sJ+xXkQYh6sd', // 'Ztmrsk7*',
};

//PRODUCTION
// const configAd = {
//     host: process.env.AUTH_AD_HOST, 
//     ssl: process.env.AUTH_AD_SSL && (process.env.AUTH_AD_SSL === 'true' || process.env.AUTH_AD_SSL === 'TRUE'),
//     baseDn: process.env.AUTH_AD_BASE_DN,
//     user: process.env.AD_USER,
//     password: process.env.AD_PASSWORD
// };

const ad = new ActiveDirectory({
    url: `ldap${configAd.ssl ? 's' : ''}://${configAd.host}${configAd.ssl ? ':636' : ''}`,
    baseDN: configAd.baseDn,
    tlsOptions: {rejectUnauthorized: false},
    username: `${configAd.user}`,
    password: `${configAd.password}`
});

const adAll = new ActiveDirectory({
    url: `ldap${configAd.ssl ? 's' : ''}://${configAd.host}${configAd.ssl ? ':636' : ''}`,
    baseDN: 'OU=ADV,OU=Projects,OU=Specials,DC=global,DC=upp,DC=cz',
    tlsOptions: {rejectUnauthorized: false},
    username: `${configAd.user}`,
    password: `${configAd.password}`
});

var ad2 = new AD({
    url: `ldap${configAdSuperUser.ssl ? 's' : ''}://${configAdSuperUser.host}${configAdSuperUser.ssl ? ':636' : ''}`,
    strictDN: false,
    tlsOptions: {rejectUnauthorized: false},
    user: `${configAdSuperUser.user}@global.upp.cz`,
    pass: `${configAdSuperUser.password}`
});

exports.getAllGroups = async () => {

    return new Promise((resolve, reject) => {
        const filter = `(&(objectClass=group)(sAMAccountName=adv_*)(!(sAMAccountName=*_manager)))`; //(memberOf=cn=test_group_adv) (sAMAccountName=petra*)
        const attributes = ['name', 'managedObjects', 'managedBy', 'member', 'uppAdvGroupAttribute'];
            adAll.findGroups({filter, attributes}, (err, data) => {

                if (err) logger.info(`manager ERR >>>>> ${JSON.stringify(err, undefined, 2)}`);
                else{
                    // logger.info(`manager >>>>> ${JSON.stringify(data, undefined, 2)}`);
                    console.log("All groups found here >> : >> ", data.length)
                    resolve({
                        allGroups: data,
                    })
                } 
            })
    });
};

exports.getAllManagerGroups = async () => {

    return new Promise((resolve, reject) => {
        const filter = `(&(objectClass=group)(sAMAccountName=adv_*_manager))`; //(memberOf=cn=test_group_adv) (sAMAccountName=petra*)
        const attributes = ['name', 'managedObjects', 'managedBy', 'member', 'uppAdvGroupAttribute'];
            adAll.findGroups({filter, attributes}, (err, data) => {

                if (err) logger.info(`manager ERR >>>>> ${JSON.stringify(err, undefined, 2)}`);
                else{
                    // logger.info(`manager >>>>> ${JSON.stringify(data, undefined, 2)}`);
                    console.log("All manager groups found here >> : >> ", data.length)
                    resolve({
                        allGroups: data,
                    })
                } 
            })
    });
};


exports.getUser = async uid => {
    return new Promise((resolve, reject) => {

        const filter = `(&(sAMAccountName=${uid})(objectClass=user)(!(objectClass=computer)))`;
        const attributes = ['sAMAccountName', 'givenName', 'sn', 'displayName', 'mail'];
        ad.findUsers({filter, attributes}, (err, data) => {
            if (err) reject(`${err}`);
            else if (!data || data.length === 0) reject(`Can't find user ${uid}`);
            else resolve({
                    uid: data[0].sAMAccountName,
                    name: data[0].givenName && data[0].sn ? `${data[0].givenName} ${data[0].sn}` : data[0].displayName,
                    email: data[0].mail
                });
        })
    });
};

exports.getOwnGroups = async () => {

    return new Promise((resolve, reject) => {

        const filter = `(&(objectClass=user)(sAMAccountName=${configAd.user})(!(objectClass=computer)))`; //(memberOf=cn=test_group_adv) (sAMAccountName=petra*)
        const attributes = ['sAMAccountName', 'givenName', 'sn', 'displayName', 'mail', 'memberOf', 'managedObjects'];
            ad.findUsers({filter, attributes}, (err, data) => {
                if (err) logger.info(`manager ERR >>>>> ${JSON.stringify(err, undefined, 2)}`);
                else{
                    // logger.info(`manager >>>>> ${JSON.stringify(data, undefined, 2)}`);
                    resolve({
                        userData: data,
                    })
                } 
            })
    });
};

exports.getUserInfo = async (sAMAccountName) => {
    sAMAccountName = "reklama.booking"
    return new Promise((resolve, reject) => {

        const filter = `(&(objectClass=user)(sAMAccountName=${sAMAccountName})(!(objectClass=computer)))`; //(memberOf=cn=test_group_adv) (sAMAccountName=petra*)
        const attributes = ['sAMAccountName', 'givenName', 'sn', 'displayName', 'mail', 'memberOf', 'managedObjects'];
            ad.findUsers({filter, attributes}, (err, data) => {
                if (err) logger.info(`manager ERR >>>>> ${JSON.stringify(err, undefined, 2)}`);
                else{
                    // logger.info(`manager >>>>> ${JSON.stringify(data, undefined, 2)}`);
                    resolve({
                        userData: data,
                    })
                } 
            })
    });
};


exports.getProjectManagerGroups = async (project_id) => {

    return new Promise((resolve, reject) => {
        const filter = `(&(sAMAccountName=adv_${project_id}_manager))`; //(memberOf=cn=test_group_adv) (sAMAccountName=petra*) ${project_name}
        const attributes = ['sAMAccountName', 'sn', 'displayName', 'mail', 'memberOf', 'managedObjects']; //'givenName', 'sn', 'displayName', 'mail', 'memberOf', 'managedObjects'
            ad.find({filter, attributes}, (err, data) => {
                console.log("getProjectManagerGroups result: err, data ", err, data)
                if (err || !data || !data.groups) logger.info(`getProjectManagerGroups ERR >>>>> ${JSON.stringify(err, undefined, 2)}`);
                else if(data && data.groups){
                    console.log(`getProjectManagerGroups DATA >>>>> ${JSON.stringify(data, undefined, 2)}`);
                    resolve(
                        data.groups,
                    )
                } else{
                    resolve(
                        "No Groups"
                    )
                }
            })
    });
};


exports.getProjectNormalGroups = async (project_id) => {

    console.log("getProjectNormalGroups project_id: ", project_id)

    return new Promise((resolve, reject) => {

        const filter = `(&(sAMAccountName=adv_${project_id}*)(!(sAMAccountName=*_manager)))`; //(memberOf=cn=test_group_adv) (sAMAccountName=petra*) ${project_name}
        const attributes = ['sAMAccountName', 'sn', 'displayName', 'mail', 'memberOf', 'managedObjects']; //'givenName', 'sn', 'displayName', 'mail', 'memberOf', 'managedObjects'
            ad.find({filter, attributes}, (err, data) => {
                // console.log("getProjectNormalGroups result: err, data ", err, data)
                if (err || !data || !data.groups) logger.info(`getProjectNormalGroups ERR >>>>> ${JSON.stringify(err, undefined, 2)}`);
                else if(data && data.groups){
                    // console.log(`getProjectNormalGroups DATA >>>>> ${JSON.stringify(data, undefined, 2)}`);
                    resolve(
                        data.groups,
                    )
                } else{
                    resolve(
                        "No Groups"
                    )
                }
            })
    });
};

// exports.getGroupMembers = async (groupName) => {
//     return new Promise((resolve, reject) => {

//         const filter = `(&(objectClass=user)(memberOf=CN=${groupName},OU=ADV,OU=Projects,OU=Specials,DC=global,DC=upp,DC=cz))`; //(memberOf=cn=test_group_adv) (sAMAccountName=petra*)
//         const attributes = ['sAMAccountName', 'givenName', 'sn', 'displayName', 'mail', 'memberOf'];
//             ad.findUsers({filter, attributes}, (err, data) => {
//                 if (err) logger.info(`findUsers ERR >>>>> ${JSON.stringify(err, undefined, 2)}`);
//                 else{
//                     resolve({
//                         userData: data,
//                     })
//                 } 
//             })
//     });
// };

exports.getGroupsMembers = async (groupNamesArr) => {
    return new Promise((resolve, reject) => {

        // const filter = `(&(objectClass=user)(memberOf=CN=${groupName},OU=ADV,OU=Projects,OU=Specials,DC=global,DC=upp,DC=cz))`; //(memberOf=cn=test_group_adv) (sAMAccountName=petra*)
        const attributes = ['sAMAccountName', 'givenName', 'sn', 'displayName', 'mail', 'memberOf'];

            try{

                let promisses = []
                groupNamesArr.map(groupName => {

                    const filter = `(&(objectClass=user)(memberOf=CN=${groupName},OU=ADV,OU=Projects,OU=Specials,DC=global,DC=upp,DC=cz))`;
        
                    promisses.push(
                    new Promise((resolve1, reject1) => {
                        ad.findUsers({filter, attributes}, (err, data) => {
                            if (err) {
                                logger.info(`getGroupsMembers ERR >>>>> ${JSON.stringify(err, undefined, 2)}`);
                                // reject1()
                                resolve1({
                                    [groupName]: null,
                                })
                            }
                            else{
                                resolve1({
                                    [groupName]: data,
                                })
                            }
                        }) 
                    })  
                    ) 
                })
        
                Promise.all(promisses).then((values) => {
                    // console.log("All Promisses getGroupsMembers resooolved,", values)
                    resolve({
                        data: values
                    })
                  }).catch(err => {
                    console.log("NOT All Promisses getGroupsMembers resolved,", err)
                    reject(err)
                });
        
            }catch(e){
                console.log("AD err: ", e)
                reject(err)
            }

    });
};

exports.removeGroupMembers = async (group, user) => {
    return new Promise((resolve, reject) => {
        try{

            ad2.user(user).removeFromGroup(group).then(users => {
            logger.info(`user(${user})removeFromGroup(${group})  result>>>>> ${JSON.stringify(users, undefined, 2)} `);

            // ADD IF OK< THEN RESOLVE
            resolve({
                success: true
            })
        }).catch(err => {
            logger.info(`user(${user})removeFromGroup(${group})  ERR: >>>>> ${JSON.stringify(err)} `);
            reject(err)
        }); 

    }catch(e){
        console.log("AD err: ", e)
    }
    });
}

exports.saveNewGroupMembers = async (group_name, users) => {

    // FIND all members of group_name >> REMOVE them >> ADD users to group_name
    return new Promise((resolve, reject) => {
        try{


            // const filter = `(&(objectClass=user)(memberOf=CN=${group_name},CN=Group,CN=Schema,CN=Configuration,DC=global,DC=upp,DC=cz))`; //(memberOf=cn=test_group_adv) (sAMAccountName=petra*)
            const attributes = ['sAMAccountName', 'givenName', 'sn', 'displayName', 'mail', 'memberOf'];
            const filter = `(&(objectClass=user)(memberOf=CN=${group_name},OU=ADV,OU=Projects,OU=Specials,DC=global,DC=upp,DC=cz))`;

            let promisseGetMbs = new Promise((resolve1, reject1) => {
                    ad.findUsers({filter, attributes}, (err, data) => {
                        if (err) {
                            logger.info(`getGroupsMembers ERR >>>>> ${JSON.stringify(err, undefined, 2)}`);
                            reject1()
                        }
                        else if(data){
                            resolve1({
                                [group_name]: data,
                            })
                        } else{
                            resolve1({
                                [group_name]: [],
                            })  
                        }
                    }) 
                }) 
                
                const deletemembers = async (existingMbs) => {

                    try{

                    console.log("Deleting Members", existingMbs)
                    let promisses = []
                    existingMbs[group_name].map(userObj => {
    
                        console.log(`DELETING of ${userObj.sAMAccountName} from: ${group_name}`)
                        promisses.push(
                            ad2.user(userObj.sAMAccountName).removeFromGroup(group_name).then((value) => value).catch((err) => {
                                console.log("Deleting err: ", err)
                                return {succ: false}
                                // reject(err)
                            })
                        ) 
                    })
    
                    Promise.all(promisses).then((values) => {
                        console.log("Resolved ALL Proms REMOVING: ", values)
                        setNewMembers()
                      }).catch(err => {
                        console.log("NOT All Promisses REMOVING resolved,", err)
                        reject(err)
                    });
                }catch(err){
                    reject(err)
                }
    
                }
    
                const setNewMembers = () => {

                    try{
                        let promisses = []
                        if(users.length != 0){

                            users.map(userObj => {
                                console.log(`SPAWNING user ${userObj.sAMAccountName} for: ${group_name}`)   
                                promisses.push(
                                    ad2.user(userObj.sAMAccountName).addToGroup(group_name).then((value) => value).catch((err) => {
                                        console.log("Spawning err: ", err)
                                        return {succ: false}
                                        // reject(err)
                                    })
                                ) 
                            })

                            Promise.all(promisses).then((values) => {
                                console.log("Resolved ALL Proms SPAWNING: ", values)
                                resolve( { "new_mbs_success": true } )
                            }).catch(err => {
                                console.log("NOT All Promisses SPAWNING resolved,", err)
                                reject(err)
                            });

                        }else{
                            resolve( { "new_mbs_success": true } )
                        }
                    }catch(err){

                        resolve( { "new_mbs_success": false } )
                    }



    
                }

            async function gettingRes(){
                try{

                let existingMbs = await promisseGetMbs

                deletemembers(existingMbs).catch(err => {
                    console.log("Catching unhandled Err DELETING: ABOVE ", err)
                })

                }catch(err){
                    console.log("Ctched err: ", err)
                }

            }

            gettingRes().catch(err => {
                console.log("Catched this from ABOVE: ", err)
            })

    }catch(e){
        console.log("AD err: ", e)
    }
    });
}



exports.saveNewGroupManagers = async (group_name, newUsers) => {


    console.log("ad saveNewGroupManagers: ", group_name, newUsers)
    // FIND all members of group_name >> REMOVE them >> ADD newUsers to group_name
    return new Promise((resolve, reject) => {
        try{
            const filter = `(&(objectClass=user)(memberOf=CN=${group_name},OU=ADV,OU=Projects,OU=Specials,DC=global,DC=upp,DC=cz))`;
            const attributes = ['sAMAccountName', 'givenName', 'sn', 'displayName', 'mail', 'memberOf'];
            let promisseGetMbs = new Promise((resolve1, reject1) => {
                    ad.findUsers({filter, attributes}, (err, data) => {
                        if (err) {
                            logger.info(`getGroupsMembers ERR >>>>> ${JSON.stringify(err, undefined, 2)}`);
                            reject1()
                        }
                        else if(data){
                            resolve1({
                                [group_name]: data,
                            })
                        } else{
                            resolve1({
                                [group_name]: [],
                            })  
                        }
                    }) 
                }) 
                
                // const deletemembers = (existingMbs) => {

                //     try{

                //     console.log("Deleting Members", existingMbs)
                //     let promisses = []
                //     existingMbs.map(userObj => {
    
                //         console.log(`DELETING MANAGER of ${userObj.sAMAccountName} from: ${group_name}`)
                //         promisses.push(
                //             ad2.user(userObj.sAMAccountName).removeFromGroup(group_name).then((value) => value).catch((err) => {
                //                 console.log("Deleting err: ", err)
                //                 return {succ: false}
                //                 // reject(err)
                //             })
                //         ) 
                //     })
    
                //     Promise.all(promisses).then((values) => {
                //         console.log("Resolved ALL Proms REMOVING: ", values)
                //         setNewMembers()
                //       }).catch(err => {
                //         console.log("NOT All Promisses REMOVING resolved,", err)
                //         reject(err)
                //     });
                // }catch(err){
                //     reject(err)
                // }
    
                // }
    
                // const setNewMembers = (newMbs) => {

                //     try{
                //         let promisses = []
                //         if(newMbs.length != 0){

                //             newMbs.map(userObj => {
                //                 console.log(`SPAWNING Manager ${userObj.sAMAccountName} for: ${group_name}`)   
                //                 promisses.push(
                //                     ad2.user(userObj.sAMAccountName).addToGroup(group_name).then((value) => value).catch((err) => {
                //                         console.log("Spawning err: ", err)
                //                         return {succ: false}
                //                         // reject(err)
                //                     })
                //                 ) 
                //             })

                //             Promise.all(promisses).then((values) => {
                //                 console.log("Resolved ALL Proms SPAWNING Manager: ", values)
                //                 resolve( { "new_mbs_success": true } )
                //             }).catch(err => {
                //                 console.log("NOT All Promisses SPAWNING Manager resolved,", err)
                //                 reject(err)
                //             });

                //         }else{
                //             resolve( { "new_mbs_success": true } )
                //         }
                //     }catch(err){

                //         resolve( { "new_mbs_success": false } )
                //     }
                // }

                const spawnAndDeleteMembers = (newMbs, deleteMbs) => {
                    
                    console.log("spawnAndDeleteMembers", newMbs, deleteMbs)

                    try{
                        let promisses = []
                        if(newMbs.length != 0){

                            newMbs.map(userObj => {
                                console.log(`SPAWNING Manager ${userObj.sAMAccountName} for: ${group_name}`)   
                                promisses.push(
                                    ad2.user(userObj.sAMAccountName).addToGroup(group_name).then((value) => value).catch((err) => {
                                        console.log("Spawning err: ", err)
                                        return {succ: false}
                                        // reject(err)
                                    })
                                ) 
                            })
                        }
                        if(deleteMbs.length != 0){
                            deleteMbs.map(userObj => {
                                console.log(`DELETING MANAGER of ${userObj.sAMAccountName} from: ${group_name}`)
                                promisses.push(
                                    ad2.user(userObj.sAMAccountName).removeFromGroup(group_name).then((value) => value).catch((err) => {
                                        console.log("Deleting err: ", err)
                                        return {succ: false}
                                        // reject(err)
                                    })
                                ) 
                            })
                        }

                        Promise.all(promisses).then((values) => {
                            console.log("Resolved ALL ALL: ", values)
                            resolve( { "new_mbs_success": true } )
                        }).catch(err => {
                            console.log("NOT All Promisses ALL resolved,", err)
                            reject(err)
                        });

                    }catch(err){
                        console.log("Some ERROR in ALL ALL: ", err)
                        resolve( { "new_mbs_success": false } )
                    }
                }



            async function gettingRes(){
                try{

                let existingMbs = await promisseGetMbs

                // console.log("COMPARE EXIST AND NEW: ", existingMbs, newUsers)
                console.log("ABOUT TOFILTER OUT ADMIN: ", existingMbs[group_name])
                existingMbs[group_name] = existingMbs[group_name].filter(user => user.sAMAccountName != 'adv.test.hoskovec')
                console.log("FILTER ADM: ", existingMbs[group_name])

                console.log("TOO TOFILTER OUT ADMIN: ", newUsers)
                newUsers = newUsers.filter(user => user.sAMAccountName != 'adv.test.hoskovec')
                console.log("TOO FILTER ADM: ", newUsers)
                const sorterManagers= helperMethods.sortMembers(existingMbs[group_name], newUsers)
                // console.log("newNewOnes: ", sorterManagers, sorterManagers.newDeleted)
                spawnAndDeleteMembers(sorterManagers.newNewOnes, sorterManagers.newDeleted)

                }catch(err){
                    console.log("Ctched err: ", err)
                }
            }

            gettingRes().catch(err => {
                console.log("Catched this from ABOVE: ", err)
            })

    }catch(e){
        console.log("AD err: ", e)
    }
    });
}


