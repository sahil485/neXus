import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { scrapeNetwork } from "@/lib/inngest/functions";

// Serve Inngest functions
// Note: RAG/embeddings now handled by Python backend
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    scrapeNetwork,
  ],
});
