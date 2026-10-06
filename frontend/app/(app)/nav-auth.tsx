"use client";
import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/api";

export default function NavAuth() {
  const [logged, setLogged] = useState(false);
  useEffect(() => {
    setLogged(!!window.localStorage.getItem("token"));
  }, []);
  async function logout() {
    try {
      const token = window.localStorage.getItem("token");
      await fetch(`${apiUrl()}/api/v1/auth/logout`, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {} });
    } catch { /* abaikan */ }
    window.localStorage.removeItem("token");
    window.location.href = "/login";
  }
  if (!logged) {
    return (
      <>
        <a href="/login" className="text-blue-700 hover:underline">Login</a>
        <a href="/register" className="text-blue-700 hover:underline">Register</a>
      </>
    );
  }
  return <button onClick={() => void logout()} className="text-blue-700 hover:underline">Logout</button>;
}
