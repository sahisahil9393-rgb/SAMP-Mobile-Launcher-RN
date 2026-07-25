import RNFetchBlob from 'rn-fetch-blob'; // مكتبة تحميل الملفات - راح تحتاج تثبتها (شرح بالأسفل)
import AsyncStorage from '@react-native-async-storage/async-storage'; // لحفظ رقم النسخة محلياً

// ⚠️ عدّل هذا الرابط لرابط manifest.json الحقيقي عندك (من GitHub Releases)
const MANIFEST_URL = 'https://raw.githubusercontent.com/USERNAME/REPO/main/manifest.json';

// ⚠️ عدّل هذا المسار ليكون نفس مسار ملفات اللعبة عندك
const GAME_FILES_PATH = `${RNFetchBlob.fs.dirs.SDCardDir}/GTA/updates`;

const VERSION_KEY = 'content_update_version';

/**
 * يجيب رقم النسخة المحفوظ محلياً (0 لو أول مرة)
 */
async function getLocalVersion() {
  const value = await AsyncStorage.getItem(VERSION_KEY);
  return value ? parseInt(value, 10) : 0;
}

/**
 * يحفظ رقم النسخة الجديد بعد نجاح التحميل
 */
async function saveLocalVersion(version) {
  await AsyncStorage.setItem(VERSION_KEY, String(version));
}

/**
 * الخطوة 1: يفحص هل فيه تحديث جديد بمقارنة النسخة المحلية بالسيرفر
 * يرجع null لو ما فيه تحديث، أو معلومات التحديث لو فيه
 */
export async function checkForUpdates() {
  try {
    const response = await fetch(MANIFEST_URL);
    const manifest = await response.json();

    const localVersion = await getLocalVersion();

    if (manifest.version <= localVersion) {
      return null; // ما فيه تحديث جديد
    }

    return manifest; // فيه تحديث، نرجع كل المعلومات (النسخة + الملفات)
  } catch (error) {
    console.error('فشل فحص التحديثات:', error);
    throw error;
  }
}

/**
 * الخطوة 2: يحمّل كل ملفات التحديث ويحفظها بمسار اللعبة
 * onProgress: دالة استدعاء تستقبل (اسم الملف, نسبة التقدم) لتحديث الواجهة
 */
export async function downloadUpdate(manifest, onProgress) {
  // تأكد المجلد الهدف موجود
  const dirExists = await RNFetchBlob.fs.isDir(GAME_FILES_PATH);
  if (!dirExists) {
    await RNFetchBlob.fs.mkdir(GAME_FILES_PATH);
  }

  for (const file of manifest.files) {
    const destination = `${GAME_FILES_PATH}/${file.name}`;

    // التحميل يكتب فوق الملف تلقائياً لو موجود، أو ينشئه لو جديد
    await RNFetchBlob.config({
      path: destination,
    })
      .fetch('GET', file.url)
      .progress((received, total) => {
        const percent = Math.round((received / total) * 100);
        if (onProgress) onProgress(file.name, percent);
      });
  }

  // بعد نجاح كل الملفات، نحفظ رقم النسخة الجديد
  await saveLocalVersion(manifest.version);
}

/**
 * دالة شاملة: تفحص وتحمّل تلقائياً لو فيه تحديث
 * استخدمها مباشرة بشاشة البداية (قبل الاتصال بالسيرفر)
 */
export async function checkAndUpdate({ onUpdateFound, onProgress, onComplete, onNoUpdate, onError }) {
  try {
    const manifest = await checkForUpdates();

    if (!manifest) {
      if (onNoUpdate) onNoUpdate();
      return;
    }

    if (onUpdateFound) onUpdateFound(manifest);

    await downloadUpdate(manifest, onProgress);

    if (onComplete) onComplete();
  } catch (error) {
    if (onError) onError(error);
  }
}

/*
=====================================================
مثال استخدام - بداخل شاشة البداية (مثلاً src/screens/StartScreen.js)
=====================================================

import { checkAndUpdate } from '../services/ContentUpdater';

// عند الضغط على زر Start:
const handleStartPress = () => {
  checkAndUpdate({
    onNoUpdate: () => {
      // ما فيه تحديث - كمّل مباشرة للاتصال بالسيرفر
      connectToServer();
    },
    onUpdateFound: (manifest) => {
      console.log('فيه تحديث جديد، النسخة:', manifest.version);
      setShowUpdateModal(true); // اعرض نافذة "جاري التحديث"
    },
    onProgress: (fileName, percent) => {
      setDownloadProgress(percent); // حدّث شريط التقدم بالواجهة
    },
    onComplete: () => {
      setShowUpdateModal(false);
      connectToServer(); // خلص التحميل - كمّل للاتصال بالسيرفر
    },
    onError: (error) => {
      Alert.alert('خطأ', 'فشل تحميل التحديث: ' + error.message);
    },
  });
};
*/
