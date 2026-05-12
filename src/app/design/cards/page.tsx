import { notFound } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export const metadata = {
  title: "Design / Cards",
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
    <div className="grid grid-cols-[10rem_1fr] items-start gap-4 py-3 border-b border-bcolor/60">
      <div className="text-txtfade text-xs font-mono pt-2">{label}</div>
      <div className="flex flex-col gap-3">{children}</div>
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
    <section>
      <h2 className="text-white text-lg font-semibold mb-3">{title}</h2>
      <div className="flex flex-col">{children}</div>
    </section>
  );
}

export default function CardsDesignPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="min-h-screen bg-main text-light font-sans p-8">
      <div className="max-w-5xl mx-auto flex flex-col gap-10">
        <header>
          <h1 className="text-2xl font-semibold text-white">
            Cards — visual smoke test
          </h1>
          <p className="text-txtfade text-sm mt-1">
            Dev-only. Variants, nesting, interactive and padding behavior of the
            canonical <code className="font-mono text-light">{"<Card>"}</code>{" "}
            primitive.
          </p>
        </header>

        <Section title="Default">
          <Row label="Plain card">
            <Card>
              <p className="text-light">
                Just children, no title. Sits directly on the page background.
              </p>
            </Card>
          </Row>
          <Row label="With title">
            <Card title="Active Bounties">
              <p className="text-txtfade text-sm">12 currently active.</p>
            </Card>
          </Row>
          <Row label="Title + action">
            <Card
              title="Recent Claims"
              action={<Button variant="ghost" size="sm">View all</Button>}
            >
              <p className="text-txtfade text-sm">
                Action slot accepts any node — typically a ghost button.
              </p>
            </Card>
          </Row>
          <Row label="As link (internal)">
            <Card href="/bounties" title="Browse bounties">
              <p className="text-txtfade text-sm">
                Whole card is a Next Link. Hover should shift bg up one tone.
              </p>
            </Card>
          </Row>
          <Row label="Interactive">
            <div className="grid grid-cols-2 gap-3">
              <Card interactive>
                <p className="text-light text-sm">Interactive (hover me)</p>
              </Card>
              <Card>
                <p className="text-light text-sm">Static (no hover)</p>
              </Card>
            </div>
          </Row>
        </Section>

        <Section title="Nested">
          <Row label="Card in card">
            <Card title="Stats overview">
              <Card variant="nested">
                <p className="text-txtfade text-sm">
                  Nested card — sits inside another card. Background steps up.
                </p>
              </Card>
            </Card>
          </Row>
          <Row label="Nested w/ title">
            <Card title="Outer">
              <Card variant="nested" title="Inner">
                <p className="text-txtfade text-sm">
                  Header chrome works the same inside a nested card.
                </p>
              </Card>
            </Card>
          </Row>
          <Row label="3-level deep">
            <Card title="Level 1 (default)">
              <Card variant="nested" title="Level 2 (nested)">
                <Card variant="nested" title="Level 3 (nested again)">
                  <p className="text-txtfade text-sm">
                    Same nested variant repeated — note that level 3 looks
                    identical to level 2 because we don&apos;t have a deeper
                    tone in the ladder. This is why DESIGN.md caps nesting at
                    2 deep.
                  </p>
                </Card>
              </Card>
            </Card>
          </Row>
        </Section>

        <Section title="Disabled">
          <Row label="Claimed">
            <Card variant="disabled" title="Bounty claimed">
              <p className="text-txtfade text-sm">
                Uses bg-third and opacity-60. Not interactive even with{" "}
                <code className="font-mono">interactive</code> set.
              </p>
            </Card>
          </Row>
          <Row label="Disabled + interactive">
            <Card variant="disabled" interactive>
              <p className="text-light text-sm">
                Should NOT show hover state or pointer cursor.
              </p>
            </Card>
          </Row>
        </Section>

        <Section title="Bare">
          <Row label="Semantic group">
            <Card
              variant="bare"
              title="Filters"
              action={<Button variant="ghost" size="sm">Reset</Button>}
            >
              <p className="text-txtfade text-sm">
                No surface, no border — just provides the header chrome and
                groups content semantically.
              </p>
            </Card>
          </Row>
          <Row label="Children only">
            <Card variant="bare">
              <p className="text-txtfade text-sm">
                Pure passthrough. Useful for layout wrappers.
              </p>
            </Card>
          </Row>
        </Section>

        <Section title="Padding variants">
          <Row label="None">
            <Card padding="none">
              <div className="bg-inputcolor h-12 flex items-center justify-center text-txtfade text-xs">
                Full-bleed child (no padding)
              </div>
            </Card>
          </Row>
          <Row label="Small (p-4)">
            <Card padding="sm">
              <p className="text-txtfade text-sm">Dense — p-4</p>
            </Card>
          </Row>
          <Row label="Medium (p-6)">
            <Card padding="md">
              <p className="text-txtfade text-sm">Default — p-6</p>
            </Card>
          </Row>
          <Row label="Large (p-8)">
            <Card padding="lg">
              <p className="text-txtfade text-sm">Hero — p-8</p>
            </Card>
          </Row>
        </Section>

        <Section title="Composition">
          <Row label="BountyCard preview">
            <Card as="article" interactive title="Hit 5% PnL in 24h">
              <p className="text-txtfade text-sm mb-4">
                Open a position and close it with at least 5% profit before the
                timer runs out.
              </p>
              <Button variant="execute" action="Claim">
                Claim Bounty
              </Button>
            </Card>
          </Row>
        </Section>
      </div>
    </main>
  );
}
