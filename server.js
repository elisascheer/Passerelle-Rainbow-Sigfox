// Load the SDK
let RainbowSDK = require('rainbow-node-sdk');
var http = require('http');
var pg = require("pg");
// Define your configuration


var conString = {
  "user": process.env.user,
  "host": process.env.server,
  "database": process.env.mydb,
  "password": process.env.pass,
  "port": 5432,
}

var client = new pg.Client(conString);
client.connect();
var server = http.createServer(function(req, res) {
    if (req.method == "POST"){
        client.query("CREATE TABLE IF NOT EXISTS temperature(id serial primary key,date timestamp not null, device varchar(10) not null,data varchar(24))");
        console.log("POST");
        var body = '';
        req.on('data', function (data) {
            body += data;
            //console.log("Partial body: " + body);
        });
        req.on('end', function () {
            console.log("body: " + body);
            var jsonObj = JSON.parse(body);
            client.query("INSERT INTO temperature(date,device,data) VALUES(now(),$1,$2) RETURNING id",[jsonObj.device,jsonObj.data]);
            //console.log(jsonObj.device);
        });
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.end('post received\n');
    };  
});
server.listen(8080);
console.log("Serveur web lancé sur localhost:8080 ...");
let options = {
    "rainbow": {
        "host": "sandbox",                      // Can be "sandbox" (developer platform), "official" or any other hostname when using dedicated AIO
    },
    "credentials": {
        "login": process.env.log,  // The Rainbow email account to use
        "password": process.env.password,  // The Rainbow associated password to use
    },
    // Application identifier
   // "application": {
    //    "id": process.env.YOUR_ID_RB, // The Rainbow Application Identifier - application must have a 'deployed' state
     //   "secret": process.env.YOUR_PASSSWORD_RB, // The Rainbow Application Secret - retrieved from developer hub
    //},
    // Logs options
    "logs": {
        "enableConsoleLogs": true,              // Default: true
        "enableFileLogs": false,                // Default: false
       // "file": {
          //  "path": '/var/tmp/rainbowsdk/',     // Default path used
           // "level": 'debug'                    // Default log level used
        //}
    },
    // Proxy configuration
    //"proxy": {
    //    "host": "ip",                 // eg: "172.25.50.190" (string expected)
    //    "port": "port",                 // eg: 8080 (integer expected)
    //    "protocol": "http"          // eg: "http" (string expected)
    //},
    // IM options
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
                messageSent = rainbowSDK.im.sendMessageToJid(JSON.stringify(result.rows, null, "    "), message.fromJid);
                console.log(JSON.stringify(result.rows, null, "    "));
                client.end();
            });
        }
        else {
            messageSent = rainbowSDK.im.sendMessageToJid("Ceci n'est pas une commande", message.fromJid);
        }
       // messageSent = rainbowSDK.im.sendMessageToJid('The message answer', message.fromJid);
    }
    else {
        // send the answer to the user directly otherwise
        //messageSent = rainbowSDK.im.sendMessageToJid('The message answer', message.fromJid);
    }
});

// Start the SDK
rainbowSDK.start();

