// Google Play package-ownership verification: APK ke assets me
// adi-registration.properties hona chahiye (sirf snippet, aur kuch nahi).
//
// VERIFY_APK=1 (eas.json ke "verify" profile me set) par APK chhota banta hai:
// sirf arm64-v8a aur Agora ke optional extension .so nahi. Ye APK sirf ownership
// (signature) prove karne ke liye hai, users ko distribute nahi hota.
const {
    withDangerousMod,
    withGradleProperties,
    withAppBuildGradle,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SNIPPET = 'C5DHO26CTPBROAAAAAAAAAAAAA';
const SLIM = process.env.VERIFY_APK === '1';

const withSnippet = (config) =>
    withDangerousMod(config, [
        'android',
        async (cfg) => {
            const dir = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'assets');
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(path.join(dir, 'adi-registration.properties'), SNIPPET);
            return cfg;
        },
    ]);

const withSlimApk = (config) => {
    config = withGradleProperties(config, (cfg) => {
        cfg.modResults = cfg.modResults.filter((p) => p.key !== 'reactNativeArchitectures');
        cfg.modResults.push({ type: 'property', key: 'reactNativeArchitectures', value: 'arm64-v8a' });
        return cfg;
    });
    return withAppBuildGradle(config, (cfg) => {
        const marker = 'packagingOptions {';
        if (!cfg.modResults.contents.includes('libagora_*_extension')) {
            cfg.modResults.contents = cfg.modResults.contents.replace(
                marker,
                `${marker}\n        jniLibs { excludes += ['**/libagora_*_extension.so'] }`
            );
        }
        return cfg;
    });
};

module.exports = (config) => (SLIM ? withSlimApk(withSnippet(config)) : withSnippet(config));
