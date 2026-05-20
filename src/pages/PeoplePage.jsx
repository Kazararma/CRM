import React, { useState } from "react";
import { useUsers } from "../hooks/useUsers";
import WorkerCard from "../components/people/WorkerCard";
import WorkerDetailModal from "../components/people/WorkerDetailModal";
import { Search, Users as UsersIcon } from "lucide-react";
import LoadingSpinner from "../components/shared/LoadingSpinner";
import EmptyState from "../components/shared/EmptyState";
import ErrorBoundary from "../components/shared/ErrorBoundary";

const PeoplePage = () => {
  const { users, loading, error } = useUsers();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filteredUsers = users.filter((user) =>
    user.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openModal = (worker) => {
    setSelectedWorker(worker);
    setIsModalOpen(true);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <UsersIcon className="text-blue-600" size={32} />
            Team Directory
          </h1>
          <p className="text-gray-500 mt-1">Manage team members, roles, and review individual performance.</p>
        </div>

        <div className="relative w-full md:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search by name or email..."
            className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl">
          Error loading users. Please try again later.
        </div>
      ) : filteredUsers.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredUsers.map((user) => {
            if (!user) return null;
            return (
              <ErrorBoundary key={user.id || Math.random()}>
                <WorkerCard 
                  worker={user} 
                  onClick={() => openModal(user)}
                />
              </ErrorBoundary>
            );
          })}
        </div>
      ) : (
        <EmptyState 
          title="No team members found"
          message={searchTerm ? "Try adjusting your search query." : "No active team members in the system."}
        />
      )}

      <WorkerDetailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        worker={selectedWorker}
        onUpdate={() => {
          // No manual reload needed as useUsers is now reactive via onSnapshot
          setIsModalOpen(false);
        }}
      />
    </div>
  );
};

export default PeoplePage;
