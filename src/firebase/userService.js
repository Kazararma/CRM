import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  query, 
  where, 
  orderBy,
  serverTimestamp 
} from "firebase/firestore";
import { db } from "./config";

export const createUserDocument = async (uid, data) => {
  try {
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      const userData = {
        uid,
        email: data.email,
        displayName: data.displayName,
        photoURL: data.photoURL,
        role: "worker", // Default role
        salaryType: "hourly",
        hourlyRate: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(userRef, userData);
      return userData;
    }
    return userSnap.data();
  } catch (error) {
    console.error("Error creating user document", error);
    throw error;
  }
};

export const getUserDocument = async (uid) => {
  try {
    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      return { id: userSnap.id, ...userSnap.data() };
    }
    return null;
  } catch (error) {
    console.error("Error getting user document", error);
    throw error;
  }
};

export const getAllUsers = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, "users"));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error getting all users", error);
    throw error;
  }
};

export const updateUserRole = async (uid, newRole) => {
  try {
    const userRef = doc(db, "users", uid);
    const updates = { role: newRole };
    
    await updateDoc(userRef, updates);
  } catch (error) {
    console.error("Error updating user role", error);
    throw error;
  }
};

export const updateUserProfile = async (uid, data) => {
  try {
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, { 
      ...data,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error updating user profile", error);
    throw error;
  }
};

export const updateWorkerSalarySettings = async (uid, settings) => {
  try {
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, { 
      salaryType: settings.salaryType,
      hourlyRate: settings.hourlyRate ? parseFloat(settings.hourlyRate) : 0,
      monthlySalary: settings.monthlySalary ? parseFloat(settings.monthlySalary) : 0,
      projectRate: settings.projectRate ? parseFloat(settings.projectRate) : 0,
      projectExpectedHours: settings.projectExpectedHours ? parseFloat(settings.projectExpectedHours) : 0,
      projectOvertimeRate: settings.projectOvertimeRate ? parseFloat(settings.projectOvertimeRate) : 0,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Error updating salary settings", error);
    throw error;
  }
};

export const getWorkLogsByUser = async (uid) => {
  try {
    const q = query(
      collection(db, "projects"),
      where("assignedWorkers", "array-contains", uid)
    );
    const projectSnap = await getDocs(q);
    let allLogs = [];

    for (const projectDoc of projectSnap.docs) {
      const workLogsRef = collection(db, "projects", projectDoc.id, "workLogs");
      const logsSnap = await getDocs(query(workLogsRef, where("authorUid", "==", uid), orderBy("createdAt", "desc")));
      const logs = logsSnap.docs.map(d => ({ 
        id: d.id, 
        projectId: projectDoc.id, 
        projectName: projectDoc.data().title,
        ...d.data() 
      }));
      allLogs = [...allLogs, ...logs];
    }
    return allLogs.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
  } catch (error) {
    console.error("Error fetching work logs by user", error);
    throw error;
  }
};

export const getMeetingLogsByUser = async (uid) => {
  try {
    const q = query(
      collection(db, "projects"),
      where("assignedWorkers", "array-contains", uid)
    );
    const projectSnap = await getDocs(q);
    let allLogs = [];

    for (const projectDoc of projectSnap.docs) {
      const logsRef = collection(db, "projects", projectDoc.id, "meetingLogs");
      const logsSnap = await getDocs(query(logsRef, where("authorUid", "==", uid)));
      const logs = logsSnap.docs.map(d => ({ 
        id: d.id, 
        projectId: projectDoc.id, 
        projectName: projectDoc.data().title,
        ...d.data() 
      }));
      allLogs = [...allLogs, ...logs];
    }
    return allLogs;
  } catch (error) {
    console.error("Error fetching meeting logs by user", error);
    throw error;
  }
};

export const updateMonthlyPaymentStatus = async (uid, month, year, status) => {
  try {
    const paymentId = `${year}-${String(month + 1).padStart(2, '0')}`;
    const paymentRef = doc(db, "users", uid, "payments", paymentId);
    await setDoc(paymentRef, {
      status,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error("Error updating payment status", error);
    throw error;
  }
};
