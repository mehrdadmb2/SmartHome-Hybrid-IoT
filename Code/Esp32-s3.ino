/*
 * SmartHome-Hybrid-IoT - ESP32-S3 (سنسور)
 * آی‌پی ثابت: 192.168.1.115 (توسط روتر رزرو شود)
 * دما و رطوبت را می‌خواند و به هاب (192.168.1.119) می‌فرستد.
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>
#include <Adafruit_SSD1306.h>
#include <ArduinoJson.h>

const char* ssid = ">><<>><<";
const char* password = "MEHRdAd1380";
const char* hubIP = "192.168.1.119";   // آی‌پی هاب

#define DHTPIN 6
DHT dht(DHTPIN, DHT22);

Adafruit_SSD1306 display(128, 32, &Wire, -1);

float lastTemp = -99, lastHum = -99;
unsigned long lastSend = 0;

void setup() {
  Serial.begin(115200);
  Wire.begin(5, 4);   // SDA=5, SCL=4
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("OLED fail");
    while (1) delay(1000);
  }
  display.clearDisplay();
  display.setCursor(0,0);
  display.println("WiFi...");
  display.display();

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) delay(500);
  Serial.println("WiFi OK");
  dht.begin();
}

void loop() {
  static unsigned long lastRead = 0;
  if (millis() - lastRead >= 5000) {
    lastRead = millis();
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    if (!isnan(t) && !isnan(h)) {
      // آپدیت OLED
      display.clearDisplay();
      display.setCursor(0,0);
      display.printf("T:%.1fC H:%.1f%%", t, h);
      display.setCursor(0,15);
      display.print(WiFi.localIP());
      display.display();

      // ارسال به هاب در صورت تغییر (با فاصله حداقل ۱۰ ثانیه)
      if (abs(t - lastTemp) >= 0.2 || abs(h - lastHum) >= 1.0) {
        if (millis() - lastSend >= 10000) {
          sendData(t, h);
          lastTemp = t;
          lastHum = h;
          lastSend = millis();
        }
      }
    }
  }
}

void sendData(float t, float h) {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  http.begin("http://" + String(hubIP) + "/api/sensor");
  http.addHeader("Content-Type", "application/json");
  StaticJsonDocument<200> doc;
  doc["board"] = "esp32_s3";
  doc["temp"] = t;
  doc["humidity"] = h;
  String body;
  serializeJson(doc, body);
  http.POST(body);
  http.end();
}
