import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, db, signInWithGoogle, logout, doc, onSnapshot, setDoc, serverTimestamp } from '../lib/firebase';
import { AppUser } from '../types';

interface AuthContextType {
  user: User | null;
  appUser: AppUser | null;
  loading: boolean;
  isAuthorized: boolean;
  isAdmin: boolean;
  signIn: () => Promise<any>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const MASTER_EMAIL = 'kielyap15@gmail.com';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (!user) {
        setAppUser(null);
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;

    let initInProgress = false;

    const unsubDoc = onSnapshot(doc(db, 'users', user.uid), async (docSnap) => {
      if (docSnap.exists()) {
        setAppUser({ id: docSnap.id, ...docSnap.data() } as AppUser);
        setLoading(false);
      } else {
        if (initInProgress) return;
        
        // Doc doesn't exist, try to create initial record
        if (user.email === MASTER_EMAIL) {
            setAppUser({
                id: user.uid,
                email: user.email!,
                displayName: user.displayName || 'Master Admin',
                role: 'admin',
                isAuthorized: true
            } as AppUser);
            setLoading(false);
            
            initInProgress = true;
            try {
              console.log("Initializing Master Admin profile...");
              await setDoc(doc(db, 'users', user.uid), {
                email: user.email,
                displayName: user.displayName || 'Master Admin',
                role: 'admin',
                isAuthorized: true,
                updatedAt: serverTimestamp()
              });
              console.log("Master Admin profile initialized.");
            } catch (e) { 
              console.error("Master init error:", e); 
              initInProgress = false;
            }

        } else {
            initInProgress = true;
            try {
                console.log("Registering new staff account for authorization...");
                await setDoc(doc(db, 'users', user.uid), {
                    email: user.email,
                    displayName: user.displayName || 'Anonymous',
                    role: 'staff',
                    isAuthorized: false,
                    updatedAt: serverTimestamp()
                });
                console.log("Staff registration submitted.");
            } catch (e) { 
                console.error("Self-reg error:", e); 
                initInProgress = false;
            }
            setAppUser(null);
            setLoading(false);
        }
      }
    }, (err) => {
        console.error("Auth sync error:", err);
        setLoading(false);
    });

    return unsubDoc;
  }, [user]);

  const isMaster = user?.email === MASTER_EMAIL;
  const isAdmin = isMaster || appUser?.role === 'admin';
  const isAuthorized = isAdmin || appUser?.isAuthorized === true;

  const value = {
    user,
    appUser,
    loading,
    isAuthorized,
    isAdmin,
    signIn: signInWithGoogle,
    signOut: logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
