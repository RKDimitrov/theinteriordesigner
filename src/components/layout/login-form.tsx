"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/navigation";
import { sendMagicLinkAction, signInWithPasswordAction } from "@/server/actions/auth";

export function LoginForm() {
  const t = useTranslations("Login");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, startTransition] = useTransition();

  const signIn = () =>
    startTransition(async () => {
      const res = await signInWithPasswordAction({ email, password });
      if (!res.ok) return void toast.error(res.error);
      router.push("/apartments");
      router.refresh();
    });

  const sendLink = () =>
    startTransition(async () => {
      const res = await sendMagicLinkAction(email);
      if (res.ok) toast.success(t("linkSent"));
      else toast.error(res.error);
    });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        signIn();
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">{t("email")}</Label>
        <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">{t("password")}</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={pending || !password}>
        {t("signIn")}
      </Button>
      <Button type="button" variant="outline" disabled={pending || !email} onClick={sendLink}>
        {t("sendLink")}
      </Button>
    </form>
  );
}
