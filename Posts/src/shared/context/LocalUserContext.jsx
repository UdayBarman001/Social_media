import { createContext, useContext } from "react";
import { useLocalUser } from "../hooks/useLocalUser";

const LocalUserContext = createContext(null);

/**
 * Provides the canonical local user/profile identity, persisted in AsyncStorage
 * to the component tree. Pattern matches FeedContext.jsx.
 */
export function LocalUserProvider({ children }) {
  const value = useLocalUser();
  return (
    <LocalUserContext.Provider value={value}>
      {children}
    </LocalUserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(LocalUserContext);
  if (!ctx) throw new Error("useUser must be used inside LocalUserProvider");
  return ctx;
}
