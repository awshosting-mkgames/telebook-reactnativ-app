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
import android.os.Build
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Foreground me aane wali call par phone ka default ringtone loop me bajata hai
 * (jo user ne Settings > Sound me chuna hai). Silent / vibrate mode ko system khud respect karta hai.
 */
class RingtoneModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

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

    private fun stopInternal() {
        player?.let {
            try { if (it.isPlaying) it.stop() } catch (e: Exception) { /* already stopped */ }
            it.release()
        }
        player = null
        try { fallback?.stop() } catch (e: Exception) { /* ignore */ }
        fallback = null
    }

    override fun invalidate() {
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
