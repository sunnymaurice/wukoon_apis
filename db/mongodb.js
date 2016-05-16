/*
 *  Description: 
 *  Public Functions:
 *          1. DB basic: connect, close
 *          2. Cache wukoon access token: saveAccessToken, fetchAccessToken 
 *          3. Wechat user measurement record: 
 *          4. Device history records of those modified operations: 
 *          5. 
 *  Author: Maurice Sun 
 *  Revision History: 
 *          1. First released @ 2016.04.26 by Maurice Sun
 *          2. 
 *  Reference: Node.js MongoDB Driver API (http://mongodb.github.io/node-mongodb-native/2.1/api/)
 */

var MongodbInterface = (function () {

    function MongodbInterface() {
        this.mongoClient = require('mongodb').MongoClient;
        this.assert = require('assert');
        this.dbcfg = require(global.__base + '/config/mongodb_config.json');
        this.db = null;
        this.isInitialing = false;
        this.isInitialized = false;
        //console.log('MongodbInterface constructor Done...\n');
    }
    /**
     *  Initial process of setup the connection to MongoDB server
     */
    MongodbInterface.prototype.connect = function () {
        var _this = this;
        // 若正在初始化或已初始化完成，則直接回調
        if (this.isInitialing || this.isInitialized) {
            return new Promise( (resolve, reject) => { reject('Need initial mongodb'); });
        } 
        else {
            this.isInitialing = true;
            return new Promise((resolve, reject) => {
                // MongoDB Connection URL
                var mongodbUrl = 'mongodb://' + _this.dbcfg.DB_USER + ':' + _this.dbcfg.DB_PWD +
                    '@' + _this.dbcfg.DB_HOST + _this.dbcfg.DB_NAME +
                    '?authMechanism=SCRAM-SHA-1&authSource=' + _this.dbcfg.DB_NAME;
                // Use connect method to connect to the server    
                _this.mongoClient.connect(mongodbUrl, (error, db_instance) => {
                    _this.assert.equal(null, error); // 連結資料庫失敗執出錯誤，中斷Node
                    _this.db = db_instance;          // 記住資料庫的連結
                    _this.isInitialing = false;
                    _this.isInitialized = true;
                    resolve(_this.db);
                    //resolve('Get DB instance!');
                });
            });
        }
    };

    /**
     *  Close the connection to MongoDB server
     */
    MongodbInterface.prototype.close = function (){
        console.log('MongodbInterface: close DB\n');
        this.db.close();
        this.db = null;
        this.isInitialing = false;
        this.isInitialized = false;
    };

    /**
     *  @param
     *  @return {Promise} 
     */

    MongodbInterface.prototype.saveAccessToken = function (newAccessToken) {
        var _this = this;
        console.log('MongodbInterface: saveAccessToken');
        
        // 若沒有初始化Mongodb，則直接回調
        if (!this.isInitialized) {
            return new Promise( (resolve, reject) => { reject('Do init mongodb before call this!'); });
        }
        else {
            // Get the Collection: wukoon_access_token
            var collect = this.db.collection(this.dbcfg.COLL_ACCESS_TOKEN);

            return new Promise( (resolve) => {
                collect.findOne({}, (err, doc) => {
                    if (doc === null) {
                        // Insert a new one since there is no document yet.
                        collect.insertOne(newAccessToken, (error, result) => {
                            _this.assert.equal(null, error); // 寫入資料庫失敗執出錯誤，中斷Node
                            _this.assert.equal(1, result.insertedCount); // Check if the inserted document is one.
                            console.log('Inserted a document into the "' + _this.dbcfg.COLL_ACCESS_TOKEN + '" collection.');
                            resolve(result);
                        });
                    }
                    else {
                        // Update the document since the old one is expired.
                        // Using an upsert operation, ensuring creation if it does not exist.
                        collect.updateOne({ _id: doc._id }, { $set: newAccessToken }, { upsert: true }, (error, result) => {
                            _this.assert.equal(null, error); // 寫入資料庫失敗執出錯誤，中斷Node
                            _this.assert.equal(1, result.matchedCount);
                            console.log('Updated a document into the "' + _this.dbcfg.COLL_ACCESS_TOKEN + '" collection.');
                            resolve(result);
                        });
                    }
                });
            });
        }
    };

    /**
     * 於資料庫中取出Wukoon雲平台API接口的Access Token
     * @param {}
     * @return {Promise} 非同步工作的承諾；成功取出API接口的Access Token後，return `result` to caller.
     */
    MongodbInterface.prototype.fetchAccessToken = function () {
        var _this = this;
        console.log('MongodbInterface: fetchAccessToken');
        var collect = this.db.collection(this.dbcfg.COLL_ACCESS_TOKEN);

        return new Promise( (resolve) => {
            // Find the latest stored access token
            collect.findOne({}, (error, result) => {
                _this.assert.equal(null, error); // 連結資料庫失敗擲出錯誤，中斷Node
                resolve(result); // 找到的話回傳COLL_ACCESS_TOKEN colection 找不到會回調null
            });
        });
    };

    /**
     *  將對於設備的修改 2.2 API 修改設備狀態 & 2.5 API 發送命令給設備 的動作記錄於資料庫 collection: COLL_DEVICES
     *  @param {modRecord} : { action: "modifyStatus"/"sendCommand",
     *                         deviceID: deviceID,
     *                         status: {"status":  {"DATAPOINT1" : val1, "DATAPOINT2" : val2} }/ {"command": "cm1", "params": "args", "paramsType": ""},
     *                         modifiedTime: new Date() }
     *  @return {Promise} 非同步工作的承諾；成功將修改紀錄寫入資料庫後, return `result` to caller.
     */
    MongodbInterface.prototype.saveDevChangeRecord = function (modRecord) {
        var _this = this;
        console.log('MongodbInterface: saveDevChangeRecord');
        
         // 若沒有初始化Mongodb，則直接回調
        if (!this.isInitialized) {
            return new Promise( (resolve, reject) => { reject('Do init mongodb before call this!'); });
        }
        else {
            // Get the Collection: oseriocn_devices
            var collect = this.db.collection(this.dbcfg.COLL_DEVICES);

            return new Promise(function (resolve) {
                // Insert the done of device modification behaviour.
                collect.insertOne( modRecord, function (error, result) {
                    _this.assert.equal(null, error); // 寫入資料庫失敗擲出錯誤，中斷Node
                    _this.assert.equal(1, result.insertedCount); // Check if the inserted document is one.
                    console.log('Save a document into the "' + _this.dbcfg.COLL_DEVICES + '" collection.');
                    resolve(result);
                });
            });
        }
    };

    /**
     * 
     */

    return MongodbInterface;
}());
module.exports = exports = new MongodbInterface();