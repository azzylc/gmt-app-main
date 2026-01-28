"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";

interface SidebarProps {
  user: any;
}

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);

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

  const isActive = (path: string) => pathname === path;
  const isParentActive = (paths: string[]) => paths.some(path => pathname === path);

  const menuItems = [
    {
      id: "genel-bakis",
      label: "Genel Bakış",
      icon: "📊",
      path: "/",
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
        { label: "İzinler", path: "/izinler" },
        { label: "Giriş-Çıkış", path: "/giris-cikis" },
        { label: "Vardiya Planları", path: "/vardiya" },
        { label: "Çalışma Saatleri", path: "/calisma-saatleri" },
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
                    isParentActive(item.submenu.map(sub => sub.path))
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
                    {item.submenu.map((subItem) => (
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