import { createFileRoute, Navigate } from "@tanstack/react-router"

import { GoogleLogo } from "@/components/google-logo"
import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"

export const Route = createFileRoute("/login")({
  component: LoginPage,
})

function LoginPage() {
  const { data: session, isPending } = authClient.useSession()

  if (isPending) {
    return null
  }

  if (session) {
    return <Navigate replace to="/" />
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">Sydney Suburbs</h1>
      <p className="text-muted-foreground">
        Sign in to track the suburbs you&rsquo;ve visited.
      </p>
      <Button
        size="lg"
        variant="outline"
        onClick={async () => {
          await authClient.signIn.social({
            provider: "google",
            callbackURL: "/",
          })
        }}
      >
        <GoogleLogo />
        Sign in with Google
      </Button>
    </main>
  )
}
