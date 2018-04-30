function list_capteurs(message){
    var search_patient=client.query("SELECT device varchar primary key FROM sensors");
    search_patient.on("row",function(row,result){
        result.addRow(row);
    });
    search_patient.on("end",function(result){
        if(result.rows.length == 0) messageSent = rainbowSDK.im.sendMessageToJid("Aucun capteur n'a été déclaré.", message.fromJid);
        else {
            messageSent = rainbowSDK.im.sendMessageToJid("Les capteurs sont : ", message.fromJid);
            for(i=0;i<result.rows.length;i++){
                messageSent = rainbowSDK.im.sendMessageToJid(" - "+ result.rows[i].name, message.fromJid);
        } 
        }              
    });
}