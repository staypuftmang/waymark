"use client";

import dynamic from "next/dynamic";

// FeedbackWidget mounts on every route via the root layout but is only
// activated when the user clicks the floating action button. Lazy-load
// it so the ~50 KB widget + screenshot upload code don't ride the
// initial bundle.
const FeedbackWidget = dynamic(() => import("./FeedbackWidget"), {
  ssr: false,
  loading: () => null,
});

export default function FeedbackWidgetLazy() {
  return <FeedbackWidget />;
}
