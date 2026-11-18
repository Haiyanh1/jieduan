# JieduanBoot（可选）

开机后拉起主 Activity，让 JS 侧重挂本地闹钟。

## 现状说明

- 本目录提供 **Java 源码 + Manifest**，需自行打成 AAR 后才能随正式包生效。
- 未接入时：App 会在 **每次回到前台** 时重挂提醒（`ensureRemindersAlive`），重启后需用户再打开一次 App。

## 接入步骤（概要）

1. 用 Android Studio 将 `android/` 打成 AAR  
2. 放入本插件目录并在 HBuilderX「App 原生插件配置」中勾选 `JieduanBoot`  
3. 使用 **自定义基座 / 云打包** 重新打包  

未完成上述步骤前，请依赖设置里的「检查提醒状态」与回前台重挂。
