import { describe, expect, it } from "vitest"

import { resolveTitles } from "./titles.ts"
import {
  applyOverride,
  fallbackTitles,
  fileFromUrl,
  firstParagraph,
  titleFromUrl,
} from "./wikipedia.ts"

describe("fallbackTitles", () => {
  it("tries the NSW-qualified title before the bare name", () => {
    expect(fallbackTitles("Newtown")).toStrictEqual([
      "Newtown, New South Wales",
      "Newtown",
    ])
  })
})

describe("applyOverride", () => {
  const match = { title: "Sydney", image: "Sydney.jpg" }

  it("keeps the match when there's no override", () => {
    expect(applyOverride(match, undefined)).toStrictEqual(match)
  })

  it("lets an override replace the title", () => {
    expect(
      applyOverride(match, { title: "Sydney central business district" }),
    ).toStrictEqual({
      title: "Sydney central business district",
      image: "Sydney.jpg",
    })
  })

  it("lets an override say there is no article or image", () => {
    expect(applyOverride(match, { title: null, image: null })).toStrictEqual({
      title: null,
      image: null,
    })
  })
})

describe("Wikidata URLs", () => {
  it("turns an article URL into its title", () => {
    expect(
      titleFromUrl("https://en.wikipedia.org/wiki/Newtown,_New_South_Wales"),
    ).toBe("Newtown, New South Wales")
  })

  it("turns a Commons file path into its filename", () => {
    expect(
      fileFromUrl(
        "http://commons.wikimedia.org/wiki/Special:FilePath/King%20Street%20Newtown.jpg",
      ),
    ).toBe("King Street Newtown.jpg")
  })
})

describe("firstParagraph", () => {
  it("keeps only the first paragraph", () => {
    expect(firstParagraph("Alpha is a suburb.\nIt has a park.")).toBe(
      "Alpha is a suburb.",
    )
  })

  it("joins a line broken mid-sentence", () => {
    expect(
      firstParagraph("Frenchs Forest is \n20 kilometres north.\nMore."),
    ).toBe("Frenchs Forest is 20 kilometres north.")
  })

  it("returns null for an empty extract", () => {
    expect(firstParagraph("  ")).toBeNull()
  })
})

describe("resolveTitles", () => {
  it("follows normalisation and then redirects", () => {
    expect(
      resolveTitles("Sydney_CBD", {
        normalized: [{ from: "Sydney_CBD", to: "Sydney CBD" }],
        redirects: [
          { from: "Sydney CBD", to: "Sydney central business district" },
        ],
      }),
    ).toBe("Sydney central business district")
  })

  it("leaves a title the API didn't rename", () => {
    expect(resolveTitles("Mosman", undefined)).toBe("Mosman")
  })
})
