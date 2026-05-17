# Discord App 💬

تطبيق شبيه بـ Discord مع روم شات كتابي، روم صوتي، ومشاركة شاشة.

## ✨ المميزات

- 📝 **شات كتابي** - رسائل فورية بين المستخدمين
- 🔊 **روم صوتي** - اتصال صوتي حقيقي عبر WebRTC
- 🖥️ **مشاركة الشاشة** - شارك شاشتك مع الآخرين
- 🔐 **تسجيل دخول وأ إنشاء حساب** - نظام مصادقة آمن

## 🚀 التشغيل المحلي

### 1. تثبيت المتطلبات
- Node.js 18+
- npm

### 2. تثبيت المكتبات
```bash
npm install
```

### 3. تشغيل التطبيق
```bash
npm start
```

التطبيق رح يفتح تلقائياً على `http://localhost:3000`

## 🌐 التشغيل على الخادم

### Backend (Render.com)
1. سجل حساب على [Render.com](https://render.com)
2. أنشئ Web Service جديد
3. اربط Repository أو انشئ يدوياً من الملفات في `deploy-server/`
4. الـ Build Command: `npm install`
5. الـ Start Command: `npm start`
6.环境的 PORT: `3001`

### Frontend (Netlify)
1. سجل حساب على [Netlify](https://netlify.com)
2. اربط Repository
3. الـ Build Command: `npm run build`
4. الـ Publish Directory: `build`
5. أضف Environment Variables:
   - `REACT_APP_API_URL` = رابط الـ Backend
   - `REACT_APP_SERVER_URL` = رابط الـ Backend

## 📦 تثبيت على PC (Electron)

### تجميع التطبيق
```bash
npm run dist
```

الملف التنفيذي رح يكون في `dist/`

## 🛠️ التقنيات المستخدمة

- **Frontend**: React.js, Socket.io Client, Simple-Peer (WebRTC)
- **Backend**: Node.js, Express, Socket.io
- **Desktop**: Electron

## 📁 هيكل المشروع

```
discord/
├── src/
│   ├── App.js           # الواجهة الرئيسية
│   ├── index.js         # نقطة الدخول
│   ├── index.css        # الأنماط
│   ├── services/        # خدمات Socket
│   └── hooks/           # WebRTC hooks
├── server/              # الخادم المحلي
├── deploy-server/      # ملفات الرفع للخادم
└── build/               # التطبيق المبني
```

## ⚠️ ملاحظات

- الصوت بين عدة أشخاص يحتاج أكثر من مستخدم متصل
- افتح أكثر من تبويب بالمتصفح للتجربة مع أسماء مختلفة
- البيانات في النسخة المجانية بتتحفظ في الذاكرة (RAM)

## 📝 license

MIT