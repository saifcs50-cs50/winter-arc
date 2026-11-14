package com.saif.winterarc;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;

/** Rings the morning alarm: an insistent alarm-stream notification that opens the full-screen alarm. */
public class AlarmReceiver extends BroadcastReceiver {

    static final String CHANNEL_ID = "wa-alarm-v1";
    static final int NOTIFICATION_ID = 4747;
    static final String ACTION_DISMISS = "com.saif.winterarc.DISMISS_ALARM";
    private static final long RING_FOR_MS = 10L * 60 * 1000;

    @Override
    public void onReceive(Context context, Intent intent) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;
        if (ACTION_DISMISS.equals(intent.getAction())) {
            manager.cancel(NOTIFICATION_ID);
            return;
        }
        ensureChannel(context, manager);
        String title = intent.getStringExtra(AlarmScheduler.EXTRA_TITLE);
        String body = intent.getStringExtra(AlarmScheduler.EXTRA_BODY);

        Intent full = new Intent(context, AlarmActivity.class)
            .putExtra(AlarmScheduler.EXTRA_TITLE, title)
            .putExtra(AlarmScheduler.EXTRA_BODY, body)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_USER_ACTION);
        PendingIntent fullScreen = PendingIntent.getActivity(context, NOTIFICATION_ID, full, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Intent dismiss = new Intent(context, AlarmReceiver.class).setAction(ACTION_DISMISS);
        PendingIntent dismissPending = PendingIntent.getBroadcast(context, NOTIFICATION_ID, dismiss, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification notification = new Notification.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_arc)
            .setContentTitle(title == null || title.isEmpty() ? context.getString(R.string.alarm_default_title) : title)
            .setContentText(body)
            .setCategory(Notification.CATEGORY_ALARM)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setFullScreenIntent(fullScreen, true)
            .setContentIntent(fullScreen)
            .addAction(new Notification.Action.Builder(null, "I'm up", dismissPending).build())
            .setOngoing(true)
            .setTimeoutAfter(RING_FOR_MS)
            .build();
        notification.flags |= Notification.FLAG_INSISTENT;
        manager.notify(NOTIFICATION_ID, notification);
    }

    /**
     * Created on every ring rather than once: re-creating an existing channel only refreshes its name and
     * description, which lets an update correct the wording without touching the user's sound settings.
     */
    static void ensureChannel(Context context, NotificationManager manager) {
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, context.getString(R.string.alarm_channel_name), NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription(context.getString(R.string.alarm_channel_description));
        Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (sound == null) sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        AudioAttributes attributes = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        channel.setSound(sound, attributes);
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[] {0, 800, 600, 800});
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        manager.createNotificationChannel(channel);
    }
}
