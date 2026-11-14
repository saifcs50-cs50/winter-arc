package com.saif.winterarc;

import android.app.AlarmManager;
import android.app.AppOpsManager;
import android.app.NotificationManager;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Process;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONException;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Native pieces the web UI can't do: screen time, finding the Mac on the LAN, alarm-clock alarms, opening Quranly. */
@CapacitorPlugin(name = "WinterArc")
public class WinterArcPlugin extends Plugin {

    private static final long LOOKBACK_MS = 3L * 60 * 60 * 1000;
    private static final double MS_PER_MINUTE = 60_000.0;

    @PluginMethod
    public void usageAccess(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", hasUsageAccess());
        call.resolve(result);
    }

    @PluginMethod
    public void openUsageSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void socialMinutes(PluginCall call) {
        Long from = call.getLong("from");
        Long to = call.getLong("to");
        JSArray packages = call.getArray("packages");
        if (from == null || to == null || packages == null || to <= from) {
            call.reject("from, to and packages are required");
            return;
        }
        if (!hasUsageAccess()) {
            call.reject("Usage access not granted");
            return;
        }
        Set<String> watched = new HashSet<>();
        try {
            List<String> list = packages.toList();
            watched.addAll(list);
        } catch (JSONException e) {
            call.reject("packages must be strings");
            return;
        }
        Map<String, Long> totals = foregroundTime(from, to, watched);
        long sum = 0;
        JSObject perApp = new JSObject();
        for (Map.Entry<String, Long> entry : totals.entrySet()) {
            sum += entry.getValue();
            perApp.put(entry.getKey(), entry.getValue() / MS_PER_MINUTE);
        }
        JSObject result = new JSObject();
        result.put("minutes", sum / MS_PER_MINUTE);
        result.put("perApp", perApp);
        call.resolve(result);
    }

    @PluginMethod
    public void findHub(PluginCall call) {
        int port = call.getInt("port", 4747);
        String lastHost = call.getString("lastHost");
        new Thread(() -> {
            String host = HubFinder.find(getContext(), port, lastHost);
            if (host == null) {
                call.reject("Mac not found on this network");
            } else {
                JSObject result = new JSObject();
                result.put("host", host);
                call.resolve(result);
            }
        }, "winter-arc-find-hub").start();
    }

    @PluginMethod
    public void scheduleAlarms(PluginCall call) {
        JSArray alarms = call.getArray("alarms");
        if (alarms == null) {
            call.reject("alarms is required");
            return;
        }
        try {
            NotificationManager notifications = getContext().getSystemService(NotificationManager.class);
            if (notifications != null) AlarmReceiver.ensureChannel(getContext(), notifications);
            int scheduled = AlarmScheduler.replaceAll(getContext(), new JSONArray(alarms.toString()));
            JSObject result = new JSObject();
            result.put("scheduled", scheduled);
            call.resolve(result);
        } catch (JSONException e) {
            call.reject("Bad alarm list", e);
        }
    }

    @PluginMethod
    public void alarmStatus(PluginCall call) {
        Context context = getContext();
        boolean exact = true;
        boolean fullScreen = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AlarmManager alarms = context.getSystemService(AlarmManager.class);
            exact = alarms != null && alarms.canScheduleExactAlarms();
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            NotificationManager notifications = context.getSystemService(NotificationManager.class);
            fullScreen = notifications != null && notifications.canUseFullScreenIntent();
        }
        JSObject result = new JSObject();
        result.put("exact", exact);
        result.put("fullScreen", fullScreen);
        call.resolve(result);
    }

    @PluginMethod
    public void openApp(PluginCall call) {
        String packageName = call.getString("packageName");
        if (packageName == null || !packageName.matches("[A-Za-z0-9_.]+")) {
            call.reject("A valid packageName is required");
            return;
        }
        Context context = getContext();
        Intent launch = context.getPackageManager().getLaunchIntentForPackage(packageName);
        boolean opened = true;
        try {
            if (launch != null) {
                launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(launch);
            } else {
                Intent store = new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + packageName));
                store.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(store);
            }
        } catch (ActivityNotFoundException e) {
            opened = false;
        }
        JSObject result = new JSObject();
        result.put("opened", opened);
        call.resolve(result);
    }

    private boolean hasUsageAccess() {
        Context context = getContext();
        AppOpsManager ops = context.getSystemService(AppOpsManager.class);
        if (ops == null) return false;
        int mode = ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.getPackageName());
        return mode == AppOpsManager.MODE_ALLOWED;
    }

    /**
     * Foreground time per watched app between from and to. A session opens when an app has a resumed
     * activity and closes when none is left, the screen turns off, or the window ends. Resumes are counted
     * rather than tracked by class name because Instagram runs two instances of the same activity class,
     * and STOPPED is ignored because it arrives after PAUSED and can belong to the other instance.
     */
    private Map<String, Long> foregroundTime(long from, long to, Set<String> watched) {
        UsageStatsManager usm = getContext().getSystemService(UsageStatsManager.class);
        Map<String, Long> totals = new HashMap<>();
        if (usm == null) return totals;
        UsageEvents events = usm.queryEvents(from - LOOKBACK_MS, to);
        Map<String, Integer> resumed = new HashMap<>();
        Map<String, Long> openedAt = new HashMap<>();
        UsageEvents.Event event = new UsageEvents.Event();
        while (events.hasNextEvent()) {
            events.getNextEvent(event);
            int type = event.getEventType();
            long ts = event.getTimeStamp();
            if (type == UsageEvents.Event.SCREEN_NON_INTERACTIVE || type == UsageEvents.Event.DEVICE_SHUTDOWN) {
                for (String pkg : new HashSet<>(openedAt.keySet())) close(pkg, ts, from, to, openedAt, totals);
                resumed.clear();
                continue;
            }
            String pkg = event.getPackageName();
            if (!watched.contains(pkg)) continue;
            int count = resumed.getOrDefault(pkg, 0);
            if (type == UsageEvents.Event.ACTIVITY_RESUMED) {
                if (count == 0) openedAt.put(pkg, ts);
                resumed.put(pkg, count + 1);
            } else if (type == UsageEvents.Event.ACTIVITY_PAUSED && count > 0) {
                resumed.put(pkg, count - 1);
                if (count == 1) close(pkg, ts, from, to, openedAt, totals);
            }
        }
        for (String pkg : new HashSet<>(openedAt.keySet())) close(pkg, to, from, to, openedAt, totals);
        return totals;
    }

    private static void close(String pkg, long end, long from, long to, Map<String, Long> openedAt, Map<String, Long> totals) {
        Long start = openedAt.remove(pkg);
        if (start == null) return;
        long clippedStart = Math.max(start, from);
        long clippedEnd = Math.min(end, to);
        if (clippedEnd > clippedStart) {
            Long previous = totals.get(pkg);
            totals.put(pkg, (previous == null ? 0 : previous) + clippedEnd - clippedStart);
        }
    }
}
