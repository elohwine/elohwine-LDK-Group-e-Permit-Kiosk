package com.ldk.kiosk;

import android.os.Bundle;
import android.view.MotionEvent;
import android.view.View;
import android.webkit.WebView;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
          | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
          | View.SYSTEM_UI_FLAG_FULLSCREEN
        );
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // Get the WebView instance
        WebView webView = (WebView) findViewById(getResources().getIdentifier("webview", "id", getPackageName()));

        if (webView != null) {
            // Disable text selection & copy/paste menu
            webView.setLongClickable(false);
            webView.setHapticFeedbackEnabled(false);
            webView.setOnLongClickListener(v -> true);

            // Disable pinch-to-zoom & overscroll
            webView.getSettings().setBuiltInZoomControls(false);
            webView.getSettings().setDisplayZoomControls(false);
            webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        }
    }

    @Override
    public void onBackPressed() {
        // Disable hardware back for kiosk
    }
}
