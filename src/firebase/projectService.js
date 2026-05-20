import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc,
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  limit,
  serverTimestamp 
} from "firebase/firestore";
import { db } from "./config";

// --- Project CRUD ---

export const createProject = async (data, creatorData) => {
  try {
    const docRef = await addDoc(collection(db, "projects"), {
      ...data,
      status: data.status || "ongoing",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    if (creatorData) {
      await addProjectActivityLog({
        action: "created",
        projectId: docRef.id,
        projectName: data.title,
        userUid: creatorData.uid,
        userName: creatorData.displayName
      });
    }

    return docRef.id;
  } catch (error) {
    console.error("Error creating project", error);
    throw error;
  }
};

export const deleteProject = async (projectId, projectName, adminData) => {
  try {
    await deleteDoc(doc(db, "projects", projectId));
    
    if (adminData) {
      await addProjectActivityLog({
        action: "deleted",
        projectId: projectId,
        projectName: projectName,
        userUid: adminData.uid,
        userName: adminData.displayName
      });
    }
  } catch (error) {
    console.error("Error deleting project", error);
    throw error;
  }
};

export const getAllProjects = async () => {
  try {
    const q = query(collection(db, "projects"), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(doc => !doc.isActivityLog);
  } catch (error) {
    console.error("Error fetching all projects", error);
    throw error;
  }
};

export const getAssignedProjects = async (uid) => {
  try {
    // Workers see projects where they are in assignedWorkers
    const q = query(
      collection(db, "projects"), 
      where("assignedWorkers", "array-contains", uid)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(doc => !doc.isActivityLog);
  } catch (error) {
    console.error("Error fetching assigned projects", error);
    throw error;
  }
};

export const updateProject = async (projectId, data) => {
  try {
    const projectRef = doc(db, "projects", projectId);
    await updateDoc(projectRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error updating project", error);
    throw error;
  }
};

export const subscribeToProjects = (callback, errorCallback, uid, isAdmin) => {
  let q;
  if (isAdmin) {
    q = query(collection(db, "projects"), orderBy("createdAt", "desc"));
  } else {
    console.log("Fetching for Worker UID:", uid);
    q = query(
      collection(db, "projects"), 
      where("assignedWorkers", "array-contains", uid)
    );
  }

  return onSnapshot(q, (querySnapshot) => {
    if (querySnapshot.empty) {
      callback([]);
      return;
    }
    const projects = querySnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(doc => !doc.isActivityLog);
    callback(projects);
  }, (error) => {
    console.error("Error subscribing to projects", error);
    if (errorCallback) errorCallback(error);
  });
};

// --- Logs CRUD ---

export const addWorkLog = async (projectId, logData) => {
  try {
    const logRef = collection(db, "projects", projectId, "workLogs");
    await addDoc(logRef, {
      ...logData,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error adding work log", error);
    throw error;
  }
};

export const addMeetingLog = async (projectId, logData) => {
  try {
    const logRef = collection(db, "projects", projectId, "meetingLogs");
    await addDoc(logRef, {
      ...logData,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error adding meeting log", error);
    throw error;
  }
};

export const addBudgetLog = async (projectId, logData) => {
  try {
    const logRef = collection(db, "projects", projectId, "budgetLogs");
    await addDoc(logRef, {
      ...logData,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error adding budget log", error);
    throw error;
  }
};

export const addStageChangeLog = async (projectId, logData) => {
  try {
    const logRef = collection(db, "projects", projectId, "stageChangeLogs");
    await addDoc(logRef, {
      ...logData,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error adding stage change log", error);
    throw error;
  }
};

export const subscribeToWorkLogs = (projectId, callback) => {
  const q = query(collection(db, "projects", projectId, "workLogs"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }, (error) => console.error("Error subscribing to work logs", error));
};

export const subscribeToMeetingLogs = (projectId, callback) => {
  const q = query(collection(db, "projects", projectId, "meetingLogs"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }, (error) => console.error("Error subscribing to meeting logs", error));
};

export const subscribeToBudgetLogs = (projectId, callback) => {
  const q = query(collection(db, "projects", projectId, "budgetLogs"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }, (error) => console.error("Error subscribing to budget logs", error));
};

export const subscribeToStageChangeLogs = (projectId, callback) => {
  const q = query(collection(db, "projects", projectId, "stageChangeLogs"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }, (error) => console.error("Error subscribing to stage change logs", error));
};

// --- Project Activity Logs ---

export const addProjectActivityLog = async (logData) => {
  try {
    await addDoc(collection(db, "projects"), {
      ...logData,
      isActivityLog: true,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error adding project activity log", error);
    throw error;
  }
};

export const subscribeToProjectActivityLogs = (callback) => {
  const q = query(
    collection(db, "projects"), 
    orderBy("createdAt", "desc"),
    limit(200)
  );
  return onSnapshot(q, (snapshot) => {
    const allDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const logs = allDocs.filter(doc => doc.isActivityLog);
    callback(logs);
  }, (error) => {
    console.error("Error subscribing to project activity logs", error);
  });
};
