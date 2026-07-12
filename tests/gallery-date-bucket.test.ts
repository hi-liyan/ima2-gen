import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { dateBucket } from "../ui/src/lib/galleryUtils.ts";

describe("gallery date buckets", () => {
  it("uses browser-local calendar days rather than rolling 24-hour windows", () => {
    const generatedLastNight = new Date(2026, 6, 11, 23, 50).getTime();
    const shortlyAfterMidnight = new Date(2026, 6, 12, 0, 10);

    assert.equal(dateBucket(generatedLastNight, shortlyAfterMidnight, "zh-CN"), "yesterday");
  });

  it("formats older dates with the selected interface locale", () => {
    const generatedAt = new Date(2026, 6, 1, 12, 0);
    const now = new Date(2026, 6, 12, 12, 0);

    assert.equal(
      dateBucket(generatedAt.getTime(), now, "zh-CN"),
      generatedAt.toLocaleDateString("zh-CN", { year: "numeric", month: "short", day: "numeric" }),
    );
  });
});
