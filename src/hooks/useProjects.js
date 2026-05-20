import { useState, useEffect } from "react";
import { subscribeToProjects } from "../firebase/projectService";
import { useAuth } from "./useAuth";

export const useProjects = () => {
  const { currentUser, role } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!currentUser) return;

    const isAdmin = role === "admin" || role === "super_admin";
    
    setLoading(true);
    const unsubscribe = subscribeToProjects(
      (data) => {
        setProjects(data);
        setLoading(false);
      },
      (err) => {
        console.error("Subscription error:", err);
        setError(err);
        setLoading(false);
      },
      currentUser.uid,
      isAdmin
    );

    return () => unsubscribe();
  }, [currentUser, role]);

  return { projects, loading, error };
};
