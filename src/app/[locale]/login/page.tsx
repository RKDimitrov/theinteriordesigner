import { useTranslations } from "next-intl";
import { LoginForm } from "@/components/layout/login-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function LoginPage({ searchParams }: PageProps<"/[locale]/login">) {
  const { error } = await searchParams;
  return <LoginView linkError={error === "link"} />;
}

function LoginView({ linkError }: { linkError: boolean }) {
  const t = useTranslations("Login");
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {linkError && (
            <Alert variant="destructive">
              <AlertDescription>{t("linkError")}</AlertDescription>
            </Alert>
          )}
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
