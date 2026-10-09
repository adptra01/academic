import Hero from "@/components/public/hero";
import MethodsSummary from "@/components/public/methods-summary";
import WorkflowCore from "@/components/public/workflow-core";
import ClosingCta from "@/components/public/closing-cta";

/**
 * Welcome page — sengaja ringkas. Header, grain, dan footer datang dari
 * `(marketing)/layout.tsx`; rincian ada di `/metode`, `/alur`, `/reproduksi`.
 */
export default function Page() {
  return (
    <>
      <Hero />
      <MethodsSummary />
      <WorkflowCore />
      <ClosingCta />
    </>
  );
}
