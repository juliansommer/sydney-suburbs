import { lazy, Show } from "solid-js"

import {
  FactsRow,
  MoreDetails,
  SuburbMedia,
  Summary,
  useSuburbFacts,
} from "@/components/suburb-facts"
import {
  CloseButton,
  CouncilButton,
  PanelBody,
  type SuburbPanelProps,
} from "@/components/suburb-panel-body"
import { useMediaQuery } from "@/hooks/use-media-query"
import { preload } from "@/lib/load"

// Tailwind's `md`: a card beside the map from here up, a bottom sheet below.
const DESKTOP = "(min-width: 768px)"

// The drawer is most of the panel's weight, so only phones download it, as
// soon as the panel loads rather than when it first opens.
const SuburbSheet = lazy(async () => {
  const { SuburbSheet: component } = await import("@/components/suburb-sheet")
  return { default: component }
})
if (!window.matchMedia(DESKTOP).matches) {
  void preload(SuburbSheet.preload)
}

export function SuburbPanel(props: SuburbPanelProps) {
  const desktop = useMediaQuery(DESKTOP)
  return (
    <Show fallback={<SuburbSheet {...props} />} when={desktop()}>
      <SuburbCard {...props} />
    </Show>
  )
}

// The photo runs edge to edge across the top, with the close button over it.
function SuburbCard(props: SuburbPanelProps) {
  const facts = useSuburbFacts(() => props.suburb?.id)
  return (
    <Show when={props.suburb}>
      {(suburb) => (
        <section
          aria-label={suburb().name}
          class="absolute top-16 right-4 flex max-h-[calc(100dvh-5rem)] w-80 flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-lg"
        >
          <div class="absolute top-2 right-2 z-10 rounded-full bg-background/80 backdrop-blur-sm">
            <CloseButton onClose={props.onClose} />
          </div>
          <div class="overflow-y-auto">
            <SuburbMedia name={suburb().name} facts={facts()} />
            <div class="flex flex-col gap-4 p-4">
              <div class="flex flex-col gap-2">
                <header class="pr-8">
                  <h2 class="text-lg font-semibold">{suburb().name}</h2>
                  <p class="text-sm text-muted-foreground">
                    <CouncilButton
                      lga={suburb().lga}
                      onZoom={props.onZoomToCouncil}
                    />
                  </p>
                  <FactsRow facts={facts()} />
                </header>
                <Summary facts={facts()} />
                <MoreDetails
                  onToggleOverlay={props.onToggleOverlay}
                  overlay={props.overlay}
                  facts={facts()}
                />
              </div>
              <PanelBody signedIn={props.signedIn} suburbId={suburb().id} />
            </div>
          </div>
        </section>
      )}
    </Show>
  )
}
