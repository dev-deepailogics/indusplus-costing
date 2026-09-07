"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useLoginFacade } from "../hooks/useLoginFacade";

export function LoginForm() {
  const {
    mode,
    displayName,
    setDisplayName,
    email,
    setEmail,
    password,
    setPassword,
    submitting,
    handleSubmit,
    toggleMode,
  } = useLoginFacade();

  return (
    <div className="flex flex-1 items-center justify-center bg-muted/20 px-6">
      <Card className="w-full max-w-sm rounded-2xl shadow-sm">
        <CardHeader className="items-center text-center">
          <Image src="/logo-icon.png" alt="Indus Plus" width={48} height={48} priority />
          <CardTitle className="text-xl">
            {mode === "sign-in" ? "Sign in" : "Create an account"}
          </CardTitle>
          <CardDescription>Indus Plus Costing</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="space-y-3" onSubmit={handleSubmit}>
            {mode === "sign-up" && (
              <div className="space-y-1.5">
                <Label htmlFor="displayName">Display name</Label>
                <Input
                  id="displayName"
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoComplete="name"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {mode === "sign-in" ? "Sign in" : "Sign up"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            {mode === "sign-in" ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              type="button"
              className="font-medium text-primary underline-offset-4 hover:underline"
              onClick={toggleMode}
            >
              {mode === "sign-in" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
