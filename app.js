var cookieSession = require('cookie-session');
var bodyParser = require('body-parser');
var express = require('express');
var app = express();
var router = express.Router();
var path = require('path');
var controller = require('./controller/controller.js');
var MongoClient = require('mongodb').MongoClient;
var bcrypt = require('bcrypt');

let url = "mongodb://localhost:27017";
let dbName = 'blog';
const client = new MongoClient(url,{useNewUrlParser:true});
let BCRYPT_SALT_ROUNDS = 12;

let port = 1337;

app.use(express.static(__dirname + '/public'));
app.set('view engine', 'jade');
app.set('views',path.join(__dirname,'views'));
app.use(bodyParser.urlencoded({extended : true}));

app.use(cookieSession({
    name: 'session',
    keys: ['key1', 'key2'],

    // durée de vie de 24 heures
    maxAge: 24 * 60 * 60 * 1000
}));

app.use(router);

const adminUsername = "administrateur";
const adminPassword = "admin";
const adminMail = "testadminmail@hotmail.fr";

client.connect(function(err)
{
    if(err) throw err;
    const db = client.db(dbName);

    db.collection('user').find({'role': "Administrateur"}).toArray(function (err,result) {
        if (err) throw err;

        if(result.length === 0 || result.length === undefined)
        {
            console.log("Creating admin...");
            var hashedPassword = bcrypt.hashSync(adminPassword, BCRYPT_SALT_ROUNDS);
            db.collection('user').insertOne({username: adminUsername, password: hashedPassword, email: adminMail, role:"Administrateur"},function (err)
            {
                if(err) throw err;
            });

            console.log("Done !");
        }
    });
});

router.route(['/','/index']).get(controller.getIndex);

router.route(['/','/index']).post(controller.postIndex);

router.route('/login').get(controller.getLogin);

router.route('/login').post(controller.postLogin);

router.route('/register').get(controller.getRegister);

router.route('/register').post(controller.postRegister);

router.route('/logout').get(controller.getLogout);

router.route('/pannelAdmin').get(controller.getPannelAdmin);

router.route('/pannelAdmin/Add').get(controller.getAddArticle);

router.route('/pannelAdmin/Add').post(controller.postAddArticle);

router.route('/pannelAdmin/Update').get(controller.getUpdateArticle);

router.route('/pannelAdmin/Update').post(controller.postUpdateArticle);

router.route('/pannelAdmin/Delete').get(controller.getDeleteArticle);

router.route('/pannelAdmin/Delete').post(controller.postDeleteArticle);

app.listen(port, new function()
{
    console.log("Serveur lancé sur le port " + port);
});