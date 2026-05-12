import { notFound } from "next/navigation";
import { Button } from "@/components/ui/Button";

export const metadata = {
  title: "Design / Buttons",
  robots: { index: false, follow: false },
};

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[10rem_1fr] items-start gap-4 py-2 border-b border-bcolor/60">
      <div className="text-txtfade text-xs font-mono pt-2">{label}</div>
      <div className="flex flex-wrap items-start gap-3">{children}</div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-bcolor bg-secondary p-6">
      <h2 className="text-white text-lg font-semibold mb-4">{title}</h2>
      <div className="flex flex-col">{children}</div>
    </section>
  );
}

export default function ButtonsDesignPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="min-h-screen text-light font-sans p-8">
      <div className="max-w-5xl mx-auto flex flex-col gap-8">
        <header>
          <h1 className="text-2xl font-semibold text-white">
            Buttons — visual smoke test
          </h1>
          <p className="text-txtfade text-sm mt-1">
            Dev-only. Every variant × size × state of the canonical{" "}
            <code className="font-mono text-light">{"<Button>"}</code>{" "}
            primitive.
          </p>
        </header>

        <Section title="Execute (green gradient)">
          <Row label="Default">
            <Button variant="execute" action="Claim">
              Claim Bounty
            </Button>
          </Row>
          <Row label="Disabled">
            <Button variant="execute" action="Claim" disabled>
              Bounty conditions not met
            </Button>
          </Row>
          <Row label="Loading">
            <Button variant="execute" action="Claim" loading>
              Claim Bounty
            </Button>
          </Row>
          <Row label="Sizes">
            <div className="w-40">
              <Button variant="execute" action="Claim" size="sm">
                Claim
              </Button>
            </div>
            <div className="w-48">
              <Button variant="execute" action="Claim" size="md">
                Claim Bounty
              </Button>
            </div>
            <div className="w-56">
              <Button variant="execute" action="Claim" size="lg">
                Claim Bounty
              </Button>
            </div>
          </Row>
          <Row label="As link (internal)">
            <div className="w-56">
              <Button variant="execute" action="View" href="/bounties">
                View bounties
              </Button>
            </div>
          </Row>
          <Row label="Custom width">
            <Button variant="execute" action="Claim" className="w-auto">
              Claim
            </Button>
          </Row>
          <Row label="Pre-formatted">
            <div className="w-48">
              <Button variant="execute" action="Stake">
                [S]take
              </Button>
            </div>
          </Row>
        </Section>

        <Section title="Navigate (blue gradient)">
          <Row label="Default">
            <Button variant="navigate" action="Trade now">
              Trade now
            </Button>
          </Row>
          <Row label="Disabled">
            <Button variant="navigate" action="Trade now" disabled>
              Trade now
            </Button>
          </Row>
          <Row label="Loading">
            <Button variant="navigate" action="Trade now" loading>
              Trade now
            </Button>
          </Row>
          <Row label="Sizes">
            <div className="w-40">
              <Button variant="navigate" action="Trade" size="sm">
                Trade
              </Button>
            </div>
            <div className="w-48">
              <Button variant="navigate" action="Trade" size="md">
                Trade now
              </Button>
            </div>
            <div className="w-56">
              <Button variant="navigate" action="Trade" size="lg">
                Trade now
              </Button>
            </div>
          </Row>
          <Row label="External link">
            <div className="w-56">
              <Button
                variant="navigate"
                action="Open"
                href="https://adrena.trade"
              >
                Open Adrena
              </Button>
            </div>
          </Row>
          <Row label="Plain label">
            <div className="w-48">
              <Button variant="navigate">Back</Button>
            </div>
          </Row>
          <Row label="Legacy bracket (opt-in)">
            <div className="w-48">
              <Button variant="navigate" action="Buy" bracketPrefix>
                Buy ALP
              </Button>
            </div>
          </Row>
        </Section>

        <Section title="Outline (secondary)">
          <Row label="Default">
            <Button variant="outline">View all</Button>
          </Row>
          <Row label="With action">
            <Button variant="outline" action="Cancel">
              Cancel
            </Button>
          </Row>
          <Row label="Disabled">
            <Button variant="outline" disabled>
              Unavailable
            </Button>
          </Row>
          <Row label="Loading">
            <Button variant="outline" loading>
              Loading
            </Button>
          </Row>
          <Row label="Sizes">
            <Button variant="outline" size="sm">
              Small
            </Button>
            <Button variant="outline" size="md">
              Medium
            </Button>
            <Button variant="outline" size="lg">
              Large
            </Button>
          </Row>
          <Row label="Full width">
            <div className="w-56">
              <Button variant="outline" fullWidth>
                Full width outline
              </Button>
            </div>
          </Row>
        </Section>

        <Section title="Ghost (tertiary)">
          <Row label="Default">
            <Button variant="ghost">Dismiss</Button>
          </Row>
          <Row label="Disabled">
            <Button variant="ghost" disabled>
              Dismiss
            </Button>
          </Row>
          <Row label="Sizes">
            <Button variant="ghost" size="sm">
              Small
            </Button>
            <Button variant="ghost" size="md">
              Medium
            </Button>
            <Button variant="ghost" size="lg">
              Large
            </Button>
          </Row>
          <Row label="As link">
            <Button variant="ghost" href="/">
              Home
            </Button>
          </Row>
        </Section>
      </div>
    </main>
  );
}
