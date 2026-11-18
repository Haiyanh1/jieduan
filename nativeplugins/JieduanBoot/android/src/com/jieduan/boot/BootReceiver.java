package com.jieduan.boot;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

/**
 * 静态开机 Receiver：拉起主 Activity（透明/后台），
 * 让 uni-app 的 onLaunch/onShow 有机会执行 scheduleReminders。
 *
 * 打包说明：需用 Android Studio 打成 AAR 放入本插件 android 目录，
 * 并在 HBuilderX「App 原生插件配置」中勾选 JieduanBoot。
 * 未接入时，App 仍会在下次用户打开时通过 elapsedRealtime 检测重启并重挂。
 */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (action == null) return;

        boolean boot =
            Intent.ACTION_BOOT_COMPLETED.equals(action)
            || Intent.ACTION_LOCKED_BOOT_COMPLETED.equals(action)
            || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)
            || "android.intent.action.QUICKBOOT_POWERON".equals(action);

        if (!boot) return;

        try {
            SharedPreferences sp = context.getSharedPreferences("jieduan_boot", Context.MODE_PRIVATE);
            sp.edit().putBoolean("needs_reschedule", true).putLong("boot_at", System.currentTimeMillis()).apply();
        } catch (Throwable ignored) {}

        try {
            String pkg = context.getPackageName();
            Intent launch = context.getPackageManager().getLaunchIntentForPackage(pkg);
            if (launch == null) {
                launch = new Intent(Intent.ACTION_MAIN);
                launch.addCategory(Intent.CATEGORY_LAUNCHER);
                launch.setPackage(pkg);
            }
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            launch.putExtra("jieduan_boot_reschedule", true);
            context.startActivity(launch);
        } catch (Throwable ignored) {}
    }
}
