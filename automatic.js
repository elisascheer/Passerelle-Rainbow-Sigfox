// Load the SDK
let RainbowSDK = require('rainbow-node-sdk');
var scanf = require('scanf');
// Define your configuration
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
            console.log("client demande la température");
            messageSent = rainbowSDK.im.sendMessageToJid("Et là la température", message.fromJid);
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
