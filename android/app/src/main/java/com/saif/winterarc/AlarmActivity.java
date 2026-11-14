package com.saif.winterarc;

import android.app.Activity;
import android.app.NotificationManager;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.text.DateFormat;
import java.util.Date;

/** Full-screen morning alarm shown over the lock screen. "I'm up" silences it and opens the app. */
public class AlarmActivity extends Activity {

    private static final long SNOOZE_MS = 5L * 60 * 1000;
    private static final int SNOOZE_ID = 999_999;
    private static final int BACKGROUND = Color.parseColor("#0a1020");
    private static final int ICE = Color.parseColor("#8fd3ff");
    private static final int SURFACE = Color.parseColor("#1d2b48");

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setShowWhenLocked(true);
        setTurnScreenOn(true);

        String title = getIntent().getStringExtra(AlarmScheduler.EXTRA_TITLE);
        String body = getIntent().getStringExtra(AlarmScheduler.EXTRA_BODY);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setBackgroundColor(BACKGROUND);
        int pad = dp(28);
        root.setPadding(pad, pad, pad, pad);

        root.addView(text(DateFormat.getTimeInstance(DateFormat.SHORT).format(new Date()), 64, Color.WHITE));
        root.addView(text(title == null || title.isEmpty() ? getString(R.string.alarm_default_title) : title, 30, ICE));
        root.addView(text(body == null ? "" : body, 18, Color.parseColor("#a9b4cc")));

        Button up = button("I'm up", ICE, Color.parseColor("#07203a"));
        up.setOnClickListener(v -> {
            silence();
            startActivity(new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            finish();
        });
        root.addView(up);

        Button snooze = button("Snooze 5 min", SURFACE, Color.WHITE);
        snooze.setOnClickListener(v -> {
            silence();
            AlarmScheduler.schedule(this, SNOOZE_ID, System.currentTimeMillis() + SNOOZE_MS, title, body);
            finish();
        });
        root.addView(snooze);

        setContentView(root);
    }

    private void silence() {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.cancel(AlarmReceiver.NOTIFICATION_ID);
    }

    private TextView text(String value, int sp, int color) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextColor(color);
        view.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        view.setGravity(Gravity.CENTER);
        view.setPadding(0, dp(6), 0, dp(6));
        return view;
    }

    private Button button(String label, int background, int color) {
        Button button = new Button(this);
        button.setText(label);
        button.setAllCaps(false);
        button.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
        button.setTextColor(color);
        GradientDrawable shape = new GradientDrawable();
        shape.setColor(background);
        shape.setCornerRadius(dp(16));
        button.setBackground(shape);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(64));
        params.topMargin = dp(16);
        button.setLayoutParams(params);
        return button;
    }

    private int dp(int value) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value, getResources().getDisplayMetrics()));
    }
}
