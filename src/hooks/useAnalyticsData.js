import { useState, useEffect } from "react";
import { collection, collectionGroup, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase/config";

export const useAnalyticsData = () => {
  const [data, setData] = useState({
    projects: [],
    users: [],
    shifts: []
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let projectsLoaded = false;
    let usersLoaded = false;
    let shiftsLoaded = false;

    const checkLoading = () => {
      if (projectsLoaded && usersLoaded && shiftsLoaded) {
        setLoading(false);
      }
    };

    // 1. Projects
    // Depending on schema, it might be isDeleted or active flag. Assuming isDeleted as per instructions.
    // If some projects lack isDeleted, this query might miss them, so we just pull all projects and filter if needed,
    // or use the exact query if indexes allow. Using a simple collection fetch to be safe if no index exists.
    const unsubscribeProjects = onSnapshot(collection(db, "projects"), (snapshot) => {
      // Filter out deleted projects client-side in case they don't have the explicit boolean false
      const projectsData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(p => p.isDeleted !== true);
      
      setData(prev => ({ ...prev, projects: projectsData }));
      projectsLoaded = true;
      checkLoading();
    }, (err) => {
      console.error("Projects snapshot error", err);
      setError(err);
    });

    // 2. Users (Workers)
    const unsubscribeUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      const usersData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(u => u.role === 'worker' || u.role === 'Worker' || !u.role);
      
      setData(prev => ({ ...prev, users: usersData }));
      usersLoaded = true;
      checkLoading();
    }, (err) => {
      console.error("Users snapshot error", err);
      setError(err);
    });

    // 3. Shifts (Collection Group)
    const shiftsQuery = query(
      collectionGroup(db, "shifts"), 
      where("isValidated", "==", true)
    );
    
    const unsubscribeShifts = onSnapshot(shiftsQuery, (snapshot) => {
      const shiftsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setData(prev => ({ ...prev, shifts: shiftsData }));
      shiftsLoaded = true;
      checkLoading();
    }, (err) => {
      console.error("Shifts snapshot error", err);
      // Fallback: Fire checkLoading anyway so UI doesn't hang if they don't have the index for collectionGroup yet
      shiftsLoaded = true;
      checkLoading();
    });

    return () => {
      unsubscribeProjects();
      unsubscribeUsers();
      unsubscribeShifts();
    };
  }, []);

  return { ...data, loading, error };
};
