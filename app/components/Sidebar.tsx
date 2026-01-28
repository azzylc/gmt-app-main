"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { auth } from "../lib/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";

interface SidebarProps {
  user: any;
}

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  const menuItems = [
    { href: "/", label: "Genel Bakış", icon: "⭐", color: "text-yellow-500" },
    { href: "/gelinler", label: "Gelinler", icon: "👰", color: "text-pink-500" },
    { href: "/takvim", label: "Takvim", icon: "📅", color: "text-blue-500" },
    { href: "/personel", label: "Personel", icon: "👥", color: "text-purple-500" },
    { href: "/gorevler", label: "Görevler", icon: "📋", color: "text-teal-500" },
    { href: "/izinler", label: "İzinler", icon: "🏖️", color: "text-green-500" },
    { href: "/duyurular", label: "Duyurular", icon: "📢", color: "text-orange-500" },
    { href: "/raporlar", label: "Raporlar", icon: "📊", color: "text-indigo-500" },
    { href: "/gelin-raporlari", label: "Gelin Raporları", icon: "📈", color: "text-rose-500" },
  ];

  const bottomItems = [
    { href: "/ayarlar", label: "Ayarlar", icon: "⚙️" },
  ];

  return (
    <div className="fixed left-0 top-0 h-full w-64 bg-white shadow-lg flex flex-col z-40">
      {/* Logo */}
      <div className="p-6 border-b">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-pink-200 to-purple-200 rounded-xl flex items-center justify-center">
            <span className="text-xl">💄</span>
          </div>
          <div>
            <h1 className="font-bold text-gray-800">GMT App</h1>
            <p className="text-xs text-gray-400">Gizem Yolcu Studio</p>
          </div>
        </Link>
      </div>

      {/* Menu */}
      <nav className="flex-1 p-4 overflow-y-auto">
        <div className="space-y-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isActive
                    ? "bg-pink-50 text-pink-600 font-medium"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <span className={`text-lg ${isActive ? item.color : ""}`}>{item.icon}</span>
                <span>{item.label}</span>
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 bg-pink-500 rounded-full"></div>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Bottom */}
      <div className="p-4 border-t">
        {bottomItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 hover:bg-gray-50 transition-all"
          >
            <span className="text-lg">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
        
        {/* User */}
        <div className="mt-4 p-4 bg-gray-50 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-pink-200 to-purple-200 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
              {user?.email?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{user?.email}</p>
              <p className="text-xs text-gray-400">Admin</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="mt-3 w-full bg-red-50 hover:bg-red-100 text-red-600 py-2 rounded-lg text-sm font-medium transition-all"
          >
            Çıkış Yap
          </button>
        </div>
      </div>
    </div>
  );
}
