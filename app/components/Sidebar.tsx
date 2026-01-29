"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";

interface SidebarProps {
  user: any;
}

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);

  const menuItems = [
    {
      id: "genel-bakis",
      label: "Genel Bakış",
      icon: "📊",
      path: "/",
    },
    {
      id: "duyurular",
      label: "Duyurular",
      icon: "📢",
      path: "/duyurular",
    },
    {
      id: "gorevler",
      label: "Görevler",
      icon: "✅",
      path: "/gorevler",
    },
    {
      id: "takvim",
      label: "Takvim",
      icon: "📅",
      path: "/takvim",
    },
    {
      id: "gelinler",
      label: "Gelinler",
      icon: "👰",
      path: "/gelinler",
    },
    {
      id: "personel",
      label: "Personel",
      icon: "👤",
      submenu: [
        { label: "Tüm Personel", path: "/personel" },
        { label: "Yöneticiler", path: "/personel?tur=Yönetici" },
        { label: "Yetkililer", path: "/personel?tur=Yetkili" },
        { label: "Ayrılanlar", path: "/personel?ayrilanlar=true" },
        { label: "Giriş-Çıkış", path: "/giris-cikis" },
        { label: "Vardiya Planları", path: "/vardiya" },
        { label: "Çalışma Saatleri", path: "/calisma-saatleri" },
      ],
    },
    {
      id: "izinler",
      label: "İzinler",
      icon: "🏖️",
      submenu: [
        { label: "İzin Ekle", path: "/izinler/ekle" },
        { label: "İzin Listesi", path: "/izinler" },
        { label: "İzin Toplamları", path: "/izinler/toplamlar" },
        { label: "İzin Talepleri", path: "/izinler/talepler" },
        { label: "İzin Hakkı Ekle", path: "/izinler/hakki-ekle" },
        { label: "İzin Haklarını Listele", path: "/izinler/haklar" },
        { label: "İzin Değişiklik Kayıtları", path: "/izinler/degisiklikler" },
      ],
    },
    {
      id: "raporlar",
      label: "Raporlar",
      icon: "📈",
      submenu: [
        { label: "Aylık Rapor", path: "/raporlar/aylik" },
        { label: "Gelir Raporu", path: "/raporlar/gelir" },
        { label: "Personel Raporu", path: "/raporlar/personel" },
      ],
    },
    {
      id: "ayarlar",
      label: "Ayarlar",
      icon: "⚙️",
      path: "/ayarlar",
    },
  ];

  // Sayfa yüklendiğinde veya pathname değiştiğinde aktif menüyü aç
  useEffect(() => {
    // Hangi parent menünün altında olduğumuzu bul
    for (const item of menuItems) {
      if (item.submenu) {
        const isInSubmenu = item.submenu.some(sub => {
          const [subPath, subQuery] = sub.path.split("?");
          
          // Pathname eşleşiyor mu?
          if (pathname === subPath) {
            // Query string kontrolü
            if (!subQuery) return searchParams.toString() === "";
            return searchParams.toString() === subQuery;
          }
          
          // Alt sayfa kontrolü (örn: /izinler/ekle pathname'i, /izinler ile başlar mı?)
          // Ama /izinler için değil, sadece /izinler/xxx alt sayfaları için
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
      console.error("Çıkış hatası:", error);
    }
  };

  const toggleMenu = (menu: string) => {
    setExpandedMenu(expandedMenu === menu ? null : menu);
  };

  const isActive = (path: string) => {
    // Path'i parse et
    const [cleanPath, queryString] = path.split("?");
    
    // Ana sayfa için özel kontrol
    if (cleanPath === "/") {
      return pathname === "/" && searchParams.toString() === "";
    }
    
    // Pathname eşleşmeli
    if (pathname !== cleanPath) return false;
    
    // Query string yoksa
    if (!queryString) {
      // Mevcut URL'de de query string olmamalı
      return searchParams.toString() === "";
    }
    
    // Query string varsa karşılaştır
    return searchParams.toString() === queryString;
  };

  const isParentActive = (submenu: any[]) => 
    submenu.some(sub => isActive(sub.path));

  return (
    <div className="sidebar scrollbar-thin">
      {/* Logo & User */}
      <div className="p-4 border-b border-gray-200">
        <div className="gradient-primary text-white p-3 rounded-lg mb-3">
          <h1 className="text-lg font-bold">GYS Studio</h1>
          <p className="text-xs opacity-90">Gizem Yolcu</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
            <span className="text-primary-600 font-bold text-sm">
              {user?.email?.[0]?.toUpperCase() || "A"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">
              {user?.email?.split("@")[0] || "Admin"}
            </p>
            <p className="text-xs text-gray-500">Yönetici</p>
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <nav className="p-2 space-y-1">
        {menuItems.map((item) => (
          <div key={item.id}>
            {item.submenu ? (
              <>
                <button
                  onClick={() => toggleMenu(item.id)}
                  className={`sidebar-item w-full ${
                    isParentActive(item.submenu)
                      ? "sidebar-item-active"
                      : ""
                  }`}
                >
                  <span>{item.icon}</span>
                  <span className="flex-1 text-left">{item.label}</span>
                  <span className="text-xs transition-transform" style={{
                    transform: expandedMenu === item.id ? "rotate(90deg)" : "rotate(0deg)"
                  }}>
                    ▶
                  </span>
                </button>
                {expandedMenu === item.id && (
                  <div className="sidebar-submenu animate-slide-in">
                    {item.submenu.map((subItem: any) => (
                      <Link
                        key={subItem.path}
                        href={subItem.path}
                        className={`sidebar-item ${
                          isActive(subItem.path) ? "sidebar-item-active" : ""
                        }`}
                      >
                        <span className="text-xs">→</span>
                        <span>{subItem.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <Link
                href={item.path!}
                className={`sidebar-item ${
                  isActive(item.path!) ? "sidebar-item-active" : ""
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            )}
          </div>
        ))}
      </nav>

      {/* Logout Button */}
      <div className="p-4 border-t border-gray-200 mt-auto">
        <button
          onClick={handleLogout}
          className="btn btn-ghost w-full"
        >
          <span>🚪</span>
          <span>Çıkış Yap</span>
        </button>
      </div>
    </div>
  );
}