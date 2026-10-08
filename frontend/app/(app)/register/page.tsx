"use client";
import { useState } from "react";
import { apiUrl, fetchWithContext } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    try {
      const res = await fetchWithContext(`${apiUrl()}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.detail || `HTTP ${res.status}`);
      window.localStorage.setItem("token", j.access_token);
      window.location.href = "/dashboard";
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Registrasi gagal");
    }
  }
  return (
    <div className="mx-auto max-w-md">
      <h2 className="text-2xl font-bold">Register</h2>
      <Card className="mt-4">
        <CardContent className="pt-5">
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="name">Nama</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Password (min 8)</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {err && <Alert variant="destructive">{err}</Alert>}
            <Button type="submit">Register</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
