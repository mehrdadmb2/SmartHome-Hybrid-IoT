/*
 * SmartHome-Hybrid-IoT - ESP32-S3 Sensor Node (فقط وب‌سرور)
 * آی‌پی: 192.168.1.115 (ثابت)
 * پین‌ها:
 *  I2C OLED 128x32: SDA=5, SCL=4
 *  DHT22: 6
 *
 * یک وب‌سرور ساده در پورت 80 اجرا می‌کند که آخرین دما و رطوبت را از طریق /api/status
 * به هاب (ESP32 Hub) ارائه می‌دهد. هاب به‌طور مرتب این آدرس را پرس‌وجو می‌کند.
 */

#include <WiFi.h>
#include <WebServer.h>
#include <DHT.h>
#include <Adafruit_SSD1306.h>
#include <ArduinoJson.h>

// ---------- تنظیمات شبکه ----------
const char* ssid = ">><<>><<";
const char* password = "MEHRdAd1380";
IPAddress localIP(192, 168, 1, 115);
IPAddress gateway(192, 168, 1, 1);
IPAddress subnet(255, 255, 255, 0);

// ---------- پین‌ها ----------
#define DHTPIN 6
DHT dht(DHTPIN, DHT22);

Adafruit_SSD1306 display(128, 32, &Wire, -1);
WebServer server(80);

// آخرین مقادیر خوانده‌شده
float currentTemp = 0.0, currentHum = 0.0;
unsigned long lastRead = 0;

void setup() {
  Serial.begin(115200);
  Wire.begin(5, 4);                // SDA=5, SCL=4
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("OLED fail");
    while (1) delay(1000);
  }
  display.clearDisplay();
  display.setCursor(0,0);
  display.println("WiFi...");
  display.display();

  // WiFi با IP ثابت
  WiFi.config(localIP, gateway, subnet);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) delay(500);
  Serial.println("WiFi OK");
  display.clearDisplay();
  display.display();

  dht.begin();

  // endpoint برای هاب
  server.on("/api/status", HTTP_GET, []() {
    StaticJsonDocument<128> doc;
    doc["temp"] = currentTemp;
    doc["humidity"] = currentHum;
    String body;
    serializeJson(doc, body);
    server.send(200, "application/json", body);
  });

  server.begin();
  Serial.println("HTTP server ready");
}

void loop() {
  server.handleClient();

  // هر ۵ ثانیه سنسور را بخوان
  if (millis() - lastRead >= 5000) {
    lastRead = millis();
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    if (!isnan(t) && !isnan(h)) {
      currentTemp = t;
      currentHum = h;
      updateOLED(t, h);
    }
  }
}

void updateOLED(float t, float h) {
  static int page = 0;
  static unsigned long lastSwitch = 0;
  if (millis() - lastSwitch > 4000) {
    lastSwitch = millis();
    page = (page + 1) % 2;
  }

  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0,0);

  if (page == 0) {
    display.printf("T:%.1fC H:%.1f%%", t, h);
  } else {
    display.print("IP: ");
    display.print(WiFi.localIP());
  }
  display.display();
}
