import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { scrapeNetwork, generateEmbeddings, autoGenerateEmbeddings } from "@/lib/inngest/functions";

// Serve Inngest functions
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    scrapeNetwork,
    generateEmbeddings,
    autoGenerateEmbeddings,
  ],
});
