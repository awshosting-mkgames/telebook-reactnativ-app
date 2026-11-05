// Incoming call par phone ki asli (default) ringtone bajane wala native module.
//
// `android/` folder git-ignored hai aur EAS build me prebuild se dobara banta hai, isliye pehle
// haath se likha RingtoneModule.kt build me aata hi nahi tha aur ringtone silent thi. Ab yeh plugin
// har prebuild me RingtoneModule + RingtonePackage likhta hai aur MainApplication me register karta hai.
const fs = require('fs');
const path = require('path');
const { withDangerousMod, withMainApplication } = require('@expo/config-plugins');

const moduleKt = (pkg) => `package ${pkg}

import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.Ringtone
import android.media.RingtoneManager
import android.net.Uri
import android.app.Activity
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Foreground me aane wali call par phone ka default ringtone loop me bajata hai
 * (jo user ne Settings > Sound me chuna hai). Silent / vibrate mode ko system khud respect karta hai.
 */
class RingtoneModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), ActivityEventListener {

    private var pickerPromise: Promise? = null

    init {
        reactContext.addActivityEventListener(this)
    }

    companion object {
        private const val REQ_PICK_RINGTONE = 7421
    }

    private var player: MediaPlayer? = null
    private var fallback: Ringtone? = null

    override fun getName(): String = "RingtoneModule"

    private fun candidateUris(): List<Uri> {
        val ctx = reactApplicationContext
        return listOfNotNull(
            RingtoneManager.getActualDefaultRingtoneUri(ctx, RingtoneManager.TYPE_RINGTONE),
            RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE),
            RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        )
    }

    @ReactMethod
    fun playRingtone() {
        stopInternal()
        val attrs = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        for (uri in candidateUris()) {
            try {
                val mp = MediaPlayer()
                mp.setAudioAttributes(attrs)
                mp.setDataSource(reactApplicationContext, uri)
                mp.isLooping = true
                mp.prepare()
                mp.start()
                player = mp
                return
            } catch (e: Exception) {
                player?.release()
                player = null
            }
        }
        // MediaPlayer kisi uri par na chale to system Ringtone API (permission issues se bachta hai)
        for (uri in candidateUris()) {
            try {
                val r = RingtoneManager.getRingtone(reactApplicationContext, uri) ?: continue
                r.audioAttributes = attrs
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) r.isLooping = true
                r.play()
                fallback = r
                return
            } catch (e: Exception) {
                // next uri
            }
        }
    }

    @ReactMethod
    fun stopRingtone() {
        stopInternal()
    }

    /**
     * Android 14+ (API 34): full-screen incoming-call UI ke liye "Use full screen intents" special access
     * user ko dena padta hai (Play policy: sirf calling/alarm apps ko default grant). Isse pehle (API < 34)
     * USE_FULL_SCREEN_INTENT install-time pe mil jaata hai, isliye true.
     */
    @ReactMethod
    fun canUseFullScreenIntent(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT < 34) { promise.resolve(true); return }
            val nm = reactApplicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            promise.resolve(nm.canUseFullScreenIntent())
        } catch (e: Exception) {
            promise.resolve(true)   // pata na chale to user ko pareshan mat karo
        }
    }

    /** Full-screen intent wali settings screen kholo (API 34+); purane Android par app notification settings. */
    @ReactMethod
    fun openFullScreenIntentSettings() {
        val ctx = reactApplicationContext
        try {
            val intent = if (Build.VERSION.SDK_INT >= 34) {
                Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT)
            } else {
                Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, ctx.packageName)
            }
            intent.data = if (Build.VERSION.SDK_INT >= 34) android.net.Uri.parse("package:" + ctx.packageName) else null
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            ctx.startActivity(intent)
        } catch (e: Exception) {
            // settings screen na khule to chup-chaap
        }
    }

    private fun stopInternal() {
        player?.let {
            try { if (it.isPlaying) it.stop() } catch (e: Exception) { /* already stopped */ }
            it.release()
        }
        player = null
        try { fallback?.stop() } catch (e: Exception) { /* ignore */ }
        fallback = null
    }

    /** System ringtone picker kholo. Resolve: { uri, title } ya null (cancel). */
    @ReactMethod
    fun pickRingtone(currentUri: String?, promise: Promise) {
        val activity = reactApplicationContext.currentActivity
        if (activity == null) { promise.reject("NO_ACTIVITY", "No foreground activity"); return }
        pickerPromise?.resolve(null)
        pickerPromise = promise
        try {
            val i = Intent(RingtoneManager.ACTION_RINGTONE_PICKER)
            i.putExtra(RingtoneManager.EXTRA_RINGTONE_TYPE, RingtoneManager.TYPE_RINGTONE)
            i.putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_DEFAULT, true)
            i.putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_SILENT, false)
            i.putExtra(RingtoneManager.EXTRA_RINGTONE_TITLE, "Call ringtone")
            if (!currentUri.isNullOrEmpty()) {
                i.putExtra(RingtoneManager.EXTRA_RINGTONE_EXISTING_URI, android.net.Uri.parse(currentUri))
            }
            activity.startActivityForResult(i, REQ_PICK_RINGTONE)
        } catch (e: Exception) {
            pickerPromise = null
            promise.reject("PICKER_FAILED", e.message)
        }
    }

    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode != REQ_PICK_RINGTONE) return
        val p = pickerPromise ?: return
        pickerPromise = null
        if (resultCode != Activity.RESULT_OK || data == null) { p.resolve(null); return }
        val uri: android.net.Uri? = if (Build.VERSION.SDK_INT >= 33) {
            data.getParcelableExtra(RingtoneManager.EXTRA_RINGTONE_PICKED_URI, android.net.Uri::class.java)
        } else {
            @Suppress("DEPRECATION")
            data.getParcelableExtra(RingtoneManager.EXTRA_RINGTONE_PICKED_URI)
        }
        if (uri == null) { p.resolve(null); return }
        val title = try {
            RingtoneManager.getRingtone(reactApplicationContext, uri)?.getTitle(reactApplicationContext) ?: "Custom ringtone"
        } catch (e: Exception) { "Custom ringtone" }
        val map = Arguments.createMap()
        map.putString("uri", uri.toString())
        map.putString("title", title)
        p.resolve(map)
    }

    override fun onNewIntent(intent: Intent) {}

    /**
     * Incoming-call notification channel, user ki chuni ringtone ke saath. Channel ki sound baad me
     * badli nahi ja sakti, isliye har ringtone ke liye nayi channelId banti hai.
     */
    @ReactMethod
    fun createCallChannel(channelId: String, soundUri: String, promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) { promise.resolve(false); return }
            val nm = reactApplicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val attrs = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
            val ch = NotificationChannel(channelId, "Incoming calls", NotificationManager.IMPORTANCE_HIGH)
            ch.setSound(android.net.Uri.parse(soundUri), attrs)
            ch.enableVibration(true)
            ch.vibrationPattern = longArrayOf(1, 800, 1200, 800, 1200, 800, 1200, 800, 1200, 800, 1200)
            ch.lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            nm.createNotificationChannel(ch)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CHANNEL_FAILED", e.message)
        }
    }

    override fun invalidate() {
        reactApplicationContext.removeActivityEventListener(this)
        stopInternal()
        super.invalidate()
    }
}
`;

const packageKt = (pkg) => `package ${pkg}

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class RingtonePackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(RingtoneModule(reactContext))

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
`;

const withFiles = (config) =>
    withDangerousMod(config, ['android', async (cfg) => {
        const pkg = cfg.android?.package;
        if (!pkg) throw new Error('withRingtoneModule: android.package app.json me set hona chahiye');
        const dir = path.join(cfg.modRequest.platformProjectRoot, 'app/src/main/java', ...pkg.split('.'));
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'RingtoneModule.kt'), moduleKt(pkg));
        fs.writeFileSync(path.join(dir, 'RingtonePackage.kt'), packageKt(pkg));
        return cfg;
    }]);

const withRegister = (config) =>
    withMainApplication(config, (cfg) => {
        let src = cfg.modResults.contents;
        if (!src.includes('RingtonePackage()')) {
            if (src.includes('PackageList(this).packages.apply {')) {
                src = src.replace('PackageList(this).packages.apply {', 'PackageList(this).packages.apply {\n          add(RingtonePackage())');
            } else {
                throw new Error('withRingtoneModule: MainApplication me PackageList(this).packages.apply { nahi mila');
            }
        }
        cfg.modResults.contents = src;
        return cfg;
    });

module.exports = (config) => withRegister(withFiles(config));
