"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@open-mtlms/core";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Clock,
  Globe,
  HelpCircle,
  Info,
  ShieldCheck,
} from "lucide-react";

const FAQ_ITEMS = [
  {
    question: "Why Cloudflare? Can I use another DNS provider?",
    answer:
      "We recommend Cloudflare because it offers free DNS hosting, CNAME Flattening (required for root domains), and near-instant propagation. Other providers often can't add CNAME records on the root domain (@), which causes setup issues. You can technically use any provider that supports CNAME Flattening (e.g., Hostinger's ALIAS records), but Cloudflare is the most reliable and best-documented option.",
  },
  {
    question: "How do I change my nameservers to Cloudflare?",
    answer:
      "Log in to your domain registrar (where you purchased your domain, e.g., GoDaddy, Namecheap, Hostinger). Look for \"Nameservers\" or \"DNS Settings\" in your domain management area. Replace the existing nameservers with the two Cloudflare nameservers shown during the Cloudflare setup process. Your domain registration stays at your registrar, only DNS management moves to Cloudflare.",
  },
  {
    question: "What is CNAME Flattening and why does it matter?",
    answer:
      "The DNS standard doesn't allow CNAME records on root domains (e.g., example.com without www). Most providers enforce this restriction, which means your root domain can't point to our platform directly. Cloudflare's CNAME Flattening resolves the CNAME to an A record at query time, letting you use a CNAME on the root domain seamlessly. This means both example.com and www.example.com work without any forwarding hacks.",
  },
  {
    question: "Why must the DNS proxy be OFF (gray cloud)?",
    answer:
      "Our platform handles SSL certificates and traffic routing. When Cloudflare's proxy (orange cloud) is enabled, it intercepts traffic and applies its own SSL, which conflicts with our SSL provisioning and domain verification. Keep all records set to \"DNS only\" (gray cloud) to ensure everything works correctly.",
  },
  {
    question: "How long does DNS propagation take?",
    answer:
      "DNS records added in Cloudflare typically propagate within 5–15 minutes. Nameserver changes (switching from your registrar's DNS to Cloudflare) take 1–24 hours, though occasionally up to 48 hours. SSL certificate provisioning takes 15–30 minutes after DNS verification completes.",
  },
  {
    question: "Will changing nameservers affect my email?",
    answer:
      "When you add your domain to Cloudflare, it automatically scans and imports your existing DNS records, including MX records for email. Review the imported records carefully during setup to ensure your MX records are present. If they are, your email will continue working without interruption.",
  },
  {
    question: "My domain shows 'Pending Verification', what should I do?",
    answer:
      "Verify that: (1) the CNAME and TXT records are correctly added in Cloudflare, (2) proxy status is set to \"DNS only\" (gray cloud) for all records, (3) there are no conflicting A or AAAA records for the www hostname. If it's been more than 30 minutes, click \"Check Verification\" from the domain menu. Cloudflare DNS changes are usually fast, so the issue is typically a misconfigured record.",
  },
  {
    question: "Can I use a subdomain like learn.example.com?",
    answer:
      "Yes! Subdomains only need a single CNAME record and work with every DNS provider, no CNAME Flattening or root domain setup needed. Just add a CNAME record for \"learn\" (or your chosen subdomain) pointing to the target we provide. It's the simplest custom domain option.",
  },
];

export function DnsSetupGuide() {
  return (
    <div className="mt-8 space-y-6">
      {/* Quick Overview */}
      <div className="rounded-lg border bg-muted/30 p-6">
        <div className="flex items-start gap-3 mb-4">
          <BookOpen className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          <div>
            <h2 className="text-lg font-semibold">Custom Domain Setup Guide</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Connect your own domain in 3 simple steps. No technical expertise required.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <StepCard
            step={1}
            icon={<Globe className="h-4 w-4" />}
            title="Add your domain"
            description='Click "Add Custom Domain" above and enter your domain name (e.g., example.com or learn.example.com).'
          />
          <StepCard
            step={2}
            icon={<ShieldCheck className="h-4 w-4" />}
            title="Set up Cloudflare DNS"
            description="If not already on Cloudflare, migrate your nameservers (free). Then add the DNS records we provide."
          />
          <StepCard
            step={3}
            icon={<CheckCircle2 className="h-4 w-4" />}
            title="Wait for verification"
            description="We'll automatically verify your DNS and provision an SSL certificate. Your domain will be live shortly."
          />
        </div>
      </div>

      {/* Two-Flow Guide */}
      <div className="rounded-lg border p-6">
        <div className="flex items-start gap-3 mb-4">
          <HelpCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          <div>
            <h2 className="text-lg font-semibold">DNS Setup Instructions</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Follow both steps below to connect your custom domain via Cloudflare.
            </p>
          </div>
        </div>

        <Accordion type="multiple" defaultValue={["flow-a", "flow-b"]} className="w-full">
          {/* Flow A: Move DNS to Cloudflare */}
          <AccordionItem value="flow-a">
            <AccordionTrigger className="text-sm font-semibold text-left">
              <div>
                <span>Step A: Move Your DNS to Cloudflare</span>
                <span className="block text-xs font-normal text-muted-foreground mt-0.5">
                  Skip if your domain is already on Cloudflare
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              {/* Why Cloudflare */}
              <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                    <p className="font-medium text-blue-800 dark:text-blue-200">
                      Why Cloudflare?
                    </p>
                    <ul className="list-disc list-inside space-y-0.5">
                      <li>Free DNS hosting with industry-leading performance</li>
                      <li>
                        CNAME Flattening, allows root domain CNAME (most providers can&apos;t do
                        this)
                      </li>
                      <li>Fast propagation (seconds, not hours)</li>
                      <li>
                        Your domain stays registered at your current registrar, only DNS management
                        moves
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Steps */}
              <div className="space-y-3">
                {[
                  <>
                    Go to{" "}
                    <a
                      href="https://dash.cloudflare.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline underline-offset-2"
                    >
                      dash.cloudflare.com
                    </a>{" "}
                    and create a free account (or log in).
                  </>,
                  <>
                    Click <strong>&quot;Add a Site&quot;</strong> and enter your domain name (e.g.,{" "}
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">example.com</code>).
                  </>,
                  <>
                    Select the <strong>Free</strong> plan and click Continue.
                  </>,
                  <>
                    Cloudflare scans and imports your existing DNS records.{" "}
                    <strong>Review carefully</strong>, ensure MX records (email) and any other
                    important records are present.
                  </>,
                  <>
                    Cloudflare assigns two nameservers (e.g.,{" "}
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      ada.ns.cloudflare.com
                    </code>
                    ,{" "}
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      bob.ns.cloudflare.com
                    </code>
                    ). <strong>Copy both</strong>.
                  </>,
                  <>
                    Log in to your domain registrar (GoDaddy, Namecheap, Hostinger, etc.).
                  </>,
                  <>
                    Navigate to <strong>Nameservers</strong> or <strong>DNS Settings</strong>.
                  </>,
                  <>
                    Replace existing nameservers with the two Cloudflare nameservers. Save.
                  </>,
                  <>
                    Back in Cloudflare, click <strong>&quot;Check Nameservers&quot;</strong>.
                    Propagation takes 1–24 hours (sometimes up to 48h).
                  </>,
                ].map((step, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                      {i + 1}
                    </span>
                    <p className="text-sm text-foreground pt-0.5">{step}</p>
                  </div>
                ))}
              </div>

              {/* Reassurance note */}
              <div className="rounded-md bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">
                  Your domain registration stays at your current registrar. You&apos;re only
                  changing where DNS queries are handled. This is free and fully reversible.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Flow B: Add DNS Records */}
          <AccordionItem value="flow-b">
            <AccordionTrigger className="text-sm font-semibold text-left">
              <div>
                <span>Step B: Add DNS Records in Cloudflare</span>
                <span className="block text-xs font-normal text-muted-foreground mt-0.5">
                  Once your domain is on Cloudflare, add these records
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              {/* Example records table */}
              <div className="rounded-md border">
                <div className="grid grid-cols-5 gap-4 border-b bg-muted/50 px-4 py-3 text-xs font-medium">
                  <div>Type</div>
                  <div>Name</div>
                  <div>Target / Value</div>
                  <div>Proxy Status</div>
                  <div>Purpose</div>
                </div>
                <div className="border-b">
                  <div className="grid grid-cols-5 gap-4 px-4 py-3 text-xs">
                    <div className="font-mono">CNAME</div>
                    <div className="font-mono">www</div>
                    <div className="text-muted-foreground italic">
                      [shown after adding domain]
                    </div>
                    <div>DNS only ☁️</div>
                    <div className="text-muted-foreground">Points www to our platform</div>
                  </div>
                </div>
                <div className="border-b">
                  <div className="grid grid-cols-5 gap-4 px-4 py-3 text-xs">
                    <div className="font-mono">TXT</div>
                    <div className="text-muted-foreground italic">
                      [shown after adding domain]
                    </div>
                    <div className="text-muted-foreground italic">[verification token]</div>
                    <div>-</div>
                    <div className="text-muted-foreground">Verifies domain ownership</div>
                  </div>
                </div>
                <div>
                  <div className="grid grid-cols-5 gap-4 px-4 py-3 text-xs">
                    <div className="font-mono">CNAME</div>
                    <div className="font-mono">@</div>
                    <div className="font-mono">www.yourdomain.com</div>
                    <div>DNS only ☁️</div>
                    <div className="text-muted-foreground">
                      Root domain (CNAME Flattening)
                    </div>
                  </div>
                </div>
              </div>

              {/* Steps */}
              <div className="space-y-3">
                {[
                  <>
                    In Cloudflare dashboard, go to your domain → <strong>DNS</strong> →{" "}
                    <strong>Records</strong>.
                  </>,
                  <>
                    Click <strong>&quot;Add Record&quot;</strong>. Type: <strong>CNAME</strong>.
                    Name:{" "}
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">www</code>. Target:
                    paste the CNAME target from your domain&apos;s DNS records (shown above after
                    adding your domain).{" "}
                    <strong>
                      Set Proxy status to &quot;DNS only&quot; (click the orange cloud to turn it
                      gray).
                    </strong>{" "}
                    Save.
                  </>,
                  <>
                    Click <strong>&quot;Add Record&quot;</strong>. Type: <strong>TXT</strong>. Name:
                    paste the TXT record name shown in your DNS records. Content: paste the
                    verification value. Save.
                  </>,
                  <>
                    Click <strong>&quot;Add Record&quot;</strong>. Type: <strong>CNAME</strong>.
                    Name: <code className="rounded bg-muted px-1.5 py-0.5 text-xs">@</code>.
                    Target:{" "}
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      www.yourdomain.com
                    </code>{" "}
                    (replace with your actual domain).{" "}
                    <strong>Set Proxy status to &quot;DNS only&quot; (gray cloud).</strong> Save.
                  </>,
                ].map((step, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                      {i + 1}
                    </span>
                    <p className="text-sm text-foreground pt-0.5">{step}</p>
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground italic">
                Cloudflare automatically applies CNAME Flattening to the root (@) record, no extra
                configuration needed.
              </p>

              {/* Proxy warning */}
              <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-amber-700 dark:text-amber-300">
                    <p className="font-medium text-amber-800 dark:text-amber-200">
                      Keep DNS Proxy OFF (Gray Cloud)
                    </p>
                    <p className="mt-1">
                      For all CNAME records, the proxy status must show a gray cloud (&quot;DNS
                      only&quot;), not an orange cloud (&quot;Proxied&quot;). Our platform handles
                      SSL and routing, enabling Cloudflare&apos;s proxy interferes with domain
                      verification and SSL provisioning.
                    </p>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* Propagation Note */}
      <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-4">
        <div className="flex items-start gap-3">
          <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
              Propagation & Timing
            </p>
            <ul className="list-disc list-inside text-xs text-blue-700 dark:text-blue-300 mt-1 space-y-0.5">
              <li>DNS records in Cloudflare: 5–15 minutes</li>
              <li>Nameserver changes: 1–24 hours (up to 48h in rare cases)</li>
              <li>SSL provisioning: 15–30 minutes after DNS verification</li>
            </ul>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
              We automatically detect changes and activate your domain.
            </p>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">Frequently Asked Questions</h2>
        <Accordion type="single" collapsible className="w-full">
          {FAQ_ITEMS.map((item, i) => (
            <AccordionItem key={i} value={`faq-${i}`}>
              <AccordionTrigger className="text-sm text-left">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
}

function StepCard({
  step,
  icon,
  title,
  description,
}: {
  step: number;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
          {step}
        </span>
        <span className="text-muted-foreground">{icon}</span>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}
