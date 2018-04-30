var adminjid = process.env.admin;

function Inscription(split,message){
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
                    messageSent = rainbowSDK.im.sendMessageToJid("Vous êtes inscrit en tant que patient, si vous souhaitez devenir médecin veuillez donner votre nom à l'aministrateur", message.fromJid);
                }   
            });
        }
    });   
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
        if(result.rows.length == 0) messageSent = rainbowSDK.im.sendMessageToJid("Aucun médecin n'a été déclaré.", message.fromJid);
        else {
            messageSent = rainbowSDK.im.sendMessageToJid("Les patients sont : ", message.fromJid);
            for(i=0;i<result.rows.length;i++){
                messageSent = rainbowSDK.im.sendMessageToJid(" - "+ result.rows[i].name, message.fromJid);
        } 
        }              
    });
}

else if(chaine=="list_medecins"){
            list_medecins(message);
}
else if(chaine=="list_patients"){
    list_patients(message);
}
else if(chaine.indexOf("Inscription")==0){
    var split=chaine.split(" ");
    Inscription(split,message);
}
else if(chaine.indexOf("Medecin")==0){
    var split=chaine.split(" ");
    AddMedecin(split,message);
}