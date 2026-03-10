package com.sanbao.sanbaoai;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.codetrixstudio.capacitor.GoogleAuth.GoogleAuth;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GoogleAuth.class);
        super.onCreate(savedInstanceState);

        // Initialize GoogleAuth after bridge is ready —
        // the plugin's load() is empty, so signIn() crashes with NPE
        // unless initialize() is called first from JS or here.
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
