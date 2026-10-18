import type { JSX } from "@solidjs/web"
import { Progress as ProgressPrimitive } from "base-ui-solid/progress"
import { cva, type VariantProps } from "class-variance-authority"
import { omit } from "solid-js"

import { cn } from "@/lib/utils"

const progressIndicatorVariants = cva("h-full transition-all", {
  variants: {
    variant: {
      default: "bg-primary",
      visited: "bg-map-visited",
    },
  },
  defaultVariants: {
    variant: "default",
  },
})

type ProgressProps = Omit<ProgressPrimitive.Root.Props, "class"> &
  VariantProps<typeof progressIndicatorVariants> & { class?: JSX.ClassValue }

function Progress(props: ProgressProps) {
  const rest = omit(props, "class", "children", "variant")
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      class={cn("flex flex-wrap gap-3", props.class)}
      {...rest}
    >
      {props.children}
      <ProgressPrimitive.Track
        class="relative flex h-1 w-full items-center overflow-x-hidden rounded-full bg-muted"
        data-slot="progress-track"
      >
        <ProgressPrimitive.Indicator
          data-slot="progress-indicator"
          class={progressIndicatorVariants({ variant: props.variant })}
        />
      </ProgressPrimitive.Track>
    </ProgressPrimitive.Root>
  )
}

export { Progress }
