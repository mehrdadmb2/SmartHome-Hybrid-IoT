/*
 * SmartHome-Hybrid-IoT - Arduino Uno (دربازکن RFID + پل UART)
 * با ESP32 معمولی (هاب) روی 192.168.1.119 ارتباط سریال دارد.
 */

#include <SPI.h>
#include <MFRC522.h>
#include <SoftwareSerial.h>

#define SS_PIN     10
#define RST_PIN    9
#define RELAY_PIN  8

MFRC522 mfrc522(SS_PIN, RST_PIN);
SoftwareSerial toESP(2, 3);  // RX=2, TX=3

const char* allowedUIDs[] = {
  "62768D4C","C28A834C","828C8D4C","42E18C4C",
  "2CB0B12B","8AB3F0AF","03BAE5F1","63C602F2",
  "8AB825B0","7CB5A62A","1A08F2AF","5C56A42A",
  "6BFAE0EB","8DCC8562","9323EDF1"
};
const int nTags = sizeof(allowedUIDs) / sizeof(allowedUIDs[0]);

void setup() {
  Serial.begin(9600);
  toESP.begin(9600);
  SPI.begin();
  mfrc522.PCD_Init();
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);
}

void loop() {
  // 1. فرمان از هاب (باز کردن درب)
  if (toESP.available()) {
    String cmd = toESP.readStringUntil('\n');
    cmd.trim();
    if (cmd == "OPEN_DOOR") {
      digitalWrite(RELAY_PIN, HIGH);
      delay(2000);
      digitalWrite(RELAY_PIN, LOW);
      toESP.println("DOOR_OPENED_OK");
    }
  }

  // 2. تشخیص کارت RFID
  if (mfrc522.PICC_IsNewCardPresent() && mfrc522.PICC_ReadCardSerial()) {
    String uid = "";
    for (byte i = 0; i < mfrc522.uid.size; i++) {
      if (mfrc522.uid.uidByte[i] < 0x10) uid += "0";
      uid += String(mfrc522.uid.uidByte[i], HEX);
    }
    uid.toUpperCase();

    bool ok = false;
    for (int i = 0; i < nTags; i++) {
      if (uid == allowedUIDs[i]) { ok = true; break; }
    }

    if (ok) {
      digitalWrite(RELAY_PIN, HIGH);
      delay(2000);
      digitalWrite(RELAY_PIN, LOW);
      // ارسال رویداد به هاب
      toESP.print("DOOR_OPEN:");
      toESP.println(uid);
      Serial.print("Door opened by: ");
      Serial.println(uid);
    } else {
      Serial.print("Access denied: ");
      Serial.println(uid);
    }
    mfrc522.PICC_HaltA();
  }
}
