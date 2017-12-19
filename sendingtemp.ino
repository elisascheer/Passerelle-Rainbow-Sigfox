   
// Inclusion de la librairie nécessaire pour la lecture du DHT22
#include <DHT.h>

//Déclaration des pins reliées aux capteurs
#define DHTPIN A0

// Déclaration du type de capteur utilisé et initialisation
#define DHTTYPE DHT22
DHT dht(DHTPIN, DHTTYPE);



// Inclusion des librairies nécessaires pour l'Akeru
#include <Akeru.h>
#include <SoftwareSerial.h>

// Définition des RX/TX de l'Akeru
#define TX 5
#define RX 4
// Initialisation objet
Akeru Akeru(RX, TX);



void setup()
{
  Serial.begin(9600);
 
  // Initialisation Akeru
  Akeru.begin();
 
  // Initialisation DHT11
  dht.begin();

}

void loop()
{
  // Relevé des valeurs en provenance du DHT22
  float temp = dht.readTemperature();
  Serial.print("\ttemp = ");
  Serial.print(temp);
  String temperature = Akeru.toHex(temp);
  String message = temperature;
  Serial.print("\n");
  Serial.print(temperature);
  Serial.print("\n");
  Serial.print(message);
  Akeru.sendPayload(message);

  delay(10000000);
  
}
