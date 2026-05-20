import React, { useState, useEffect } from "react";
import Avatar from "../shared/Avatar";
import Badge from "../shared/Badge";
import { calculateHourlyPay, calculateMonthlyProgress, calculateProjectPay } from "../../utils/salaryUtils";
import { IndianRupee, TrendingUp } from "lucide-react";

const WorkerCard = ({ worker, onClick }) => {
  const [monthlyComp, setMonthlyComp] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCompensation = async () => {
      if (!worker?.id && !worker?.uid) return;
      
      const workerId = worker.uid || worker.id;
      const targetMonth = new Date().getMonth();
      const targetYear = new Date().getFullYear();

      try {
        let data;
        if (worker.salaryType === "hourly") {
          data = await calculateHourlyPay(workerId, targetMonth, targetYear);
        } else if (worker.salaryType === "monthly") {
          data = await calculateMonthlyProgress(workerId, targetMonth, targetYear);
        } else if (worker.salaryType === "project") {
          data = await calculateProjectPay(workerId, targetMonth, targetYear);
        }
        
        if (data && !data.error) {
          setMonthlyComp(data.totalPay || 0);
        }
      } catch (err) {
        console.error("Error fetching compensation for card:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCompensation();
  }, [worker]);

  return (
    <div 
      onClick={onClick}
      className="bg-white p-4 rounded-xl border border-slate-100 hover:border-blue-200 hover:shadow-lg transition-all cursor-pointer group relative flex flex-col justify-between h-full"
    >
      {/* Top Section: Info & Role */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <Avatar src={worker.photoURL} name={worker.displayName} size="md" />
          <div className="overflow-hidden">
            <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors truncate text-sm">
              {worker.displayName}
            </h3>
            {worker.jobTitle ? (
              <p className="text-[10px] font-black text-blue-600 uppercase tracking-tight truncate leading-tight">
                {worker.jobTitle}
              </p>
            ) : (
              <p className="text-[10px] text-gray-400 truncate">{worker.email}</p>
            )}
          </div>
        </div>
        <div className="opacity-80 group-hover:opacity-100 transition-opacity">
          <Badge type={worker.role} size="sm">
            {worker.role.split('_')[0]}
          </Badge>
        </div>
      </div>

      {/* Bottom Section: Compensation Pill (Visible for all roles) */}
      <div className="flex items-center justify-between mt-auto">
        <div className="bg-slate-50 group-hover:bg-blue-50 px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors border border-transparent group-hover:border-blue-100">
          <div className="bg-white p-1 rounded shadow-sm text-blue-600">
            <IndianRupee size={12} />
          </div>
          <div className="flex flex-col">
            <span className="text-[8px] font-black text-slate-400 uppercase leading-tight">
              {worker.salaryType === 'project' ? 'Project' : 
               worker.salaryType === 'hourly' ? 'Hourly' : 'Monthly'}
            </span>
            <span className="text-xs font-black text-slate-900 group-hover:text-blue-700 transition-colors">
              {loading ? "..." : Number(monthlyComp).toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        <div className="text-slate-300 group-hover:text-blue-500 transition-all transform group-hover:translate-x-1">
          <TrendingUp size={16} />
        </div>
      </div>

      {/* Interactive Decoration */}
      <div className="absolute bottom-0 right-0 w-16 h-16 bg-blue-500/5 rounded-tl-full translate-x-8 translate-y-8 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform duration-500 pointer-events-none" />
    </div>
  );
};

export default WorkerCard;
