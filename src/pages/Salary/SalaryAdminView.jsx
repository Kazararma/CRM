import React, { useState, useMemo } from 'react';
import { useSalaryDashboard } from '../../hooks/useSalaryDashboard';
import { useAuth } from '../../hooks/useAuth';
import { initiatePayment } from '../../services/salaryService';
import { 
  computeProjectSalary, 
  computeMonthlySalary, 
  computeHourlySalary,
  normalizeSalaryConfig 
} from '../../utils/salaryEngine';
import GlobalPayrollTracker from '../../components/salary/GlobalPayrollTracker';
import AdminWorkerSalaryCard from '../../components/salary/AdminWorkerSalaryCard';
import SalaryConfigModal from '../../components/salary/SalaryConfigModal';
import PaySalaryConfirmModal from '../../components/salary/PaySalaryConfirmModal';
import SalaryWorkerView from './SalaryWorkerView';
import SalaryDetailModal from '../../components/salary/SalaryDetailModal';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import { DollarSign, Search } from 'lucide-react';

const SalaryAdminView = () => {
  const { currentUser } = useAuth();
  const { workers, transactions, allShifts, loading, error } = useSalaryDashboard();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState("payroll"); // 'payroll' or 'personal'
  const [payrollSubTab, setPayrollSubTab] = useState("workers"); // 'workers' or 'admins'
  
  const [selectedWorkerForConfig, setSelectedWorkerForConfig] = useState(null);
  const [selectedWorkerForPayment, setSelectedWorkerForPayment] = useState(null);
  const [pendingPaymentData, setPendingPaymentData] = useState(null);
  const [pendingShifts, setPendingShifts] = useState([]);
  const [detailData, setDetailData] = useState(null);

  // Filter and Category workers
  const { workerList, adminList } = useMemo(() => {
    const filtered = workers.map(w => {
      const allWorkerShifts = allShifts.filter(s => (s.authorUid === w.id || s.userId === w.id) && s.isPaid !== true);
      const validatedWorkerShifts = allWorkerShifts.filter(s => s.isValidated === true);
      const pendingValidationCount = allWorkerShifts.filter(s => s.isValidated !== true).length;
      const salary = normalizeSalaryConfig(w);
      
      let computed = { totalPayable: 0, formatted: { totalPayable: '₹0' } };
      if (salary.isConfigured) {
        if (salary.type === 'project') computed = computeProjectSalary(salary.project, validatedWorkerShifts);
        if (salary.type === 'monthly') computed = computeMonthlySalary(salary.monthly, validatedWorkerShifts);
        if (salary.type === 'hourly') computed = computeHourlySalary(salary.hourly, validatedWorkerShifts);
      }

      return {
        ...w,
        salary,
        computed,
        pendingValidationCount,
        activeTransaction: transactions.find(t => t.workerId === w.id && !t.isResolved) || null
      };
    }).filter(w => 
      w.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return {
      workerList: filtered.filter(u => u.role?.toLowerCase() === 'worker'),
      adminList: filtered.filter(u => u.role?.toLowerCase() === 'admin' || u.role?.toLowerCase() === 'super_admin')
    };
  }, [workers, transactions, allShifts, searchTerm]);

  const currentDisplayList = payrollSubTab === 'workers' ? workerList : adminList;

  const handleInitiatePayment = async (worker, computedData) => {
    try {
      const resolvedProjectName = worker.salary?.project?.projectName || 
                                   pendingShifts[0]?.projectName || 
                                   "General Payroll";

      const scope = worker.salary?.type === 'project' ? {
        projectId: worker.salary.project.projectId || pendingShifts[0]?.projectId || null,
        projectName: resolvedProjectName,
        periodMonth: new Date().toISOString().slice(0, 7)
      } : {
        projectName: "General Payroll",
        periodMonth: new Date().toISOString().slice(0, 7)
      };

      await initiatePayment({
        worker,
        admin: currentUser,
        computedData,
        salaryType: worker.salary?.type || worker.salaryType,
        scope,
        shifts: pendingShifts,
        previousDisputedTransactionId: worker.activeTransaction?.status === 'DISPUTED' ? worker.activeTransaction.id : null
      });
      
      setSelectedWorkerForPayment(null);
      setPendingPaymentData(null);
      setPendingShifts([]);
    } catch (err) {
      console.error("Payment initiation failed:", err);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
            <div className="p-2 bg-blue-600 text-white rounded-2xl">
              <DollarSign size={28} />
            </div>
            Salary & Payroll
          </h1>
          <p className="text-gray-500 mt-2 font-medium">Manage team compensation and track your personal earnings.</p>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-xl self-start">
          <button 
            onClick={() => setActiveTab("payroll")}
            className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${activeTab === 'payroll' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            TEAM PAYROLL
          </button>
          <button 
            onClick={() => setActiveTab("personal")}
            className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${activeTab === 'personal' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            MY SALARY
          </button>
        </div>
      </div>

      {activeTab === "personal" ? (
        <SalaryWorkerView />
      ) : (
        <>
          <GlobalPayrollTracker workerSalaries={[...workerList, ...adminList]} transactions={transactions} />

          <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
            <div className="flex bg-white border border-gray-100 p-1 rounded-xl shadow-sm">
              <button 
                onClick={() => setPayrollSubTab("workers")}
                className={`px-4 py-2 rounded-lg text-[10px] font-black transition-all flex items-center gap-2 ${payrollSubTab === 'workers' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                WORKERS
                <span className={`px-1.5 py-0.5 rounded-full text-[8px] ${payrollSubTab === 'workers' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-400'}`}>
                  {workerList.length}
                </span>
              </button>
              <button 
                onClick={() => setPayrollSubTab("admins")}
                className={`px-4 py-2 rounded-lg text-[10px] font-black transition-all flex items-center gap-2 ${payrollSubTab === 'admins' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                ADMINS
                <span className={`px-1.5 py-0.5 rounded-full text-[8px] ${payrollSubTab === 'admins' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-400'}`}>
                  {adminList.length}
                </span>
              </button>
            </div>

            <div className="relative group w-full md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors" size={16} />
              <input 
                type="text"
                placeholder={`Search ${payrollSubTab}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-11 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl w-full shadow-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-bold text-sm"
              />
            </div>
          </div>

          {currentDisplayList.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {currentDisplayList.map(worker => (
                <AdminWorkerSalaryCard 
                  key={worker.id}
                  worker={worker}
                  activeTransaction={worker.activeTransaction}
                  onPay={(w, data, shifts) => {
                    setSelectedWorkerForPayment(w);
                    setPendingPaymentData(data);
                    setPendingShifts(shifts);
                  }}
                  onConfigure={setSelectedWorkerForConfig}
                  onViewBreakdown={(w, computed, shifts) => {
                    setDetailData({ worker: w, computed, shifts });
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
              <p className="text-gray-400 font-bold">No {payrollSubTab} found matching your search.</p>
            </div>
          )}
        </>
      )}

      {selectedWorkerForConfig && (
        <SalaryConfigModal 
          isOpen={!!selectedWorkerForConfig}
          onClose={() => setSelectedWorkerForConfig(null)}
          worker={selectedWorkerForConfig}
        />
      )}

      {selectedWorkerForPayment && (
        <PaySalaryConfirmModal 
          isOpen={!!selectedWorkerForPayment}
          onClose={() => {
            setSelectedWorkerForPayment(null);
            setPendingPaymentData(null);
            setPendingShifts([]);
          }}
          onConfirm={handleInitiatePayment}
          worker={selectedWorkerForPayment}
          computedData={pendingPaymentData}
        />
      )}

      {detailData && (
        <SalaryDetailModal 
          isOpen={!!detailData}
          onClose={() => setDetailData(null)}
          worker={detailData.worker}
          computed={detailData.computed}
          shifts={detailData.shifts}
        />
      )}
    </div>
  );
};

export default SalaryAdminView;
