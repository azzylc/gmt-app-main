import { NextResponse } from "next/server";
import { adminDb } from "@/app/lib/firestore-admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const confirm = searchParams.get("confirm");
  
  try {
    const snapshot = await adminDb.collection("gelinler").get();
    
    const silinecekler: { id: string; isim: string }[] = [];
    
    snapshot.docs.forEach((doc) => {
      const isim = doc.data().isim || "";
      const upper = isim.toUpperCase();
      if (upper.includes("ERTELENDİ") || upper.includes("İPTAL")) {
        silinecekler.push({ id: doc.id, isim: isim });
      }
    });
    
    // Sadece sayım modu
    if (confirm !== "true") {
      return NextResponse.json({
        mode: "SAYIM (silmek için ?confirm=true ekle)",
        toplam: silinecekler.length,
        ilk10: silinecekler.slice(0, 10)
      });
    }
    
    // Silme modu
    const batch = adminDb.batch();
    silinecekler.forEach((item) => {
      batch.delete(adminDb.collection("gelinler").doc(item.id));
    });
    await batch.commit();
    
    return NextResponse.json({
      mode: "SİLİNDİ",
      silinenSayisi: silinecekler.length
    });
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}