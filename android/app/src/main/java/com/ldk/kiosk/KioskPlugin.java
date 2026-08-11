package com.ldk.kiosk;

import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageInstaller;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Capacitor plugin exposing native Android capabilities to the kiosk WebView.
 *
 * Methods:
 *   rebootApp()            — Kills the Android process so the OS restarts it.
 *                            JS must ack the command BEFORE calling this.
 *   installApk({ url })    — Downloads an APK from a URL into the app cache dir
 *                            and launches the system package installer via FileProvider.
 *                            Requires: android.permission.REQUEST_INSTALL_PACKAGES
 */
@CapacitorPlugin(name = "Kiosk")
public class KioskPlugin extends Plugin {
    private static final String TAG = "KioskPlugin";

    /**
     * Kill the current process. Android will restart it via the app's launch intent.
     * Called by the JS layer for the reboot_app remote command — JS acks first.
     */
    @PluginMethod
    public void rebootApp(PluginCall call) {
        call.resolve(new JSObject());
        new Handler(Looper.getMainLooper()).postDelayed(() ->
            android.os.Process.killProcess(android.os.Process.myPid()),
        500);
    }

    /**
     * Download an APK from `url` and open the system installer.
     * JS sends: { url: "https://..." }
     * Requires android.permission.REQUEST_INSTALL_PACKAGES in AndroidManifest.xml.
     */
    @PluginMethod
    public void installApk(PluginCall call) {
        String apkUrl = call.getString("url");
        if (apkUrl == null || apkUrl.isEmpty()) {
            call.reject("url is required");
            return;
        }

        new Thread(() -> {
            try {
                File apkFile = downloadApkToCache(apkUrl);

                // FileProvider authority must match AndroidManifest.xml
                Uri apkUri = FileProvider.getUriForFile(
                    getContext(),
                    getContext().getPackageName() + ".fileprovider",
                    apkFile
                );

                Intent intent = new Intent(Intent.ACTION_VIEW);
                intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);

                call.resolve(new JSObject());
            } catch (Exception e) {
                call.reject("APK install failed: " + e.getMessage(), e);
            }
        }).start();
    }

    @PluginMethod
    public void isDeviceOwner(PluginCall call) {
        JSObject out = new JSObject();
        out.put("isDeviceOwner", isAppDeviceOwner());
        call.resolve(out);
    }

    @PluginMethod
    public void getAppInfo(PluginCall call) {
        try {
            PackageInfo info = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            long versionCode = info.getLongVersionCode();
            String versionName = info.versionName == null ? "" : info.versionName;

            JSObject out = new JSObject();
            out.put("packageName", getContext().getPackageName());
            out.put("versionCode", versionCode);
            out.put("versionName", versionName);
            call.resolve(out);
        } catch (Exception e) {
            call.reject("Unable to read app info: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void allowLockTaskForSelf(PluginCall call) {
        if (!isAppDeviceOwner()) {
            call.reject("App is not Device Owner. Provision Device Owner first.");
            return;
        }

        try {
            DevicePolicyManager dpm = getContext().getSystemService(DevicePolicyManager.class);
            ComponentName admin = KioskDeviceAdminReceiver.getComponentName(getContext());
            String pkg = getContext().getPackageName();
            dpm.setLockTaskPackages(admin, new String[] { pkg });

            JSObject out = new JSObject();
            out.put("allowlisted", true);
            call.resolve(out);
        } catch (Exception e) {
            call.reject("Failed to allowlist lock task package: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void installApkSilent(PluginCall call) {
        String apkUrl = call.getString("url");
        boolean fallbackInteractive = call.getBoolean("fallbackInteractive", true);

        if (apkUrl == null || apkUrl.isEmpty()) {
            call.reject("url is required");
            return;
        }

        new Thread(() -> {
            try {
                File apkFile = downloadApkToCache(apkUrl);

                if (isAppDeviceOwner()) {
                    commitPackageInstallerSession(apkFile);
                    JSObject out = new JSObject();
                    out.put("queued", true);
                    out.put("silent", true);
                    call.resolve(out);
                    return;
                }

                if (fallbackInteractive) {
                    launchInteractiveInstaller(apkFile);
                    JSObject out = new JSObject();
                    out.put("queued", true);
                    out.put("silent", false);
                    call.resolve(out);
                    return;
                }

                call.reject("Silent install requires Device Owner provisioning.");
            } catch (Exception e) {
                call.reject("Silent APK install failed: " + e.getMessage(), e);
            }
        }).start();
    }

    private File downloadApkToCache(String apkUrl) throws Exception {
        File apkFile = new File(getContext().getCacheDir(), "kiosk-update.apk");

        URL url = new URL(apkUrl);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setConnectTimeout(30_000);
        conn.setReadTimeout(60_000);
        conn.connect();

        try (InputStream in = conn.getInputStream(); OutputStream out = new FileOutputStream(apkFile)) {
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) != -1) {
                out.write(buf, 0, n);
            }
        } finally {
            conn.disconnect();
        }

        return apkFile;
    }

    private void launchInteractiveInstaller(File apkFile) {
        Uri apkUri = FileProvider.getUriForFile(
            getContext(),
            getContext().getPackageName() + ".fileprovider",
            apkFile
        );

        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
    }

    private void commitPackageInstallerSession(File apkFile) throws Exception {
        PackageInstaller packageInstaller = getContext().getPackageManager().getPackageInstaller();
        PackageInstaller.SessionParams params =
            new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
        params.setAppPackageName(getContext().getPackageName());

        int sessionId = packageInstaller.createSession(params);
        PackageInstaller.Session session = null;
        try {
            session = packageInstaller.openSession(sessionId);

            try (InputStream in = new java.io.FileInputStream(apkFile);
                 OutputStream out = session.openWrite("base.apk", 0, -1)) {
                byte[] buffer = new byte[65536];
                int c;
                while ((c = in.read(buffer)) != -1) {
                    out.write(buffer, 0, c);
                }
                session.fsync(out);
            }

            session.commit(
                KioskInstallResultReceiver
                    .createCommitPendingIntent(getContext(), sessionId)
                    .getIntentSender()
            );
        } catch (Exception e) {
            if (session != null) {
                try {
                    session.abandon();
                } catch (Exception abandonError) {
                    Log.w(TAG, "Session abandon failed", abandonError);
                }
            }
            throw e;
        } finally {
            if (session != null) {
                session.close();
            }
        }
    }

    private boolean isAppDeviceOwner() {
        DevicePolicyManager dpm = getContext().getSystemService(DevicePolicyManager.class);
        return dpm != null && dpm.isDeviceOwnerApp(getContext().getPackageName());
    }
}
