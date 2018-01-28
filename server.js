var express = require("express");
let RainbowSDK = require('rainbow-node-sdk');
var pg=require("pg");
var app = express();
var conString = process.env.DATABASE_URL;
var client = new pg.Client(conString);
client.connect();


client.query("CREATE TABLE IF NOT EXISTS temperature(id serial primary key,date timestamp not null, device varchar(10) not null,data varchar(24))");
app.post("/", function(req, res) { 
    console.log("POST");
    var body = '';
    req.on('data', function (data) {
            body += data;
            console.log(" " + body);
    });
    req.on('end', function () {
            var jsonObj = JSON.parse(body);
            client.query("INSERT INTO temperature(date,device,data) VALUES(now(),$1,$2)",[jsonObj.device,jsonObj.data]);
            //console.log("ID : " +jsonObj.device);
            //console.log("Payload: " +jsonObj.data);
            res.send("Data saved in the database successfully!\n")
    });
});
var port = process.env.PORT || 5000;
app.listen(port, function() {
    console.log("Listening on " + port);
});

let options = {
    "rainbow": {
        "host": "sandbox",                      // Can be "sandbox" (developer platform), "official" or any other hostname when using dedicated AIO
    },
    "credentials": {
        "login": process.env.LOG,  // The Rainbow email account to use
        "password": process.env.PASS,  // The Rainbow associated password to use
    },
    "logs": {
        "enableConsoleLogs": false,              // Default: true
        "enableFileLogs": false,                // Default: false
       
    },
    "im": {
        "sendReadReceipt": true   // True to send the 'read' receipt automatically
    }
};

// Instantiate the SDK
let rainbowSDK = new RainbowSDK(options);
rainbowSDK.events.on('rainbow_onmessagereceived', function(message) {
    // test if the message comes from a bubble of from a conversation with one participant
    var chaine=message.content;
    if(message.type == "chat") {
        // Send the answer to the bubble
        console.log("Message : "+message.content);
        client.query("CREATE TABLE IF NOT EXISTS doctors(id serial primary key,jid varchar(300))");
        var req=client.query("SELECT * from doctors where jid='"+message.fromJid+"'");
        //console.log(is_null(req));
        req.on("row",function(row,result){
            result.addRow(row);
        });
        req.on("end",function(result){
           if(result.rows.length==0){
            client.query("insert into doctors(jid) values($1)",[message.fromJid]);
           }
        });
        if(chaine=="temp"){
            var query = client.query("SELECT data,date FROM temperature ORDER BY date DESC NULLS LAST,data LIMIT 1 OFFSET 0");
            query.on("row", function (row, result) {
            result.addRow(row);
            });
            query.on("end", function (result) {
                //console.log(result.rows[0].data);
                messageSent = rainbowSDK.im.sendMessageToJid("The temperature is "+ result.rows[0].data + "°C", message.fromJid);
            });
        }

        /*else if(chaine.indexOf("link")==0){ //si on entre la commande link
            //link ID name
            var split=chaine.split(" ");
            if (split.length!=2) messageSent = rainbowSDK.im.sendMessageToJid("usage : link <name>", message.fromJid);
            else {
                client.query("CREATE TABLE IF NOT EXISTS patients(id serial primary key,link int,name varchar(24),constraint fk foreign key (link) references doctors(id))");
                console.log("Associer un patient à un médecin\n");
                var id_doc=client.query("select id from doctors where jid='"+message.fromJid+"'");
                req.on("row",function(row,result){
                    result.addRow(row);
                });
                req.on("end",function(result){
                    console.log(result.rows[1].id);
                    client.query("INSERT INTO patients(name,link) VALUES ($1,$2)",[split[1],result.rows[1].id]);
                });

            }
            console.log(message.fromJid);

            //messageSent = rainbowSDK.im.sendMessageToJid("Nouveau patient bien enregistré!", message.fromJid);
            //console.log(split);


        }*/
        else {
            messageSent = rainbowSDK.im.sendMessageToJid("This is not a command", message.fromJid);
        }
    }
    else {
        // send the answer to the user directly otherwise
        //messageSent = rainbowSDK.im.sendMessageToJid('The message answer', message.fromJid);
    }
});

// Start the SDK
rainbowSDK.start();