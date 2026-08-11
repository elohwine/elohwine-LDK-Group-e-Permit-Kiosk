package com.ldk.kiosk;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.util.Log;

public class KioskInstallResultReceiver extends BroadcastReceiver {
    public static final String ACTION_INSTALL_COMMIT = "com.ldk.kiosk.ACTION_INSTALL_COMMIT";
    private static final String TAG = "KioskInstallReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !ACTION_INSTALL_COMMIT.equals(intent.getAction())) {
            return;
        }

        int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
        String message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);

        if (status == PackageInstaller.STATUS_SUCCESS) {
            Log.i(TAG, "Silent APK install committed successfully");
            return;
        }

        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            Intent confirmIntent = intent.getParcelableExtra(Intent.EXTRA_INTENT);
            if (confirmIntent != null) {
                confirmIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(confirmIntent);
                Log.w(TAG, "Install requires user action");
                return;
            }
        }

        Log.e(TAG, "Silent install failed. status=" + status + " message=" + message);
    }

    public static PendingIntent createCommitPendingIntent(Context context, int requestCode) {
        Intent callbackIntent = new Intent(context, KioskInstallResultReceiver.class);
        callbackIntent.setAction(ACTION_INSTALL_COMMIT);
        return PendingIntent.getBroadcast(
            context,
            requestCode,
            callbackIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }
}