import React, { useState, useEffect } from "react";
import { useUsers } from "../../hooks/useUsers";
import { 
  collectionGroup, 
  query, 
  where, 
  onSnapshot,
  orderBy
} from "firebase/firestore";
import { db } from "../../firebase/config";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { useShift } from "../../contexts/ShiftContext";
import WorkerSummaryCard from "./WorkerSummaryCard";
import WorkerCalendarModal from "./WorkerCalendarModal";
import LoadingSpinner from "../shared/LoadingSpinner";
import { Search, Users } from "lucide-react";
import ErrorDisplay from "../shared/ErrorDisplay";
import ErrorBoundary from "../shared/ErrorBoundary";

const WorkHourAdminView = () => {
  const { users, loading: usersLoading } = useUsers();
  const { reconciliationError } = useShift();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSubTab, setActiveSubTab] = useState("workers"); // 'workers' or 'admins'
  const [allShifts, setAllShifts] = useState([]);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const monthStartStr = format(startOfMonth(currentMonth), "yyyy-MM-dd");
    const monthEndStr = format(endOfMonth(currentMonth), "yyyy-MM-dd");

    const q = query(
      collectionGroup(db, "shifts"),
      where("date", ">=", monthStartStr),
      where("date", "<=", monthEndStr)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const shiftData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAllShifts(shiftData);
    }, (err) => {
      console.error("Admin View Fetch Error (All Shifts):", err);
      setError(err.message);
    });

    return () => unsubscribe();
  }, [currentMonth]);

  // Categorize users
  const { workerList, adminList } = React.useMemo(() => {
    const filtered = users.filter(u => 
      u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return {
      workerList: filtered.filter(u => u.role?.toLowerCase() === "worker"),
      adminList: filtered.filter(u => u.role?.toLowerCase() === "admin" || u.role?.toLowerCase() === "super_admin")
    };
  }, [users, searchTerm]);

  const currentDisplayList = activeSubTab === 'workers' ? workerList : adminList;

  const getWorkerShifts = (userId) => {
    return allShifts.filter(s => s.userId === userId || s.authorUid === userId);
  };

  if (usersLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <ErrorDisplay error={error || reconciliationError} />
      
      {/* Search and Sub-Tabs */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div className="flex flex-col md:flex-row items-center gap-4 w-full xl:w-auto">
          <div className="flex bg-white border border-gray-100 p-1 rounded-xl shadow-sm w-full md:w-auto">
            <button 
              onClick={() => setActiveSubTab("workers")}
              className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-2 ${activeSubTab === 'workers' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              WORKERS
              <span className={`px-1.5 py-0.5 rounded-full text-[8px] ${activeSubTab === 'workers' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-400'}`}>
                {workerList.length}
              </span>
            </button>
            <button 
              onClick={() => setActiveSubTab("admins")}
              className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-2 ${activeSubTab === 'admins' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              ADMINS
              <span className={`px-1.5 py-0.5 rounded-full text-[8px] ${activeSubTab === 'admins' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-400'}`}>
                {adminList.length}
              </span>
            </button>
          </div>

          <div className="relative w-full md:w-80 group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400 group-focus-within:text-blue-600 transition-colors" />
            </div>
            <input
              type="text"
              placeholder={`Search ${activeSubTab}...`}
              className="block w-full pl-11 pr-4 py-2.5 border border-gray-100 rounded-xl bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-sm shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white p-1.5 rounded-xl border border-gray-100 shadow-sm self-end md:self-auto">
          <button 
            onClick={() => setCurrentMonth(prev => new Date(prev.setMonth(prev.getMonth() - 1)))}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-blue-600 font-bold"
          >
            &larr;
          </button>
          <span className="font-black text-sm px-4 text-gray-700 uppercase tracking-tight">{format(currentMonth, "MMMM yyyy")}</span>
          <button 
            onClick={() => setCurrentMonth(prev => new Date(prev.setMonth(prev.getMonth() + 1)))}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-blue-600 font-bold"
          >
            &rarr;
          </button>
        </div>
      </div>

      {currentDisplayList.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {currentDisplayList.map(worker => {
            if (!worker) return null;
            return (
              <ErrorBoundary key={worker.id}>
                <WorkerSummaryCard 
                  worker={worker}
                  shifts={getWorkerShifts(worker.id)}
                  onClick={() => {
                    setSelectedWorker(worker);
                    setIsModalOpen(true);
                  }}
                />
              </ErrorBoundary>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
          <p className="text-gray-400 font-bold">No {activeSubTab} found for this month.</p>
        </div>
      )}

      <WorkerCalendarModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        worker={selectedWorker}
      />
    </div>
  );
};

export default WorkHourAdminView;
