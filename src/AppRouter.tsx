import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';

// Route-level code splitting — each page loads independently
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Leads = lazy(() => import('./pages/Leads'));
const LeadDetail = lazy(() => import('./pages/LeadDetail'));
const AIAgents = lazy(() => import('./pages/AIAgents'));
const AIJobs = lazy(() => import('./pages/AIJobs'));
const CommandCentre = lazy(() => import('./pages/CommandCentre'));
const Meetings = lazy(() => import('./pages/Meetings'));
const Invoices = lazy(() => import('./pages/Invoices'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Settings = lazy(() => import('./pages/Settings'));
const BrandManagement = lazy(() => import('./pages/BrandManagement'));
const TeamManagement = lazy(() => import('./pages/TeamManagement'));
const UserProfile = lazy(() => import('./pages/UserProfile'));
const AgentMemory = lazy(() => import('./pages/AgentMemory'));
const WorkflowManager = lazy(() => import('./pages/WorkflowManager'));
const AIEvolution = lazy(() => import('./pages/AIEvolution'));
const CalendarPage = lazy(() => import('./pages/Calendar'));
const KnowledgeBase = lazy(() => import('./pages/KnowledgeBase'));
const Accounting = lazy(() => import('./pages/Accounting'));
const ApprovalQueue = lazy(() => import('./pages/ApprovalQueue'));
const FounderExecutive = lazy(() => import('./pages/FounderExecutive'));
const NotFound = lazy(() => import('./pages/NotFound'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-slate-950">
      <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
            <Route index element={<Dashboard />} />
            <Route path="leads" element={<Leads />} />
            <Route path="leads/:id" element={<LeadDetail />} />
            <Route path="ai-agents" element={<AIAgents />} />
            <Route path="ai-jobs" element={<AIJobs />} />
            <Route path="command-centre" element={<CommandCentre />} />
            <Route path="meetings" element={<Meetings />} />
            <Route path="invoices" element={<Invoices />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="settings" element={<Settings />} />
            <Route path="brands" element={<BrandManagement />} />
            <Route path="team" element={<TeamManagement />} />
            <Route path="profile" element={<UserProfile />} />
            <Route path="agent-memory" element={<AgentMemory />} />
            <Route path="workflows" element={<WorkflowManager />} />
            <Route path="ai-evolution" element={<AIEvolution />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="knowledge" element={<KnowledgeBase />} />
            <Route path="accounting" element={<Accounting />} />
            <Route path="approvals" element={<ApprovalQueue />} />
            <Route path="executive" element={<FounderExecutive />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
