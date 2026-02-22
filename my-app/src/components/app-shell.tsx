"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

export function AppShell({
  children,
  userLabel,
}: {
  children: ReactNode;
  userLabel: string;
}) {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");

  useEffect(() => {
    setSearchQuery(searchParams.get("q") || "");
  }, [searchParams]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/dashboard?q=${encodeURIComponent(searchQuery)}`);
    } else {
      router.push("/dashboard");
    }
  };

  const navLinks = [
    { name: "Dashboard", href: "/dashboard", icon: "dashboard" },
    { name: "Compounding", href: "/compounding", icon: "science" },
    { name: "Medications", href: "/medications", icon: "medication" },
    { name: "Patients", href: "/patients", icon: "person" },
  ];

  const reportLinks = [
    { name: "Audit Logs", href: "/audit-logs", icon: "history" },
    { name: "Analytics", href: "/analytics", icon: "analytics" },
  ];

  // Helper to determine active state
  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    // For compounding, consider job details as active too
    if (href === "/compounding") {
      return pathname.startsWith("/compounding") || pathname.includes("/dashboard/jobs");
    }
    return pathname.startsWith(href);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background-light text-slate-900 font-display antialiased selection:bg-[rgba(19,127,236,0.2)]">
      {/* Sidebar Navigation */}
      <aside className={`w-64 flex-shrink-0 bg-white border-r border-slate-200 flex-col z-20 transition-transform lg:flex ${isSidebarOpen ? "fixed inset-y-0 left-0 flex" : "hidden"}`}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-100 ">
          <div className="flex items-center">
            <div className="size-8 text-[var(--color-primary)] mr-3">
              <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 42.4379C4 42.4379 14.0962 36.0744 24 41.1692C35.0664 46.8624 44 42.2078 44 42.2078L44 7.01134C44 7.01134 35.068 11.6577 24.0031 5.96913C14.0971 0.876274 4 7.27094 4 7.27094L4 42.4379Z" fill="currentColor"></path>
              </svg>
            </div>
            <h1 className="font-bold text-xl tracking-tight text-slate-900 ">Medivance</h1>
          </div>
          <button className="lg:hidden text-slate-500 hover:text-slate-700" onClick={() => setSidebarOpen(false)}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium group transition-colors ${
                isActive(link.href)
                  ? "bg-[rgba(19,127,236,0.1)] text-[var(--color-primary)]"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <span className={`material-symbols-outlined text-[20px] ${!isActive(link.href) ? "group-hover:text-[var(--color-primary)] transition-colors" : ""}`}>
                {link.icon}
              </span>
              {link.name}
            </Link>
          ))}
          
          <div className="pt-4 pb-2">
            <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Reports</p>
          </div>
          
          {reportLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium group transition-colors ${
                isActive(link.href)
                  ? "bg-[rgba(19,127,236,0.1)] text-[var(--color-primary)]"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <span className={`material-symbols-outlined text-[20px] ${!isActive(link.href) ? "group-hover:text-[var(--color-primary)] transition-colors" : ""}`}>
                {link.icon}
              </span>
              {link.name}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-100 ">
          <form action="/auth/logout" method="post">
            <button className="flex items-center gap-3 w-full px-3 py-2 text-sm font-medium text-slate-600 hover:text-red-600 transition-colors" type="submit">
              <span className="material-symbols-outlined text-[20px]">logout</span>
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50/50 relative">
        {/* Decorative gradient blobs */}
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-50/80 to-transparent pointer-events-none z-0"></div>

        {/* Header */}
        <header className="h-16 flex items-center justify-between px-6 lg:px-8 border-b border-slate-200/60 bg-white/80 backdrop-blur-md z-10 sticky top-0">
          <div className="flex items-center gap-4 lg:hidden">
            <button className="text-slate-500 hover:text-slate-700" onClick={() => setSidebarOpen(true)}>
              <span className="material-symbols-outlined">menu</span>
            </button>
            <div className="size-6 text-[var(--color-primary)]">
              <svg fill="currentColor" viewBox="0 0 48 48"><path d="M4 42.4379C4 42.4379 14.0962 36.0744 24 41.1692C35.0664 46.8624 44 42.2078 44 42.2078L44 7.01134C44 7.01134 35.068 11.6577 24.0031 5.96913C14.0971 0.876274 4 7.27094 4 7.27094L4 42.4379Z"></path></svg>
            </div>
          </div>
          
          <div className="flex flex-1 items-center justify-between max-w-7xl mx-auto w-full">
            <h2 className="text-lg font-semibold text-slate-800 hidden sm:block tracking-tight">Compounding Workspace</h2>
            <div className="flex items-center gap-4 ml-auto">
              <form onSubmit={handleSearch} className="relative hidden sm:block">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <span className="material-symbols-outlined text-[20px]">search</span>
                </span>
                <input 
                  className="w-64 py-2 pl-10 pr-4 text-sm bg-white border border-slate-200 rounded-full focus:outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] placeholder:text-slate-400 transition-all text-slate-900 " 
                  placeholder="Search orders, MRN..." 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </form>
              <button className="relative p-2 text-slate-500 hover:text-[var(--color-primary)] transition-colors rounded-full hover:bg-slate-100 ">
                <span className="material-symbols-outlined">notifications</span>
                <span className="absolute top-1.5 right-1.5 size-2 bg-red-500 rounded-full border-2 border-white "></span>
              </button>
              <div className="flex items-center gap-3 pl-4 border-l border-slate-200 ">
                <div className="text-right hidden md:block">
                  <p className="text-sm font-semibold text-slate-900 leading-tight">{userLabel}</p>
                  <p className="text-xs text-slate-500 ">Authorized Personnel</p>
                </div>
                <div className="size-9 rounded-full bg-slate-200 flex items-center justify-center border border-white shadow-sm text-slate-500 font-bold text-sm">
                  {userLabel.charAt(0).toUpperCase()}
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 lg:p-8 scroll-smooth z-10">
          <div className="max-w-7xl mx-auto space-y-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
