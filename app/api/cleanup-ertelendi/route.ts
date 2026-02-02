import { NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firestore-admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const confirm = searchParams.get("confirm");
  
  try {
    const snapshot = await adminDb.collection("gelinler").get();
    
    const silinecekler: { id: string; isim: string }[] = [];
    
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      // Tüm document'ı string olarak kontrol et
      const allText = JSON.stringify(data).toUpperCase();
      if (allText.includes("ERTELENDİ") || allText.includes("İPTAL") || allText.includes("IPTAL")) {
        silinecekler.push({ id: doc.id, isim: data.isim || "" });
      }
    });
    
    // Sadece sayım modu
    if (confirm !== "true") {
      return NextResponse.json({
        mode: "SAYIM (silmek için ?confirm=true ekle)",
        toplam: silinecekler.length,
        ornekler: silinecekler.slice(0, 10)
      });
    }
    
    // Silme modu - batch ile (500 limit)
    let deleted = 0;
    const batchSize = 500;
    
    for (let i = 0; i < silinecekler.length; i += batchSize) {
      const batch = adminDb.batch();
      const chunk = silinecekler.slice(i, i + batchSize);
      
      chunk.forEach((item) => {
        batch.delete(adminDb.collection("gelinler").doc(item.id));
      });
      
      await batch.commit();
      deleted += chunk.length;
      console.log(`🗑️ ${deleted}/${silinecekler.length} silindi`);
    }
    
    return NextResponse.json({
      mode: "SİLİNDİ",
      silinenSayisi: deleted
    });
    
  } catch (error: any) {
    console.error("Temizlik hatası:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
