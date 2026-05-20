import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut 
} from "firebase/auth";
import { auth } from "./config";

const googleProvider = new GoogleAuthProvider();

// FORCE account selection to avoid auto-login with wrong accounts
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export const signInWithGoogle = async () => {
  try {
    // Standard popup sign-in
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google", error);
    
    // Fallback or specific error handling can be added here if needed
    // (e.g. checking for popup-blocked errors)
    if (error.code === 'auth/popup-blocked') {
      alert("Please allow popups for this website to sign in with Google.");
    }
    
    throw error;
  }
};

export const signOutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out", error);
    throw error;
  }
};
