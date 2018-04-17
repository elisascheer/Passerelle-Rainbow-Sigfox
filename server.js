var express = require("express");
let RainbowSDK = require('rainbow-node-sdk');
var pg=require("pg");
const fs = require('fs');
const output = require('d3node-output');
const d3 = require('d3-node')().d3;
const d3nLine = require('../');
var app = express();
var conString = process.env.DATABASE_URL;
var password = process.env.password;
var client = new pg.Client(conString);
client.connect();
client.query("CREATE TABLE IF NOT EXISTS temperature(id serial primary key,date timestamp not null, device varchar(10) not null,data float not null)");
client.query("CREATE TABLE IF NOT EXISTS users(jid varchar primary key,name varchar,category varchar(1))");
client.query("CREATE TABLE IF NOT EXISTS sensors(device varchar primary key,userjid varchar)");
client.query("CREATE TABLE IF NOT EXISTS link(id serial primary key,jid varchar,id_sensors varchar,constraint fk foreign key (jid) references users(jid),constraint fk_id foreign key (id_sensors) references sensors(device))");
client.query("CREATE TABLE IF NOT EXISTS warning(bubblejid varchar primary key,trigger float)");
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
            check_temperature(jsonObj.data,jsonObj.device);
            var dev=client.query("SELECT * FROM sensors WHERE device='"+jsonObj.device+"'");
            dev.on("row",function(row,result){
                result.addRow(row);
            })
            dev.on("end",function(result){
                if(result.rows.length==0){
                    client.query("INSERT INTO sensors(device) VALUES('"+jsonObj.device+"')");

                }
                else {
                    console.log("déjà enregistré dans la bdd");
                }
            })
            res.send("Data saved in the database successfully!\n")
    });
});
var port = process.env.PORT || 4000;
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

function check_temperature(data,device){
    var req=client.query("SELECT * FROM sensors WHERE device='"+device+"'");
    req.on("row",function(row,result){
        result.addRow(row);
    });
    req.on("end",function(result){
        //console.log(result.rows);
        var jid=result.rows[0].userjid;
        let bubbles=rainbowSDK.bubbles.getAll();
        //console.log(bubbles[0].users[0].jid_im);
        if(jid!=null){
            for (i=0;i<bubbles.length;i++){
                //console.log(bubbles[i].users);
                for (j=0;j<bubbles[i].users.length;j++){
                    //console.log(bubbles[i].users[j].jid_im);
                    if(bubbles[i].users[j].jid_im==jid){
                        //console.log(bubbles[i].users[j].jid_im);
                        var in_bubble=bubbles[i].jid;
                        var trigger=client.query("SELECT * FROM warning WHERE bubblejid='"+in_bubble+"' AND trigger<"+data+"");
                        trigger.on("row",function(row,result){
                            result.addRow(row);
                        });
                        trigger.on("end",function(result){
                            if(result.rows.length==0){
                                console.log("warning non atteint");
                            }
                            else{
                                console.log("attention température élevée");
                                messageSent = rainbowSDK.im.sendMessageToBubbleJid("Attention la température à dépassé "+result.rows[0].trigger+", elle a atteint "+data+"!",in_bubble);
                            }
                        })
                       // console.log(bubbles[i].jid);
                    }
                }
                //console.log(in_bubble);
            } 
        }
        else {
            console.log("jid null");
        }

    });
}

function get_temperature(message){
    var bubblejid=message.fromBubbleJid;
    let name=rainbowSDK.bubbles.getBubbleByJid(bubblejid).name;
    console.log(name);
    var get_temp=client.query("SELECT * FROM users JOIN sensors ON sensors.userjid=users.jid JOIN temperature ON sensors.device=temperature.device AND users.category='P' AND users.name='"+name+"' ORDER BY date DESC NULLS LAST,data LIMIT 1 OFFSET 0");
    get_temp.on("row", function (row, result) {
        result.addRow(row);
    });
    get_temp.on("end", function (result) {
        if(result.rows.length!=0){
            console.log(result.rows[0].data);
            messageSent = rainbowSDK.im.sendMessageToBubbleJid("Température de  "+ result.rows[0].data + "°C", bubblejid);
        }
        else {
            messageSent = rainbowSDK.im.sendMessageToBubbleJid("Aucune valeurs enregistrées\n", bubblejid);
        }
    });
}
function draw_graph(message){
    var bubblejid=message.fromBubbleJid;
    let name=rainbowSDK.bubbles.getBubbleByJid(bubblejid).name;
    var test=client.query("select to_char(date,'dd-Mon-YYYY') as date,data from(select cast(t.date as date) as date, avg(t.data) as data from temperature t group by cast(t.date as date) order by cast(t.date as date) asc) as mean");
    test.on("row",function(row,result){
        result.addRow(row);
    });
    test.on("end",function(result){
        //console.log(result.rows[0]);
        if(result.rows.length!=0){
            for(i=0;i<result.rows.length;i++){
                //result.rows[i].date.toString();
                result.rows[i].date=(parseTime(result.rows[i].date));
                console.log(result.rows[i].date);
            }
            console.log(result.rows);
            const data=result.rows;
            //console.log(data);
            //console.log();
            output('output', d3nLine({ data: data }));
        }
        else {
            messageSent = rainbowSDK.im.sendMessageToBubbleJid("Aucune valeurs enregistrées pour tracer le graphe\n", bubblejid);
        }
    });
}

function stats(arg,message){
    var req=client.query("SELECT AVG(data),VARIANCE(data),STDDEV(data) FROM (SELECT * FROM link JOIN temperature ON temperature.device=link.id_patients JOIN patients ON patients.id=temperature.device WHERE patients.name='"+arg[1]+"') AS stats");
    req.on("row", function (row, result) {
        result.addRow(row);
    });
    req.on("end", function (result) {
        if(result.rows.length!=0){
            var mean=0;
            if(arg[2]=="mean"){
                messageSent = rainbowSDK.im.sendMessageToJid("La température moyenne de  "+arg[1]+" est "+result.rows[0].avg+"°C", message.fromJid);                            
            }
            else if(arg[2]=="all"){
                messageSent = rainbowSDK.im.sendMessageToJid("Résumé statistiques "+arg[1]+" :\nMoyenne : "+result.rows[0].avg+"°C\nVariance : "+result.rows[0].variance+"°C\nEcart type : "+result.rows[0].stddev+"°C" , message.fromJid);
            }

            else messageSent = rainbowSDK.im.sendMessageToJid("Options disponibles : all, mean", message.fromJid);
        }
        else {
            messageSent = rainbowSDK.im.sendMessageToJid("Vous n'avez pas accès aux données de ce patient ou aucune données n'ont été enregistrées", message.fromJid);
        }
    });
}



function check(jid_doc,message){
    var check=client.query("SELECT * FROM users WHERE jid='"+message.fromJid+"' AND category='M'");
    check.on("row",function(row,result){
        result.addRow(row);
    });
    check.on("end",function(result){
        if(result.rows.length!=0){
            //le medecin a le droit de se link car est bien dans la table users
            link(split,message);
        }
        else messageSent=rainbowSDK.im.sendMessageToJid("Non autorisé", message.fromJid);
    });
}
function link(split,message){
    console.log("ok");
    var search_name=client.query("SELECT * FROM users WHERE name='"+split[1]+"' AND category='P'");
    search_name.on("row",function(row,result){
        result.addRow(row);
    });
    search_name.on("end",function(result){
        if(result.rows.length!=0){
            //console.log(result.rows);
            var id_doc=client.query("SELECT * FROM users WHERE jid='"+message.fromJid+"'"); //on récupère le jid du medecin
            id_doc.on("row",function(row,result){
                result.addRow(row);
            });
            id_doc.on("end",function(result){
                //console.log(result.rows);
                if(result.rows.length==1){
                    var id_patient=client.query("SELECT * FROM users WHERE name='"+split[1]+"' AND category='P'");
                    id_patient.on("row",function(row,result){
                        result.addRow(row);
                    });
                    id_patient.on("end",function(result){
                        //console.log(result.rows);
                        var patient=result.rows[0].jid;
                        //console.log(patient);
                        var search_in_table=client.query("SELECT * FROM sensors WHERE userjid='"+patient+"'");
                        search_in_table.on("row",function(row,result){
                            result.addRow(row);
                        });
                        search_in_table.on("end",function(result){
                            //console.log(result.rows[0]);
                            var sensor=result.rows[0].device;
                            //console.log(sensor);
                            client.query("INSERT INTO link(jid,id_sensors) VALUES ($1,$2)",[message.fromJid,sensor]);
                            let bubbles = rainbowSDK.bubbles.getAll()[1];
                            let bubbleid=bubbles.jid;
                            create_bubble(split[1],message.fromJid,patient);
                            let contact = rainbowSDK.contacts.getAll();
                            //else messageSent = rainbowSDK.im.sendMessageToJid("Vous êtes déjà attaché au patient "+split[1]+" !", message.fromJid);
                        });

                    });
                }                   
            });
        }
        else {
            messageSent = rainbowSDK.im.sendMessageToJid("Le nom passé en argument n'est pas enregistré dans la base de données", message.fromJid);
        }
    });    
}

function link_device(split,message){
    var patient=client.query("SELECT * from users WHERE name='"+split[1]+"' AND category='P'");
    patient.on("row",function(row,result){
        result.addRow(row);
    });
    patient.on("end",function(result){
        if(result.rows.length!=0){
            var userjid=result.rows[0].jid;
            var device=client.query("SELECT * FROM sensors WHERE device='"+split[2]+"'");
            device.on("row",function(row,result){
                result.addRow(row);
            });
            device.on("end",function(result){
                if(result.rows.length!=0){
                    client.query("UPDATE sensors SET userjid='"+userjid+"' WHERE device='"+split[2]+"'");

                }
                else {
                    console.log("le capteur n'existe pas\n");
                }
            });

        }
        else {
            console.log("patient non trouvé\n");
        }
    })


}





function warning(message,value){
    var name=rainbowSDK.bubbles.getBubbleByJid(message).name;
    console.log(message);
    var search_bubble=client.query("SELECT * FROM warning WHERE bubblejid='"+message+"' AND trigger='"+value+"'");
    search_bubble.on("row",function(row,result){
        result.addRow(row);
    });
    search_bubble.on("end",function(result){
        console.log(result.rows);
        if(result.rows.length==0){
            console.log("alarme ok");
            client.query("INSERT INTO warning(bubblejid,trigger) VALUES('"+message+"','"+value+"')");
            messageSent = rainbowSDK.im.sendMessageToBubbleJid("Alarme mise en place\n",message);
        }
        else {
            messageSent = rainbowSDK.im.sendMessageToBubbleJid("Alarme de "+value+"°C dejà mise en place\n",message);
        }
    });

}
/*
function delete_warning(split,message){
    var del=client.query("SELECT * FROM warning WHERE jid='"+message.fromJid+"'");
    del.on("row",function(row,result){
        result.addRow(row);
    });
    del.on("end",function(result){
        //console.log(result.rows);
        if(result.rows.length!=0){
            messageSent = rainbowSDK.im.sendMessageToJid("Vous avez déclaré la ou les alarme(s) suivante(s) : \n", message.fromJid);
            for(i=0;i<result.rows.length;i++){
                messageSent = rainbowSDK.im.sendMessageToJid(" - "+ result.rows[i].trigger+"°C\n", message.fromJid);
            }
            messageSent = rainbowSDK.im.sendMessageToJid("Souhaitez-vous toutes les désactiver? Entrez O pour oui, N <valeur1> <valeur2> pour en désactiver une ou plusieurs\n", message.fromJid);
            wait_for_response(message.fromJid);
        }
    });
}
function wait_for_response(jid){
    rainbowSDK.events.on('rainbow_onmessagereceived',function(message){
        if(message.content=="O"){
            client.query("DELETE FROM WARNING WHERE jid='"+message.fromJid+"'");
        }
        else if(message.content.indexOf("N")==0){
            var split=message.content.split(" ");
            console.log(split.length);
            for(i=1;i<split.length;i++){
                client.query("DELETE FROM WARNING WHERE jid='"+message.fromJid+"' AND trigger="+parseInt(split[i]));
            }
        }
    })
}
function list(message){
    var search_patient=client.query("SELECT name FROM patients JOIN link ON patients.id=link.id_patients WHERE jid='"+message.fromJid+"'");
    search_patient.on("row",function(row,result){
        result.addRow(row);
    });
    search_patient.on("end",function(result){
        if(result.rows.length == 0) messageSent = rainbowSDK.im.sendMessageToJid("Vous n'avez déclaré aucun patient", message.fromJid);
        else {
            messageSent = rainbowSDK.im.sendMessageToJid("Vos patients : ", message.fromJid);
            for(i=0;i<result.rows.length;i++){
                messageSent = rainbowSDK.im.sendMessageToJid(" - "+ result.rows[i].name, message.fromJid);
        } 
        }                
    });
}
*/

function create_bubble(name,jid_m,jid_p){
    let withHistory = true;
    rainbowSDK.bubbles.createBubble(name, "A little description of my bubble", withHistory).then(function(bubble) {
    // do something with the bubble created
        console.log(bubble.jid);
        invite_bubble(jid_m,bubble);
        invite_bubble(jid_p,bubble);
        console.log("bubble ok");
    }).catch(function(err) {
    // do something if the creation of the bubble failed (eg. providing the same name as an existing bubble)
        console.log("bubble fail");
    });

}

function invite_bubble(jid_contact,bubble){
    let contact=rainbowSDK.contacts.getAll();
    let invitedAsModerator = true;     // To set to true if you want to invite someone as a moderator
    let sendAnInvite = false;            // To set to false if you want to add someone to a bubble without having to invite him first
    let inviteReason = "bot-invite";
    //console.log(bubble);
    for(i=0;i<contact.length;i++){
        if(contact[i].jid_im==jid_contact) {
            console.log(contact[i]);
            rainbowSDK.bubbles.inviteContactToBubble(contact[i], bubble, invitedAsModerator, sendAnInvite, inviteReason).then(function(bubbleUpdated) {
                // do something with the invite sent
                    messageSent = rainbowSDK.im.sendMessageToBubbleJid("hello je suis le bot", bubble.jid);
                    console.log("ok");
            }).catch(function(err) {
                // do something if the invitation failed (eg. bad reference to a buble)
                     console.log("fail");
            });
         }
    }
}


// Instantiate the SDK
let rainbowSDK = new RainbowSDK(options);
rainbowSDK.events.on('rainbow_onmessagereceived', function(message) {
    // test if the message comes from a bubble of from a conversation with one participant
    //console.log(bubbles);
    //console.log(message.fromJid);
    //let contacts=rainbowSDK.contacts.getContactByJid('f623e4d2f80445cca79d90a74bbbf868@sandbox-all-in-one-prod-1.opentouch.cloud');
    //console.log(contacts);
    var chaine=message.content;
    if(message.type == "chat") {
        // Send the answer to the bubble
        console.log("Message : "+message.content);
        if(chaine=="help"){
            messageSent = rainbowSDK.im.sendMessageToJid("temp <nom>\nlink <nom>\nlist\nstats <nom> <all,mean...>\nwarning <nom> <valeur>\nremove warning", message.fromJid);
        }

        else if(chaine.indexOf("link_patient")==0){ //si on entre la commande link_patient lie un médecin à un patient
            //link ID name
            var split=chaine.split(" ");
            if (split.length!=2) messageSent = rainbowSDK.im.sendMessageToJid("usage : link <nom> <identifiant de l'antenne>", message.fromJid);
            else {
                link(split,message);
            }
        }
        else if(chaine.indexOf("link_device")==0){ //si on entre la commande link_device lie un patient à une antenne
            //link ID name
            var split=chaine.split(" ");
            if (split.length!=3) messageSent = rainbowSDK.im.sendMessageToJid("usage : link_sensor <name> <identifiant de l'antenne>", message.fromJid);
            else {
                link_device(split,message);
            }
        }
        else if(chaine.indexOf("remove")==0){
            var split=chaine.split(" ");
            if(split.length!=2)  messageSent = rainbowSDK.im.sendMessageToJid("usage : remove warning", message.fromJid);
            else {
                if(split[1]=="warning"){
                delete_warning(split,message);
                }
            }
            /*else if(split[1]=="patient"){
            }*/
        }
        else if(chaine.indexOf("lier")==0){
            var split=chaine.split(" ");
            create_bubble(split[1]);

        }
        else if(chaine=="list"){
            list(message);
        }
        else {
            messageSent = rainbowSDK.im.sendMessageToJid("Ce n'est pas une commande, veuillez entrer help pour accéder à la liste des commandes disponibles", message.fromJid);
        }
    }

    else {
        console.log(message.fromBubbleJid);
        console.log(rainbowSDK.bubbles.getBubbleByJid(message.fromBubbleJid).users[0].jid_im);
        var jid=message.fromBubbleJid;
        console.log("Message : "+message.content);
        if(chaine=="temp"){
             get_temperature(message);
        }
        else if(chaine=="draw_graph"){
            draw_graph(message);
        }
        else if(chaine.indexOf("stats")==0){
            var arg=chaine.split(" ");
            //if(arg.length<=2) messageSent = rainbowSDK.im.sendMessageToJid("Il manque des aguments", message.fromJid);
            if(arg.length==3){
                stats(arg,message);
            }
            //else messageSent = rainbowSDK.im.sendMessageToJid("usage : stats <nom> <options>", message.fromJid);    
        }
        else if(chaine=="help"){
            //messageSent = rainbowSDK.im.sendMessageToJid("temp <nom>\nlink <nom>\nlist\nstats <nom> <all,mean...>\nwarning <nom> <valeur>\nremove warning", message.fromJid);
        }
        else if(chaine.indexOf("warning")==0){ //commande warning : création d'une nouvelle alerte
            var split=chaine.split(" ");
            if (split.length!=2) {
                //messageSent = rainbowSDK.im.sendMessageToJid("usage : warning <valeur>", message.fromJid);
            }
            else {
                var value=split[1];
                console.log(value);
                warning(jid,value);
            }
        }
        // send the answer to the user directly otherwise
        console.log("je suis dans la bulle");

    }
});

// Start the SDK
rainbowSDK.start()
