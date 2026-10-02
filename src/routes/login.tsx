import { createFileRoute, Navigate } from "@tanstack/react-router"

import { GoogleLogo } from "@/components/google-logo"
import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"

// Only same-origin paths, so the login page can't bounce someone off-site.
// `//host` and `/\host` are protocol-relative to browsers.
const SAME_ORIGIN_PATH = /^\/(?![/\\])/

interface LoginSearch {
  redirect?: string
}

export const Route = createFileRoute("/login")({
  validateSearch: ({ redirect }): LoginSearch => {
    // Anything that isn't a path, like a number or a missing value, stringifies
    // to something the pattern rejects.
    const path = String(redirect)
    return { redirect: SAME_ORIGIN_PATH.test(path) ? path : undefined }
  },
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
