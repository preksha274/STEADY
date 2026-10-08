/*
  =============================================================================
  STEADY BAND - ESP32 Tremor Detection & Haptic Cueing Firmware
  =============================================================================
  Hardware:
    - ESP32 Development Board
    - MPU6050 6-Axis IMU (I2C: SDA=GPIO 21, SCL=GPIO 22, AD0=GND -> 0x68)
    - ERM/LRA Vibration Motor Driver (GPIO 27) via PWM (LEDC)
    - Tactile Pushbutton (GPIO 14) with internal pull-up (active LOW)

  Serial Protocol (460800 baud):
    Boot banner:
      H,<firmware_version>,<sample_rate_hz>,<accel_range_g>
    Streaming sample (every 10 ms / 100 Hz):
      S,<ms>,<ax_g>,<ay_g>,<az_g>,<hp_g>,<rms_g>,<freq_hz>,<tremor 0/1>,<state>,<drops>
      state: 0 = normal, 1 = motor vibrating, 2 = cooldown (not assessed),
             3 = button test, 4 = sensor error (readings paused)
    Serial Commands (ASCII newline-terminated):
      V,<duration_ms>,<intensity_0_255>,<pulse_ms>  -> start vibration pattern (capped at 5000 ms)
      X                                              -> cancel vibration immediately
      C,<rms_g>,<fmin>,<fmax>,<sustained_ms>         -> update tremor detection thresholds live
      P                                              -> ping / uptime check
    Acks:
      A,<command>  (e.g., A,V  A,X  A,C  A,P,<uptime_ms>)

  Notes:
    - Never blocks the 100 Hz sampling loop (no delay, non-blocking serial & I2C).
    - Writes serial telemetry only if Serial.availableForWrite() is sufficient;
      otherwise increments drops counter.
    - If MPU6050 read fails, does not stream fake defaults; increments failure
      counter and enters state 4 (sensor error).
    - Resets DSP window when exiting vibration or cooldown.
    - Restores zero-crossing hysteresis (0.015 g) to prevent noise inflation.
  =============================================================================
*/

#include <Arduino.h>
#include <Wire.h>
#include <math.h>
#include <esp_arduino_version.h>

// -----------------------------------------------------------------------------
// Version & Configuration Constants
// -----------------------------------------------------------------------------
#define FW_VERSION        "1.1.0"
#define SAMPLE_RATE_HZ    100
#define SAMPLE_INTERVAL_US (1000000UL / SAMPLE_RATE_HZ) // 10,000 µs (10 ms)
#define ACCEL_RANGE_G     2.0f
#define SERIAL_BAUD       460800

// Hardware Pin Definitions
#define PIN_MOTOR         27
#define PIN_BUTTON        14
#define I2C_SDA           21
#define I2C_SCL           22
#define MPU6050_ADDR      0x68

// PWM (LEDC) Configuration
#define PWM_FREQ_HZ       5000
#define PWM_RESOLUTION    8     // 8-bit (0 - 255)
#define PWM_CHANNEL       0

// Motor Safety Limits & Cooldown
#define MAX_VIB_DURATION_MS 5000UL
#define DEFAULT_COOLDOWN_MS  600UL

// MPU6050 Registers
#define MPU6050_PWR_MGMT_1   0x6B
#define MPU6050_ACCEL_CONFIG 0x1C
#define MPU6050_ACCEL_XOUT_H 0x3B

// Zero-crossing hysteresis to prevent sensor noise from corrupting frequency estimation
#define ZERO_CROSS_HYSTERESIS_G 0.015f

// -----------------------------------------------------------------------------
// LEDC Compatibility Macros (ESP32 Core 2.x vs Core 3.x)
// -----------------------------------------------------------------------------
#if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
  #define INIT_PWM() ledcAttach(PIN_MOTOR, PWM_FREQ_HZ, PWM_RESOLUTION)
  #define SET_PWM(duty) ledcWrite(PIN_MOTOR, (duty))
#else
  #define INIT_PWM() do { \
    ledcSetup(PWM_CHANNEL, PWM_FREQ_HZ, PWM_RESOLUTION); \
    ledcAttachPin(PIN_MOTOR, PWM_CHANNEL); \
  } while(0)
  #define SET_PWM(duty) ledcWrite(PWM_CHANNEL, (duty))
#endif

// -----------------------------------------------------------------------------
// State Machine & Tremor Parameters
// -----------------------------------------------------------------------------
enum SystemState {
  STATE_NORMAL       = 0,
  STATE_VIBRATING    = 1,
  STATE_COOLDOWN     = 2,
  STATE_BUTTON_TEST  = 3,
  STATE_SENSOR_ERROR = 4
};

struct ThresholdConfig {
  float    rms_threshold_g;  // RMS threshold for tremor detection (default: 0.08 g)
  float    fmin_hz;          // Min frequency band (default: 3.0 Hz)
  float    fmax_hz;          // Max frequency band (default: 8.0 Hz)
  uint32_t sustained_ms;     // Milliseconds of sustained tremor motion (default: 1500 ms)
};

// Global Thresholds
static ThresholdConfig thresholds = {
  0.080f,  // rms_threshold_g
  3.000f,  // fmin_hz
  8.000f,  // fmax_hz
  1500     // sustained_ms (1.5 seconds)
};

// Vibration Controller State
static struct {
  bool          active;
  uint32_t      startTime;
  uint32_t      durationMs;
  uint8_t       intensity;
  uint32_t      pulseMs;
  uint32_t      lastPulseToggle;
  bool          pulseHigh;
  uint32_t      cooldownEndMs;
  bool          wasInCooldown;
} motorState = {false, 0, 0, 0, 0, 0, false, 0, false};

// Telemetry & Diagnostic Counters
static uint32_t droppedPackets = 0;
static uint32_t sensorErrorCount = 0;
static uint32_t lastSampleMicros = 0;

// Button Debounce State
static struct {
  bool lastReading;
  bool pressed;
  uint32_t lastDebounceTime;
} btnState = {HIGH, false, 0};

// -----------------------------------------------------------------------------
// Real-Time Tremor DSP Buffers & State
// -----------------------------------------------------------------------------
static const float HPF_ALPHA = 0.93f;
static float lpGravity = 1.0f;

// Sliding window buffer for RMS and Frequency (100 samples = 1.0 s)
#define WINDOW_SIZE 100
static float hpBuffer[WINDOW_SIZE];
static int   bufIdx = 0;
static int   bufCount = 0;
static float runningSumSq = 0.0f;

// Sustained tremor duration accumulator
static uint32_t sustainedTremorMs = 0;
static bool     lastTremorDetected = false;

// Serial Command Buffer
#define CMD_BUFFER_SIZE 96
static char cmdBuffer[CMD_BUFFER_SIZE];
static uint8_t cmdBufferPos = 0;

// Output formatted line buffer
static char txBuffer[128];

// -----------------------------------------------------------------------------
// Forward Declarations
// -----------------------------------------------------------------------------
void initMPU6050();
bool readMPU6050(float &ax, float &ay, float &az);
void resetTremorDSP();
void processTremorDSP(float ax, float ay, float az, float &hp, float &rms, float &freq, bool &tremor, int currentState);
void updateMotorStateMachine();
void startVibration(uint32_t durationMs, uint8_t intensity, uint32_t pulseMs);
void cancelVibration();
void handleSerialCommands();
void parseCommandLine(const char* line);
void updateButtonState();

// -----------------------------------------------------------------------------
// Setup
// -----------------------------------------------------------------------------
void setup() {
  Serial.begin(SERIAL_BAUD);
  delay(50);

  pinMode(PIN_BUTTON, INPUT_PULLUP);

  INIT_PWM();
  SET_PWM(0);

  Wire.begin(I2C_SDA, I2C_SCL, 400000);
  initMPU6050();

  resetTremorDSP();

  // Print boot banner: H,<firmware_version>,<sample_rate_hz>,<accel_range_g>
  Serial.printf("H,%s,%d,%.1f\n", FW_VERSION, SAMPLE_RATE_HZ, ACCEL_RANGE_G);
  Serial.flush();

  lastSampleMicros = micros();
}

// -----------------------------------------------------------------------------
// Main Loop (Strict non-blocking 100 Hz cadence)
// -----------------------------------------------------------------------------
void loop() {
  // 1. Process any incoming serial commands non-blockingly
  handleSerialCommands();

  // 2. Poll button state (debounced & instant cancel trigger)
  updateButtonState();

  // 3. Update Motor PWM state machine (pulses, durations, cooldowns)
  updateMotorStateMachine();

  // 4. Check 100 Hz sampling timer (every 10,000 µs)
  uint32_t currentMicros = micros();
  if ((uint32_t)(currentMicros - lastSampleMicros) >= SAMPLE_INTERVAL_US) {
    lastSampleMicros += SAMPLE_INTERVAL_US;

    if ((uint32_t)(currentMicros - lastSampleMicros) > SAMPLE_INTERVAL_US * 2) {
      lastSampleMicros = currentMicros;
    }

    uint32_t nowMs = millis();

    // Determine current system state
    int currentState = STATE_NORMAL;
    if (btnState.pressed) {
      currentState = STATE_BUTTON_TEST;
    } else if (motorState.active) {
      currentState = STATE_VIBRATING;
    } else if (nowMs < motorState.cooldownEndMs) {
      currentState = STATE_COOLDOWN;
      motorState.wasInCooldown = true;
    } else if (motorState.wasInCooldown) {
      // Transitioning out of cooldown back to normal: reset DSP window!
      motorState.wasInCooldown = false;
      resetTremorDSP();
      currentState = STATE_NORMAL;
    }

    // Read MPU6050 Accelerometer
    float ax = 0.0f, ay = 0.0f, az = 0.0f;
    bool readOk = readMPU6050(ax, ay, az);

    float hp = 0.0f, rms = 0.0f, freq = 0.0f;
    bool isTremor = false;

    if (!readOk) {
      // Sensor read failure: do NOT stream default values!
      sensorErrorCount++;
      currentState = STATE_SENSOR_ERROR;
      // Reset DSP state to prevent stale data carry-over
      sustainedTremorMs = 0;
      isTremor = false;
    } else {
      // Compute DSP features (hp, rms, freq, tremor flag)
      processTremorDSP(ax, ay, az, hp, rms, freq, isTremor, currentState);
    }

    // Format Telemetry Line: S,<ms>,<ax>,<ay>,<az>,<hp>,<rms>,<freq>,<tremor>,<state>,<drops>
    int len = snprintf(
      txBuffer,
      sizeof(txBuffer),
      "S,%lu,%.3f,%.3f,%.3f,%.3f,%.3f,%.3f,%d,%d,%lu\n",
      (unsigned long)nowMs,
      ax, ay, az,
      hp, rms, freq,
      isTremor ? 1 : 0,
      currentState,
      (unsigned long)droppedPackets
    );

    // Write ONLY if TX buffer space is available; otherwise drop packet
    if (len > 0 && Serial.availableForWrite() >= len) {
      Serial.write((const uint8_t*)txBuffer, len);
    } else {
      droppedPackets++;
    }
  }
}

// -----------------------------------------------------------------------------
// MPU6050 I2C Routines (Non-blocking / Fast)
// -----------------------------------------------------------------------------
void initMPU6050() {
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(MPU6050_PWR_MGMT_1);
  Wire.write(0x00);
  Wire.endTransmission(true);

  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(MPU6050_ACCEL_CONFIG);
  Wire.write(0x00); // ±2g range
  Wire.endTransmission(true);
}

bool readMPU6050(float &ax, float &ay, float &az) {
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(MPU6050_ACCEL_XOUT_H);
  if (Wire.endTransmission(false) != 0) return false;

  uint8_t bytesReceived = Wire.requestFrom((uint16_t)MPU6050_ADDR, (uint8_t)6, (uint8_t)true);
  if (bytesReceived == 6) {
    int16_t rawX = (Wire.read() << 8) | Wire.read();
    int16_t rawY = (Wire.read() << 8) | Wire.read();
    int16_t rawZ = (Wire.read() << 8) | Wire.read();

    const float SCALE = 1.0f / 16384.0f;
    ax = rawX * SCALE;
    ay = rawY * SCALE;
    az = rawZ * SCALE;
    return true;
  }
  return false;
}

void resetTremorDSP() {
  for (int i = 0; i < WINDOW_SIZE; i++) hpBuffer[i] = 0.0f;
  bufIdx = 0;
  bufCount = 0;
  runningSumSq = 0.0f;
  sustainedTremorMs = 0;
  lastTremorDetected = false;
  lpGravity = 1.0f;
}

// -----------------------------------------------------------------------------
// Tremor DSP: High-Pass, RMS, Hysteresis Zero-Crossings & Sustained Motion
// -----------------------------------------------------------------------------
void processTremorDSP(float ax, float ay, float az, float &hp, float &rms, float &freq, bool &tremor, int currentState) {
  float aMag = sqrtf(ax * ax + ay * ay + az * az);

  // 1-pole high-pass filter
  lpGravity = (1.0f - HPF_ALPHA) * aMag + HPF_ALPHA * lpGravity;
  hp = aMag - lpGravity;

  // Analysis paused during vibration / cooldown / button test / sensor error
  if (currentState != STATE_NORMAL) {
    sustainedTremorMs = 0;
    lastTremorDetected = false;
    rms = 0.0f;
    freq = 0.0f;
    tremor = false;
    return;
  }

  // Sliding window RMS
  float oldVal = hpBuffer[bufIdx];
  runningSumSq -= (oldVal * oldVal);
  if (runningSumSq < 0.0f) runningSumSq = 0.0f;

  hpBuffer[bufIdx] = hp;
  runningSumSq += (hp * hp);

  bufIdx = (bufIdx + 1) % WINDOW_SIZE;
  if (bufCount < WINDOW_SIZE) bufCount++;

  rms = sqrtf(runningSumSq / (float)bufCount);

  // Frequency estimation via zero-crossing count with hysteresis (±0.015 g)
  int zeroCrossings = 0;
  int lastSign = 0; // -1 for below -0.015g, +1 for above +0.015g
  for (int i = 0; i < bufCount; i++) {
    int idx = (bufIdx - 1 - i + WINDOW_SIZE) % WINDOW_SIZE;
    float val = hpBuffer[idx];
    if (val > ZERO_CROSS_HYSTERESIS_G) {
      if (lastSign == -1) zeroCrossings++;
      lastSign = 1;
    } else if (val < -ZERO_CROSS_HYSTERESIS_G) {
      if (lastSign == 1) zeroCrossings++;
      lastSign = -1;
    }
  }

  float bufferDurationSec = (float)bufCount / (float)SAMPLE_RATE_HZ;
  if (bufferDurationSec > 0.1f && zeroCrossings > 1) {
    freq = (zeroCrossings / 2.0f) / bufferDurationSec;
  } else {
    freq = 0.0f;
  }

  // Check instantaneous candidate in 3-8 Hz band above RMS threshold
  bool candidate = (rms >= thresholds.rms_threshold_g) &&
                   (freq >= thresholds.fmin_hz) &&
                   (freq <= thresholds.fmax_hz);

  // Accumulate sustained tremor duration in milliseconds (10 ms step)
  if (candidate) {
    sustainedTremorMs += 10;
  } else {
    if (sustainedTremorMs >= 10) sustainedTremorMs -= 10;
  }

  // Tremor confirmed if sustained tremor exceeds configured duration (default 1500 ms)
  tremor = (sustainedTremorMs >= thresholds.sustained_ms);
  lastTremorDetected = tremor;
}

// -----------------------------------------------------------------------------
// Vibration Motor Pattern Controller & Cooldown
// -----------------------------------------------------------------------------
void startVibration(uint32_t durationMs, uint8_t intensity, uint32_t pulseMs) {
  if (durationMs > MAX_VIB_DURATION_MS || durationMs == 0) {
    durationMs = MAX_VIB_DURATION_MS;
  }

  motorState.active = true;
  motorState.startTime = millis();
  motorState.durationMs = durationMs;
  motorState.intensity = intensity;
  motorState.pulseMs = pulseMs;
  motorState.lastPulseToggle = millis();
  motorState.pulseHigh = true;

  SET_PWM(intensity);
}

void cancelVibration() {
  motorState.active = false;
  SET_PWM(0);
  motorState.cooldownEndMs = millis() + DEFAULT_COOLDOWN_MS;
  motorState.wasInCooldown = true;
}

void updateMotorStateMachine() {
  if (!motorState.active) return;

  uint32_t now = millis();
  if ((uint32_t)(now - motorState.startTime) >= motorState.durationMs) {
    cancelVibration();
    return;
  }

  if (motorState.pulseMs > 0) {
    if ((uint32_t)(now - motorState.lastPulseToggle) >= motorState.pulseMs) {
      motorState.lastPulseToggle = now;
      motorState.pulseHigh = !motorState.pulseHigh;
      SET_PWM(motorState.pulseHigh ? motorState.intensity : 0);
    }
  } else {
    SET_PWM(motorState.intensity);
  }
}

// -----------------------------------------------------------------------------
// Button Debounce & Immediate Cancel Logic
// -----------------------------------------------------------------------------
void updateButtonState() {
  bool rawReading = (digitalRead(PIN_BUTTON) == LOW);

  if (rawReading != btnState.lastReading) {
    btnState.lastDebounceTime = millis();
    btnState.lastReading = rawReading;
  }

  if ((millis() - btnState.lastDebounceTime) > 30) {
    if (rawReading != btnState.pressed) {
      btnState.pressed = rawReading;
      if (btnState.pressed && motorState.active) {
        cancelVibration();
      }
    }
  }
}

// -----------------------------------------------------------------------------
// Non-Blocking Serial Command Parser
// -----------------------------------------------------------------------------
void handleSerialCommands() {
  while (Serial.available() > 0) {
    char c = (char)Serial.read();
    if (c == '\r') continue;

    if (c == '\n') {
      cmdBuffer[cmdBufferPos] = '\0';
      if (cmdBufferPos > 0) {
        parseCommandLine(cmdBuffer);
      }
      cmdBufferPos = 0;
    } else {
      if (cmdBufferPos < CMD_BUFFER_SIZE - 1) {
        cmdBuffer[cmdBufferPos++] = c;
      }
    }
  }
}

void parseCommandLine(const char* line) {
  if (line == nullptr || line[0] == '\0') return;
  char cmdType = line[0];

  switch (cmdType) {
    // -------------------------------------------------------------------------
    // V,<duration_ms>,<intensity_0_255>,<pulse_ms>
    // -------------------------------------------------------------------------
    case 'V':
    case 'v': {
      uint32_t duration = 1500;
      int intensity = 200;
      uint32_t pulse = 0;
      int parsed = sscanf(line, "%*c,%lu,%d,%lu", &duration, &intensity, &pulse);
      if (parsed < 1) duration = 1500;
      if (parsed < 2) intensity = 200;
      if (parsed < 3) pulse = 0;
      intensity = constrain(intensity, 0, 255);
      startVibration(duration, (uint8_t)intensity, pulse);
      Serial.println("A,V");
      break;
    }

    // -------------------------------------------------------------------------
    // X -> cancel vibration immediately
    // -------------------------------------------------------------------------
    case 'X':
    case 'x': {
      cancelVibration();
      Serial.println("A,X");
      break;
    }

    // -------------------------------------------------------------------------
    // C,<rms_g>,<fmin>,<fmax>,<sustained_ms> -> update thresholds live
    // -------------------------------------------------------------------------
    case 'C':
    case 'c': {
      float newRms = thresholds.rms_threshold_g;
      float newFmin = thresholds.fmin_hz;
      float newFmax = thresholds.fmax_hz;
      uint32_t newSustained = thresholds.sustained_ms;
      int parsed = sscanf(line, "%*c,%f,%f,%f,%lu", &newRms, &newFmin, &newFmax, &newSustained);
      if (parsed >= 1 && newRms > 0.001f) thresholds.rms_threshold_g = newRms;
      if (parsed >= 2 && newFmin > 0.5f)   thresholds.fmin_hz = newFmin;
      if (parsed >= 3 && newFmax > newFmin) thresholds.fmax_hz = newFmax;
      if (parsed >= 4 && newSustained >= 100) thresholds.sustained_ms = newSustained;
      Serial.println("A,C");
      break;
    }

    // -------------------------------------------------------------------------
    // P -> Ping / Uptime
    // -------------------------------------------------------------------------
    case 'P':
    case 'p': {
      Serial.printf("A,P,%lu\n", (unsigned long)millis());
      break;
    }

    default:
      break;
  }
}
