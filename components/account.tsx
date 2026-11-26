"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Leaf } from "lucide-react";
import { login, register } from "../lib/storage";
import { PendingLabel, usePendingAction } from "./shared";

export function Account({ registerMode, ready }: { registerMode: boolean; ready: boolean }) {
  const router = useRouter();
  const { pending, run } = usePendingAction();
  const [registered, setRegistered] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const read = (name: string) => String(values.get(name) ?? "");
    if (!ready) return;
    run(() => {
      if (registerMode) setRegistered(register({
        name: read("name"), email: read("email"), password: read("password"),
        memberId: read("memberId"), contact: read("contact"),
      }));
      else router.push(login(read("email"), read("password")) === "admin" ? "/admin" : "/");
    }, registerMode ? "Registration submitted." : "Signed in.");
  }

  return <section className="wrap account-wrap">
    <div className="panel account-panel">
      <span className="brand-mark"><Leaf size={21} aria-hidden /></span>
      <h1>{registerMode ? "Register" : "Sign in"}</h1>
      <p className="muted">{registerMode ? "Use your cooperative member details to request access." : "Sign in to shop as a cooperative member or manage the market."}</p>
      {registered ? <div className="stack mt-6"><p className="callout" role="status">{registered}</p><Link className="button" href="/login">Sign in</Link></div> :
        <form onSubmit={submit} className="stack mt-6">
          {registerMode && <label>Name<input name="name" required maxLength={100} autoComplete="name" /></label>}
          <label>Email<input name="email" type="email" required maxLength={150} autoComplete="email" /></label>
          <div className="password-field">
            <label htmlFor="account-password">Password</label>
            <div className="password-input">
              <input
                id="account-password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={registerMode ? 6 : undefined}
                maxLength={100}
                autoComplete={registerMode ? "new-password" : "current-password"}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
              </button>
            </div>
          </div>
          {registerMode && <>
            <label>Member ID<input name="memberId" required maxLength={40} /></label>
            <label>Contact number<input name="contact" type="tel" required maxLength={20} autoComplete="tel" /></label>
          </>}
          <button className="button" disabled={!ready || Boolean(pending)}>
            {pending ? <PendingLabel>Processing...</PendingLabel> : registerMode ? "Create account" : "Sign in"}
          </button>
          <p className="muted text-sm">{registerMode ? "Already registered? " : "New to the market? "}<Link className="text-link" href={registerMode ? "/login" : "/register"}>{registerMode ? "Sign in" : "Register"}</Link></p>
        </form>}
    </div>
  </section>;
}
