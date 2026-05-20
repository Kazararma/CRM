import React, { useState, useEffect } from "react";
import { subscribeToProjects, subscribeToProjectActivityLogs } from "../firebase/projectService";
import CreateProjectForm from "../components/projects/CreateProjectForm";
import ProjectAdminCard from "../components/projects/ProjectAdminCard";
import { FolderKanban, Plus, X, History } from "lucide-react";
import LoadingSpinner from "../components/shared/LoadingSpinner";
import EmptyState from "../components/shared/EmptyState";
import { format } from "date-fns";
import { useAuth } from "../hooks/useAuth";

const ProjectsPage = () => {
  const { role } = useAuth();
  const [projects, setProjects] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const isAdmin = role === "admin" || role === "super_admin";

  useEffect(() => {
    // REAL-TIME PROJECTS LISTENER
    setLoading(true);
    const unsubscribeProjects = subscribeToProjects(
      (data) => {
        setProjects(data);
        setLoading(false);
      },
      (err) => {
        console.error("Error subscribing to projects", err);
        setError(err);
        setLoading(false);
      },
      null, // Fetch all for admins
      isAdmin
    );

    // REAL-TIME ACTIVITY LOGS
    const unsubscribeLogs = subscribeToProjectActivityLogs((logs) => {
      setActivityLogs(logs);
    });

    return () => {
      if (unsubscribeProjects) unsubscribeProjects();
      if (unsubscribeLogs) unsubscribeLogs();
    };
  }, [role, isAdmin]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <FolderKanban className="text-blue-600" size={32} />
            Projects
          </h1>
          <p className="text-gray-500 mt-1">Create new contracts, assign teams, and manage overall project lifecycles.</p>
        </div>

        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-lg ${
            showCreateForm 
              ? "bg-gray-100 text-gray-700 hover:bg-gray-200" 
              : "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200"
          }`}
        >
          {showCreateForm ? <X size={20} /> : <Plus size={20} />}
          {showCreateForm ? "Cancel" : "New Project"}
        </button>
      </div>

      {showCreateForm && (
        <CreateProjectForm onComplete={() => setShowCreateForm(false)} />
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-6">
          Error loading projects. Please try again later.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Projects */}
        <div className="lg:col-span-2 space-y-4">
          {projects.length > 0 ? (
            projects.map((project) => (
              <ProjectAdminCard 
                key={project.id} 
                project={project} 
                onUpdate={() => {}} // No-op since we are now reactive
              />
            ))
          ) : (
            <EmptyState 
              title="No projects found"
              message="Create a new contract to get started and assign your team."
            />
          )}
        </div>

        {/* Right Column: Activity Logs */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sticky top-8">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-6">
              <History className="text-blue-600" size={20} />
              Activity Log
            </h3>
            
            <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2">
              {activityLogs.length > 0 ? (
                activityLogs.map((log) => (
                  <div key={log.id} className="relative pl-4 border-l-2 border-gray-100 pb-1">
                    <div className={`absolute -left-1.5 top-1.5 w-3 h-3 rounded-full ${
                      log.action === "created" ? "bg-green-500" : "bg-red-500"
                    }`} />
                    <p className="text-sm text-gray-900">
                      <span className="font-bold">{log.userName}</span>{" "}
                      {log.action === "created" ? "created" : "deleted"} project{" "}
                      <span className="font-bold">{log.projectName}</span>
                    </p>
                    <p className="text-[11px] text-gray-400 mt-1">
                      {log.createdAt ? format(log.createdAt.toDate(), "MMM d, yyyy · h:mm a") : "Just now"}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 italic">No recent activity.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectsPage;
