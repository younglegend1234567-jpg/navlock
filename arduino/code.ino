// ================================================
//   NAVLOCK - ESP32 + HiveMQ + Supabase
//   Sinkron dengan dashboard React
// ================================================

#include <SPI.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <WiFiClient.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <time.h>

// ================================================
// PIN
// ================================================
#define RST_PIN        4
#define SS_PIN         5
#define RELAY_PIN      26
#define BUZZER_PIN     2

// HIGH = relay OFF = pintu terkunci. Ubah jika relay kamu active HIGH.
#define RELAY_LOCKED   HIGH
#define RELAY_UNLOCKED LOW

// ================================================
// DURASI
// ================================================
#define DOOR_OPEN_DURATION     3000
#define SCAN_COOLDOWN          2000
#define CARD_SYNC_INTERVAL     15000
#define COMMAND_POLL_INTERVAL  3000
#define HEARTBEAT_INTERVAL     10000

// ================================================
// WIFI, HIVEMQ, SUPABASE
// Isi sesuai .env dashboard.
// ================================================
#define WIFI_SSID       "A"
#define WIFI_PASSWORD   "09876543"

#define HIVEMQ_HOST     "broker.hivemq.com"
#define HIVEMQ_PORT     1883

#define SUPABASE_URL      "https://YOUR_PROJECT_REF.supabase.co"
#define SUPABASE_ANON_KEY "YOUR_SUPABASE_ANON_KEY"

// Harus sama dengan src/lib/mqtt.js
#define TOPIC_COMMAND "navlock/variruujpdsivihzfcjo/door/command"
#define TOPIC_STATUS  "navlock/variruujpdsivihzfcjo/door/status"
#define TOPIC_ONLINE  "navlock/variruujpdsivihzfcjo/door/online"
#define TOPIC_LOG     "navlock/variruujpdsivihzfcjo/access/log"

// ================================================
// DATA
// ================================================
struct RfidCard {
  String uid;
  String name;
};

MFRC522 rfid(SS_PIN, RST_PIN);
WiFiClient mqttClient;
WiFiClientSecure httpSecureClient;
PubSubClient mqtt(mqttClient);

RfidCard cards[50];
int cardCount = 0;

String pendingCommand = "";
unsigned long lastScanTime = 0;
unsigned long lastCardSync = 0;
unsigned long lastCommandPoll = 0;
unsigned long lastHeartbeat = 0;
unsigned long lastMqttReconnect = 0;
bool doorOpen = false;

// ================================================
// SETUP
// ================================================
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=============================");
  Serial.println("  NavLock ESP32");
  Serial.println("  HiveMQ + Supabase");
  Serial.println("=============================");

  pinMode(RELAY_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, RELAY_LOCKED);
  digitalWrite(BUZZER_PIN, LOW);

  SPI.begin();
  rfid.PCD_Init();
  delay(200);

  byte version = rfid.PCD_ReadRegister(MFRC522::VersionReg);
  if (version == 0x00 || version == 0xFF) {
    Serial.println("[RFID] ERROR - tidak terdeteksi. Cek wiring RC522.");
    buzzerError();
  } else {
    Serial.println("[RFID] OK - versi: 0x" + String(version, HEX));
  }

  connectWiFi();
  configTime(7 * 3600, 0, "pool.ntp.org", "time.google.com");

  httpSecureClient.setInsecure();
  mqtt.setServer(HIVEMQ_HOST, HIVEMQ_PORT);
  mqtt.setCallback(onMqttMessage);

  connectMqtt();
  syncCardsFromSupabase();
  publishDoorState("locked", "idle", true);

  buzzerOK();
  delay(100);
  buzzerOK();

  Serial.println("\n[SIAP] Tempelkan kartu RFID...");
}

// ================================================
// LOOP
// ================================================
void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    return;
  }

  if (!mqtt.connected()) {
    connectMqtt();
  }
  mqtt.loop();

  if (pendingCommand.length() > 0) {
    String command = pendingCommand;
    pendingCommand = "";
    handleCommand(command);
  }

  unsigned long now = millis();

  if (now - lastCardSync >= CARD_SYNC_INTERVAL) {
    lastCardSync = now;
    syncCardsFromSupabase();
  }

  if (now - lastCommandPoll >= COMMAND_POLL_INTERVAL) {
    lastCommandPoll = now;
    pollCommandFromSupabase();
  }

  if (now - lastHeartbeat >= HEARTBEAT_INTERVAL) {
    lastHeartbeat = now;
    publishDoorState(doorOpen ? "unlocked" : "locked", "idle", true);
  }

  if (doorOpen) return;
  if (now - lastScanTime < SCAN_COOLDOWN) return;
  if (!rfid.PICC_IsNewCardPresent()) return;
  if (!rfid.PICC_ReadCardSerial()) return;

  lastScanTime = now;

  String uid = readUid();
  String cardName = findCardName(uid);
  Serial.println("\n[SCAN] UID: " + uid);

  if (cardName != "") {
    Serial.println("[OK] Akses DITERIMA - " + cardName);
    unlockDoor(uid, cardName);
  } else {
    Serial.println("[TOLAK] Kartu tidak dikenal");
    denyAccess();
    sendAccessLog(uid, "denied", "Tidak dikenal");
  }

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
}

// ================================================
// WIFI + MQTT
// ================================================
void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.print("[WiFi] Menghubungkan ke " + String(WIFI_SSID));
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Terhubung. IP: " + WiFi.localIP().toString());
  } else {
    Serial.println("\n[WiFi] GAGAL");
  }
}

void connectMqtt() {
  if (mqtt.connected()) return;
  if (millis() - lastMqttReconnect < 3000) return;
  lastMqttReconnect = millis();

  String clientId = "navlock_esp32_" + String((uint32_t)ESP.getEfuseMac(), HEX);
  Serial.print("[MQTT] Menghubungkan ke HiveMQ...");

  bool ok = mqtt.connect(clientId.c_str(), TOPIC_ONLINE, 1, true, "false");

  if (ok) {
    Serial.println(" OK");
    mqtt.subscribe(TOPIC_COMMAND, 1);
    mqtt.publish(TOPIC_ONLINE, "true", true);
    mqtt.publish(TOPIC_STATUS, doorOpen ? "unlocked" : "locked", true);
  } else {
    Serial.println(" gagal, rc=" + String(mqtt.state()));
  }
}

void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  message.trim();

  if (String(topic) == TOPIC_COMMAND && (message == "unlock" || message == "lock")) {
    pendingCommand = message;
    Serial.println("[MQTT] Command dari dashboard: " + pendingCommand);
  }
}

// ================================================
// COMMAND + DOOR
// ================================================
void handleCommand(String command) {
  if (command == "unlock") {
    unlockDoor("WEB", "Web Admin");
    publishDoorState("locked", "idle", true);
    return;
  }

  if (command == "lock") {
    lockDoor();
    publishDoorState("locked", "idle", true);
  }
}

void unlockDoor(String uid, String cardName) {
  doorOpen = true;
  buzzerOK();

  digitalWrite(RELAY_PIN, RELAY_UNLOCKED);
  Serial.println("[RELAY] Solenoid TERBUKA - " + cardName);
  publishDoorState("unlocked", "idle", true);

  sendAccessLog(uid, "accepted", cardName);

  delay(DOOR_OPEN_DURATION);
  lockDoor();
}

void lockDoor() {
  digitalWrite(RELAY_PIN, RELAY_LOCKED);
  doorOpen = false;
  lastScanTime = millis();
  Serial.println("[RELAY] Solenoid TERKUNCI");
  publishDoorState("locked", "idle", true);
}

// ================================================
// RFID
// ================================================
String readUid() {
  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(rfid.uid.uidByte[i], HEX);
    if (i < rfid.uid.size - 1) uid += ":";
  }
  uid.toUpperCase();
  return uid;
}

String normalizeUid(String uid) {
  uid.toUpperCase();
  uid.replace(":", "");
  uid.replace("-", "");
  uid.replace(" ", "");
  return uid;
}

String findCardName(String uid) {
  String normalized = normalizeUid(uid);
  for (int i = 0; i < cardCount; i++) {
    if (normalizeUid(cards[i].uid) == normalized) {
      return cards[i].name;
    }
  }
  return "";
}

// ================================================
// SUPABASE
// ================================================
void syncCardsFromSupabase() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/rfid_cards?select=uid,name,active&active=eq.true";
  http.begin(httpSecureClient, url);
  addSupabaseHeaders(http);

  int code = http.GET();
  String response = http.getString();
  http.end();

  if (code != 200) {
    Serial.println("[Supabase] Sync kartu gagal. HTTP " + String(code));
    Serial.println(response);
    return;
  }

  DynamicJsonDocument doc(8192);
  DeserializationError error = deserializeJson(doc, response);
  if (error) {
    Serial.println("[Supabase] JSON kartu invalid");
    return;
  }

  cardCount = 0;
  for (JsonObject row : doc.as<JsonArray>()) {
    if (cardCount >= 50) break;
    cards[cardCount].uid = row["uid"].as<String>();
    cards[cardCount].name = row["name"].as<String>();
    cardCount++;
  }

  Serial.println("[Supabase] Kartu aktif tersinkron: " + String(cardCount));
}

void pollCommandFromSupabase() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/door_states?select=command&id=eq.main&limit=1";
  http.begin(httpSecureClient, url);
  addSupabaseHeaders(http);

  int code = http.GET();
  String response = http.getString();
  http.end();

  if (code != 200) return;

  DynamicJsonDocument doc(512);
  DeserializationError error = deserializeJson(doc, response);
  JsonArray rows = doc.as<JsonArray>();
  if (error || rows.size() == 0) return;

  String command = rows[0]["command"].as<String>();
  if (command == "unlock" || command == "lock") {
    pendingCommand = command;
    Serial.println("[Supabase] Command dari database: " + command);
  }
}

void publishDoorState(String status, String command, bool online) {
  if (mqtt.connected()) {
    mqtt.publish(TOPIC_STATUS, status.c_str(), true);
    mqtt.publish(TOPIC_ONLINE, online ? "true" : "false", true);
  }

  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/door_states?on_conflict=id";
  http.begin(httpSecureClient, url);
  addSupabaseHeaders(http);
  http.addHeader("Prefer", "resolution=merge-duplicates,return=minimal");

  DynamicJsonDocument doc(512);
  doc["id"] = "main";
  doc["status"] = status;
  doc["command"] = command;
  doc["online"] = online;
  doc["last_seen"] = getIsoNow();
  doc["updated_at"] = getIsoNow();

  String body;
  serializeJson(doc, body);
  int code = http.POST(body);
  String response = http.getString();
  http.end();

  if (code < 200 || code >= 300) {
    Serial.println("[Supabase] Update door_states gagal. HTTP " + String(code));
    Serial.println(response);
  }
}

void sendAccessLog(String uid, String status, String cardName) {
  if (mqtt.connected()) {
    DynamicJsonDocument mqttDoc(256);
    mqttDoc["uid"] = uid;
    mqttDoc["status"] = status;
    mqttDoc["cardName"] = cardName;
    mqttDoc["time"] = getLocalTimeString();
    mqttDoc["date"] = getLocalDateString();

    String payload;
    serializeJson(mqttDoc, payload);
    mqtt.publish(TOPIC_LOG, payload.c_str(), false);
  }

  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/access_logs";
  http.begin(httpSecureClient, url);
  addSupabaseHeaders(http);
  http.addHeader("Prefer", "return=minimal");

  DynamicJsonDocument doc(512);
  doc["uid"] = uid;
  doc["status"] = status;
  doc["card_name"] = cardName;
  doc["time"] = getLocalTimeString();
  doc["date"] = getLocalDateString();
  doc["read"] = false;

  String body;
  serializeJson(doc, body);
  int code = http.POST(body);
  String response = http.getString();
  http.end();

  if (code < 200 || code >= 300) {
    Serial.println("[Supabase] Insert access_logs gagal. HTTP " + String(code));
    Serial.println(response);
  }
}

void addSupabaseHeaders(HTTPClient &http) {
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_ANON_KEY));
  http.addHeader("Content-Type", "application/json");
}

// ================================================
// TIME
// ================================================
String getLocalTimeString() {
  struct tm timeinfo;
  if (getLocalTime(&timeinfo, 1000)) {
    char buf[10];
    strftime(buf, sizeof(buf), "%H:%M:%S", &timeinfo);
    return String(buf);
  }

  unsigned long s = millis() / 1000;
  char buf[10];
  sprintf(buf, "%02lu:%02lu:%02lu", (s / 3600) % 24, (s / 60) % 60, s % 60);
  return String(buf);
}

String getLocalDateString() {
  struct tm timeinfo;
  if (getLocalTime(&timeinfo, 1000)) {
    char buf[11];
    strftime(buf, sizeof(buf), "%Y-%m-%d", &timeinfo);
    return String(buf);
  }
  return "1970-01-01";
}

String getIsoNow() {
  struct tm timeinfo;
  if (getLocalTime(&timeinfo, 1000)) {
    char buf[26];
    strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%S+07:00", &timeinfo);
    return String(buf);
  }
  return "1970-01-01T00:00:00+07:00";
}

// ================================================
// BUZZER
// ================================================
void buzzerOK() {
  digitalWrite(BUZZER_PIN, HIGH);
  delay(150);
  digitalWrite(BUZZER_PIN, LOW);
  delay(100);
}

void buzzerError() {
  for (int i = 0; i < 3; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(500);
    digitalWrite(BUZZER_PIN, LOW);
    delay(200);
  }
}

void denyAccess() {
  for (int i = 0; i < 3; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(100);
    digitalWrite(BUZZER_PIN, LOW);
    delay(100);
  }
}
