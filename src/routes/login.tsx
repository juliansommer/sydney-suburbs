import { createFileRoute, Navigate } from "@tanstack/react-router"
import { z } from "zod/mini"

import { GoogleLogo } from "@/components/google-logo"
import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"

// Only same-origin paths, so the login page can't bounce someone off-site.
// `//host` and `/\host` are protocol-relative to browsers.
const redirectPath = z
  .string()
  .check(z.refine((path) => /^\/(?![/\\])/.test(path)))

interface LoginSearch {
  redirect?: string
}

export const Route = createFileRoute("/login")({
  validateSearch: (search): LoginSearch => ({
    redirect: redirectPath.safeParse(search.redirect).data,
  }),
  component: LoginPage,
})

function LoginPage() {
  const { data: session, isPending } = authClient.useSession()
  const redirect = Route.useSearch({ select: (s) => s.redirect ?? "/" })

  if (isPending) {
    return null
  }

  if (session) {
    // `href` wins over `to`, which is only there because the types need it.
    return <Navigate href={redirect} replace to="/" />
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
            callbackURL: redirect,
          })
        }}
      >
        <GoogleLogo />
        Sign in with Google
      </Button>
    </main>
  )
}
