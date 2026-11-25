"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Leaf } from "lucide-react";
import { login, register } from "../lib/storage";

export function Account({ registerMode, ready }: { registerMode: boolean; ready: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [registered, setRegistered] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const read = (name: string) => String(values.get(name) ?? "");
    setError("");
    try {
      if (registerMode) setRegistered(register({
        name: read("name"), email: read("email"), password: read("password"),
        memberId: read("memberId"), contact: read("contact"),
      }));
      else router.push(login(read("email"), read("password")) === "admin" ? "/admin" : "/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please try again.");
    }
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
          <label>Password<input name="password" type="password" required minLength={registerMode ? 6 : undefined} maxLength={100} autoComplete={registerMode ? "new-password" : "current-password"} /></label>
          {registerMode && <>
            <label>Member ID<input name="memberId" required maxLength={40} /></label>
            <label>Contact number<input name="contact" type="tel" required maxLength={20} autoComplete="tel" /></label>
          </>}
          {error && <p className="callout error-text" role="alert">{error}</p>}
          <button className="button" disabled={!ready}>{registerMode ? "Create account" : "Sign in"}</button>
          <p className="muted text-sm">{registerMode ? "Already registered? " : "New to the market? "}<Link className="text-link" href={registerMode ? "/login" : "/register"}>{registerMode ? "Sign in" : "Register"}</Link></p>
        </form>}
    </div>
  </section>;
}
