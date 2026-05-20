import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase/config";
import { signInWithGoogle, signOutUser } from "../firebase/authService";
import { getUserDocument, createUserDocument } from "../firebase/userService";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      if (user) {
        setCurrentUser(user);
        try {
          let profile = await getUserDocument(user.uid);
          if (!profile) {
            profile = await createUserDocument(user.uid, {
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL,
            });
          }
          setUserProfile(profile);
          setRole(profile.role);
        } catch (error) {
          console.error("Error in auth state change listener", error);
        }
      } else {
        setCurrentUser(null);
        setUserProfile(null);
        setRole(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("Sign in failed", error);
    }
  };

  const signOut = async () => {
    try {
      await signOutUser();
    } catch (error) {
      console.error("Sign out failed", error);
    }
  };

  const value = {
    currentUser,
    userProfile,
    role,
    loading,
    signIn,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
