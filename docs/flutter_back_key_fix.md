# Flutter/Android TV Native Key Interception & Forwarding Guide

This document describes how to fix the issue where the physical TV Remote's **Back** button (and other keys like numeric buttons) are intercepted by the native Android/Flutter layout and do not reach the WebView's JavaScript engine.

---

## The Problem
By default, the Android OS routing for hardware button events inside a WebView passes keys through native widgets first. 
1. If you use Flutter, `WillPopScope`, `PopScope`, or native D-pad wrappers consume `KEYCODE_BACK` (value `4`) to pop the Flutter route stack, rather than passing it to the browser.
2. Similarly, numeric keys (0-9) may get swallowed by native focus or keyboard IME handlers.

---

## The Solution: Native-to-JS Key Forwarding

We have implemented two global injection triggers on the HTML window:
* **`window.triggerTVBack()`**: Synthetic handler to trigger a Back event.
* **`window.triggerTVKey(keyCode, keyName)`**: Synthetic handler to inject any standard keyCode.

Your Flutter developer must catch native keys and evaluate these JavaScript functions.

---

### Implementation Options

#### Option A: If using `flutter_inappwebview` (Recommended)

Wrap the InAppWebView with a `Focus` widget or use `onReceivedKeyEvent`:

```dart
InAppWebView(
  initialUrlRequest: URLRequest(url: WebUri("http://your-server-ip:8000/index.html")),
  initialSettings: InAppWebViewSettings(
    supportZoom: false,
    useWideViewPort: true,
    // Critical: ensures WebView gets keyboard/remote focus
    hardwareAccelerated: true,
  ),
  onWebViewCreated: (controller) {
    _webViewController = controller;
  },
  // Intercept key events inside the webview widget
  onReceivedKeyEvent: (controller, event) async {
    // Check if key is pressed down
    if (event.action == android.KeyEventAction.DOWN) {
      int keyCode = event.keyCode;
      
      // keycode 4 is KEYCODE_BACK
      if (keyCode == 4) {
        // Forward back action to JS trigger
        await controller.evaluateJavascript(
          source: "if (typeof window.triggerTVBack === 'function') { window.triggerTVBack(); }"
        );
        return true; // Mark as handled so native app doesn't exit
      }
      
      // Optionally forward raw digits (keycode 7 to 16 for 0-9)
      if (keyCode >= 7 && keyCode <= 16) {
        int digit = keyCode - 7;
        await controller.evaluateJavascript(
          source: "if (typeof window.TVKeyInjector === 'object') { window.TVKeyInjector.triggerNumber('$digit'); }"
        );
        return true;
      }
    }
    return false;
  },
)
```

---

#### Option B: If using `webview_flutter` (Official Plugin)

Use a `RawKeyboardListener` / `KeyboardListener` or `Focus` widget wrapping the WebView:

```dart
import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';

// Wrap the WebView widget in a Focus/KeyboardListener:
Focus(
  autofocus: true,
  onKeyEvent: (FocusNode node, KeyEvent event) {
    if (event is KeyDownEvent) {
      final logicalKey = event.logicalKey;
      
      // Intercept Back Button
      if (logicalKey == LogicalKeyboardKey.goBack || 
          logicalKey == LogicalKeyboardKey.escape ||
          logicalKey == LogicalKeyboardKey.backspace) {
        
        _webViewController.runJavaScript(
          "if (typeof window.triggerTVBack === 'function') { window.triggerTVBack(); }"
        );
        return KeyEventResult.handled; // Prevent native pop/exit
      }

      // Intercept Numeric Inputs
      if (logicalKey.keyId >= LogicalKeyboardKey.digit0.keyId && 
          logicalKey.keyId <= LogicalKeyboardKey.digit9.keyId) {
        
        int digit = logicalKey.keyId - LogicalKeyboardKey.digit0.keyId;
        _webViewController.runJavaScript(
          "if (typeof window.TVKeyInjector === 'object') { window.TVKeyInjector.triggerNumber('$digit'); }"
        );
        return KeyEventResult.handled;
      }
    }
    return KeyEventResult.ignored;
  },
  child: WebViewWidget(controller: _webViewController),
)
```

---

#### Option C: Android Native WebView wrapper (Kotlin / Java)

If building a native Android wrapper app instead of Flutter:

```kotlin
webView.setOnKeyListener(View.OnKeyListener { _, keyCode, event ->
    if (event.action == KeyEvent.ACTION_DOWN) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            webView.evaluateJavascript("javascript:if(typeof window.triggerTVBack === 'function'){window.triggerTVBack();}", null)
            return@OnKeyListener true // Consumed
        }
        
        if (keyCode >= KeyEvent.KEYCODE_0 && keyCode <= KeyEvent.KEYCODE_9) {
            val digit = keyCode - KeyEvent.KEYCODE_0
            webView.evaluateJavascript("javascript:if(typeof window.TVKeyInjector === 'object'){window.TVKeyInjector.triggerNumber('$digit');}", null)
            return@OnKeyListener true // Consumed
        }
    }
    false
})
```

---

### Verifying the Fix
1. Open the page on the TV device.
2. Look at the **green debug key logger** at the top left of the screen.
3. Press **Back** or **Numbers** on the physical remote. 
4. The key logger should immediately update to show the synthetic keycodes injected by the native wrapper.
5. Navigation and input entry will now work seamlessly.
