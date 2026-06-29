#include <SPI.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

// Pin
#define RST_PIN     4
#define SS_PIN      5
#define RELAY_PIN   26
#define BUZZER_PIN  2

// WiFi - ganti dengan WiFi kamu
#define WIFI_SSID     "A"
#define WIFI_PASSWORD "09876543"

// Firebase
#define DATABASE_URL "https://smart-door-lock-9b00f-default-rtdb.asia-southeast1.firebasedatabase.app"
#define API_KEY      "AIzaSyCHeeWpFaxADs57a2u5K-ol3HJcZh87Dx0"

MFRC522 rfid(SS_PIN, RST_PIN);
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

#define MAX_CARDS 20
#define HEARTBEAT_INTERVAL 10000

struct CardEntry {
  byte uid[4];
  char name[32];
};

CardEntry cardList[MAX_CARDS];
int cardCount = 0;
unsigned long lastCardsUpdate = 0;
unsigned long lastHeartbeat = 0;

const byte defaultAuthorizedUID[][4] = {
  {0x9F, 0x3A, 0x2B, 0xFA}
};
const char defaultAuthorizedName[][16] = {
  "Kartu utama"
};

bool signupOK = false;

void logFirebaseError(const String &context) {
  if (fbdo.httpCode() != 0) {
    Serial.printf("Firebase error (%s): %s [code=%d]\n", context.c_str(), fbdo.errorReason().c_str(), fbdo.httpCode());
  } else {
    Serial.printf("Firebase error (%s): %s\n", context.c_str(), fbdo.errorReason().c_str());
  }
}

void updateHeartbeat() {
  if (!Firebase.ready() || !signupOK) return;

  unsigned long nowMillis = millis();
  if (!Firebase.RTDB.setBool(&fbdo, "smart-door-lock/door/online", true)) {
    logFirebaseError("updateHeartbeat online");
  }
  if (!Firebase.RTDB.setInt(&fbdo, "smart-door-lock/door/lastSeen", nowMillis)) {
    logFirebaseError("updateHeartbeat lastSeen");
  }
}

void setDoorStatus(const char *status) {
  if (!Firebase.ready() || !signupOK) return;

  if (!Firebase.RTDB.setString(&fbdo, "smart-door-lock/door/status", status)) {
    logFirebaseError("setDoorStatus status");
  }
  if (!Firebase.RTDB.setString(&fbdo, "smart-door-lock/door/lastUpdated", getTimeString())) {
    logFirebaseError("setDoorStatus lastUpdated");
  }
  if (!Firebase.RTDB.setBool(&fbdo, "smart-door-lock/door/online", true)) {
    logFirebaseError("setDoorStatus online");
  }
  if (!Firebase.RTDB.setInt(&fbdo, "smart-door-lock/door/lastSeen", millis())) {
    logFirebaseError("setDoorStatus lastSeen");
  }
}

void setup() {
  Serial.begin(115200);
  SPI.begin();
  rfid.PCD_Init();

  pinMode(RELAY_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH);
  digitalWrite(BUZZER_PIN, LOW);

  // Koneksi WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Menghubungkan ke WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(500);
  }
  Serial.println("\nWiFi terhubung!");
  Serial.println(WiFi.localIP());

  // Setup Firebase
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  config.token_status_callback = tokenStatusCallback;

  // Database rules allow anonymous access, jadi signUp tidak diperlukan.
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
  signupOK = true;

  loadDefaultCards();
  if (Firebase.ready() && signupOK) {
    updateAuthorizedCards();
    setDoorStatus("locked");
    updateHeartbeat();
  }

  Serial.println("Smart Door Lock siap!");
}

void loop() {
  if (Firebase.ready() && signupOK && millis() - lastCardsUpdate > 60000) {
    lastCardsUpdate = millis();
    updateAuthorizedCards();
  }

  if (Firebase.ready() && signupOK && millis() - lastHeartbeat > HEARTBEAT_INTERVAL) {
    lastHeartbeat = millis();
    updateHeartbeat();
  }

  // Cek perintah dari dashboard web (buka/kunci manual)
  if (Firebase.ready() && signupOK) {
    if (Firebase.RTDB.getString(&fbdo, "smart-door-lock/door/command")) {
      String cmd = fbdo.stringData();
      if (cmd == "unlock") {
        Serial.println("Perintah dari web: BUKA");
        openDoor("Web Admin", "manual");
        Firebase.RTDB.setString(&fbdo, "smart-door-lock/door/command", "idle");
      } else if (cmd == "lock") {
        digitalWrite(RELAY_PIN, HIGH);
        setDoorStatus("locked");
        Firebase.RTDB.setString(&fbdo, "smart-door-lock/door/command", "idle");
      }
    }
  }

  // Cek kartu RFID
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) {
    delay(100);
    return;
  }

  // Baca UID
  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(rfid.uid.uidByte[i], HEX);
    if (i < rfid.uid.size - 1) uid += ":";
  }
  uid.toUpperCase();
  Serial.println("UID: " + uid);

  if (isAuthorized(rfid.uid.uidByte)) {
    Serial.println("Akses DITERIMA");
    openDoor(uid, "rfid");
    sendLog(uid, "accepted", getCardName(uid));
  } else {
    Serial.println("Akses DITOLAK");
    denyAccess();
    sendLog(uid, "denied", "Tidak dikenal");
  }

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
}

void loadDefaultCards() {
  cardCount = 0;
  for (int i = 0; i < 1 && cardCount < MAX_CARDS; i++) {
    memcpy(cardList[cardCount].uid, defaultAuthorizedUID[i], 4);
    strncpy(cardList[cardCount].name, defaultAuthorizedName[i], sizeof(cardList[cardCount].name) - 1);
    cardList[cardCount].name[sizeof(cardList[cardCount].name) - 1] = '\0';
    cardCount++;
  }
}

String formatUid(const byte uid[4]) {
  char buf[16];
  sprintf(buf, "%02X:%02X:%02X:%02X", uid[0], uid[1], uid[2], uid[3]);
  return String(buf);
}

bool addCardFromDb(String uidStr, String nameStr) {
  uidStr.toUpperCase();
  uidStr.replace(":", "");
  if (uidStr.length() != 8) return false;

  byte parsed[4];
  for (int i = 0; i < 4; i++) {
    String part = uidStr.substring(i * 2, i * 2 + 2);
    parsed[i] = (byte) strtoul(part.c_str(), NULL, 16);
  }

  for (int i = 0; i < cardCount; i++) {
    if (memcmp(cardList[i].uid, parsed, 4) == 0) {
      strncpy(cardList[i].name, nameStr.c_str(), sizeof(cardList[i].name) - 1);
      cardList[i].name[sizeof(cardList[i].name) - 1] = '\0';
      return true;
    }
  }

  if (cardCount >= MAX_CARDS) return false;

  memcpy(cardList[cardCount].uid, parsed, 4);
  strncpy(cardList[cardCount].name, nameStr.c_str(), sizeof(cardList[cardCount].name) - 1);
  cardList[cardCount].name[sizeof(cardList[cardCount].name) - 1] = '\0';
  cardCount++;
  return true;
}

void updateAuthorizedCards() {
  if (!Firebase.ready() || !signupOK) return;

  if (!Firebase.RTDB.getJSON(&fbdo, "smart-door-lock/cards")) {
    Serial.printf("Failed to load cards: %s\n", fbdo.errorReason().c_str());
    return;
  }

  String cardsJson = fbdo.stringData();
  Serial.println("Cards JSON: " + cardsJson);

  loadDefaultCards();
  int idx = 0;
  while (true) {
    int uidStart = cardsJson.indexOf("\"uid\":\"", idx);
    if (uidStart < 0) break;
    uidStart += 7;
    int uidEnd = cardsJson.indexOf('"', uidStart);
    if (uidEnd < 0) break;
    String uidValue = cardsJson.substring(uidStart, uidEnd);

    int nameStart = cardsJson.indexOf("\"name\":\"", uidEnd);
    if (nameStart < 0) break;
    nameStart += 9;
    int nameEnd = cardsJson.indexOf('"', nameStart);
    if (nameEnd < 0) break;
    String nameValue = cardsJson.substring(nameStart, nameEnd);

    addCardFromDb(uidValue, nameValue);
    idx = nameEnd;
  }
  Serial.printf("Loaded %d authorized cards\n", cardCount);
}

bool isAuthorized(byte *uid) {
  for (int i = 0; i < cardCount; i++) {
    if (memcmp(uid, cardList[i].uid, 4) == 0) return true;
  }
  return false;
}

String getCardName(String uid) {
  uid.toUpperCase();
  for (int i = 0; i < cardCount; i++) {
    if (uid == formatUid(cardList[i].uid)) {
      return String(cardList[i].name);
    }
  }
  return "Kartu tidak dikenal";
}

void openDoor(String uid, String method) {
  digitalWrite(BUZZER_PIN, HIGH);
  delay(100);
  digitalWrite(BUZZER_PIN, LOW);

  digitalWrite(RELAY_PIN, LOW);

  setDoorStatus("unlocked");
  delay(3000);
  digitalWrite(RELAY_PIN, HIGH);
  setDoorStatus("locked");
}

void denyAccess() {
  for (int i = 0; i < 3; i++) {
    digitalWrite(BUZZER_PIN, HIGH); delay(100);
    digitalWrite(BUZZER_PIN, LOW);  delay(100);
  }
}

void sendLog(String uid, String status, String cardName) {
  if (!Firebase.ready() || !signupOK) return;

  String path = "smart-door-lock/logs/" + String(millis());
  Firebase.RTDB.setString(&fbdo, path + "/uid", uid);
  Firebase.RTDB.setString(&fbdo, path + "/status", status);
  Firebase.RTDB.setString(&fbdo, path + "/cardName", cardName);
  Firebase.RTDB.setString(&fbdo, path + "/time", getTimeString());
}

String getTimeString() {
  // Format sederhana pakai millis, nanti bisa diganti NTP
  unsigned long ms = millis();
  unsigned long detik = ms / 1000;
  unsigned long menit = detik / 60;
  unsigned long jam = menit / 60;
  char buf[20];
  sprintf(buf, "%02lu:%02lu:%02lu", jam % 24, menit % 60, detik % 60);
  return String(buf);
}