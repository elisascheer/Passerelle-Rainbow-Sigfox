# Passerelle-Rainbow-Sigfox

Notre projet ingénieur 2A consiste à établir une passerelle entre les données émises par un objet Sigfox et l'application de chat professionnelle Rainbow.

Le code fournit dans ce git est le code de la gateway, c'est un bot/serveur codé en Javascript qui répond aux requêtes des utilisateurs de Rainbow.

Pour déployer ce code il faudrait avoir un compte développeur Rainbow

Le Bot est hebergé dans la plateforme Heroku

Pour déployer ce code :
- git clone https://github.com/elisascheer/Passerelle-Rainbow-Sigfox
- cd Passerelle-Rainbow-Sigfox
- heroku apps:create [NAME OF YOUR APP]
- heroku addons:create heroku-postgresql:hobby-dev
- heroku git:remote -a [NAME OF YOUR APP]
- git push heroku master
- variables environnements :
- [x] heroku config:set LOG=[ADRESSE MAIL DE VOTRE COMPTE DEVLOPPEUR]
- [x] heroku config:set PASS=[MOT DE PASSE DE VOTRE COMPTE DEVLOPPEUR]
- heroku ps:scale web=1
- heroku logs --tail

Il est également possible de tester la solution en local : 

-git clone https://github.com/elisascheer/Passerelle-Rainbow-Sigfox
-cd Passerelle-Rainbow-Sigfox
-npm install
-DATABASE_URL=[URL DE LA BDD LOCALE PG] LOG=[ADRESSE MAIL DE VOTRE COMPTE DEVELOPPEUR] PASS=[MDP DU COMPTE DEVELOPPEUR] ROOT_URL=localhost:4000/ admin=[JID ADMIN] node ./server/server.js

Pour pouvoir envoyer des requêtes POST en local : 
-curl -X POST http://localhost:4000/  -H "Content-Type:application/json" -d '{"device":"1B3DEB", "data":"39.1"}'
Architecture globale de la passerelle
![alt tag](https://cdn.discordapp.com/attachments/369435428706582535/403285199820947476/Architecture.jpg)
Lien du git pour le code Arduino -> https://github.com/elisascheer/Arduino-Sigfox


