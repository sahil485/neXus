import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { scrapeNetwork } from "@/lib/inngest/functions";

// Serve Inngest functions
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    scrapeNetwork,
    // Add more functions here as you build them
  ],
});

