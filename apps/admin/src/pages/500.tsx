import type { NextPage } from "next";
import Head from "next/head";
import Link from "next/link";
import { ADMIN_APP_NAME } from "@/lib/brand";

/**
 * Custom 500 error page (Pages Router).
 * Ensures Next.js generates .next/export/500.html during build so the build rename step does not fail.
 */
const Custom500: NextPage = () => {
  return (
    <>
      <Head>
        <title>{`500 - Server Error | ${ADMIN_APP_NAME}`}</title>
      </Head>
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <h1 className="text-2xl font-bold">500 - Server Error</h1>
        <p className="mt-2 text-muted-foreground">Something went wrong on our side.</p>
        <Link href="/dashboard" className="mt-6 text-primary underline">
          Go to Dashboard
        </Link>
      </main>
    </>
  );
};

export default Custom500;
