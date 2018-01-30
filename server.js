var express = require("express");
let RainbowSDK = require('rainbow-node-sdk');
var pg=require("pg");
var app = express();
var conString = process.env.DATABASE_URL;
var client = new pg.Client(conString);
client.connect();
//select * from link JOIN temperature ON temperature.device=link.id_patients
// JOIN patients ON patients.id=temperature.device where patients.name='Dubois';

client.query("CREATE TABLE IF NOT EXISTS temperature(id serial primary key,date timestamp not null, device varchar(10) not null,data varchar(24))");
client.query("create table if not exists patients(id varchar primary key,name varchar)");
client.query("insert into patients(id,name) values('1B3EFA','Dubois')");
client.query("insert into patients(id,name) values('1B3EFB','Thomas')");
client.query("insert into patients(id,name) values('1B3EFC','Dupont')");
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
            client.query("create table if not exists table_id(id serial primary key,device varchar(10))");
            var req=client.query("SELECT * from table_id where device='"+jsonObj.device+"'");
            //console.log(is_null(req));
            req.on("row",function(row,result){
                result.addRow(row);
            });
            req.on("end",function(result){
                if(result.rows.length==0){
                    client.query("insert into table_id(device) values($1)",[jsonObj.device]);
                }
            });
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
        client.query("CREATE TABLE IF NOT EXISTS doctors(jid varchar primary key)");
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
        if(chaine.indexOf("temp")==0){
            var arg=chaine.split(" ");
            if(arg.length!=2) messageSent = rainbowSDK.im.sendMessageToJid("usage : temp <name>", message.fromJid);
            else {
                var get_temp=client.query("select * from link JOIN temperature ON temperature.device=link.id_patients JOIN patients ON patients.id=temperature.device where patients.name='"+arg[1]+"' ORDER BY date DESC NULLS LAST,data LIMIT 1 OFFSET 0");
                get_temp.on("row", function (row, result) {
                    result.addRow(row);
                });
                get_temp.on("end", function (result) {
                    if(result.rows.length!=0){
                        console.log(result.rows[0].data);
                        messageSent = rainbowSDK.im.sendMessageToJid("The temperature of "+arg[1]+" is "+ result.rows[0].data + "°C", message.fromJid);
                    }
                    else {
                        messageSent = rainbowSDK.im.sendMessageToJid("You don't have access to these data or no data have been registered yet", message.fromJid);
                    }
                });
            }
        }

        else if(chaine=="help"){
            messageSent = rainbowSDK.im.sendMessageToJid("temp <name>\nlink <name>\nlist", message.fromJid);
        }

        else if(chaine.indexOf("link")==0){ //si on entre la commande link
            //link ID name
            var split=chaine.split(" ");
            if (split.length!=2) messageSent = rainbowSDK.im.sendMessageToJid("usage : link <name>", message.fromJid);
            else {
                var search_name=client.query("select * from patients where name='"+split[1]+"'");
                search_name.on("row",function(row,result){
                    result.addRow(row);
                });
                search_name.on("end",function(result){
                    if(result.rows.length!=0){
                        client.query("CREATE TABLE IF NOT EXISTS link(id serial primary key,jid varchar,id_patients varchar,constraint fk foreign key (jid) references doctors(jid),constraint fk_id foreign key (id_patients) references patients(id))");
                        console.log("Associer un patient à un médecin\n");
                        var id_doc=client.query("select * from doctors where jid='"+message.fromJid+"'");
                        id_doc.on("row",function(row,result){
                            result.addRow(row);
                        });
                        id_doc.on("end",function(result){
                            if(result.rows.length==1){
                                var id_patient=client.query("select id from patients where name='"+split[1]+"'");
                                id_patient.on("row",function(row,result){
                                result.addRow(row);
                                });
                                id_patient.on("end",function(result){
                                var patient=result.rows[0].id;
                                console.log(patient);
                                client.query("insert into link(jid,id_patients) values ($1,$2)",[message.fromJid,patient]);
                                });
                            }

                    
                });
                    }
                    else {
                        messageSent = rainbowSDK.im.sendMessageToJid("The name passed as an argument doesn't exist", message.fromJid);
                    }
                });

            }
            //console.log(message.fromJid);
        }
        else {
            messageSent = rainbowSDK.im.sendMessageToJid("This is not a command, enter the command help to see all the available commands", message.fromJid);
        }
    }
    else {
        // send the answer to the user directly otherwise
        //messageSent = rainbowSDK.im.sendMessageToJid('The message answer', message.fromJid);
    }
});

// Start the SDK
rainbowSDK.start();
