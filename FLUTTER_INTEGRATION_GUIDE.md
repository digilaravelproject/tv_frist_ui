# Flutter Integration Guide — Hotel TV UI

## 1. Project Overview & Architecture

This is a **Hotel In-Room TV interface** that displays:

- **Date / Time** (local system clock)
- **Guest greeting** (from PMS data)
- **Weather** (temperature, AQI, 7-day forecast)
- **Flight board** (CSMIA departures/arrivals)
- **TV controls** (Launch apps, HDMI, IPTV)
- **Language switcher** (i18n for RTL languages)
- **Image gallery / slideshow**
- **Hotel info, amenities, travel, city guide** (static HTML pages)

The original app relied on a PHP backend hosted on a remote server. **PHP has been completely removed.** The web app now runs **100% offline** served by a local HTTP server inside your Flutter app's WebView on Android TV.

### Data Flow

```
┌──────────────────────────────────────────────────────────┐
│                    Flutter App (Android TV)               │
│                                                          │
│  ┌──────────────────────────────────────────────┐       │
│  │         Local Virtual HTTP Server              │       │
│  │  (e.g., Nginx on device or Flutter HTTP server) │       │
│  │  Serves: HTML, CSS, JS, JSON, Images, Fonts    │       │
│  └──────────────┬───────────────────────────────┘       │
│                 │ loads via WebView                       │
│  ┌──────────────▼───────────────────────────────┐       │
│  │   WebView (JavaScriptChannel: FlutterBridge)   │       │
│  │                                                │       │
│  │  JS calls: FlutterBridge.postMessage(...)      │       │
│  │  Dart responds: eval JS callback               │       │
│  └──────────────────────────────────────────────┘       │
└──────────────────────────────────────────────────────────┘
```

### PHP Removal Summary
- All `fetch()` calls that targeted `https://chhaurasiyaa.github.io/*` URLs have been replaced with local relative paths.
- All `update_cache.php` and data-writing PHP endpoints have been replaced with **Flutter bridge calls** (`syncWeather()`, `syncFlights()`).
- The `js/bridge.js` file defines the full API contract between JS ↔ Dart.

---

## 2. Directory Structure

Serve this entire directory tree from a local HTTP server at `http://localhost:<PORT>`:

```
_public_html/
├── FLUTTER_INTEGRATION_GUIDE.md   ◀── You are here
├── index.html                     ◀── Home page (launcher)
├── settings.html                  ◀── Admin PIN login
├── advanced.html                  ◀── Admin settings panel
├── languages.html                 ◀── Language selector

├── js/
│   ├── bridge.js                  ◀── Flutter Bridge interface (REQUIRED)
│   ├── home.js                    ◀── Home page logic
│   ├── weather.js                 ◀── Offline-first weather module

├── css/
│   ├── home.css
│   ├── flights.css

├── images/
│   ├── main.jpg                   ◀── Background image
│   ├── icons/
│   │   ├── apps.png
│   │   ├── livetv.png
│   │   ├── languages.png
│   │   ├── hotelinfo.png
│   │   ├── amenities.png
│   │   ├── travel.png
│   │   ├── flights.png
│   │   ├── ourcity.png
│   │   ├── weather.png
│   │   ├── settings.png
│   │   ├── sunny.png
│   │   ├── cloudy.png
│   │   ├── rainy.png
│   │   └── storm.png

├── fonts/                         ◀── Custom fonts (if any)

├── admin/
│   ├── devices/                   ◀── Per-device config JSONs
│   │   └── <serial>.json          ── Example: "ABC123.json"
│   ├── rooms/                     ◀── Per-room guest JSONs
│   │   └── <room_no>.json         ── Example: "101.json"
│   ├── languages/                 ◀── Language JSON files
│   │   ├── english.json
│   │   ├── arabic.json
│   │   ├── french.json
│   │   └── ...
│   └── languages.json             ◀── Available languages list

├── languages/                     ◀── Public language JSONs (copy of admin/languages/)
│   ├── english.json
│   ├── arabic.json
│   └── ...

├── weather/
│   ├── weather.html               ◀── Weather page
│   ├── weather_data.json          ◀── Weather data (sync target)
│   ├── css/
│   └── images/

├── flights/
│   ├── flights.html               ◀── Flight board page
│   ├── css/
│   │   └── flights.css
│   ├── js/
│   │   └── flightdata.js          ◀── Flight data module
│   ├── data_departures.json       ◀── Departures data (sync target)
│   ├── data_arrivals.json         ◀── Arrivals data (sync target)
│   ├── cities/                    ◀── City translation JSONs
│   ├── airlines/                  ◀── Airline translation JSONs
│   └── images/

├── hotel_info/                    ◀── Static hotel info pages
├── amenities/                     ◀── Amenities pages
├── travel/                        ◀── Travel pages
├── city/                          ◀── City guide pages
├── iptv/                          ◀── IPTV configuration
├── applications/                  ◀── Application pages
├── taj_resorts/                   ◀── Taj Resorts sub-pages

└── (No PHP files — all removed)
```

### What to Serve
| Resource | Where | Notes |
|----------|-------|-------|
| Static HTML/CSS/JS | All files from `_public_html/` | Serve as-is |
| JSON data files | `admin/rooms/*.json`, `admin/devices/*.json` | Need to exist before first use |
| Synced data | `weather/weather_data.json`, `flights/data_departures.json`, `flights/data_arrivals.json` | Flutter background sync writes these |

---

## 3. JS-to-Dart Bridge Definitions

### 3.1 Protocol

All JS-to-Dart communication uses a **`postMessage` + callback-ID pattern**:

**JavaScript → Dart:**
```js
window.FlutterBridge.postMessage(JSON.stringify({
    method: 'methodName',   // String method name
    args: [...],            // Array of arguments
    id: 123                 // Unique call ID
}));
```

**Dart → JavaScript (response):**
```js
window.flutterBridge._resolve(id, result);  // Success
window.flutterBridge._reject(id, error);    // Failure
```

All bridge functions return a JavaScript `Promise`. If Dart does not respond within **10 seconds**, the promise rejects with a timeout error.

### 3.2 Full Bridge API

---

#### **`identifyDevice(ip)`**
| Field | Value |
|-------|-------|
| **Purpose** | Identify the TV device via ADB to get serial, model, MAC |
| **Args** | `[ip: string]` — TV IP address (e.g. `"192.168.1.100"`) |
| **Response** | `{ success: boolean, serial: string, model: string, ip: string, mac: string, room?: string, error?: string }` |
| **Required** | ✅ Yes — Core provisioning |

---

#### **`saveDeviceConfig(config)`**
| Field | Value |
|-------|-------|
| **Purpose** | Save device configuration to persistent storage |
| **Args** | `[config: Object]` — Full device config object |
| **Response** | `{ success: boolean, error?: string }` |
| **Required** | ✅ Yes — Core provisioning |

---

#### **`saveRoomConfig(room, config)`**
| Field | Value |
|-------|-------|
| **Purpose** | Save room-to-device mapping + guest data |
| **Args** | `[room: string, config: Object]` — Room number + config |
| **Response** | `{ success: boolean, error?: string }` |
| **Required** | ✅ Yes — Room assignment |

---

#### **`getDeviceConfig(serial)`**
| Field | Value |
|-------|-------|
| **Purpose** | Retrieve saved device config by serial number |
| **Args** | `[serial: string]` — Device serial |
| **Response** | `{ deviceConfig: Object }` or `null` if not found |
| **Required** | ✅ Yes — Device restoration |

---

#### **`getRoomConfig(room)`**
| Field | Value |
|-------|-------|
| **Purpose** | Retrieve saved room config by room number |
| **Args** | `[room: string]` — Room number |
| **Response** | `{ roomConfig: Object }` or `null` if not found |
| **Required** | ✅ Yes — Guest data restoration |

---

#### **`launchApp(packageName)`**
| Field | Value |
|-------|-------|
| **Purpose** | Launch an Android TV app by package name |
| **Args** | `[packageName: string]` — e.g. `"com.netflix.ninja"` |
| **Response** | `{ success: boolean, error?: string }` |
| **Required** | ✅ Yes — Core TV control |

---

#### **`launchHdmi(model)`**
| Field | Value |
|-------|-------|
| **Purpose** | Switch to HDMI input by TV model identifier |
| **Args** | `[model: string]` — e.g. `"Worldtech_RT32HD"` |
| **Response** | `{ success: boolean, error?: string }` |
| **Required** | ✅ Yes — Core TV control |

---

#### **`getHdmiModels()`**
| Field | Value |
|-------|-------|
| **Purpose** | Get available HDMI models to display in settings |
| **Args** | `[]` — No arguments |
| **Response** | `{ models: { "Worldtech_RT32HD": "HDMI-1", ... } }` |
| **Required** | ✅ Yes — Settings page |

---

#### **`launchIptv(packageName, configPath)`**
| Field | Value |
|-------|-------|
| **Purpose** | Launch IPTV app with optional config file |
| **Args** | `[packageName: string, configPath?: string]` |
| **Response** | `{ success: boolean, error?: string }` |
| **Required** | ✅ Yes — Core TV control |

---

#### **`openSettings()`**
| Field | Value |
|-------|-------|
| **Purpose** | Launch Android System Settings |
| **Args** | `[]` — No arguments |
| **Response** | `{ success: boolean, error?: string }` |
| **Required** | ✅ Yes — Core TV control |

---

#### **`updatePmsGuest(guestData)`**
| Field | Value |
|-------|-------|
| **Purpose** | Receive updated guest data from PMS (room, name, check-in/out) |
| **Args** | `[guestData: Object]` — `{ room: string, guestName: string, checkIn: string, checkOut: string, ... }` |
| **Response** | `{ success: boolean, error?: string }` |
| **Required** | ✅ Yes — Guest greeting display |

---

#### **`syncWeather()`**
| Field | Value |
|-------|-------|
| **Purpose** | Tell Flutter to fetch fresh weather data from Open-Meteo API and write `weather/weather_data.json` |
| **Args** | `[]` — No arguments |
| **Response** | `{ success: boolean, data?: Object, error?: string }` |
| **Required** | ❌ Optional — Background sync |

---

#### **`syncFlights()`**
| Field | Value |
|-------|-------|
| **Purpose** | Tell Flutter to fetch fresh flight data from FlightRadar24 API and write `data_departures.json` / `data_arrivals.json` |
| **Args** | `[]` — No arguments |
| **Response** | `{ success: boolean, data?: Object, error?: string }` |
| **Required** | ❌ Optional — Background sync |

---

#### **`getPictureList(category)`**
| Field | Value |
|-------|-------|
| **Purpose** | Get list of image paths for a gallery category |
| **Args** | `[category: string]` — e.g. `"travel"`, `"hotel_info"` |
| **Response** | `Array<string>` — Array of image paths/URLs |
| **Required** | ❌ Optional — Gallery pages |

---

#### **`rotateImage(imagePath, degrees)`**
| Field | Value |
|-------|-------|
| **Purpose** | Rotate an image (for gallery interaction) |
| **Args** | `[imagePath: string, degrees: number]` — `90`, `180`, or `270` |
| **Response** | `{ success: boolean, rotatedPath?: string, error?: string }` |
| **Required** | ❌ Optional — Gallery interaction |

---

#### **`getSystemInfo()`**
| Field | Value |
|-------|-------|
| **Purpose** | Get TV system info (model, Android version, IP, MAC) |
| **Args** | `[]` — No arguments |
| **Response** | `{ model: string, androidVersion: string, ip: string, mac: string, ... }` |
| **Required** | ❌ Optional — Admin settings |

---

#### **`checkInternet()`**
| Field | Value |
|-------|-------|
| **Purpose** | Check if device has internet connectivity |
| **Args** | `[]` — No arguments |
| **Response** | `boolean` — `true` if online |
| **Required** | ❌ Optional — Status indicator |

---

#### **`hideLoading()`**
| Field | Value |
|-------|-------|
| **Purpose** | Hide native loading indicator (called when WebView page finishes loading) |
| **Args** | `[]` — No arguments |
| **Response** | No response expected (fire-and-forget) |
| **Required** | ❌ Optional — UX polish |

---

### 3.3 Legacy Backward Compatibility

The bridge maintains two legacy interfaces for pages that haven't been migrated yet:

#### `window.AndroidBridge` (Legacy TV app interface)
| Method | Maps to |
|--------|---------|
| `getPictureList(category)` | `flutterBridge.getPictureList(category)` |
| `rotateImage(imagePath, degrees)` | `flutterBridge.rotateImage(imagePath, degrees)` |
| `hideLoading()` | Same as above (fire-and-forget) |
| `setLanguage(file)` | Not in new bridge — notify if needed |

#### `window.Android` (Very old interface)
| Method | Behavior |
|--------|----------|
| `pictureListReady(jsonString)` | Dispatches a `CustomEvent('pictureListReady')` on `window` |
| `hideLoading()` | Delegates to `AndroidBridge.hideLoading()` |

---

## 4. Required vs. Optional Setup

### ✅ Required (App Will Not Work Without These)

These 12 functions are **strictly required** for the core Hotel TV experience:

| # | Function | Why |
|---|----------|-----|
| 1 | `launchApp` | Users press "Applications" or "Live TV" → app must launch Netflix, YouTube, etc. |
| 2 | `launchHdmi` | Users with HDMI source selection |
| 3 | `getHdmiModels` | Settings page needs to list available HDMI models |
| 4 | `launchIptv` | Users with IPTV source selection |
| 5 | `openSettings` | Shortcut to Android Settings |
| 6 | `identifyDevice` | First-time provisioning needs to discover serial/IP/MAC |
| 7 | `saveDeviceConfig` | Persist device-room mapping |
| 8 | `saveRoomConfig` | Persist room number + guest association |
| 9 | `getDeviceConfig` | Restore state on app restart |
| 10 | `getRoomConfig` | Restore room/guest state on app restart |
| 11 | `updatePmsGuest` | Guest name display on home screen |
| 12 | _Local HTTP server_ | Must serve all files at `http://localhost:<PORT>/` |

### ⚠️ Important for Required Functions

**Room/Device config persistence**: The app uses `localStorage.getItem('roomNo')`, `localStorage.getItem('deviceSerial')`, etc. **The Flutter WebView must NOT clear localStorage** between sessions. Store these in Dart's `SharedPreferences` + sync back to JS on WebView init.

### 🔧 Optional (Nice-to-Have)

| # | Function | Why |
|---|----------|-----|
| 1 | `syncWeather` | If not implemented, weather shows cached data or placeholders |
| 2 | `syncFlights` | If not implemented, flights show cached data or placeholders |
| 3 | `getPictureList` | Gallery slideshow won't work |
| 4 | `rotateImage` | Gallery image rotation won't work |
| 5 | `getSystemInfo` | System info page shows empty |
| 6 | `checkInternet` | Connectivity indicator won't update |
| 7 | `hideLoading` | Native loading overlay stays visible |

### Offline Behavior Summary

| Module | Fresh Data | Cached Data | No Data |
|--------|-----------|-------------|---------|
| **Weather** | Fetches `weather_data.json` | Falls back to `localStorage` cache (24h expiry) | Shows `--°C` placeholders + offline banner |
| **Flights** | Fetches `data_departures.json` / `data_arrivals.json` | Falls back to `localStorage` cache (6h expiry) | Shows empty table rows |
| **Guest Data** | Fetches `admin/rooms/<roomNo>.json` | No cache (must fetch fresh each time) | Shows greeting without guest name |
| **All others** | Local files only | N/A — fully static content | Content missing |

---

## 5. Flutter Developer Instructions

> **Copy the block below and give it to your Flutter developer.**

---

### Flutter Integration Instructions

#### A. Serve the Web UI

You have two options for serving the local files:

**Option 1 — Embedded HTTP Server (Recommended)**
Use a package like [`http_server`](https://pub.dev/packages/http_server) or [`shelf`](https://pub.dev/packages/shelf) to run a local HTTP server inside your Flutter app. Bind it to `127.0.0.1:<PORT>` and serve all files from the `_public_html` directory with appropriate MIME types. Set `PORT` to something like `8080`.

Example MIME type map to configure:
- `.html` → `text/html`
- `.css` → `text/css`
- `.js` → `application/javascript`
- `.json` → `application/json`
- `.png` → `image/png`
- `.jpg`, `.jpeg` → `image/jpeg`
- `.mp4` → `video/mp4`
- `.woff`, `.woff2` → `font/woff2`

**Option 2 — Load via `file://`**
Use `loadFile()` or `loadRequest()` on the WebView to load `index.html` from the app's assets directory.

#### B. Configure the WebView

```dart
import 'package:webview_flutter/webview_flutter.dart';

class HotelTvWebView extends StatefulWidget {
  @override
  State<HotelTvWebView> createState() => _HotelTvWebViewState();
}

class _HotelTvWebViewState extends State<HotelTvWebView> {
  late final WebViewController _controller;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..addJavaScriptChannel(
        'FlutterBridge',
        onMessageReceived: _handleBridgeMessage,
      )
      ..loadRequest(Uri.parse('http://localhost:8080/index.html'));
  }

  Future<void> _handleBridgeMessage(JavaScriptMessage message) async {
    // Parse the JSON message from JS
    final Map<String, dynamic> call = jsonDecode(message.message);
    final String method = call['method'];
    final List<dynamic> args = call['args'];
    final int id = call['id'];

    try {
      dynamic result;
      switch (method) {
        // === Required: Core TV Control ===
        case 'launchApp':
          // args[0] = packageName string
          // Launch via Android Intent: context.startActivity(...)
          result = await _launchAndroidApp(args[0] as String);
          break;

        case 'launchHdmi':
          // args[0] = model string (e.g. "Worldtech_RT32HD")
          // Use TV-specific HDMI switching API or send IR command
          result = await _switchToHdmi(args[0] as String);
          break;

        case 'getHdmiModels':
          // Return list of available HDMI models from config
          result = await _getHdmiModels();
          break;

        case 'launchIptv':
          // args[0] = packageName, args[1] = configPath (optional)
          result = await _launchAndroidApp(args[0] as String);
          break;

        case 'openSettings':
          // Launch Android Settings intent
          result = await _openAndroidSettings();
          break;

        // === Required: Device Provisioning ===
        case 'identifyDevice':
          // args[0] = IP address string
          // Run ADB or use TvInputManager to identify device
          result = await _identifyTvDevice(args[0] as String);
          break;

        case 'saveDeviceConfig':
          // args[0] = device config object
          // Save to SharedPreferences or local file
          result = await _saveDeviceConfig(args[0] as Map<String, dynamic>);
          break;

        case 'saveRoomConfig':
          // args[0] = room number, args[1] = room config object
          result = await _saveRoomConfig(args[0] as String, args[1] as Map<String, dynamic>);
          break;

        case 'getDeviceConfig':
          // args[0] = serial string
          result = await _getDeviceConfig(args[0] as String);
          break;

        case 'getRoomConfig':
          // args[0] = room number string
          result = await _getRoomConfig(args[0] as String);
          break;

        // === Required: PMS / Guest ===
        case 'updatePmsGuest':
          // args[0] = guestData object { room, guestName, ... }
          // Write to admin/rooms/<room>.json + notify WebView to reload
          result = await _updateGuestData(args[0] as Map<String, dynamic>);
          break;

        // === Optional: Background Sync ===
        case 'syncWeather':
          // Fetch from Open-Meteo API, write to weather/weather_data.json
          result = await _syncWeatherData();
          break;

        case 'syncFlights':
          // Fetch from FlightRadar24 API, write to flights/data_departures.json
          // and flights/data_arrivals.json
          result = await _syncFlightData();
          break;

        // === Optional: Gallery ===
        case 'getPictureList':
          result = await _getPictureList(args[0] as String);
          break;

        case 'rotateImage':
          result = await _rotateImage(args[0] as String, args[1] as int);
          break;

        // === Optional: System ===
        case 'getSystemInfo':
          result = await _getSystemInfo();
          break;

        case 'checkInternet':
          result = await _checkInternetConnectivity();
          break;

        case 'hideLoading':
          // Hide any native loading overlay
          result = true;
          break;

        default:
          // Unknown method - reject the call
          _rejectBridgeCall(id, 'Unknown method: $method');
          return;
      }

      _resolveBridgeCall(id, result);
    } catch (e) {
      _rejectBridgeCall(id, e.toString());
    }
  }

  void _resolveBridgeCall(int id, dynamic result) {
    final String jsonResult = jsonEncode(result);
    _controller.runJavaScript('window.flutterBridge._resolve($id, $jsonResult)');
  }

  void _rejectBridgeCall(int id, String error) {
    final String escapedError = error.replaceAll("'", "\\'");
    _controller.runJavaScript("window.flutterBridge._reject($id, '$escapedError')");
  }
}
```

#### C. Initial State Setup (Required on App Start)

Before loading `index.html` into the WebView, ensure these localStorage values are set:

```dart
// After WebView is initialized but before loading index.html:
_controller.runJavaScript('''
  localStorage.setItem('roomNo', '$currentRoomNumber');
  localStorage.setItem('selectedLangFile', '${currentLanguageFile}');
  localStorage.setItem('deviceSerial', '$deviceSerial');
  localStorage.setItem('deviceIp', '$deviceIp');
''');
```

#### D. PMS Integration

When the PMS system sends new guest data (e.g., a new check-in), your Dart code should:

1. Write the guest data to `admin/rooms/<roomNo>.json` (on the virtual server's file system)
2. Call `window.flutterBridge.updatePmsGuest(...)` via `runJavaScript()` to notify the UI
3. The JS side re-fetches guest data and updates the greeting

#### E. Background Sync (Weather & Flights)

These are **fire-and-forget** operations. When JS calls `syncWeather()` or `syncFlights()`:

1. Your Dart code fetches data from the external API
2. Writes the result to the appropriate JSON file (e.g., `weather/weather_data.json`)
3. Returns `{ success: true }`
4. The JS side will pick up the fresh file on its next polling interval

For best UX, also schedule these syncs periodically from Dart (e.g., every 30 minutes) regardless of JS requests.

#### F. WebView Settings (Android TV)

```dart
_controller
  ..setJavaScriptMode(JavaScriptMode.unrestricted)
  ..setNavigationDelegate(NavigationDelegate(
    onPageFinished: (url) {
      // Hide loading indicator
      _controller.runJavaScript('window.AndroidBridge.hideLoading()');
    },
  ))
  // Enable DOM storage (for localStorage)
  // This is crucial — without it, language and room settings won't persist
  ..setDomStorageEnabled(true);
```

Ensure `android:usesCleartextTraffic="true"` in your `AndroidManifest.xml` if using `http://localhost`.

#### G. Key Gotchas

| Issue | Solution |
|-------|----------|
| `localStorage` clears on app restart | Store values in Dart `SharedPreferences`, re-inject via `runJavaScript()` on WebView init |
| CORS errors on `file://` | Serve from local HTTP server instead of `file://` |
| WebView blocks `http://` | Add `android:usesCleartextTraffic="true"` to `AndroidManifest.xml` |
| Fonts not loading via `file://` | Use `@font-face` with data URIs or serve from local HTTP |
| Images too large for WebView | Set WebView `layoutAlgorithm` to `SINGLE_COLUMN` if needed |
| Pin code for admin | Uses current date (YYMMDD format) as default — hardcoded in `settings.html` |
| Bridge timeout | Each bridge call times out after 10 seconds — implement all required methods promptly |
