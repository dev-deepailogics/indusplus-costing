"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
import { GoogleIcon } from "@/components/auth/google-icon";
import { signInWithEmail, signInWithGoogle, signUpWithEmail } from "@/lib/auth/actions";
import { authErrorMessage } from "@/lib/auth/error-message";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "sign-in") {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password);
      }
      router.replace("/parameters");
    } catch (error) {
      toast.error(authErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogle() {
    setGoogleSubmitting(true);
    try {
      await signInWithGoogle();
      router.replace("/parameters");
    } catch (error) {
      toast.error(authErrorMessage(error));
    } finally {
      setGoogleSubmitting(false);
    }
  }

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
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={googleSubmitting}
            onClick={handleGoogle}
          >
            <GoogleIcon />
            Continue with Google
          </Button>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            or
            <div className="h-px flex-1 bg-border" />
          </div>

          <form className="space-y-3" onSubmit={handleSubmit}>
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
              onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
            >
              {mode === "sign-in" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
