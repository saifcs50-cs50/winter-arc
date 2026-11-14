package com.saif.winterarc;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Keeps the morning alarms scheduled as real alarm-clock alarms, and remembers them across reboots. */
final class AlarmScheduler {

    static final String EXTRA_ID = "id";
    static final String EXTRA_TITLE = "title";
    static final String EXTRA_BODY = "body";
    private static final String PREFS = "winter_arc_alarms";
    private static final String KEY_LIST = "alarms";

    private AlarmScheduler() {}

    /** Cancels every alarm this app set, then schedules the given list. Returns how many are in the future. */
    static int replaceAll(Context context, JSONArray alarms) throws JSONException {
        cancelAll(context);
        prefs(context).edit().putString(KEY_LIST, alarms.toString()).apply();
        return scheduleStored(context);
    }

    static int scheduleStored(Context context) {
        JSONArray alarms = stored(context);
        long now = System.currentTimeMillis();
        int count = 0;
        for (int i = 0; i < alarms.length(); i++) {
            JSONObject alarm = alarms.optJSONObject(i);
            if (alarm == null) continue;
            long at = alarm.optLong("at");
            if (at <= now) continue;
            schedule(context, alarm.optInt("id"), at, alarm.optString("title"), alarm.optString("body"));
            count++;
        }
        return count;
    }

    static void schedule(Context context, int id, long at, String title, String body) {
        AlarmManager manager = context.getSystemService(AlarmManager.class);
        if (manager == null) return;
        PendingIntent fire = firePending(context, id, title, body);
        Intent showIntent = new Intent(context, MainActivity.class);
        PendingIntent show = PendingIntent.getActivity(context, id, showIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        boolean exactAllowed = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || manager.canScheduleExactAlarms();
        if (exactAllowed) {
            manager.setAlarmClock(new AlarmManager.AlarmClockInfo(at, show), fire);
        } else {
            manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, fire);
        }
    }

    private static void cancelAll(Context context) {
        AlarmManager manager = context.getSystemService(AlarmManager.class);
        if (manager == null) return;
        JSONArray alarms = stored(context);
        for (int i = 0; i < alarms.length(); i++) {
            JSONObject alarm = alarms.optJSONObject(i);
            if (alarm != null) manager.cancel(firePending(context, alarm.optInt("id"), "", ""));
        }
    }

    private static PendingIntent firePending(Context context, int id, String title, String body) {
        Intent intent = new Intent(context, AlarmReceiver.class)
            .putExtra(EXTRA_ID, id)
            .putExtra(EXTRA_TITLE, title)
            .putExtra(EXTRA_BODY, body);
        return PendingIntent.getBroadcast(context, id, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static JSONArray stored(Context context) {
        try {
            return new JSONArray(prefs(context).getString(KEY_LIST, "[]"));
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
