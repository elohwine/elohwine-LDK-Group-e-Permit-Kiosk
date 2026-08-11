package com.ldk.kiosk;

import android.app.admin.DeviceAdminReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class KioskDeviceAdminReceiver extends DeviceAdminReceiver {
    private static final String TAG = "KioskDeviceAdmin";

    public static ComponentName getComponentName(Context context) {
        return new ComponentName(context.getApplicationContext(), KioskDeviceAdminReceiver.class);
    }

    @Override
    public void onEnabled(Context context, Intent intent) {
        super.onEnabled(context, intent);
        Log.i(TAG, "Device admin enabled");
    }

    @Override
    public CharSequence onDisableRequested(Context context, Intent intent) {
        CharSequence message = super.onDisableRequested(context, intent);
        Log.w(TAG, "Device admin disable requested");
        return message;
    }

    @Override
    public void onDisabled(Context context, Intent intent) {
        super.onDisabled(context, intent);
        Log.w(TAG, "Device admin disabled");
    }
}