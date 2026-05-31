import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { 
  LayoutDashboard, 
  FolderKanban, 
  Users, 
  Clock,
  CreditCard,
  Target,
  TrendingUp,
  Receipt,
  LogOut, 
  Menu, 
  X,
  BarChart2,
  ArrowLeftRight
} from "lucide-react";

import Avatar from "../shared/Avatar";

const Sidebar = ({ isOpen, toggleSidebar }) => {
  const { role, signOut, userProfile } = useAuth();
  const location = useLocation();

  const isAdmin = role === "admin" || role === "super_admin";

  const navItems = [
    { name: "Dashboard",     path: "/dashboard",     icon: LayoutDashboard, visible: true },
    { name: "Import/Export", path: "/import-export", icon: ArrowLeftRight,  visible: isAdmin },
    { name: "Leads",         path: "/leads",         icon: Target,          visible: isAdmin },
    { name: "Opportunities", path: "/opportunities", icon: TrendingUp,       visible: isAdmin },
    { name: "Projects",      path: "/projects",      icon: FolderKanban,    visible: isAdmin },
    { name: "Invoices",      path: "/invoices",      icon: Receipt,         visible: isAdmin },
    { name: "People",        path: "/people",        icon: Users,           visible: isAdmin },
    { name: "Work Hours",    path: "/work-hours",    icon: Clock,           visible: true },
    { name: "Salary",        path: "/salary",        icon: CreditCard,      visible: true },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden" 
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full bg-black text-white w-64 transform ${isOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 transition-transform duration-200 ease-in-out z-30 flex flex-col`}>
        <div className="pt-8 pb-4 flex flex-col items-center justify-center relative">
          <img 
            src="/wavelet-logo.png" 
            alt="Wavelet Logo" 
            className="w-48 h-48 object-contain drop-shadow-xl" 
          />
          <span className="text-2xl font-black tracking-tight text-white text-center -mt-6">
            WAVELET CRM
          </span>
        </div>

        <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto pb-4 pt-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-zinc-800 [&::-webkit-scrollbar-thumb]:rounded-full">
          {navItems.filter(item => item.visible).map((item) => (
            <Link
              key={item.name}
              to={item.path}
              onClick={() => window.innerWidth < 768 && toggleSidebar()}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                location.pathname === item.path 
                  ? "bg-white text-black shadow-lg font-bold scale-[1.02]" 
                  : "text-white hover:bg-white/10 font-medium"
              }`}
            >
              <item.icon size={20} className={location.pathname === item.path ? "text-black" : "text-white"} />
              <span>{item.name}</span>
            </Link>
          ))}
        </nav>

        <div className="p-4 mx-4 mb-4 rounded-xl bg-zinc-900/50 border border-zinc-800/50">
          <div className="flex items-center gap-3 mb-4 px-2">
            <Avatar 
              src={userProfile?.photoURL} 
              name={userProfile?.displayName} 
              size="md" 
            />
            <div className="overflow-hidden">
              <p className="text-sm font-semibold truncate">{userProfile?.displayName}</p>
              <p className="text-xs text-white/70 font-medium capitalize tracking-wide">{role?.replace("_", " ")}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-4 py-2 mt-2 text-white hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors text-sm font-medium"
          >
            <LogOut size={18} />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};

const AppShell = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
      
      <div className="flex-1 flex flex-col md:ml-64">
        {/* TopBar for Mobile */}
        <header className="md:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
          <button 
            onClick={toggleSidebar}
            className="p-2 rounded-md text-gray-600 hover:bg-gray-100"
          >
            <Menu size={24} />
          </button>
          <div className="flex items-center gap-3">
            <img src="/wavelet-logo.png" alt="Wavelet Logo" className="w-10 h-10 object-contain drop-shadow-sm" />
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">WAVELET CRM</h1>
          </div>
          <div className="w-10" /> {/* Spacer */}
        </header>

        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppShell;
