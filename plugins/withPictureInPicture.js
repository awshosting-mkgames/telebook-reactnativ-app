// Video call ke dauraan Home dabane par system Picture-in-Picture (Android 8+).
//
// Kya karta hai (har prebuild me, kyunki android/ folder git-ignored hai):
//  1. AndroidManifest: MainActivity par supportsPictureInPicture + PiP ke liye zaroori configChanges.
//  2. PipModule.kt / PipPackage.kt likhta hai aur MainApplication me register karta hai.
//     JS: NativeModules.PipModule.setEnabled(bool) -> call connected ho tab true. Android 12+ par
//     setAutoEnterEnabled se Home dabate hi PiP; purane versions par MainActivity.onUserLeaveHint.
//  3. MainActivity.onUserLeaveHint override (Android 8-11 ke liye).
const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod, withMainActivity, withMainApplication } = require('@expo/config-plugins');

const moduleKt = (pkg) => `package ${pkg}

import android.app.Activity
import android.app.PictureInPictureParams
import android.os.Build
import android.util.Rational
import androidx.activity.ComponentActivity
import androidx.core.app.PictureInPictureModeChangedInfo
import androidx.core.util.Consumer
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.modules.core.DeviceEventManagerModule

/** Video call ke liye system Picture-in-Picture. JS: setEnabled(bool), enter(), isInPip(). */
class PipModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        @Volatile var enabled = false
        @Volatile var inPip = false

        private fun params(auto: Boolean): PictureInPictureParams {
            val b = PictureInPictureParams.Builder().setAspectRatio(Rational(9, 16))
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) b.setAutoEnterEnabled(auto)
            return b.build()
        }

        /** MainActivity.onUserLeaveHint se (Android 8-11; 12+ par auto-enter hi kaam karta hai). */
        fun enterIfEnabled(activity: Activity) {
            if (!enabled || Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) return
            try { activity.enterPictureInPictureMode(params(true)) } catch (e: Exception) { /* PiP allowed nahi */ }
        }
    }

    private var listener: Consumer<PictureInPictureModeChangedInfo>? = null
    private var listenerOwner: ComponentActivity? = null

    override fun getName(): String = "PipModule"

    private fun emit(value: Boolean) {
        inPip = value
        try {
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("pipModeChanged", value)
        } catch (e: Exception) { /* JS abhi ready nahi */ }
    }

    private fun attachListener(activity: Activity?) {
        val owner = activity as? ComponentActivity ?: return
        if (listenerOwner === owner) return
        detachListener()
        val l = Consumer<PictureInPictureModeChangedInfo> { info -> emit(info.isInPictureInPictureMode) }
        owner.addOnPictureInPictureModeChangedListener(l)
        listener = l
        listenerOwner = owner
    }

    private fun detachListener() {
        val l = listener
        val o = listenerOwner
        if (l != null && o != null) o.removeOnPictureInPictureModeChangedListener(l)
        listener = null
        listenerOwner = null
    }

    @ReactMethod
    fun setEnabled(value: Boolean) {
        enabled = value
        val act = reactApplicationContext.currentActivity ?: return
        act.runOnUiThread {
            attachListener(act)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                try { act.setPictureInPictureParams(params(value)) } catch (e: Exception) { /* ignore */ }
            }
        }
    }

    @ReactMethod
    fun enter() {
        val act = reactApplicationContext.currentActivity ?: return
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        act.runOnUiThread {
            attachListener(act)
            try { act.enterPictureInPictureMode(params(enabled)) } catch (e: Exception) { /* ignore */ }
        }
    }

    @ReactMethod
    fun isInPip(promise: Promise) { promise.resolve(inPip) }

    // NativeEventEmitter ke liye (RN warning se bachne ko)
    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}

    override fun invalidate() {
        enabled = false
        detachListener()
        super.invalidate()
    }
}
`;

const packageKt = (pkg) => `package ${pkg}

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class PipPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(PipModule(reactContext))

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
`;

const withManifest = (config) =>
    withAndroidManifest(config, (cfg) => {
        const app = cfg.modResults.manifest.application?.[0];
        const activity = app?.activity?.find((a) => a.$['android:name'] === '.MainActivity');
        if (!activity) throw new Error('withPictureInPicture: MainActivity manifest me nahi mila');
        activity.$['android:supportsPictureInPicture'] = 'true';
        const need = ['screenSize', 'smallestScreenSize', 'screenLayout', 'orientation'];
        const have = (activity.$['android:configChanges'] || '').split('|').filter(Boolean);
        need.forEach((c) => { if (!have.includes(c)) have.push(c); });
        activity.$['android:configChanges'] = have.join('|');
        return cfg;
    });

const withFiles = (config) =>
    withDangerousMod(config, ['android', async (cfg) => {
        const pkg = cfg.android?.package;
        if (!pkg) throw new Error('withPictureInPicture: android.package app.json me set hona chahiye');
        const dir = path.join(cfg.modRequest.platformProjectRoot, 'app/src/main/java', ...pkg.split('.'));
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'PipModule.kt'), moduleKt(pkg));
        fs.writeFileSync(path.join(dir, 'PipPackage.kt'), packageKt(pkg));
        return cfg;
    }]);

const withRegister = (config) =>
    withMainApplication(config, (cfg) => {
        let src = cfg.modResults.contents;
        if (!src.includes('PipPackage()')) {
            if (src.includes('PackageList(this).packages.apply {')) {
                src = src.replace('PackageList(this).packages.apply {', 'PackageList(this).packages.apply {\n          add(PipPackage())');
            } else {
                throw new Error('withPictureInPicture: MainApplication me PackageList(this).packages.apply { nahi mila');
            }
        }
        cfg.modResults.contents = src;
        return cfg;
    });

const withLeaveHint = (config) =>
    withMainActivity(config, (cfg) => {
        let src = cfg.modResults.contents;
        if (cfg.modResults.language !== 'kt') {
            console.warn('withPictureInPicture: MainActivity Kotlin nahi hai, onUserLeaveHint skip (Android 12+ auto-enter chalega)');
            return cfg;
        }
        if (!src.includes('PipModule.enterIfEnabled')) {
            const marker = /class MainActivity\s*:\s*ReactActivity\(\)\s*\{/;
            if (marker.test(src)) {
                src = src.replace(marker, (m) => `${m}
  // @generated begin pip-leave-hint
  override fun onUserLeaveHint() {
    super.onUserLeaveHint()
    PipModule.enterIfEnabled(this)
  }
  // @generated end pip-leave-hint
`);
            } else {
                console.warn('withPictureInPicture: MainActivity class line nahi mili, onUserLeaveHint skip');
            }
        }
        cfg.modResults.contents = src;
        return cfg;
    });

module.exports = (config) => withLeaveHint(withRegister(withFiles(withManifest(config))));
