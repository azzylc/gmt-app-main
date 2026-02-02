import { NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firestore-admin";
import { fullSync } from "@/app/lib/calendar-sync";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const confirm = searchParams.get("confirm");
  
  // ONAY KONTROLÜ
  if (confirm !== "RESETFIRESTORE2026") {
    return NextResponse.json({
      error: "Bu API Firestore'daki TÜM gelinleri siler ve yeniden yükler!",
      usage: "?confirm=RESETFIRESTORE2026 ekleyerek onayla"
    }, { status: 400 });
  }
  
  try {
    console.log("🔥 FIRESTORE RESET BAŞLIYOR...");
    
    // 1️⃣ TÜM GELİNLERİ SİL
    console.log("📦 Mevcut kayıtlar siliniyor...");
    const snapshot = await adminDb.collection("gelinler").get();
    const totalDocs = snapshot.size;
    
    let deleted = 0;
    const batchSize = 500;
    
    for (let i = 0; i < snapshot.docs.length; i += batchSize) {
      const batch = adminDb.batch();
      const chunk = snapshot.docs.slice(i, i + batchSize);
      
      chunk.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      deleted += chunk.length;
      console.log(`🗑️ ${deleted}/${totalDocs} silindi`);
    }
    
    console.log(`✅ ${deleted} kayıt silindi`);
    
    // 2️⃣ GOOGLE CALENDAR'DAN YENİDEN YÜK
    console.log("📥 Google Calendar'dan yeniden yükleniyor...");
    const syncResult = await fullSync();
    
    if (!syncResult.success) {
      throw new Error("Full sync başarısız!");
    }
    
    console.log("✅ Yeniden yükleme tamamlandı");
    
    return NextResponse.json({
      success: true,
      silinen: deleted,
      eklenen: syncResult.added,
      ertelendiSilinen: syncResult.deleted,
      atlanan: syncResult.skipped,
      toplamCalendar: syncResult.totalEvents,
      mesaj: "Firestore tamamen sıfırlandı ve yeniden yüklendi!"
    });
    
  } catch (error: any) {
    console.error("❌ Reset hatası:", error);
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
}
