var express = require("express");
let RainbowSDK = require('rainbow-node-sdk');
var pg=require("pg");
var app = express();
const fs = require('fs');
var conString = process.env.DATABASE_URL;
var adminjid = process.env.admin;
var password = process.env.password;
const output = require('d3node-output');
const d3 = require('d3-node')().d3;
//const d3nLine = require('path').resolve(__dirname, './d3node-linechart');
const d3nLine = require('../');
//path.resolve('/foo/bar', './baz');
const parseTime = d3.timeParse('%d-%b-%Y %H:%M:%S');
//const d3nLine = require('./d3node-linechart');
const {Wit, log} = require('node-wit');
const clientnpm = new Wit({accessToken: 'AQH3W6Q43X7SHWT7AFSH5QPA25WJWOSX'});
var client = new pg.Client(conString);
client.connect();
client.query("CREATE TABLE IF NOT EXISTS temperature(id serial primary key,data float not null,date timestamp without time zone not null, device varchar(10) not null)");
client.query("CREATE TABLE IF NOT EXISTS users(jid varchar primary key,name varchar,category varchar(1))");
client.query("CREATE TABLE IF NOT EXISTS sensors(device varchar primary key,userjid varchar)");
client.query("CREATE TABLE IF NOT EXISTS link(id serial primary key,jid varchar,id_sensors varchar,constraint fk foreign key (jid) references users(jid),constraint fk_id foreign key (id_sensors) references sensors(device))");
client.query("CREATE TABLE IF NOT EXISTS warning(bubblejid varchar ,trigger float, primary key(bubblejid,trigger) )");

/*code du serveur qui réceptionne les callbacks Sigfox*/
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

/*fonction qui est appelée lorsqu'un nouveau callback est enregistré, permet de vérfier si une température dépasse une alarme déclarée, prend en paramètre 
la valeur du capteur et son identifiant*/
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


/*fonction qui permet de récupérer la température (la plus récente)*/
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

function stats(arg,message){
    var bubblejid=message.fromBubbleJid;
    let bubble=rainbowSDK.bubbles.getBubbleByJid(bubblejid);
    var users=bubble.users;
    for(i=0;i<users.length;i++){
        var search_patient=client.query("SELECT * FROM users WHERE jid='"+users[i].jid_im+"' AND category='P'");
        search_patient.on("row",function(row,result){
            result.addRow(row);
        });
        search_patient.on("end",function(result){
            if(result.rows.length==0){
                console.log("nope");
            }
            else {
                var user_jid=result.rows[0].jid;
                var req=client.query("SELECT AVG(data),VARIANCE(data),STDDEV(data) FROM (SELECT * FROM link JOIN temperature ON temperature.device=link.id_sensors JOIN sensors ON sensors.device=temperature.device WHERE sensors.userjid='"+user_jid+"') AS stats");
                req.on("row", function (row, result) {
                    result.addRow(row);
                });
                req.on("end", function (result) {
                    //console.log(result.rows);
                    if(result.rows.length!=0){
                        var mean=0;
                        if(arg[1]=="mean"){
                            messageSent = rainbowSDK.im.sendMessageToBubbleJid("La température moyenne est "+result.rows[0].avg+"°C", message.fromBubbleJid);                            
                        }
                        else if(arg[1]=="all"){
                            messageSent = rainbowSDK.im.sendMessageToBubbleJid("Résumé statistiques :\nMoyenne : "+result.rows[0].avg+"°C\nVariance : "+result.rows[0].variance+"°C\nEcart type : "+result.rows[0].stddev+"°C" , message.fromBubbleJid);
                        }

                        else messageSent = rainbowSDK.im.sendMessageToBubbleJid("Options disponibles : all, mean", message.fromBubbleJid);
                    }
                    else {
                        messageSent = rainbowSDK.im.sendMessageToBubbleJid("Vous n'avez pas accès aux données de ce patient ou aucune données n'ont été enregistrées", message.fromBubbleJid);
                    }
                });
            }
        });
    }
}



function check(split,message){
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
                            //est-ce que ce patient est déjà lié à qqln?
                            var link=client.query("SELECT * FROM link WHERE id_sensors='"+sensor+"'");
                            link.on("row",function(row,result){
                                result.addRow(row);
                            });
                            link.on("end",function(result){
                                if(result.rows.length==0){
                                    //la bulle n'existe pas donc on la créée
                                    client.query("INSERT INTO link(jid,id_sensors) VALUES ($1,$2)",[message.fromJid,sensor]);
                                    //let bubbles = rainbowSDK.bubbles.getAll()[1];
                                    //let bubbleid=bubbles.jid;
                                    create_bubble(split[1],message.fromJid,patient);

                                    //let contact = rainbowSDK.contacts.getAll();
                                }
                                else { //la bulle existe déjà et dans ce cas on l'invite dans la bulle et on l'enregistre dans la bdd
                                    var is_link=client.query("SELECT * FROM link WHERE id_sensors='"+sensor+"' AND jid='"+message.fromJid+"'");
                                    is_link.on("row",function(row,result){
                                        result.addRow(row);
                                    });
                                    is_link.on("end",function(result){
                                        if(result.rows.length==0){
                                            console.log(result.rows);
                                            let bubble=rainbowSDK.bubbles.getAll();
                                            console.log(bubble.length);
                                            for(i=0;i<bubble.length;i++){
                                                //console.log(bubble[i]);
                                                for(j=0;j<bubble[i].users.length;j++){
                                                    //console.log(bubble[i].users);
                                                    if(bubble[i].users[j].jid_im==patient){
                                                        //console.log(bubble[i].users[j].jid_im);
                                                       // console.log("je suis dans le if");
                                                        var bubble_jid=bubble[i].jid;
                                                        //console.log(bubble_jid);
                                                        //console.log(bubble[i]);
                                                        invite_bubble(message.fromJid,bubble[i]);
                                                        //messageSent = rainbowSDK.im.sendMessageToBubbleJid("Bienvenue dans la bulle de suivi du patient "+bubble[i].name+", si vous désirez obtenir des informations, il vous suffit d'écrire 'Bot,' suivi de votre demande, je peux vous fournir sa température, des statistiques. Vous pouvez également placer une ou plusieurs alarmes pour être notifié dès qu'une anomalie sera constatée. ", bubble[i].jid);
                                                        client.query("INSERT INTO link(jid,id_sensors) VALUES ($1,$2)",[message.fromJid,sensor]);
                                                    }
                                                }
                                            }
                                        }
                                        else messageSent = rainbowSDK.im.sendMessageToJid("Vous avez déjà accès aux données de ce patient",message.fromJid);
                                    });
                                    //trouver la bulle et inviter le mec dedans
                                    //messageSent = rainbowSDK.im.sendMessageToJid("Vous avez déjà accès aux données de ce patient",message.fromJid);
                                }
                            });
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


/*fonction qui permet de lier un device à un patient, prend en argument le nom du patient ainsi que l'objet message reçu*/
function link_device(split,message){
    var check=client.query("SELECT * FROM users WHERE jid='"+message.fromJid+"' AND category='M'");
    check.on("row",function(row,result){
        result.addRow(row);
    });
    check.on("end",function(result){
        if(result.rows.length!=0){
            var patient=client.query("SELECT * from users WHERE name='"+split[1]+"' AND category='P'");
            patient.on("row",function(row,result){
                result.addRow(row);
            });
            patient.on("end",function(result){
                if(result.rows.length!=0){
                    var userjid=result.rows[0].jid;
                    var check_link=client.query("SELECT * FROM sensors WHERE userjid='"+userjid+"'");
                    check_link.on("row",function(row,result){
                        result.addRow(row);
                    });
                    check_link.on("end",function(result){
                        if(result.rows.length!=0){
                            console.log("patient déjà associé à un capteur");
                            messageSent = rainbowSDK.im.sendMessageToJid("Le patient est déjà associé à un capteur", message.fromJid);
                        }
                        else{
                            var device=client.query("SELECT * FROM sensors WHERE device='"+split[2]+"'");
                            device.on("row",function(row,result){
                                result.addRow(row);
                            });
                            device.on("end",function(result){
                                if(result.rows.length!=0){
                                    client.query("UPDATE sensors SET userjid='"+userjid+"' WHERE device='"+split[2]+"'");
                                }
                                else {
                                    console.log("Le capteur n'existe pas\n");
                                }
                            });
                        }
                    })
                }
                else {
                    console.log("patient non trouvé\n");
                }
            })
        }
        else{
            messageSent = rainbowSDK.im.sendMessageToJid("Non autorisé", message.fromJid);
        }
    })

}


/*fonction qui permet de déclarer une alarme sur un capteur, prend en paramètre l'objet message et la valeur de l'alarme*/
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

function list_warning(message){
    var del=client.query("SELECT * FROM warning WHERE bubblejid='"+message.fromBubbleJid+"'");
    del.on("row",function(row,result){
        result.addRow(row);
    });
    del.on("end",function(result){
        //console.log(result.rows);
        if(result.rows.length!=0){
            messageSent = rainbowSDK.im.sendMessageToBubbleJid("Vous avez déclaré la ou les alarme(s) suivante(s) : \n", message.fromJid);
            for(i=0;i<result.rows.length;i++){
                messageSent = rainbowSDK.im.sendMessageToBubbleJid(" - "+ result.rows[i].trigger+"°C\n", message.fromBubbleJid);
            }
        }
        else {
            messageSent = rainbowSDK.im.sendMessageToBubbleJid("Aucune alarme déclarée\n", message.fromJid);
        }
    });
}


function delete_warning(value,message){
        if(value=="remove warning"){
            client.query("DELETE FROM WARNING WHERE bubblejid='"+message.fromBubbleJid+"'");
            messageSent = rainbowSDK.im.sendMessageToBubbleJid("Les alarmes ont bien été supprimées\n",message.fromBubbleJid);
        }
        else if(value.indexOf("remove warning")==0){
            var split=value.split(" ");
            console.log(split.length);
            for(i=1;i<split.length;i++){
                client.query("DELETE FROM WARNING WHERE bubblejid='"+message.fromBubbleJid+"' AND trigger="+parseInt(split[i]));
            }
        }
}


/*fonction qui permet de créer une bulle prend en paramètre le nom de la bulle et 2 jid (celui du patient et medecin) puis fait appel à la fonction
invite_bubble*/
function create_bubble(name,jid_m,jid_p){
    let withHistory = true;
    let invitedAsModerator = true;     // To set to true if you want to invite someone as a moderator
    let sendAnInvite = true;            // To set to false if you want to add someone to a bubble without having to invite him first
    let inviteReason = "bot-invite";
    rainbowSDK.bubbles.createBubble(name, "A little description of my bubble", withHistory).then(function(bubble) {
    // do something with the bubble created
        console.log(bubble);
        console.log(jid_m);
        invite_bubble(jid_m,bubble);
        invite_bubble(jid_p,bubble);
        console.log("bubble ok");
        messageSent = rainbowSDK.im.sendMessageToBubbleJid("Bienvenue dans la bulle de suivi du patient "+name+", si vous désirez obtenir des informations, il vous suffit d'écrire 'Bot,' suivi de votre demande, je peux vous fournir sa température, des statistiques. Vous pouvez également placer une ou plusieurs alarmes pour être notifié dès qu'une anomalie sera constatée. ", bubble.jid);

    }).catch(function(err) {
    // do something if the creation of the bubble failed (eg. providing the same name as an existing bubble)
        console.log(err);
    });

}
/*fonction qui invite un contact dans une bulle, prend en paramètre le jid du contact à ajouter et la bulle dans laquelle ajouter le contact*/
function invite_bubble(jid_contact,bubble){
    let contact=rainbowSDK.contacts.getAll();
    let invitedAsModerator = false;     // To set to true if you want to invite someone as a moderator
    let sendAnInvite = true;            // To set to false if you want to add someone to a bubble without having to invite him first
    let inviteReason = "bot-invite";
    //console.log(bubble);
    for(i=0;i<contact.length;i++){
        if(contact[i].jid_im==jid_contact){
            //console.log(contact[i]);
            rainbowSDK.bubbles.inviteContactToBubble(contact[i], bubble, invitedAsModerator, sendAnInvite, inviteReason).then(function(bubbleUpdated) {
                // do something with the invite sent
                console.log("invite ok");
            }).catch(function(err) {
                // do something if the invitation failed (eg. bad reference to a buble)
                console.log(err);
            });
         }
    }
}


function Inscription(split,message){
    if(split.length!=2){
        console.log("pas de nom en argument");
        messageSent = rainbowSDK.im.sendMessageToJid("Pas de nom en argument, veuillez recommencer la procédure", message.fromJid);
    }
    else{
        var search_jid=client.query("SELECT jid FROM users WHERE jid='"+message.fromJid+"'");
        search_jid.on("row",function(row,result){
            result.addRow(row);
        });
        search_jid.on("end",function(result){
            if(result.rows.length!=0){
                messageSent = rainbowSDK.im.sendMessageToJid("Vous êtes déjà inscrit", message.fromJid);  
            }
            else {
                var search_name=client.query("SELECT name FROM users WHERE name='"+split[1]+"'");
                search_name.on("row",function(row,result){
                result.addRow(row);
                });
                search_name.on("end",function(result){
                    if(result.rows.length!=0){ 
                        messageSent = rainbowSDK.im.sendMessageToJid("Votre nom est déjà prit, veuillez ajouter la première lettre de votreprenom (ex : eDupont)", message.fromJid);
                    }
                    else {
                        console.log("Création d'un nouvel utilisateur\n");
                        var name=split[1];
                        client.query("INSERT INTO users(jid,name,category) VALUES ($1,$2,$3)",[message.fromJid,name,'P']); 
                        messageSent = rainbowSDK.im.sendMessageToJid("Vous êtes inscrit en tant que patient, si vous souhaitez devenir médecin veuillez donner votre nom à l'administrateur", message.fromJid);
                    }   
                });
            }
        }); 
    }
      
}

function AddMedecin(split,message){
    if(message.fromJid==adminjid) {
        var search_name=client.query("SELECT jid FROM users WHERE name='"+split[1]+"'");
        search_name.on("row",function(row,result){
                result.addRow(row);
        });
        search_name.on("end",function(result){
            if(result.rows.length!=0){
                  client.query("UPDATE users SET category = 'M' WHERE name ='"+split[1]+"'");
                  messageSent = rainbowSDK.im.sendMessageToJid("L'utilisateur a été nommé médecin", message.fromJid);
            }
            else{
                messageSent = rainbowSDK.im.sendMessageToJid("Ce nom n'est pas dans les inscrits", message.fromJid);
            }
        });
    }
    else{
        messageSent = rainbowSDK.im.sendMessageToJid("Seul l'administrateur peut utiliser cette fonction", message.fromJid);
    }
}

function list_medecins(message){
    var search_patient=client.query("SELECT name FROM users WHERE category='M'");
    search_patient.on("row",function(row,result){
        result.addRow(row);
    });
    search_patient.on("end",function(result){
        if(result.rows.length == 0) messageSent = rainbowSDK.im.sendMessageToJid("Aucun médecin n'a été déclaré.", message.fromJid);
        else {
            messageSent = rainbowSDK.im.sendMessageToJid("Les médecins sont : ", message.fromJid);
            for(i=0;i<result.rows.length;i++){
                messageSent = rainbowSDK.im.sendMessageToJid(" - "+ result.rows[i].name, message.fromJid);
        } 
        }              
    });
}

function list_patients(message){
    var search_patient=client.query("SELECT name FROM users WHERE category='P'");
    search_patient.on("row",function(row,result){
        result.addRow(row);
    });
    search_patient.on("end",function(result){
        if(result.rows.length == 0) messageSent = rainbowSDK.im.sendMessageToJid("Aucun patient n'a été déclaré.", message.fromJid);
        else {
            messageSent = rainbowSDK.im.sendMessageToJid("Les patients sont : ", message.fromJid);
            for(i=0;i<result.rows.length;i++){
                messageSent = rainbowSDK.im.sendMessageToJid(" - "+ result.rows[i].name, message.fromJid);
        } 
        }              
    });
}

function free_sensor(message,name){
    var check=client.query("SELECT * FROM users WHERE jid='"+message.fromJid+"' AND category='M'");
    check.on("row",function(row,result){
        result.addRow(row);
    });
    check.on("end",function(result){
        if(result.rows.length!=0){
            //vérifier d'abord que le nom se trouve dans la bdd et qu'il est bien relié à un sensor
            var is_link=client.query("SELECT * FROM users JOIN sensors ON users.jid=sensors.userjid WHERE users.name='"+name[1]+"'");
            is_link.on("row",function(row,result){
                result.addRow(row);
            });
            is_link.on("end",function(result){

                if(result.rows.length == 0) messageSent = rainbowSDK.im.sendMessageToJid("Le patient n'est pas enregistré ou il n'est attaché à aucun capteur", message.fromJid);
                //si le patient n'est relié qu'à un capteur
                else if(result.rows.length==1){
                    var jid=result.rows[0].jid;
                    messageSent = rainbowSDK.im.sendMessageToJid("Dissociation du capteur réussie, bulle en cours de suppression",message.fromJid);
                    delete_bubble(jid,message);
                    var delete_values=client.query("SELECT * from sensors JOIN temperature ON sensors.device=temperature.device WHERE sensors.userjid='"+jid+"'");
                    delete_values.on("row",function(row,result){
                        result.addRow(row);
                    });
                    delete_values.on("end",function(result){
                        if(result.rows.length!=0){
                            console.log(result.rows);
                            var sensor=result.rows[0].device;
                            del_sensor_db(sensor);
                            client.query("DELETE FROM link WHERE id_sensors='"+sensor+"'");

                        }
                    })
                    client.query("UPDATE sensors set userjid=NULL WHERE userjid='"+jid+"'");            
                }        
            })
        } 
        else{
            messageSent = rainbowSDK.im.sendMessageToJid("Non autorisé",message.fromJid);
        }

}


function del_sensor_db(sensor){
    client.query("DELETE FROM temperature WHERE device='"+sensor+"'");
}

function delete_bubble(user_jid,message){
    var bubble=rainbowSDK.bubbles.getAll();
    for(i=0;i<bubble.length;i++){
        console.log(bubble[i]);
       for(j=0;j<bubble[i].users.length;j++){
       //console.log(bubble[i].users);
           if(bubble[i].users[j].jid_im==user_jid){
             console.log(bubble[i].users[j].jid_im);
             console.log("suppression de la bulle");
             rainbowSDK.bubbles.deleteBubble(bubble[i]).then(function() {
                    // do something once the bubble has been deleted
                    console.log("bulle supprimée");
                    messageSent=rainbowSDK.im.sendMessageToJid("Bulle supprimée",message.fromJid);
             }).catch(function(err) {
                    // do something if you can't delete the bubble
                    console.log("pb");
                    console.log(err);
             });

            }
        }
    }
}

function draw_graph(message){
    var bubblejid=message.fromBubbleJid;
    let name=rainbowSDK.bubbles.getBubbleByJid(bubblejid).name;
    //var test=client.query("select to_char(date,'dd-Mon-YYYY HH24:MI:SS') as date,data from temperature");  /*WHERE device='1B3DEB'");*/
    //let users=rainbowSDK.bubbles.getBubbleByJid(bubblejid).users;
    var id_patient=client.query("SELECT * FROM users WHERE name='"+name+"' AND category='P'");
    id_patient.on("row",function(row,result){
        result.addRow(row);
    });
    id_patient.on("end",function(result){
        //console.log(result.rows);
        var patient=result.rows[0].jid;
        console.log(patient);
        var search_in_table=client.query("SELECT * FROM sensors WHERE userjid='"+patient+"'");
        search_in_table.on("row",function(row,result){
            result.addRow(row);
        });
        search_in_table.on("end",function(result){
            var dev=result.rows[0].device;
            console.log(dev);
            var test=client.query("SELECT TO_CHAR(date,'dd-Mon-YYYY HH24:MI:SS') AS date,data FROM temperature WHERE device='"+dev+"';");
            test.on("row",function(row,result){
                result.addRow(row);
            });
            test.on("end",function(result){
                console.log(result.rows);
                if(result.rows.length!=0){
                    messageSent = rainbowSDK.im.sendMessageToBubbleJid("[Graphique]"+process.env.ROOT_URL+""+bubblejid+"",bubblejid);
                    app.get('/'+bubblejid+'', function (req, res) {
                      res.sendFile(__dirname + '/output.html');
                    });
                    for(i=0;i<result.rows.length;i++){
                        result.rows[i].date=(parseTime(result.rows[i].date));
                        console.log(result.rows[i].date);
                        //console.log(result.rows[i].data);

                    }
                    const data=result.rows;
                    console.log(data);
                    output('./server/output', d3nLine({ data: data }));
                }
                else{
                    messageSent = rainbowSDK.im.sendMessageToBubbleJid("Aucune valeurs enregistrées pour tracer le graphe\n", bubblejid);
                }
            });
        });
    });
}

/*liste les sensors dispo et sensors pris par patients*/
function list_sensors(message){
    var list_sensors=client.query("SELECT * FROM sensors");
    list_sensors.on("row",function(row,result){
        result.addRow(row);
    });
    list_sensors.on("end",function(result){
        if(result.rows.length!=0){
            var available_sensors=[];
            var use_sensors=[];
            var list_patients=[];
            for(i=0;i<result.rows.length;i++){
                if(result.rows[i].userjid==null){
                    console.log("pas de patient");
                    available_sensors.push(result.rows[i].device);
                    console.log(available_sensors);
                }
                else{
                    use_sensors.push(result.rows[i].device);
                    list_patients.push(result.rows[i].userjid);
                }
            }
            if(available_sensors.length!=0){
                messageSent=rainbowSDK.im.sendMessageToJid("Les sensors disponibles sont : \n", message.fromJid);
                for(j=0;j<available_sensors.length;j++){
                    messageSent=rainbowSDK.im.sendMessageToJid("-"+available_sensors[j]+"\n", message.fromJid);
                }
            }
            else if(available_sensors.length==0){
                messageSent=rainbowSDK.im.sendMessageToJid("Aucuns sensors disponible", message.fromJid);
            }
            else if(use_sensors.length==0){
                messageSent=rainbowSDK.im.sendMessageToJid("Aucun sensors n'est utilisé\n", message.fromJid);
            }
            else{
                var used_sensor=client.query("SELECT * FROM sensors JOIN users ON sensors.userjid=users.jid");
                used_sensor.on("row",function(row,result){
                    result.addRow(row);
                });
                used_sensor.on("end",function(result){
                    messageSent=rainbowSDK.im.sendMessageToJid("Les sensors utilisés sont : \n", message.fromJid);
                    for(k=0;k<result.rows.length;k++){
                        messageSent=rainbowSDK.im.sendMessageToJid("-"+result.rows[k].device+" utilisé par le patient "+result.rows[k].name+"\n", message.fromJid);
                    }
                })
            }
        }
    })
}

/*Code principal du bot qui reste en écoute sur les messages reçus de type chat ou groupchat*/
// Instantiate the SDK
let rainbowSDK = new RainbowSDK(options);
rainbowSDK.events.on('rainbow_onmessagereceived', function(message) {
    console.log(message.fromJid);
    var chaine=message.content;
    if(message.type == "chat") {
        // Send the answer to the bubble
        console.log("Message : "+message.content);
        if(chaine.indexOf("link_device")==0){ //si on entre la commande link_device lie un patient à une antenne
            //link ID name
            var split=chaine.split(" ");
            if (split.length!=3) messageSent = rainbowSDK.im.sendMessageToJid("usage : link_device <nom> <identifiant de l'antenne>", message.fromJid);
            else {
                link_device(split,message);
            }
        }
        else if(chaine.indexOf("free_sensor")==0){
            console.log("dissocier patient-sensor");
            var split=chaine.split(" ");
            if (split.length!=3) messageSent = rainbowSDK.im.sendMessageToJid("usage : free_sensor <nom> <identifiant de l'antenne>", message.fromJid);
            else free_sensor(message,split);
        }
        else if(chaine=="list_sensors"){
            console.log("lister les sensors disponibles");
            list_sensors(message);
        }
        else {
            clientnpm.message(message.content, {})
                .then((datawit) => {
            if (!(datawit.hasOwnProperty('entities'))) {
                messageSent = rainbowSDK.im.sendMessageToBubbleJid("Je ne comprend pas votre demande. Je peux vous donner la température de votre patient, des données statistique vis-à-vis de celle-ci ainsi que fixer une alarme.", message.fromBubbleJid);
            }
            else if(datawit.entities.intent[0].confidence < 0.5){
                //console.log("niveau de confidence : " + datawit.entities.intent[0].confidence + "00%");
                messageSent = rainbowSDK.im.sendMessageToJid("Je ne suis pas certain de ce que vous souhaitez, pouvez vous reformuler ?", message.fromJid);
            }
            else{
                //console.log(datawit.entities.intent.length);
                var value = datawit.entities.intent[0].value;
                if(value == "Inscription"){
                        //console.log("Objectif : s'inscrire");
                    if(datawit.entities.hasOwnProperty('contact')){
                        var chaine="Inscription "+datawit.entities.contact[0].value
                        Inscription(chaine.split(" "),message);
                    }
                    else{
                        messageSent = rainbowSDK.im.sendMessageToBubbleJid("Je n'ai pas compris à quel nom vous souhaitez vous inscrire. Pouvez vous reformulez en indiquant clairement votre nom ?", message.fromBubbleJid);
                    }
                }
                else if(value == "médecin"){
                    //console.log("Objectif : transformer quelqu'un en medecin");
                    if(datawit.entities.hasOwnProperty('contact')){
                        var chaine="Medecin "+datawit.entities.contact[0].value
                        AddMedecin(chaine.split(" "),message);
                    }
                    else{
                        messageSent = rainbowSDK.im.sendMessageToBubbleJid("Je n'ai pas compris à qui vous souhaitez définir en tant que médecin. Pouvez vous reformulez en indiquant clairement la personne avec qui vous souhaitez promouvoir ?", message.fromBubbleJid);
                    }
                }
                else if(value == "lier"){
                    //console.log("Objectif : suivre un patient");
                    if(datawit.entities.hasOwnProperty('contact')){
                        var chaine="link "+datawit.entities.contact[0].value
                        check(chaine.split(" "),message);
                    }
                    else{
                        messageSent = rainbowSDK.im.sendMessageToBubbleJid("Je n'ai pas compris à qui vous souhaitez vous lier. Pouvez vous reformulez en indiquant clairement la personne avec qui vous souhaitez vous lier ?", message.fromBubbleJid);
                    }
                }
                else if(value == "liste" && datawit.entities.intent.length==2){
                    var value = datawit.entities.intent[1].value;
                    if(value == "médecin"){
                        //console.log("Objectif : donner la liste des médecins");
                        list_medecins(message);
                    }
                    else if(value == "patient"){
                        //console.log("Objectif : donner la liste des patients");
                        list_patients(message);
                    }
                    else if(value == "capteur"){
                        //console.log("Objectif : donner la liste des patients");
                        list_sensors(message);
                    }
                }
            }
            }) 
        .catch( raison => {
            messageSent = rainbowSDK.im.sendMessageToJid("Ce n'est pas une commande, veuillez entrer help pour accéder à la liste des commandes disponibles", message.fromJid);
        })
    }
    }

    else {
        console.log(message.fromBubbleJid);
        console.log(rainbowSDK.bubbles.getBubbleByJid(message.fromBubbleJid).users[0].jid_im);
        var jid=message.fromBubbleJid;
        console.log("Message : "+message.content);
        if(chaine.substring(0,4)=="Bot," || chaine.substring(0,4)=="bot,"){
            clientnpm.message(chaine.substring(4,message.length), {})
                .then((datawit) => {
        console.log(datawit);
            if (!(datawit.hasOwnProperty('entities'))) {
        console.log("ma bite sur ton front");
                messageSent = rainbowSDK.im.sendMessageToBubbleJid("Je ne comprend pas votre demande. Je peux vous donner la température de votre patient, des données statistique vis-à-vis de celle-ci ainsi que fixer une alarme.", message.fromBubbleJid);
            }
            else if(datawit.entities.intent[0].confidence < 0.5){
                //console.log("niveau de confidence : " + datawit.entities.intent[0].confidence + "00%");
                messageSent = rainbowSDK.im.sendMessageToBubbleJid("Je ne suis pas certain de ce que vous souhaitez, pouvez vous reformuler ?", message.fromBubbleJid);
            }
            else{
                var value = datawit.entities.intent[0].value;
        console.log(datawit);
                if(value == "température"){
                    //console.log("Objectif : donner température");
                    //var chaine="temp"
                    get_temperature(message);
                }
                else if(value == "statistique"){
                    //console.log("Objectif : donner statistique totale");
                    var chaine="stats all"
                    stats(chaine.split(" "),message);
                }
                else if(value == "Moyenne"){
                    //console.log("Objectif : donner moyenne");
                    var chaine="stats mean"
                    stats(chaine.split(" "),message);
                }
                else if(value == "alarme"){
                    //console.log("Objectif : ajouter une alarme");
                    if(datawit.entities.number.length > 1 && datawit.entities.number[0].value == 1){
                        warning(jid,datawit.entities.number[1].value);
                    }
                    else{
                        warning(jid,datawit.entities.number[0].value);
                    }
                }
                else if(value == "retirer"){
                    //console.log("Objectif : retirer les warnings");
                    var chaine="remove warning"
                    if (datawit.entities.hasOwnProperty('number')) {
                        for (var i=0; i<datawit.entities.number.length; i++) {
                            if( !(i==0 && datawit.entities.number[0].value==1 && datawit.entities.number.length>1)){
                                chaine = chaine + " " + datawit.entities.number[i].value;
                            }
                        }
                    }
                    console.log(chaine);
                    try {
                        delete_warning(chaine,message);
                    }
                    catch(error) {
                        messageSent = rainbowSDK.im.sendMessageToBubbleJid("Il est possible que l'alarme que vous souhaitez supprimer n'existe pas, ou alors je n'ai pas compris quelles alarmes vous souhaitez supprimer. Désolé.", message.fromBubbleJid);
                    }
                       // messageSent = rainbowSDK.im.sendMessageToBubbleJid("Il est possible que l'alarme que vous souhaitez supprimer n'existe pas, ou alors je n'ai pas compris quelles alarmes vous souhaitez supprimer. Désolé.", message.fromBubbleJid);
                }
                else if(value == "graphique"){
                    //console.log("Objectif : graphique de temperature");
                    draw_graph(message);
                }
                else if(value == "liste"){
                    //console.log("Objectif : liste des warning");
                    list_warning(message);
                }
            }   
        })
        .catch( raison => {
            messageSent = rainbowSDK.im.sendMessageToBubbleJid("Je ne comprend pas votre demande. Je peux vous donner la température de votre patient, des données statistiques vis-à-vis de celui-ci ainsi que fixer une alarme.", message.fromBubbleJid);
        })
    }

    }
});

// Start the SDK
rainbowSDK.start()
