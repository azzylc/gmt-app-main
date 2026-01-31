const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const users = [
  {
    email: 'azizerkanyolcu@outlook.com',
    uid: 'AlxATauS09QIveQF6UgjxP8SKXT2',
    role: 'Kurucu',
    groups: ['GYS']
  }
];

async function setCustomClaims() {
  console.log('🔧 Custom Claims ayarlanıyor...\n');
  
  for (const user of users) {
    try {
      await admin.auth().setCustomUserClaims(user.uid, {
        kullaniciTuru: user.role,
        gruplar: user.groups
      });
      
      console.log(`✅ ${user.email} → ${user.role}`);
      
    } catch (error) {
      console.error(`❌ ${user.email} HATA:`, error.message);
    }
  }
  
  console.log('\n🎉 Custom claims tamamlandı!');
  console.log('⚠️  Yeniden giriş yapman gerekebilir (token yenilenmesi için)');
  process.exit(0);
}

setCustomClaims().catch(error => {
  console.error('❌ Kritik hata:', error);
  process.exit(1);
});
