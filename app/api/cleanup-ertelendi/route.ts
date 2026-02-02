import { NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firestore-admin";
import { getCalendarClient } from "@/app/lib/calendar-sync";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const confirm = searchParams.get("confirm");
  
  try {
    // 1️⃣ GOOGLE CALENDAR'DAN TÜM EVENTLERİ ÇEK
    const calendar = getCalendarClient();
    const response: any = await calendar.events.list({
      calendarId: process.env.GOOGLE_CALENDAR_ID!,
      timeMin: new Date('2025-01-01').toISOString(),
      timeMax: new Date('2030-12-31').toISOString(),
      singleEvents: true,
      maxResults: 2500
    });
    
    const events = response.data.items || [];
    
    // 2️⃣ ERTELENDİ/İPTAL EVENTLERİNİN ID'LERİNİ BUL
    const silinecekIds: string[] = [];
    const ornekler: { id: string; title: string }[] = [];
    
    events.forEach((event: any) => {
      const title = (event.summary || "").toUpperCase();
      
      // ERTELENDİ, İPTAL veya IPTAL içerenleri bul
      if (title.includes("ERTELENDİ") || title.includes("İPTAL") || title.includes("IPTAL")) {
        silinecekIds.push(event.id);
        
        // İlk 10 tanesini örnek olarak sakla
        if (ornekler.length < 10) {
          ornekler.push({
            id: event.id,
            title: event.summary || ""
          });
        }
      }
    });
    
    // SADECE SAYIM MODU
    if (confirm !== "true") {
      return NextResponse.json({
        mode: "SAYIM (silmek için ?confirm=true ekle)",
        toplam: silinecekIds.length,
        ornekler: ornekler
      });
    }
    
    // 3️⃣ SİLME MODU - FIRESTORE'DAN BU ID'LERİ SİL
    let deleted = 0;
    const batchSize = 500;
    
    for (let i = 0; i < silinecekIds.length; i += batchSize) {
      const batch = adminDb.batch();
      const chunk = silinecekIds.slice(i, i + batchSize);
      
      chunk.forEach((id) => {
        batch.delete(adminDb.collection("gelinler").doc(id));
      });
      
      await batch.commit();
      deleted += chunk.length;
      console.log(`🗑️ ${deleted}/${silinecekIds.length} silindi`);
    }
    
    return NextResponse.json({
      mode: "SİLİNDİ",
      silinenSayisi: deleted,
      ornekler: ornekler.slice(0, 5)
    });
    
  } catch (error: any) {
    console.error("Temizlik hatası:", error);
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
}