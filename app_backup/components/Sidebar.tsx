"use client";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";

interface SidebarProps {
  user: any;
}

function SidebarContent({ user }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  const [kullaniciGruplar, setKullaniciGruplar] = useState<string[]>([]);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [personelData, setPersonelData] = useState<any>(null);

  // Mobil kontrolu
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Sayfa degisince mobil menuyu kapat
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  // Kullanici gruplarini Firebase'den cek
  useEffect(() => {
    if (!user?.email) return;
    const q = query(collection(db, "personnel"), where("email", "==", user.email));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        setKullaniciGruplar(data.grupEtiketleri || []);
        setPersonelData(data);
      }
    });
    return () => unsubscribe();
  }, [user?.email]);

  const isKurucu = kullaniciGruplar.some((g) => g.toLowerCase() === "kurucu");

  const menuItems = [
    { id: "qr-giris", label: "Giris-Cikis", icon: "📱", path: "/qr-giris" },
    { id: "genel-bakis", label: "Genel Bakis", icon: "📊", path: "/" },
    { id: "duyurular", label: "Duyurular", icon: "📢", path: "/duyurular" },
    { id: "gorevler", label: "Gorevler", icon: "✅", path: "/gorevler" },
    { id: "takvim", label: "Takvim", icon: "📅", path: "/takvim" },
    { id: "gelinler", label: "Gelinler", icon: "👰", path: "/gelinler" },
    {
      id: "personel",
      label: "Personel",
      icon: "👤",
      submenu: [
        { label: "Tum Personel", path: "/personel" },
        { label: "Kurucular", path: "/personel?grup=kurucu" },
        { label: "Yoneticiler", path: "/personel?grup=yonetici" },
        { label: "Ayrilanlar", path: "/personel?ayrilanlar=true" },
        { label: "Giris-Cikis Kayitlari", path: "/giris-cikis" },
        { label: "Vardiya Planlari", path: "/vardiya" },
        { label: "Calisma Saatleri", path: "/calisma-saatleri" },
      ],
    },
    {
      id: "izinler",
      label: "Izinler",
      icon: "🏖️",
      submenu: [
        { label: "Izin Ekle", path: "/izinler/ekle" },
        { label: "Izin Listesi", path: "/izinler" },
        { label: "Izin Toplamlari", path: "/izinler/toplamlar" },
        { label: "Izin Talepleri", path: "/izinler/talepler" },
        { label: "Izin Hakki Ekle", path: "/izinler/hakki-ekle" },
        { label: "Izin Haklarini Listele", path: "/izinler/haklar" },
        { label: "Izin Degisiklik Kayitlari", path: "/izinler/degisiklikler" },
      ],
    },
    {
      id: "raporlar",
      label: "Raporlar",
      icon: "📈",
      submenu: [
        { label: "Gelin Raporlari", path: "/gelin-raporlari" },
        { label: "Aylik Rapor", path: "/raporlar" },
      ],
    },
    ...(isKurucu ? [{ id: "yonetim", label: "Yonetim Paneli", icon: "👑", path: "/yonetim" }] : []),
    { id: "ayarlar", label: "Ayarlar", icon: "⚙️", path: "/ayarlar" },
  ];

  const bottomNavItems = [
    { icon: "🏠", label: "Ana Sayfa", path: "/" },
    { icon: "📱", label: "Giris-Cikis", path: "/qr-giris" },
    { icon: "👰", label: "Gelinler", path: "/gelinler" },
    { icon: "✅", label: "Gorevler", path: "/gorevler" },
    { icon: "☰", label: "Menu", action: "menu" },
  ];

  useEffect(() => {
    for (const item of menuItems) {
      if (item.submenu) {
        const isInSubmenu = item.submenu.some((sub) => {
          const [subPath, subQuery] = sub.path.split("?");
          if (pathname === subPath) {
            if (!subQuery) return searchParams.toString() === "";
            return searchParams.toString() === subQuery;
          }
          if (pathname.startsWith(subPath + "/")) return true;
          return false;
        });
        if (isInSubmenu) {
          setExpandedMenu(item.id);
          return;
        }
      }
    }
  }, [pathname, searchParams]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Cikis hatasi:", error);
    }
  };

  const toggleMenu = (menu: string) => {
    setExpandedMenu(expandedMenu === menu ? null : menu);
  };

  const isActive = (path: string) => {
    const [cleanPath, queryString] = path.split("?");
    if (cleanPath === "/") {
      return pathname === "/" && searchParams.toString() === "";
    }
    if (pathname !== cleanPath) return false;
    if (!queryString) {
      return searchParams.toString() === "";
    }
    return searchParams.toString() === queryString;
  };

  const isParentActive = (submenu: any[]) => submenu.some((sub) => isActive(sub.path));

  const MenuContent = () => (
    <>
      <div className="p-4 border-b border-gray-200">
        <div className="bg-gradient-to-r from-pink-500 to-pink-600 text-white p-3 rounded-xl mb-3">
          <h1 className="text-lg font-bold">GYS Studio</h1>
          <p className="text-xs opacity-90">Gizem Yolcu</p>
        </div>
        <div className="flex items-center gap-3">
          {personelData?.foto ? (
            <img src={personelData.foto} alt="" className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center">
              <span className="text-pink-600 font-bold text-sm">{user?.email?.[0]?.toUpperCase() || "A"}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">
              {personelData?.ad ? `${personelData.ad} ${personelData.soyad || ""}` : user?.email?.split("@")[0] || "Admin"}
            </p>
            <p className="text-xs text-gray-500">{isKurucu ? "Kurucu" : "Personel"}</p>
          </div>
        </div>
      </div>

      <nav className="p-2 space-y-1 flex-1 overflow-y-auto">
        {menuItems.map((item) => (
          <div key={item.id}>
            {item.submenu ? (
              <>
                <button
                  onClick={() => toggleMenu(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isParentActive(item.submenu) ? "bg-pink-50 text-pink-600" : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span className="flex-1 text-left">{item.label}</span>
                  <span className={`text-xs transition-transform duration-200 ${expandedMenu === item.id ? "rotate-90" : ""}`}>▶</span>
                </button>
                <div className={`overflow-hidden transition-all duration-200 ${expandedMenu === item.id ? "max-h-96" : "max-h-0"}`}>
                  <div className="ml-4 pl-4 border-l-2 border-gray-200 space-y-1 py-1">
                    {item.submenu.map((subItem: any) => (
                      <Link
                        key={subItem.path}
                        href={subItem.path}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                          isActive(subItem.path) ? "bg-pink-500 text-white font-medium" : "text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        <span>{subItem.label}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <Link
                href={item.path!}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive(item.path!) ? "bg-pink-500 text-white" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            )}
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-200">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl transition-all text-sm font-medium"
        >
          <span>🚪</span>
          <span>Cikis Yap</span>
        </button>
      </div>
    </>
  );

  // MOBIL GORUNUM
  if (isMobile) {
    return (
      <>
        <header className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 z-40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-r from-pink-500 to-pink-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-xs font-bold">GYS</span>
            </div>
            <span className="font-semibold text-gray-800">GYS Studio</span>
          </div>
          <button
            onClick={() => setIsMobileOpen(true)}
            className="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded-xl transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </header>

        {isMobileOpen && <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setIsMobileOpen(false)} />}

        <div
          className={`fixed top-0 left-0 h-full w-72 bg-white z-50 transform transition-transform duration-300 ease-out flex flex-col ${
            isMobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <button
            onClick={() => setIsMobileOpen(false)}
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition z-10"
          >
            X
          </button>
          <MenuContent />
        </div>

        <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-200 flex items-center justify-around z-40 px-2">
          {bottomNavItems.map((item, index) =>
            item.action === "menu" ? (
              <button
                key={index}
                onClick={() => setIsMobileOpen(true)}
                className="flex flex-col items-center justify-center w-14 h-12 rounded-xl text-gray-500"
              >
                <span className="text-xl mb-0.5">{item.icon}</span>
                <span className="text-[10px]">{item.label}</span>
              </button>
            ) : (
              <Link
                key={index}
                href={item.path!}
                className={`flex flex-col items-center justify-center w-14 h-12 rounded-xl transition-all ${
                  isActive(item.path!) ? "text-pink-500 bg-pink-50" : "text-gray-500"
                }`}
              >
                <span className="text-xl mb-0.5">{item.icon}</span>
                <span className="text-[10px]">{item.label}</span>
              </Link>
            )
          )}
        </nav>

        <div className="h-14" />
      </>
    );
  }

  // DESKTOP GORUNUM
  return (
    <div className="fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 flex flex-col z-40">
      <MenuContent />
    </div>
  );
}

export default function Sidebar({ user }: SidebarProps) {
  return (
    <Suspense
      fallback={
        <div className="fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
        </div>
      }
    >
      <SidebarContent user={user} />
    </Suspense>
  );
}