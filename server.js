var express = require("express");
let RainbowSDK = require('rainbow-node-sdk');
var pg=require("pg");
var app = express();
var conString = process.env.DATABASE_URL;
var client = new pg.Client(conString);
client.connect();


app.post("/", function(req, res) { 
    client.query("CREATE TABLE IF NOT EXISTS temperature(id serial primary key,date timestamp not null, device varchar(10) not null,data varchar(24))");
    console.log("POST");
    var body = '';
    req.on('data', function (data) {
            body += data;
            console.log("Partial body: " + body);
    });
    req.on('end', function () {
            var jsonObj = JSON.parse(body);
            client.query("INSERT INTO temperature(date,device,data) VALUES(now(),$1,$2)",[jsonObj.device,jsonObj.data]);
            console.log("ID : " +jsonObj.device);
            console.log("Payload: " +jsonObj.data);
            res.send("Data saved in the database successfully!\n");
            res.end();

    });
});
var port = process.env.PORT || 5000;
app.listen(port, function() {
    console.log("Listening on " + port);
});

let options = {
    "rainbow": {
        "host": "sandbox",                      
    },
    "credentials": {
        "login": process.env.LOG,  // The Rainbow email account to use
        "password": process.env.PASS,  // The Rainbow associated password to use
    },
    "logs": {
        "enableConsoleLogs": true,              // Default: true
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
    if(message.type == "chat") {
        // Send the answer to the bubble
        console.log("un client fait une demande");
        if(message.content=="temp"){
            var query = client.query("SELECT data,date FROM temperature ORDER BY date DESC NULLS LAST,data LIMIT 1 OFFSET 0");
            query.on("row", function (row, result) {
            result.addRow(row);
            });
            query.on("end", function (result) {
                //console.log(result.rows[0].data);
                messageSent = rainbowSDK.im.sendMessageToJid("The temperature is "+ result.rows[0].data + "°C", message.fromJid);
            });
        }
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