var express = require('express'),
    app = express(),
    fs = require('fs'),
    os = require('os'),
    http = require('http'),
    https = require('https'),
    crypto = require('crypto'),
    paths = require('path'),
    cluster = require('cluster'),
    lactate = require('lactate'),
    memoize = require('memoizee'),
    memwatch = require('memwatch'),
    connect = require('connect'),
    jade = require('jade'),
    cons = require('consolidate'),
    compression = require('compression')(),
    session = require('express-session'),
    bodyParser = require('body-parser'),
    cookieParser = require('cookie-parser'),
    port = 8065, mongo = require('mongodb').MongoClient,
    spawn = require('child_process').spawn,
    exec = require('child_process').exec,
    program = require('commander'), collection,
    format = require('util').format,
    mongoip = '172.17.0.8', mongodb = "twapp_spark_live01"; //"twapp_storage_new"


memwatch.on('leak', function (info) {

    console.log("MEMORY LEAK DATA: ", info);

});

memwatch.on('stats', function (stats) {

    console.log("HEAP USAGE STATS: ", stats);

});

var instances = 1;//os.cpus().length;

if (cluster.isMaster) { // fork worker threads
    for (var i = 0; i < instances; i += 1) {
        console.log('Starting worker thread #' + i);
        worker = cluster.fork();

    }

    worker.on('death', function (worker) {
        // Log deaths!
        console.log(': worker ' + worker.pid + ' died.');
        // If autoRestart is true, spin up another to replace it
        if (this.autoRestart) {
            console.log(': Restarting worker thread...');
            cluster.fork();
        }
    });
} else {


    function calldocker(cmd, name) {


        if (0 == cmd.length) {
            cmd = ['/bin/bash'];
        }


        exec('docker inspect ' + name, function (err, stdout) {
            if (err) throw err;

            var obj = JSON.parse(stdout);
            var id = obj[0].ID;
            var proc = spawn('lxc-attach', ['-n', id].concat(cmd), { stdio: 'inherit' });
        });
    }

    app.use(express.static(__dirname + '/public'));
    app.use(bodyParser());

    app.use(cookieParser());
    app.use(session({ secret: 'nerfherder', cookie: { maxAge: 60000 }}));

    app.engine('jade', cons.jade);
    app.set('view engine', 'jade');
    app.set('views', __dirname + '/views');


    var index = fs.readFileSync(__dirname + '/public/index.html');
    fs.watchFile(__dirname + '/public/index.html', function (curr, prev) {
        console.log("RELOADING INDEX.HTML!!!!!");
        index = fs.readFileSync(__dirname + '/public/index.html');
    });

    app.all('/', function (req, res) {
        res.set('Content-Type', 'text/html');
        res.send(index);
        console.log("/ Address: ", req.connection.remoteAddress);
    });

    mongo.connect('mongodb://' + mongoip + ':27017/' + mongodb + '', function (err, db) {
        if (err) throw err;

        collection = db.collection('posts');

        app.get('/fullset/:limit/:skip', function (req, res) {
            console.log("SOMEONE's Browser is about to get Really sluggish!");
            console.log("/ Address: ", req.connection.remoteAddress);
            console.log("Limit: ", req.params['limit']);
            console.log("Skip: ", req.params['skip']);
            collection.find({}, { limit: req.params['limit'], skip: req.params['skip']}).toArray(function (err, docs) {
                console.log("Returned #" + docs.length + " documents");
                res.send({data: docs, count: docs.length});
            });
        });

        app.get('/episode/:num', function (req, res) {
            console.log("/ Address: ", req.connection.remoteAddress);
            console.log("CONNECTION FROM: ", req.headers)
            collection.find({ episode: req.params['num'] }).toArray(function (err, docs) {
                console.log("Returned #" + docs.length + " Episode based documents");
                res.send(docs);
            });
        });

        app.get('/episodesentiment/:num', function (req, res) {
            console.log("/ Address: ", req.connection.remoteAddress);
            console.log("CONNECTION FROM: ", req.headers)
            var pos, neg, temp;
            // Map function
            var map = function () {
                emit(this.sentiment, this.episode);
            };
            // Reduce function
            var reduce = function (k, vals) {
                return;
            };

            collection.mapReduce(map, reduce, {out: {replace: 'tempCollection', readPreference: 'primary'}}, function (err, collection) {
                // Mapreduce returns the temporary collection with the results
                collection.find({"episode": req.params['num']}, function (err, result) {


                    collection.findOne({'_id': 2}, function (err, result) {
                        assert.equal(1, result.value);

                        db.close();
                    });
                });
            });
        });

        app.get('/textsearch/:search', function (req, res) {
            console.log("/ Address: ", req.connection.remoteAddress);
            console.log("CONNECTION FROM: ", req.headers)
            collection.find({ tokens: req.params['search'] }).toArray(function (err, docs) {
                console.log("Returned #" + docs.length + " Episode based documents");
                res.send(docs);
            });
        });

        app.get('/search/:val', function (req, res) {
            console.log("/ Address: ", req.connection.remoteAddress);
            console.log("CONNECTION FROM: ", req.headers)
            console.log("QUERY VALUES: ", req.params['val']);
            collection.find({ original: {"$regex": req.params['val'] }}).toArray(function (err, docs) {
                console.log("Returned #" + docs.length + " Episode based documents");
                res.send(docs);
            });
        });

        app.get('/chart/:num', function (req, res) {
            console.log("/ Address: ", req.connection.remoteAddress);
            console.log("CONNECTION FROM: ", req.headers)
            collection.find({ episode: req.params['num'] }).toArray(function (err, docs) {
                console.log("Returned #" + docs.length + " Episode based documents");
                res.send(docs);
            });
        });


        app.get('/mr/:search', function (req, res) {
            console.log("/ Address: ", req.connection.remoteAddress);
            console.log("CONNECTION FROM: ", req.headers)
            collection.mapreduce(function () {
                //emit(req.params['search']);
            }, function (episode, entities) {
                //do map reduce stuff here

            }).toArray(function (err, docs) {
                console.log("Returned #" + docs.length + " Epidsode based documents");
                res.send(docs);
            });
        });


    });


    console.log("PORT HTTP: ", port);

    app.listen(port);
}