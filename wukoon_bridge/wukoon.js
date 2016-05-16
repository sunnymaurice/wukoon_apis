/*
 *  Description: Fulfillment of Wukoon defined APIs used for send request to Wukoon platform
 *  Public APIs:
 *          1. Retrieve 'Access Token'
 *          2. Modify device status
 *          3. Get device entire status
 *          4. Get device status via 'Data Point'
 *          5. Send commands to the device 
 *  Author: Maurice Sun 
 *  Revision History: 
 *          1. First released @ 2016.05.13 by Maurice Sun
 *          2. 
 *  Reference: Wukoon API document v1.07
 */
var WukoonAPI = (function () {

    function WukoonAPI() {
        this.request = require('request');  // to make HTTP requests
        this.crypto = require('crypto');
        this.mongoDB = require(global.__base + '/db/mongodb.js');
        this.wkcfg = require(global.__base + '/config/wukoon_config.json');
        this.wkToken = null;
        //this.rtcfg = require(global.__base + '/config/route_config.json');
        
        /**
         * Local functio to check if the cache of wukoon access token in DB is about expried
         * @retrun {boolean} 
         */
        this.isExpired = function (cachedToken) {
            //console.log('WukoonAPI: isExpired')
            //console.log('cached token: ' + JSON.stringify(cachedToken) + '\n');

            if (!cachedToken) {
                //console.log('no cacheToken\n');
                return true;
            }
            else {
                var currTimeStamp = new Date().getTime();
                console.log('current time: ' + currTimeStamp+ '\n')
                // get to know if the cachedToken is expired 
                return currTimeStamp > cachedToken.expiredTime;  
                /*
                var lastSeconds = ( new Date().getTime() - cachedToken.createTime.getTime() ) / 1000;
                console.log('cache lasted period for ' + lastSeconds + ' seconds.\n');
                return cachedToken.expireIn < lastSeconds + 60; // if true, 提早1分鐘更換
                */
            }
        };
        console.log('WukoonAPI constructor Done...\n');
    }

    /**
     * 2.1 API: 獲取 Access Token 
     * 取得Wukoon雲接口必須使用的AccessToken (Send HTTP GET Request to Wukoon Cloud Server)
     * @return {Promise} 非同步工作的承諾；取得Wukoon雲接口的AccessToken後回覆json結果
     */
    WukoonAPI.prototype.getWkAccessToken = function () {
        console.log('WukoonAPI: getWkAccessToken\n');
        var _this = this;
       
        return new Promise(function (resolve, reject) {
            /**
             *  send http get request to Wukoon to inquire an access_token
             */
            var getAccessToken = function () {
                console.log('getWkAccessToken: call getAccessToken()!\n');
                // TODO: 因為wukoon對於不同產品型號分配不同的 AppID/AppSecrect 所以設計要考慮能夠判別對象設備的型號
                var options = {
                    method: 'GET',
                    url: _this.wkcfg.WK_BASE_URL + _this.wkcfg.WK_TOKEN_QUERY + 
                        _this.wkcfg.WK_TYPE_NAME + '=' + _this.wkcfg.WK_TYPE_TOKEN + '&' +
                        _this.wkcfg.WK_APPID_NAME + '=' + _this.wkcfg.WK_APPID + '&' +
                        _this.wkcfg.WK_APPSECRECT_NAME +'=' + _this.wkcfg.WK_APPSECRET
                };

                //console.log(JSON.stringify(options));
                // Request URL: http://120.24.216.153:8000/token?type=ACCESS_TOKEN&appId=APPID&appSecret=APPSECRET
                _this.request( options, function (error, response, body) {

                    if(error) {
                        console.log('\n##### getAccessToken Request Error. #####\n');
                        reject(error);
                    } else {
                        if(response.statusCode === 200) {
                            body = JSON.parse(body);

                            if(body.errcode) {
                                console.log('\n##### getAccessToken - wukoon http response errcode: %d\n', body.errcode);
                                reject(body);
                            } else {
                                /*
                                    wkToken: JSON representation
                                    {
                                        "_id" : ObjectId("57298b4771ffb68148601b87"),
                                        "accessToken" : "kqowtzvvqprbcfcrwkfzqdycaayyzycx",
                                        "expireIn" : 7200,
                                        "createdTime" : ISODate("2016-05-13T06:43:11.568Z"),
                                        "expiredTime" : ISODate("2016-05-13T08:43:11.568Z")
                                    }
                                */
                                // TODO: 時間顯示是否該用 GMT+8 的時間
                                var currTime = new Date();
                                var expireTime = currTime.getTime() + (body.expireIn - 60)*1000;
                                _this.wkToken = body; 
                                _this.wkToken.createdTime = currTime;
                                _this.wkToken.expiredTime = new Date(expireTime);

                                // 將access_token 暫存至 database 
                                _this.mongoDB.saveAccessToken(_this.wkToken).then(function () {
                                    console.log('Refresh Wukoon Access Token.');
                                    resolve(_this.wkToken);
                                });
                            }
                        } else {
                            console.log('getAccessToken Request get status code: ' + response.statusCode);
                            reject(body);
                        }
                    }
                });
            };

            // There is no cached access_token in this module.
            if (!_this.wkToken) {
                // 從資料庫中取出暫存access_token
                _this.mongoDB.fetchAccessToken().then( function (token) {

                    if (token === null) {
                        console.log('no cached access token in module yet ...\n');
                        getAccessToken(); // 資料庫尚無access_token，向wukoon要求access_token
                    }
                    else {
                        _this.wkToken = token;
                       
                        if (_this.isExpired(_this.wkToken)) {
                            console.log('The cached token in DB needs to be updated with a new one from wukoon\n')
                            getAccessToken(); // 如果過期則發出要求給微信更新access_token
                        }
                        else {
                            console.log('return cached token ...\n');
                            // 回傳尚未過期的access_token
                            resolve(_this.wkToken);
                        }
                    }
                }, function (error) {
                    reject(error);
                });
            }
            // There is already an cached access_token.
            else {
                console.log('WukoonAPI: getWkAccessToken, module has stored the token!\n');

                if (_this.isExpired(_this.wkToken)) {
                    console.log('The cached token needs to be updated with a new one from wukoon\n');
                    getAccessToken(); // 如果過期則發出要求給微信更新access_token
                }
                else {
                    console.log('Use the cached token!\n');
                    // 回傳尚未過期的access_token
                    resolve(_this.wkToken);
                }
            }
            
        });
    };

    /** 
     *  2.2 API: 修改設備狀態
     *  @param {deviceID: string; mac of the target deive, targetObj: string; eg. { DATAPOINT1 : val1, DATAPOINT2 : val2} }
     *  @return `http response body` or `error`
     */
    WukoonAPI.prototype.modifyDeviceStatus = function (deviceID, targetObj) {
        console.log('WukoonAPI: modifyDeviceStatus\n');
        var _this = this;

        if(!deviceID || !targetObj)
        {
            return new Promise( function(reject) {
                reject(new Error('modifyDeviceStatus: params error'));      
            });
        }else {
            return new Promise( function(resolve, reject) {
                // Send http post request after getting access token 
                _this.getWkAccessToken().then( function (token) {
                    var reqJson = { status: targetObj };
                    //console.log(JSON.stringify(reqJson));
                    //contents of request in body 
                    /* 
                            "status" : 
                            {
                                "DATAPOINT1": val1,
                                "DATAPOINT2": val2
                            } 
                    */
                    var options = {
                        method: 'POST',
                        url: _this.wkcfg.WK_BASE_URL + _this.wkcfg.WK_DEV_ENTRY_URL + deviceID + 
                             _this.wkcfg.WK_DEV_STATUS_QUERY + _this.wkcfg.WK_ACCESS_TOKEN_NAME + '=' + token.accessToken,
                        //qs: { accessToken: token.accessToken },
                        headers: { 'content-type': 'application/json'},
                        body: reqJson,
                        json: true 
                    };

                    _this.request( options, function (error, response, body) {
                        
                        if(error) {
                            console.log('\n##### modifyDeviceStatus Request Error. #####\n');
                            reject(error);
                        } else {
                            if(response.statusCode === 200) {
                                if(body.errcode) {
                                    console.log('\n##### modifyDeviceStatus - wukoon http response errcode: %d\n', body.errcode);
                                    reject(body);
                                    // TODO: should I handle errcode = 20013 (token has expired) here?
                                } else {
                                    // Fields to be kept in DB whenever there is a successful modification of device status.
                                    _this.devModRecord = {
                                        action: "modifyStatus",
                                        deviceID: deviceID,
                                        status: targetObj,
                                        modifiedTime: new Date()
                                    };

                                    //console.log('Going to do saveDevChangeRecord with record: '+JSON.stringify(_this.devModRecord)+'\n');
                                    // TODO: Should we keep this record in our server or let Wukoon Cloud do this?    
                                    // Save the history record of updating the device's Data Point
                                    _this.mongoDB.saveDevChangeRecord(_this.devModRecord).then( function () {
                                        console.log('Save the modification of device status record.');
                                        //resolve(_this.devModRecord);
                                        resolve(body);
                                    }, function (error) {
                                        reject(error);
                                    }); // end of _this.mongoDB.saveDevChangeRecord(_this.devModRecord).then()
                                }
                            } else {
                                console.log('modifyDeviceStatus Request get status code: ' + response.statusCode);
                                reject(body);
                            }
                        }
                    }); //end of _this.request.post()
                }, function (error) {
                    reject(error);
                }); //end of _this.getWkAccessToken().then()
            }); //end of return new Promise()
        }       
    };

    /**
     *  2.3 & 2.4 API: 查詢設備狀態(完整查詢/按數據點查詢)
     *  @param {deviceID: string, dataPoint: string}
     *  @return a last full DP set json / a specific `dataPoint` json
     *      1.full DP set json : {"deviceId": "57298f73fdfc98e319ab9c37", "weight": {"value": 65.1, "unit": "kg", "timeStamp": 1462960392993}, "xxx": {...}, ... : ...}
     *      2.a specific `weight` json: {"deviceId": "57298f73fdfc98e319ab9c37", "value": 120.8, "unit": "lb", "timeStamp": 1462960393002}
     */
    WukoonAPI.prototype.getDeviceStatus = function (deviceID, dataPointStr) {
        console.log('WukoonAPI: getDeviceStatus\n');
        var _this = this;

        if(!deviceID)
        {
            return new Promise( function(reject) {
                reject(new Error('getDeviceStatus: params error! deviceID is NULL.'));      
            });
        } else {
            return new Promise( function(resolve, reject) {

                // Send http get request after getting access token 
                _this.getWkAccessToken().then( function (token) {

                    if(!dataPointStr)
                    {
                        // Request URL: http://120.24.216.153:8000/device/deviceID/status?accessToken=token
                        var fullOptions = {
                            method: 'GET',
                            url: _this.wkcfg.WK_BASE_URL + _this.wkcfg.WK_DEV_ENTRY_URL + deviceID + 
                                 _this.wkcfg.WK_DEV_STATUS_QUERY + _this.wkcfg.WK_ACCESS_TOKEN_NAME + '=' + token.accessToken
                            //qs: { accessToken: token.accessToken }
                        };

                        _this.request(fullOptions, function (error, response, body) {
                            
                            if(error) {
                                console.log('\n##### getDeviceStatus Full Request Error. #####\n');
                                reject(error);
                            } else {
                                if(response.statusCode === 200){
                                    body = JSON.parse(body);

                                    if (body.errcode) {
                                        console.log('getDeviceStatus(full) - wukoon http response errcode: ' + body.errcode);
                                        reject(new Error(body));
                                    } else {
                                        // "errcode": 0
                                        //TODO: Parse the body content and return a [full DP set] json
                                        resolve(body);
                                    }
                                } else {
                                    console.log('getDeviceStatus Full Request get status code: ' + response.statusCode);
                                    reject(body);
                                }
                            }
                        });
                    } else {
                        // Request URL: http://120.24.216.153:8000/device/deviceID/status/dataPoint?accessToken=token
                        var dpOptions = {
                            method: 'GET',
                            url: _this.wkcfg.WK_BASE_URL + _this.wkcfg.WK_DEV_ENTRY_URL + deviceID + _this.wkcfg.WK_DEV_DP_STATUS_URL + 
                                 dataPointStr + '?' + _this.wkcfg.WK_ACCESS_TOKEN_NAME + '=' + token.accessToken 
                            //qs: { accessToken: token.accessToken }
                        };

                        _this.request( dpOptions, function (error, response, body) {
                            if(error) {
                                console.log('\n##### getDeviceStatus DP: '+ dataPointStr +' Request Error. #####\n');
                                reject(new Error(error));
                            } else {
                                if(response.statusCode === 200)
                                {
                                    body = JSON.parse(body);

                                    if(body.errcode) {
                                        console.log('getDeviceStatus - wukoon http response errcode: ' + body.errcode);
                                        reject(body);
                                    } else {
                                        // "errcode": 0
                                        //TODO: Parse the body cotent and return a [specific DP] json 
                                        console.log('getDeviceStatus ('+ dataPointStr +'):\n' + JSON.stringify(body) + '\n');
                                        resolve(body);
                                    }   
                                } else {
                                    console.log('getDeviceStatus DP: '+ dataPointStr +' Request get status code: ' + response.statusCode);
                                    reject(body);
                                }
                            }  
                        });
                    }
                }, function(error) {
                    reject(new Error(error));
                });
            });
        }
    };

    /** 
     *  2.5 API: 發送命令給設備
     *  @param {deviceID: string, cmdSet: obj, { command: 'getFwVer', params: 'args', params2: ''}} 
     *  @return  
     */
    WukoonAPI.prototype.sendCommandToDevice = function (deviceID, cmdSet) {
        console.log('WukoonAPI: sendCommandToDevice\n');
        var _this = this;

        if(!deviceID || !cmdSet)
        {
            return new Promise( function(reject) {
                reject(new Error('sendCommandToDevice: params error'));      
            });
        }else {
            return new Promise( function(resolve, reject) {

                // TODO: Check if the cmdSetObj.command is a legal cmd beforehand.

                // Send http post request after getting access token 
                _this.getWkAccessToken().then( function (token) {
                     var options = {
                        method: 'POST',
                        url: _this.wkcfg.WK_BASE_URL + _this.wkcfg.WK_DEV_ENTRY_URL + deviceID + 
                             _this.wkcfg.WK_COMMAND_QUERY + _this.wkcfg.WK_ACCESS_TOKEN_NAME + '=' + token.accessToken,
                        //qs: { accessToken: token.accessToken },
                        headers: { 'content-type': 'application/json'},
                        body: cmdSet,
                        json: true 
                    };
                    console.log(JSON.stringify(options));

                    _this.request( options, function (error, response, body) {
                        if(error) {
                            console.log('\n##### sendCommandToDevice Request Error. #####\n');
                            reject(error);
                        } else {
                            if(response.statusCode === 200) {
                                if(body.errcode) {
                                    console.log('\n##### sendCommandToDevice - wukoon http response errcode: %d\n', body.errcode);
                                    reject(body);
                                    // TODO: should I handle errcode = 20013 (token has expired) here?
                                } else {
                                    console.log('sendCommandToDevice get resp body:\n' + JSON.stringify(body) + '\n');
                                    resolve(body);
                                }
                            } else {
                                console.log('sendCommandToDevice Request get status code: ' + response.statusCode);
                                reject(body);
                            }
                        }
                    });
                }, function(error){
                    reject(error);
                });
            });
        }
    };    

    return WukoonAPI; 
}());
module.exports = exports = new WukoonAPI();