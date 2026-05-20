import { useState, useEffect } from "react";
import { 
  subscribeToWorkLogs, 
  subscribeToMeetingLogs, 
  subscribeToBudgetLogs, 
  subscribeToStageChangeLogs 
} from "../firebase/projectService";

export const useProjectLogs = (projectId) => {
  const [logs, setLogs] = useState({
    workLogs: [],
    meetingLogs: [],
    budgetLogs: [],
    stageChangeLogs: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!projectId) return;

    setLoading(true);
    let isSubscribed = true;

    try {
      const unsubWork = subscribeToWorkLogs(projectId, (data) => {
        if (isSubscribed) setLogs(prev => ({ ...prev, workLogs: data }));
      });
      
      const unsubMeeting = subscribeToMeetingLogs(projectId, (data) => {
        if (isSubscribed) setLogs(prev => ({ ...prev, meetingLogs: data }));
      });

      const unsubBudget = subscribeToBudgetLogs(projectId, (data) => {
        if (isSubscribed) setLogs(prev => ({ ...prev, budgetLogs: data }));
      });

      const unsubStage = subscribeToStageChangeLogs(projectId, (data) => {
        if (isSubscribed) setLogs(prev => ({ ...prev, stageChangeLogs: data }));
      });

      // Firebase listeners trigger almost instantly with cached/initial data
      const timeout = setTimeout(() => {
        if (isSubscribed) setLoading(false);
      }, 500);

      return () => {
        isSubscribed = false;
        clearTimeout(timeout);
        unsubWork();
        unsubMeeting();
        unsubBudget();
        unsubStage();
      };
    } catch (err) {
      console.error("Error setting up log subscriptions", err);
      setError(err);
      setLoading(false);
    }
  }, [projectId]);

  // Kept for backward compatibility if any component calls it
  const refreshLogs = async () => {};

  return { logs, loading, error, refreshLogs };
};
