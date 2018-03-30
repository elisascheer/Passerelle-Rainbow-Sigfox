var adminjid = process.env.admin;


function Inscription(split,message){
    var search_jid=client.query("SELECT Jid FROM personnes WHERE Jid='"+message.fromJid+"'");
    search_jid.on("row",function(row,result){
        result.addRow(row);
    });
    search_jid.on("end",function(result){
        if(result.rows.length!=0){
            messageSent = rainbowSDK.im.sendMessageToJid("Vous êtes déjà inscrit", message.fromJid);  
        }
        else {
            var search_name=client.query("SELECT Name FROM personnes WHERE name='"+split[1]+"'");
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
                client.query("INSERT INTO personnes(jid,name,role) VALUES ($1,$2,$3)",[message.fromJid,name,'P']); 
                messageSent = rainbowSDK.im.sendMessageToJid("Vous êtes inscrit en tant que patient, si vous souhaitez devenir médecin veuillez donner votre nom à l'aministrateur", message.fromJid)
            }     
        }
    });

}

function Add-Medecin(split,message){
    if(message.fromJid==adminjid) {
        var search_name=client.query("SELECT Jid FROM personnes WHERE name='"+split[1]+"'");
        search_name.on("row",function(row,result){
            result.addRow(row);
        });
        search_name.on("end",function(result){
        if(result.rows.length!=0){
              client.query("UPDATE personnes SET role = 'M' WHERE name ='"+split[1]+"'");
              messageSent = rainbowSDK.im.sendMessageToJid("L'utilisateur a été nommé médecin", message.fromJid)
        }
        else {
            messageSent = rainbowSDK.im.sendMessageToJid("Ce nom n'est pas dans les inscrits", message.fromJid);
        }
    else{
        messageSent = rainbowSDK.im.sendMessageToJid("Seul l'administrateur peut utiliser cette fonction", message.fromJid);
    }

}
