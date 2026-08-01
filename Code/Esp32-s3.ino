/*
 * SmartHome-Hybrid-IoT - ESP32-S3 Sensor Node (سلف‌تست)
 * آی‌پی ثابت: 192.168.1.115
 * 
 * پین‌ها:
 *  I2C OLED 128x32: SDA=5, SCL=4
 *  DHT22: 6
 * 
 * هر ۵ ثانیه دما و رطوبت را خوانده و در صورت تغییر محسوس، به هاب (192.168.1.119) ارسال می‌کند.
 * نمایش روی OLED به‌صورت چرخشی: دما/رطوبت و آی‌پی.
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>
#include <Adafruit_SSD1306.h>
#include <ArduinoJson.h>

// ---------- تنظیمات شبکه ----------
const char* ssid     = ">><<>><<";
const char* password = "MEHRdAd1380";
const char* hubIP    = "192.168.1.119";   // آی‌پی هاب

// IP ثابت (در صورت نیاز)
IPAddress localIP(192, 168, 1, 115);
IPAddress gateway(192, 168, 1, 1);
IPAddress subnet(255, 255, 255, 0);

// ---------- پین‌ها ----------
#define DHTPIN 6
DHT dht(DHTPIN, DHT22);

Adafruit_SSD1306 display(128, 32, &Wire, -1);

// متغیرهای کنترل
float lastTemp = -99, lastHum = -99;
unsigned long lastSend = 0;

// صفحات نمایش OLED
int oledPage = 0;
unsigned long lastPageSwitch = 0;

// ---------- سلف‌تست ----------
void selfTest() {
  Serial.println("\n========== S3 SELF TEST START ==========");
  
  // 1. I2C و OLED
  Serial.print("[1/3] OLED init... ");
  Wire.begin(5, 4);                // SDA=5, SCL=4
  if (display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("OK (0x3C)");
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0,0);
    display.println("S3 Node Boot");
    display.display();
    delay(1000);
  } else {
    Serial.println("FAILED");
  }

  // 2. WiFi
  Serial.print("[2/3] WiFi connect... ");
  WiFi.config(localIP, gateway, subnet);
  WiFi.begin(ssid, password);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(" OK");
    Serial.print("    IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println(" FAILED");
  }

  // 3. DHT22
  Serial.print("[3/3] DHT22 test read... ");
  dht.begin();
  delay(2000);
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  if (!isnan(t) && !isnan(h)) {
    Serial.printf("OK (%.1f°C, %.1f%%)\n", t, h);
    updateOLED(t, h);  // نمایش اولیه
  } else {
    Serial.println("FAILED (check wiring)");
  }

  Serial.println("========== SELF TEST COMPLETE ==========\n");
}

// ---------- راه‌اندازی ----------
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\nESP32-S3 Sensor Node starting...");

  // انجام تست‌ها
  selfTest();

  Serial.println("Sensor node ready.");
}

// ---------- حلقه اصلی ----------
void loop() {
  static unsigned long lastRead = 0;
  if (millis() - lastRead >= 5000) {
    lastRead = millis();
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    if (!isnan(t) && !isnan(h)) {
      updateOLED(t, h);

      // ارسال به هاب در صورت تغییر قابل توجه و حداقل ۱۰ ثانیه فاصله
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

// ---------- ارسال داده به هاب ----------
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
  int code = http.POST(body);
  if (code > 0) {
    Serial.printf("Data sent (HTTP %d)\n", code);
  }
  http.end();
}

// ---------- بروزرسانی OLED ----------
void updateOLED(float t, float h) {
  // تغییر صفحه هر ۴ ثانیه
  if (millis() - lastPageSwitch > 4000) {
    lastPageSwitch = millis();
    oledPage = (oledPage + 1) % 2;
  }

  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0,0);

  if (oledPage == 0) {
    // صفحه اول: دما و رطوبت
    display.printf("Temp: %.1f C\n", t);
    display.printf("Hum : %.1f %%", h);
  } else {
    // صفحه دوم: آی‌پی
    display.print("IP: ");
    display.print(WiFi.localIP());
    // در صورت تمایل می‌توان RSSI یا زمان ارسال را هم نشان داد
  }
  display.display();
}
