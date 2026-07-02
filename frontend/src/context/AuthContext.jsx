/**
 * context/AuthContext.jsx — App-wide login state
 * ==================================================
 * React Context is a way to share a value (here: "who's logged in")
 * with every component in the tree, without passing it down through
 * props one layer at a time.
 *
 * Analogy: without Context, every component between App and, say,
 * the Layout's logout button would need to accept a `user` prop and
 * pass it further down — like a bucket brigade. Context lets any
 * component "tap into" the value directly, however deep it is.
 *
 * We store the JWT in localStorage so a page refresh doesn't log the
 * user out — the token survives, and on app load we ask the backend
 * "is this token still good?" via getMe().
 */

import { createContext, useContext, useEffect, useState } from "react";
import { login as apiLogin, getMe } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true); // true while we check a saved token

  useEffect(() => {
    const token = localStorage.getItem("cc_token");
    if (!token) {
      setLoading(false);
      return;
    }
    // We have a saved token from a previous session — verify it's
    // still valid (not expired, user still active) before trusting it.
    getMe()
      .then((me) => setUser(me))
      .catch(() => {
        localStorage.removeItem("cc_token");
        localStorage.removeItem("cc_user");
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(username, password) {
    const data = await apiLogin(username, password);
    localStorage.setItem("cc_token", data.access_token);
    localStorage.setItem("cc_user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }

  function logout() {
    localStorage.removeItem("cc_token");
    localStorage.removeItem("cc_user");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

/** Usage in any component: const { user, logout } = useAuth(); */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
