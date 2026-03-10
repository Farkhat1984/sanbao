package com.sanbao.sanbaoai;

import android.os.Bundle;
import android.view.View;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;
import com.codetrixstudio.capacitor.GoogleAuth.GoogleAuth;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GoogleAuth.class);
        super.onCreate(savedInstanceState);

        // Push WebView below status bar — add top padding equal to status bar height
        View rootView = findViewById(android.R.id.content);
        ViewCompat.setOnApplyWindowInsetsListener(rootView, (v, insets) -> {
            int top = insets.getInsets(WindowInsetsCompat.Type.statusBars()).top;
            int bottom = insets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom;
            v.setPadding(0, top, 0, bottom);
            return insets;
        });

        // Initialize GoogleAuth — plugin's load() is empty, signIn() NPEs without this
        getBridge().executeOnMainThread(() -> {
            try {
                GoogleAuth plugin = (GoogleAuth) getBridge().getPlugin("GoogleAuth").getInstance();
                String clientId = "785998485085-ufi4mt9193bs4r5v6jtcc6f7k367po7s.apps.googleusercontent.com";
                plugin.loadSignInClient(clientId, true, new String[]{"profile", "email"});
            } catch (Exception e) {
                android.util.Log.e("MainActivity", "GoogleAuth init failed", e);
            }
        });
    }
}
