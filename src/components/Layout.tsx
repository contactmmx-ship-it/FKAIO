import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  Brain,
  Cpu,
  Calendar,
  CalendarDays,
  FileText,
  Bell,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Radio,
  Tag,
  UserCog,
  UserCircle,
  Database,
  GitBranch,
  TrendingUp,
  BookOpen,
  DollarSign,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

const nav = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['Founder', 'OpsHead', 'BrandManager', 'RM', 'Accounts', 'Trainer'] },
  { path: '/leads', label: 'Leads CRM', icon: Users, roles: ['Founder', 'OpsHead', 'BrandManager', 'RM'] },
  { path: '/command-centre', label: 'Command Centre', icon: Radio, roles: ['Founder', 'OpsHead'] },
  { path: '/brands', label: 'Brand Management', icon: Tag, roles: ['Founder', 'OpsHead'] },
  { path: '/team', label: 'Team', icon: UserCog, roles: ['Founder', 'OpsHead'] },
  { path: '/ai-agents', label: 'AI Agents', icon: Brain, roles: ['Founder', 'OpsHead'] },
  { path: '/ai-jobs', label: 'AI Jobs', icon: Cpu, roles: ['Founder', 'OpsHead'] },
  { path: '/agent-memory', label: 'Agent Memory', icon: Database, roles: ['Founder', 'OpsHead', 'RM'] },
  { path: '/workflows', label: 'Workflows', icon: GitBranch, roles: ['Founder', 'OpsHead'] },
  { path: '/ai-evolution', label: 'AI Evolution', icon: TrendingUp, roles: ['Founder', 'OpsHead'] },
  { path: '/meetings', label: 'Meetings', icon: Calendar, roles: ['Founder', 'OpsHead', 'BrandManager', 'RM'] },
  { path: '/calendar', label: 'Calendar', icon: CalendarDays, roles: ['Founder', 'OpsHead', 'BrandManager', 'RM', 'Accounts', 'Trainer'] },
  { path: '/knowledge', label: 'Knowledge Base', icon: BookOpen, roles: ['Founder', 'OpsHead'] },
  { path: '/accounting', label: 'Accounting', icon: DollarSign, roles: ['Founder', 'OpsHead', 'Accounts'] },
  { path: '/approvals', label: 'Approvals', icon: ShieldCheck, roles: ['Founder', 'OpsHead'] },
  { path: '/executive', label: 'Executive AI', icon: Sparkles, roles: ['Founder', 'OpsHead'] },
  { path: '/invoices', label: 'Invoices', icon: FileText, roles: ['Founder', 'OpsHead', 'Accounts'] },
  { path: '/notifications', label: 'Notifications', icon: Bell, roles: ['Founder', 'OpsHead', 'BrandManager', 'RM', 'Accounts', 'Trainer'] },
  { path: '/profile', label: 'Profile', icon: UserCircle, roles: ['Founder', 'OpsHead', 'BrandManager', 'RM', 'Accounts', 'Trainer'] },
  { path: '/settings', label: 'Settings', icon: Settings, roles: ['Founder', 'OpsHead'] },
];

export default function Layout() {
  const { user, consultant, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const role = consultant?.role ?? 'RM';
  const visibleNav = nav.filter((item) => item.roles.includes(role));

  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} fixed lg:static lg:translate-x-0 z-50 w-64 h-full bg-slate-900 border-r border-slate-800 transition-transform duration-300 flex flex-col`}
      >
        <div className="flex items-center justify-between p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold leading-tight">Franchisee Kart</h1>
              <p className="text-[10px] text-cyan-400 font-semibold uppercase tracking-wider">AIOS</p>
            </div>
          </div>
          <button className="lg:hidden text-slate-400 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {visibleNav.map((item) => {
            const active = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  active
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
                {active && <ChevronRight className="w-3 h-3 ml-auto" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-xs font-bold">
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{consultant?.name || user?.email}</p>
              <p className="text-xs text-slate-500">{role}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-red-400 transition-colors w-full"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 bg-slate-900/50 border-b border-slate-800 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <button className="lg:hidden text-slate-400 hover:text-white" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold">
              {nav.find((n) => location.pathname === n.path || location.pathname.startsWith(n.path + '/'))?.label || 'Dashboard'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/notifications" className="relative p-2 text-slate-400 hover:text-white transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </Link>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
