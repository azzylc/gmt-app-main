// app/api/migrate-personnel/route.ts
// Mevcut personellere Firebase Auth kaydı ekler

import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/app/lib/firestore-admin';

const DEFAULT_PASSWORD = '9918';

export async function POST(req: NextRequest) {
  // Güvenlik: Sadece CRON_SECRET ile çalışsın
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = {
    success: [] as string[],
    failed: [] as { email: string; error: string }[],
    skipped: [] as string[],
  };

  try {
    // Tüm personelleri çek
    const personnelSnapshot = await adminDb.collection('personnel').get();
    
    console.log(`📋 ${personnelSnapshot.size} personel bulundu`);

    for (const doc of personnelSnapshot.docs) {
      const data = doc.data();
      const email = data.email;
      const displayName = `${data.ad} ${data.soyad}`;

      // Email yoksa atla
      if (!email) {
        results.skipped.push(`${displayName} (email yok)`);
        continue;
      }

      // Zaten authUid varsa atla
      if (data.authUid) {
        results.skipped.push(`${displayName} (zaten auth var)`);
        continue;
      }

      try {
        // Firebase Auth'da kullanıcı oluştur
        const userRecord = await adminAuth.createUser({
          email: email,
          password: DEFAULT_PASSWORD,
          displayName: displayName,
          disabled: !data.aktif,
        });

        // Firestore doc'u güncelle - authUid ekle
        await adminDb.collection('personnel').doc(doc.id).update({
          authUid: userRecord.uid,
          migratedAt: new Date().toISOString(),
        });

        console.log(`✅ ${displayName} (${email}) → ${userRecord.uid}`);
        results.success.push(`${displayName} (${email})`);

      } catch (authError: any) {
        console.error(`❌ ${displayName}: ${authError.message}`);
        
        // Email zaten varsa, mevcut kullanıcıyı bul ve bağla
        if (authError.code === 'auth/email-already-exists') {
          try {
            const existingUser = await adminAuth.getUserByEmail(email);
            await adminDb.collection('personnel').doc(doc.id).update({
              authUid: existingUser.uid,
              migratedAt: new Date().toISOString(),
            });
            results.success.push(`${displayName} (${email}) - mevcut auth bağlandı`);
            continue;
          } catch (e) {
            // Bağlama da başarısız
          }
        }
        
        results.failed.push({ 
          email: email, 
          error: authError.message 
        });
      }
    }

    return NextResponse.json({
      status: 'completed',
      summary: {
        total: personnelSnapshot.size,
        success: results.success.length,
        failed: results.failed.length,
        skipped: results.skipped.length,
      },
      details: results,
      defaultPassword: DEFAULT_PASSWORD,
    });

  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { error: 'Migration failed', details: error.message },
      { status: 500 }
    );
  }
}

// GET - Migration durumunu kontrol et
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const personnelSnapshot = await adminDb.collection('personnel').get();
  
  let withAuth = 0;
  let withoutAuth = 0;
  const missing: string[] = [];

  personnelSnapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.authUid) {
      withAuth++;
    } else {
      withoutAuth++;
      missing.push(`${data.ad} ${data.soyad} (${data.email || 'email yok'})`);
    }
  });

  return NextResponse.json({
    total: personnelSnapshot.size,
    withAuth,
    withoutAuth,
    missingAuth: missing,
  });
}